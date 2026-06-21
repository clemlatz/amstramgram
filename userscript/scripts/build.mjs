import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC  = join(ROOT, "src");
const OUT  = join(ROOT, "amstragram.js");
const PKG  = join(ROOT, "package.json");

// Bump patch version in package.json
const pkg = JSON.parse(readFileSync(PKG, "utf8"));
pkg.version = String(Number(pkg.version) + 1);
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n", "utf8");

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
}).join("\n").replace("__VERSION__", pkg.version);

writeFileSync(OUT, output, "utf8");
console.log(`Built amstragram.js v${pkg.version} — ${output.length.toLocaleString()} chars, ${output.split("\n").length.toLocaleString()} lines`);
