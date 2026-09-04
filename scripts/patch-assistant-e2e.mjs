#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const file = path.resolve("scripts/electron-e2e.js");
let source = fs.readFileSync(file, "utf8");
const oldAssertion = '  const memoryHandoffReady = await window.webContents.executeJavaScript("document.querySelector(\'.ai-composer textarea\')?.value.includes(\'Use this durable BRACE memory as the starting context\') && document.body.innerText.includes(\'Draft stays on this device until you send it.\')");';
const newAssertion = `  const memoryHandoffReady = await window.webContents.executeJavaScript(\`\n    (() => {\n      const draft = document.querySelector('.ai-composer textarea')?.value || '';\n      const preview = Array.from(document.querySelectorAll('.ai-composer button')).find((button) => button.textContent?.trim() === 'Preview context');\n      const send = Array.from(document.querySelectorAll('.ai-composer button')).find((button) => button.textContent?.includes('Send'));\n      return draft.includes('Use this durable BRACE memory as the starting context') &&\n        Boolean(preview) &&\n        document.body.innerText.includes('Retrieved context may be sent to the selected provider.') &&\n        document.body.innerText.includes('Preview the exact') &&\n        Boolean(send?.disabled);\n    })()\n  \`);`;

if (!source.includes(newAssertion)) {
  if (!source.includes(oldAssertion)) throw new Error("Assistant E2E patch could not locate the legacy handoff assertion.");
  source = source.replace(oldAssertion, newAssertion);
}

fs.writeFileSync(file, source.replace(/\r\n/g, "\n"));
process.stdout.write("Updated Electron E2E for preview-first Ask BRACE handoff.\n");
