import { dialog, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ConnectorId = "codex" | "claude" | "antigravity" | "generic";
export type ConnectorAccess = "read-only" | "remember";

interface ConnectorOptions {
  userDataPath: string;
  executablePath: string;
  appPath: string;
  getWindow: () => BrowserWindow | null;
}

interface LaunchDefinition {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ConfigBackup {
  path: string | null;
  existed: boolean;
}

const CLIENTS: Record<ConnectorId, {
  name: string;
  commandNames: string[];
  description: string;
}> = {
  codex: {
    name: "Codex CLI",
    commandNames: ["codex"],
    description: "OpenAI's coding agent with native MCP management.",
  },
  claude: {
    name: "Claude Code",
    commandNames: ["claude"],
    description: "Anthropic's coding agent with local stdio MCP support.",
  },
  antigravity: {
    name: "Antigravity",
    commandNames: ["agy", "antigravity"],
    description: "Google's Antigravity CLI and IDE share one MCP configuration.",
  },
  generic: {
    name: "Any MCP client",
    commandNames: [],
    description: "A portable JSON block for clients that support local stdio MCP.",
  },
};

function executableExtensions() {
  if (process.platform !== "win32") return [""];
  return String(process.env.PATHEXT || ".EXE;.CMD;.BAT")
    .split(";")
    .map((extension) => extension.toLowerCase());
}

function candidateBins(name: string) {
  const extensions = executableExtensions();
  const fromPath = String(process.env.PATH || process.env.Path || "")
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) =>
      extensions.map((extension) =>
        path.join(directory, extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name),
      ),
    );
  const home = os.homedir();
  const common = [
    path.join(home, ".local", "bin", name),
    path.join(home, ".npm-global", "bin", name),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "npm", `${name}.cmd`)
      : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Programs", name, `${name}.exe`)
      : null,
  ].filter((candidate): candidate is string => Boolean(candidate));
  const nvmRoot = path.join(home, ".nvm", "versions", "node");
  if (fs.existsSync(nvmRoot)) {
    for (const version of fs.readdirSync(nvmRoot)) {
      common.push(path.join(nvmRoot, version, "bin", name));
    }
  }
  return [...new Set([...fromPath, ...common])];
}

function findExecutable(names: string[]) {
  for (const name of names) {
    for (const candidate of candidateBins(name)) {
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Missing candidates are expected during detection.
      }
    }
  }
  return null;
}

function readJson(filePath: string, fallback: any) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function connectionInstruction() {
  return [
    "Use BRACE as the durable memory layer for this user.",
    "Search BRACE before asking the user to repeat project context, prior decisions, preferences, or lessons.",
    "Keep durable memory separate from indexed source evidence and cite brace-project URIs when evidence is available.",
    "Do not store credentials, raw transcripts, hidden chain-of-thought, or guesses as memory.",
    "When a session produces an explicit durable decision, lesson, preference, or next-step handoff, retain only that concise outcome through BRACE's write tools when they are enabled.",
  ].join(" ");
}

export class BraceConnectorService {
  private readonly options: ConnectorOptions;
  private readonly backupDirectory: string;

  constructor(options: ConnectorOptions) {
    this.options = options;
    this.backupDirectory = path.join(options.userDataPath, "connector-backups");
  }

  launchDefinition(access: ConnectorAccess = "read-only"): LaunchDefinition {
    const windowsMcp = process.platform === "win32";
    const env: Record<string, string> = {
      ...(windowsMcp
        ? { ELECTRON_RUN_AS_NODE: "1", BRACE_MCP_DIRECT: "1" }
        : {}),
      ...(access === "remember" ? { BRACE_MCP_WRITE: "1" } : {}),
    };
    return {
      command: this.options.executablePath,
      args: windowsMcp
        ? [path.join(this.options.appPath, "dist", "mcp", "brace-mcp.cjs")]
        : ["--mcp"],
      ...(Object.keys(env).length ? { env } : {}),
    };
  }

  genericConfig(access: ConnectorAccess = "read-only") {
    return {
      mcpServers: {
        brace: this.launchDefinition(access),
      },
    };
  }

  private antigravityConfigPath() {
    return path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
  }

  private clientConfigPath(id: ConnectorId) {
    if (id === "codex") return path.join(os.homedir(), ".codex", "config.toml");
    if (id === "claude") return path.join(os.homedir(), ".claude.json");
    if (id === "antigravity") return this.antigravityConfigPath();
    return null;
  }

