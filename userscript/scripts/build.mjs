import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC  = join(ROOT, "src");
const OUT  = join(ROOT, "amstragram.js");

const version = execSync("git rev-list --count HEAD", { cwd: ROOT }).toString().trim();

// For a browser extension build, swap "platform/gm.js" for "platform/extension.js"
// and add a manifest.json + background service worker.
const FILES = [
  "header.js",
  "platform/gm.js",
  "core/utilities.js",
  "core/zip.js",
  "core/hotkey.js",
  "core/toast.js",
  "core/context-menu.js",
  "core/dash-manifest.js",
  "core/mp4-remux.js",
  "core/mkv-mux.js",
  "core/video-resolver.js",
  "core/media-selection.js",
  "core/dm-lightspeed.js",
  "core/download-pipeline.js",
  "core/file-metadata.js",
  "core/date-filter.js",
  "core/story-matching.js",
  "core/settings-schema.js",
  "core/styles.js",
  "main.js",
];

const output = FILES.map(f => {
  const filePath = join(SRC, f);
  try {
    return readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Missing file: src/${f} — ${err.message}`);
    process.exit(1);
  }
}).join("\n").replace("__VERSION__", version);

writeFileSync(OUT, output, "utf8");
console.log(`Built amstragram.js v${version} — ${output.length.toLocaleString()} chars, ${output.split("\n").length.toLocaleString()} lines`);
