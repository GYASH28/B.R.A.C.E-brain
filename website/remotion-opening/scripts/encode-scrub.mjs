import {spawnSync} from "node:child_process";
import {renameSync} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const build = path.resolve(root, "../builds/brace/assets");
const jobs = [
  ["brace-opening-source.mp4", "brace-opening.mp4"],
  ["brace-opening-portrait-source.mp4", "brace-opening-portrait.mp4"],
];

for (const [sourceName, outputName] of jobs) {
  const source = path.join(root, "out", sourceName);
  const temporary = path.join(build, `${outputName}.tmp.mp4`);
  const output = path.join(build, outputName);
  const result = spawnSync("ffmpeg", [
    "-y", "-i", source, "-an", "-c:v", "libx264", "-preset", "medium",
    "-crf", "24", "-pix_fmt", "yuv420p", "-g", "6", "-keyint_min", "6",
    "-sc_threshold", "0", "-bf", "0", "-movflags", "+faststart", temporary,
  ], {stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${sourceName} with exit code ${result.status}`);
  renameSync(temporary, output);
}
