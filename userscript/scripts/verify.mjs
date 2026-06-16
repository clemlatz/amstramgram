import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const built = readFileSync(join(ROOT, "amstragram.js"), "utf8");

const EXPECTED_MODULES = [
  "UTILITIES_CORE", "ZIP_CORE", "HOTKEY_CORE", "TOAST_CORE",
  "CONTEXT_MENU_CORE", "DASH_MANIFEST_CORE", "MP4_REMUX_CORE",
  "MKV_MUX_CORE", "VIDEO_RESOLVER_CORE", "MEDIA_SELECTION_CORE",
  "DM_LIGHTSPEED_CORE", "DOWNLOAD_PIPELINE_CORE",
  "FILE_METADATA_CORE", "DATE_FILTER_CORE", "STORY_MATCHING_CORE",
];

const EXPECTED_STRINGS = [
  "// ==UserScript==",
  "// ==/UserScript==",
  "const GramPlatform =",
  "(function () {",
  '"use strict";',
];

let errors = 0;

for (const mod of EXPECTED_MODULES) {
  if (!built.includes(`const ${mod} =`)) {
    console.error(`MANQUANT module: ${mod}`);
    errors++;
  }
}

for (const str of EXPECTED_STRINGS) {
  if (!built.includes(str)) {
    console.error(`MANQUANT chaîne: ${str}`);
    errors++;
  }
}

// Strip comments and string literals before counting active calls.
// We look for actual invocations: `GM_X(` or `typeof GM_X` — not mentions in comments or strings.
const gmCalls = ["GM_xmlhttpRequest", "GM_download", "GM_openInTab",
                 "GM_registerMenuCommand", "GM_getValue", "GM_setValue"];

// Remove single-line comments, block comments, and string literals from the text
// so that references inside them are not counted as active calls.
function stripCommentsAndStrings(src) {
  // Order matters: handle strings before comments so quoted // is not treated as a comment start.
  return src
    // Template literals (simplified — removes content between backticks)
    .replace(/`[^`\\]*(?:\\[\s\S][^`\\]*)*`/g, '""')
    // Double-quoted strings
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    // Single-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    // Block comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Single-line comments
    .replace(/\/\/[^\n]*/g, "");
}

const builtStripped = stripCommentsAndStrings(built);

for (const call of gmCalls) {
  // Only match actual call sites: `GM_X(` or `typeof GM_X`
  const activePattern = new RegExp(`(?:typeof\\s+${call}|${call}\\s*\\()`, "g");
  const count = (builtStripped.match(activePattern) || []).length;
  if (count > 0) {
    const platformMatch = builtStripped.match(/const GramPlatform = \(\(\) => \{[\s\S]*?\}\)\(\);/);
    const platformSection = platformMatch ? platformMatch[0] : "";
    const inPlatform = (platformSection.match(activePattern) || []).length;
    const inHeader = (builtStripped.split("const GramPlatform =")[0].match(activePattern) || []).length;
    const leaks = count - inPlatform - inHeader;
    if (leaks > 0) {
      console.error(`FUITE GM: ${call} apparaît ${leaks} fois hors de GramPlatform`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log("OK — build vérifié, aucune fuite GM détectée");
} else {
  console.error(`\n${errors} erreur(s) détectée(s)`);
  process.exit(1);
}