  private backup(id: ConnectorId) {
    const source = this.clientConfigPath(id);
    if (!source || !fs.existsSync(source)) {
      return { path: null, existed: false } satisfies ConfigBackup;
    }
    fs.mkdirSync(this.backupDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(
      this.backupDirectory,
      `${id}-${safeTimestamp()}${path.extname(source) || ".bak"}`,
    );
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target, 0o600);
    return { path: target, existed: true } satisfies ConfigBackup;
  }

  private restoreBackup(id: ConnectorId, backup: ConfigBackup) {
    const target = this.clientConfigPath(id);
    if (!target) return;
    if (!backup.existed) {
      if (fs.existsSync(target)) fs.rmSync(target, { force: true });
      return;
    }
    if (!backup.path || !fs.existsSync(backup.path)) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(backup.path, target);
  }

  private async version(executablePath: string | null) {
    if (!executablePath) return null;
    try {
      const result = await execFileAsync(executablePath, ["--version"], {
        timeout: 5_000,
        windowsHide: true,
        maxBuffer: 64_000,
      });
      return String(result.stdout || result.stderr || "")
        .trim()
        .split(/\r?\n/)[0]
        .slice(0, 120) || null;
    } catch {
      return null;
    }
  }

  private codexConfigured() {
    const filePath = this.clientConfigPath("codex");
    if (!filePath || !fs.existsSync(filePath)) return false;
    const source = fs.readFileSync(filePath, "utf8");
    return /^\[mcp_servers\.brace\]/m.test(source);
  }

  private claudeConfigured() {
    const filePath = this.clientConfigPath("claude");
    if (!filePath || !fs.existsSync(filePath)) return false;
    const config = readJson(filePath, {});
    const pools = [config?.mcpServers, config?.user?.mcpServers];
    if (pools.some((pool) => Boolean(pool?.brace))) return true;
    return Object.values(config?.projects || {}).some((project: any) =>
      Boolean(project?.mcpServers?.brace),
    );
  }

  private antigravityConfigured() {
    const config = readJson(this.antigravityConfigPath(), {});
    return Boolean(config?.mcpServers?.brace);
  }

  private isConfigured(id: ConnectorId) {
    if (id === "codex") return this.codexConfigured();
    if (id === "claude") return this.claudeConfigured();
    if (id === "antigravity") return this.antigravityConfigured();
    return false;
  }

  async list() {
    const results = await Promise.all(
      (Object.keys(CLIENTS) as ConnectorId[]).map(async (id) => {
        const client = CLIENTS[id];
        const executablePath = findExecutable(client.commandNames);
        const configured = this.isConfigured(id);
        return {
          id,
          name: client.name,
          description: client.description,
          detected: id === "generic" || Boolean(executablePath),
          executablePath,
          version: await this.version(executablePath),
          configured,
          configPath: this.clientConfigPath(id),
          supportsInstall: id !== "generic",
          instruction: connectionInstruction(),
          readOnlyConfig: this.genericConfig("read-only"),
          rememberConfig: this.genericConfig("remember"),
        };
      }),
    );
    return results;
  }

  private async run(executablePath: string, args: string[]) {
    return execFileAsync(executablePath, args, {
      timeout: 20_000,
      windowsHide: true,
      maxBuffer: 512_000,
    });
  }

  executableFor(id: ConnectorId) {
    if (!Object.hasOwn(CLIENTS, id)) return null;
    return findExecutable(CLIENTS[id].commandNames);
  }

  async runAssistant(
    id: "codex" | "claude",
    prompt: string,
    workingDirectory: string,
  ) {
    const executablePath = this.executableFor(id);
    if (!executablePath) {
      throw new Error(`${CLIENTS[id].name} is not installed or is not visible to BRACE.`);
    }
    const args = id === "codex"
      ? [
          "exec",
          "--sandbox",
          "read-only",
          "--skip-git-repo-check",
          "--ephemeral",
          "--color",
          "never",
          "-C",
          workingDirectory,
          prompt,
        ]
      : [
          "-p",
          "--permission-mode",
          "plan",
          "--no-session-persistence",
          prompt,
        ];
    const result = await execFileAsync(executablePath, args, {
      cwd: workingDirectory,
      timeout: 300_000,
      windowsHide: true,
      maxBuffer: 2_000_000,
      env: process.env,
    });
    const output = String(result.stdout || "").trim();
    if (!output) {
      const detail = String(result.stderr || "").trim().slice(-1_000);
      throw new Error(detail || `${CLIENTS[id].name} returned no response.`);
    }
    return {
      client: id,
      response: output.slice(0, 200_000),
      stderr: String(result.stderr || "").trim().slice(-4_000),
    };
  }

