import fs from "node:fs";

const filePath = "core/project-indexer.js";
let source = fs.readFileSync(filePath, "utf8");
const before = '  ".git", ".hg", ".svn", ".next", ".turbo", ".cache", ".idea",\n  ".vscode", ".venv", "__pycache__", "build", "coverage", "dist",';
const after = '  ".git", ".hg", ".svn", ".next", ".turbo", ".cache", ".idea",\n  ".obsidian", ".trash", ".vscode", ".venv", "__pycache__", "build", "coverage", "dist",';
if (!source.includes(after)) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error("Could not patch the project indexer ignore set safely.");
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
  fs.writeFileSync(filePath, source);
}
console.log("Applied note-vault metadata ignore defaults.");
