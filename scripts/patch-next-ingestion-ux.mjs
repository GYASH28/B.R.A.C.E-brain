import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Found ${label} more than once.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patch(filePath, transforms) {
  let source = fs.readFileSync(filePath, "utf8");
  for (const [before, after, label] of transforms) source = replaceOnce(source, before, after, label);
  fs.writeFileSync(filePath, source);
}

patch("electron/memory-service.ts", [
  [
    '      title: "Import a project into BRACE",',
    '      title: "Import a project folder or note vault into BRACE",',
    "native import dialog title",
  ],
]);

patch("src/components/brace/brace-app.tsx", [
  [
    '<p>Opening the encrypted local index. No network request is required.</p>',
    '<p>Opening your local SQLite index. No network request is required.</p>',
    "accurate startup privacy copy",
  ],
  [
    '              Choose one project folder. BRACE makes its useful context searchable and ready for the AI tools you connect.',
    '              Choose a project folder or note vault. BRACE makes supported text searchable in place and ready for the AI tools you connect.',
    "onboarding import description",
  ],
  [
    '<FolderInput className="h-4 w-4" /> Choose a project folder',
    '<FolderInput className="h-4 w-4" /> Choose a folder or vault',
    "onboarding import button",
  ],
  [
    '<OnboardingStep number="01" icon={FolderInput} title="Choose a folder" text="Pick one project. BRACE reads supported files without moving or editing them." />',
    '<OnboardingStep number="01" icon={FolderInput} title="Choose a folder or vault" text="Pick a project, Markdown/plain-text folder, or Obsidian-style vault. BRACE reads supported files without moving or editing them." />',
    "onboarding import step",
  ],
]);

console.log("Applied BRACE first-class note-vault ingestion UX and accurate local-storage copy.");