  private async installCodex(
    executablePath: string,
    access: ConnectorAccess,
  ) {
    if (this.codexConfigured()) {
      await this.run(executablePath, ["mcp", "remove", "brace"]);
    }
    const definition = this.launchDefinition(access);
    const args = ["mcp", "add"];
    for (const [key, value] of Object.entries(definition.env || {})) {
      args.push("--env", `${key}=${value}`);
    }
    args.push("brace", "--", definition.command, ...definition.args);
    await this.run(executablePath, args);
  }

  private async installClaude(
    executablePath: string,
    access: ConnectorAccess,
  ) {
    if (this.claudeConfigured()) {
      await this.run(executablePath, ["mcp", "remove", "brace", "--scope", "user"]);
    }
    const definition = this.launchDefinition(access);
    const args = [
      "mcp",
      "add",
      "--scope",
      "user",
      "--transport",
      "stdio",
      "brace",
    ];
    for (const [key, value] of Object.entries(definition.env || {})) {
      args.push("--env", `${key}=${value}`);
    }
    args.push("--", definition.command, ...definition.args);
    await this.run(executablePath, args);
  }

  private installAntigravity(access: ConnectorAccess) {
    const filePath = this.antigravityConfigPath();
    const config = readJson(filePath, {});
    const next = {
      ...config,
      mcpServers: {
        ...(config.mcpServers || {}),
        brace: this.launchDefinition(access),
      },
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.brace-${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    fs.renameSync(temporary, filePath);
  }

  async install(id: ConnectorId, access: ConnectorAccess) {
    if (!Object.hasOwn(CLIENTS, id) || id === "generic") {
      throw new Error("Choose a detected AI client for guided setup.");
    }
    if (!new Set<ConnectorAccess>(["read-only", "remember"]).has(access)) {
      throw new Error("Choose read-only or remember access.");
    }
    const window = this.options.getWindow();
    if (!window) throw new Error("The BRACE window is unavailable.");
    const executablePath = findExecutable(CLIENTS[id].commandNames);
    if (!executablePath) {
      throw new Error(`${CLIENTS[id].name} is not installed or is not visible to BRACE.`);
    }
    const approval = await dialog.showMessageBox(window, {
      type: "question",
      title: `Connect ${CLIENTS[id].name} to BRACE?`,
      message:
        access === "remember"
          ? "Allow this client to recall and save explicit durable outcomes."
          : "Allow this client to recall BRACE memory in read-only mode.",
      detail: [
        "BRACE will add one local stdio MCP server named ‘brace’ to this client's configuration.",
        "A recoverable backup is created first. No API key is requested or copied.",
        access === "remember"
          ? "The client may write non-destructive memories and decisions. Forgetting remains disabled."
          : "The client cannot change or forget BRACE memory.",
        "Retrieved memory may be sent to the model provider according to that client's own privacy policy.",
      ].join("\n\n"),
      buttons: ["Cancel", "Connect"],
      defaultId: 0,
      cancelId: 0,
    });
    if (approval.response !== 1) return { connected: false, cancelled: true };

    const backup = this.backup(id);
    try {
      if (id === "codex") await this.installCodex(executablePath, access);
      if (id === "claude") await this.installClaude(executablePath, access);
      if (id === "antigravity") this.installAntigravity(access);
      if (!this.isConfigured(id)) {
        throw new Error(
          `${CLIENTS[id].name} did not preserve the BRACE server entry after setup.`,
        );
      }
      return {
        connected: true,
        cancelled: false,
        backupPath: backup.path,
        client: id,
        access,
      };
    } catch (error) {
      this.restoreBackup(id, backup);
      throw new Error(
        `BRACE could not configure ${CLIENTS[id].name}. The previous configuration was restored. ${
          error instanceof Error ? error.message : "Unknown setup error."
        }`,
      );
    }
  }
}
