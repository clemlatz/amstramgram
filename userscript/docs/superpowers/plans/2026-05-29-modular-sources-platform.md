# Amstragram — Découpage en sources modulaires + couche Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper `amstragram.js` en fichiers sources dans `src/`, abstraire les appels GM_* derrière une interface `GramPlatform`, et produire le même `amstragram.js` via un script de build — préparation à une future migration en extension de navigateur.

**Architecture:** Les 13 modules `*_CORE` deviennent chacun un fichier dans `src/core/`. Les API Greasemonkey (`GM_xmlhttpRequest`, `GM_download`, `GM_openInTab`, `GM_registerMenuCommand`) sont encapsulées dans `src/platform/gm.js` derrière l'objet global `GramPlatform`. Le script `scripts/build.mjs` concatène les fichiers dans l'ordre pour produire `amstragram.js`. Lors de la migration extension, seul `src/platform/extension.js` changera.

**Tech Stack:** Node.js ESM (≥ 18), zéro dépendance npm.

---

## Contexte et observations

- `amstragram.js` fait 23 550 lignes. Le commentaire à la ligne 3598 confirme qu'il était déjà généré par un build.
- Les 11 premiers modules (lignes 31–2934) sont **purs** : aucune dépendance GM_*.
- `DOWNLOAD_PIPELINE_CORE` (lignes 2935–3595) utilise `GM_xmlhttpRequest`, `GM_download`, `GM_openInTab`.
- Le IIFE principal (lignes 3596–23550) utilise `GM_openInTab` et `GM_download` dans ses propres helpers (`openInNewTab`, `gmDownloadFile`), `GM_registerMenuCommand` à l'init, et `GM_getValue`/`GM_setValue` uniquement pour l'historique des téléchargements.
- **Les settings sont déjà dans `localStorage`** — seul l'historique passe par GM_getValue/GM_setValue (avec localStorage en fallback). Ce chemin GM sera supprimé : localStorage suffit.
- Le IIFE principal duplique `openInNewTab`/`gmDownloadFile` indépendamment de DOWNLOAD_PIPELINE_CORE. Les deux seront redirigés vers GramPlatform.

---

## Structure de fichiers finale

```
src/
  header.js                     ← bloc // ==UserScript==
  platform/
    gm.js                       ← GramPlatform (implémentation GM_*)
    extension.js                ← stub extension (chrome.*, à compléter plus tard)
  core/
    utilities.js                ← UTILITIES_CORE
    zip.js                      ← ZIP_CORE
    hotkey.js                   ← HOTKEY_CORE
    toast.js                    ← TOAST_CORE
    context-menu.js             ← CONTEXT_MENU_CORE
    dash-manifest.js            ← DASH_MANIFEST_CORE
    mp4-remux.js                ← MP4_REMUX_CORE
    mkv-mux.js                  ← MKV_MUX_CORE
    video-resolver.js           ← VIDEO_RESOLVER_CORE
    media-selection.js          ← MEDIA_SELECTION_CORE
    dm-lightspeed.js            ← DM_LIGHTSPEED_CORE
    download-pipeline.js        ← DOWNLOAD_PIPELINE_CORE (GM_* → GramPlatform)
  main.js                       ← IIFE principal (GM_* → GramPlatform)
scripts/
  build.mjs                     ← concat → amstragram.js
  extract.mjs                   ← (éphémère) coupe amstragram.js en src/
  verify.mjs                    ← vérifie que le build contient tous les modules
package.json
```

**Ordre de concaténation dans le build :**
`header.js` → `platform/gm.js` → `core/utilities.js` → `core/zip.js` → `core/hotkey.js` → `core/toast.js` → `core/context-menu.js` → `core/dash-manifest.js` → `core/mp4-remux.js` → `core/mkv-mux.js` → `core/video-resolver.js` → `core/media-selection.js` → `core/dm-lightspeed.js` → `core/download-pipeline.js` → `main.js`

---

## Interface GramPlatform

```js
GramPlatform = {
  fetchUrl({ method, url, headers, responseType, timeout })
    → Promise<{ status: number, response: any, responseText: string }>

  downloadFile(url, filename, options = { saveAs?, timeoutMs? })
    → Promise<boolean>

  openTab(url, options = { active? })
    → void

  openMultipleTabs(urls)
    → void

  registerMenuCommand(label, fn)
    → void
}
```

`GramPlatform` est défini comme une const globale dans `src/platform/gm.js` avant tous les autres modules.

---

## Tâche 1 — Scaffold : package.json, build, verify

**Files:**
- Create: `package.json`
- Create: `scripts/build.mjs`
- Create: `scripts/verify.mjs`

- [ ] **Step 1 : Créer `package.json`**

```json
{
  "name": "amstragram",
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "verify": "node scripts/verify.mjs"
  }
}
```

- [ ] **Step 2 : Créer `scripts/build.mjs`**

```js
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC  = join(ROOT, "src");
const OUT  = join(ROOT, "amstragram.js");

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
  "main.js",
];

const output = FILES.map(f => readFileSync(join(SRC, f), "utf8")).join("\n");
writeFileSync(OUT, output, "utf8");
console.log(`Built amstragram.js — ${output.length.toLocaleString()} chars, ${output.split("\n").length.toLocaleString()} lines`);
```

- [ ] **Step 3 : Créer `scripts/verify.mjs`**

```js
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

const gmCalls = ["GM_xmlhttpRequest", "GM_download", "GM_openInTab",
                 "GM_registerMenuCommand", "GM_getValue", "GM_setValue"];
for (const call of gmCalls) {
  const count = (built.match(new RegExp(call, "g")) || []).length;
  if (count > 0) {
    // Expected: GM calls should only appear in gm.js (inside GramPlatform) and in @grant lines
    // Count occurrences in the platform section only — any outside are leaks
    const platformSection = built.split("const GramPlatform =")[1]?.split("})();")[0] || "";
    const inPlatform = (platformSection.match(new RegExp(call, "g")) || []).length;
    const inHeader = (built.split("const GramPlatform =")[0].match(new RegExp(call, "g")) || []).length;
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
```

- [ ] **Step 4 : Vérifier que les scripts Node s'exécutent sans erreur**

Les fichiers `src/` n'existent pas encore — le build va échouer, c'est normal.

```bash
node --version
```

Expected : v18.x ou supérieur.

- [ ] **Step 5 : Commit**

```bash
git add package.json scripts/build.mjs scripts/verify.mjs
git commit -m "chore: add build scaffold (concat) and verify script"
```

---

## Tâche 2 — Extraction des modules dans `src/`

**Files:**
- Create: `scripts/extract.mjs` (éphémère)
- Create: `src/header.js`
- Create: `src/core/utilities.js` … `src/core/dm-lightspeed.js` (11 fichiers)
- Create: `src/core/download-pipeline.js` (temporaire, avant refactoring Platform)
- Create: `src/main.js` (temporaire, avant refactoring Platform)

- [ ] **Step 1 : Créer `scripts/extract.mjs`**

Ce script lit `amstragram.js` et découpe chaque module dans son fichier source. À exécuter **une seule fois** puis supprimer.

```js
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const raw  = readFileSync(join(ROOT, "amstragram.js"), "utf8");
const lines = raw.split("\n");

// Numéros de ligne 1-indexés (comme cat -n) — début et fin inclusifs
const SEGMENTS = [
  { file: "src/header.js",                  start: 1,    end: 30   },
  { file: "src/core/utilities.js",          start: 31,   end: 155  },
  { file: "src/core/zip.js",                start: 156,  end: 299  },
  { file: "src/core/hotkey.js",             start: 300,  end: 385  },
  { file: "src/core/toast.js",              start: 386,  end: 423  },
  { file: "src/core/context-menu.js",       start: 424,  end: 520  },
  { file: "src/core/dash-manifest.js",      start: 521,  end: 669  },
  { file: "src/core/mp4-remux.js",          start: 670,  end: 1690 },
  { file: "src/core/mkv-mux.js",           start: 1691, end: 2352 },
  { file: "src/core/video-resolver.js",     start: 2353, end: 2567 },
  { file: "src/core/media-selection.js",    start: 2568, end: 2805 },
  { file: "src/core/dm-lightspeed.js",      start: 2806, end: 2934 },
  { file: "src/core/download-pipeline.js",  start: 2935, end: 3595 },
  { file: "src/main.js",                    start: 3596, end: lines.length },
];

for (const { file, start, end } of SEGMENTS) {
  const dir = join(ROOT, file.split("/").slice(0, -1).join("/"));
  mkdirSync(dir, { recursive: true });
  const content = lines.slice(start - 1, end).join("\n");
  writeFileSync(join(ROOT, file), content, "utf8");
  console.log(`${file} — ${content.split("\n").length} lignes`);
}
console.log("Extraction terminée.");
```

- [ ] **Step 2 : Exécuter l'extraction**

```bash
node scripts/extract.mjs
```

Expected : 14 lignes de log (une par fichier), "Extraction terminée."

- [ ] **Step 3 : Vérifier que chaque fichier commence par la bonne déclaration**

```bash
head -1 src/header.js src/core/utilities.js src/core/zip.js src/core/mp4-remux.js src/core/download-pipeline.js src/main.js
```

Expected :
- `src/header.js` → `// ==UserScript==`
- `src/core/utilities.js` → `const UTILITIES_CORE = (() => {`
- `src/core/zip.js` → `const ZIP_CORE = (() => {`
- `src/core/mp4-remux.js` → `// stts/stsc/...` (commentaire avant `const MP4_REMUX_CORE`)
- `src/core/download-pipeline.js` → commentaire ou `const DOWNLOAD_PIPELINE_CORE`
- `src/main.js` → `(function () {`

- [ ] **Step 4 : Tester un premier build (avant Platform)**

Ajouter temporairement un placeholder vide pour `src/platform/gm.js` :

```bash
mkdir -p src/platform && echo "// GramPlatform placeholder" > src/platform/gm.js
node scripts/build.mjs
```

Expected : `Built amstragram.js — N chars, N lines`

- [ ] **Step 5 : Vérifier la structure du build (avant Platform — les fuites GM sont attendues ici)**

```bash
node -e "
const { readFileSync } = await import('fs');
const s = readFileSync('amstragram.js', 'utf8');
const mods = ['UTILITIES_CORE','ZIP_CORE','HOTKEY_CORE','TOAST_CORE','CONTEXT_MENU_CORE',
  'DASH_MANIFEST_CORE','MP4_REMUX_CORE','MKV_MUX_CORE','VIDEO_RESOLVER_CORE',
  'MEDIA_SELECTION_CORE','DM_LIGHTSPEED_CORE','DOWNLOAD_PIPELINE_CORE',
  'FILE_METADATA_CORE','DATE_FILTER_CORE','STORY_MATCHING_CORE'];
mods.forEach(m => { if (!s.includes('const ' + m)) console.error('MANQUANT: ' + m); });
console.log('Modules présents.');
" --input-type=module
```

Expected : "Modules présents." (pas d'erreur MANQUANT).

- [ ] **Step 6 : Commit**

```bash
git add src/ scripts/extract.mjs
git commit -m "chore: extract all modules into src/ (pre-Platform refactor)"
```

---

## Tâche 3 — Couche Platform : `src/platform/gm.js` + stub extension

**Files:**
- Modify: `src/platform/gm.js`
- Create: `src/platform/extension.js`

`GramPlatform` doit être défini **avant** tous les modules core dans l'ordre de concaténation. Il est placé en deuxième position dans le build (après `header.js`).

- [ ] **Step 1 : Écrire `src/platform/gm.js`**

Les implémentations de `downloadFile` et `openTab` sont adaptées depuis les fonctions `gmDownloadFile` et `openInNewTab` existantes dans `DOWNLOAD_PIPELINE_CORE` (lignes 3041–3098 du `src/core/download-pipeline.js` extrait).

```js
const GramPlatform = (() => {
  function fetchUrl({ method = "GET", url, headers = {}, responseType = "text", timeout = 30000 }) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest is unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        responseType,
        timeout,
        onload:   (r) => resolve({ status: r.status, response: r.response, responseText: r.responseText }),
        onerror:  (err) => reject(new Error(err?.error || String(err) || "GM_xmlhttpRequest failed")),
        ontimeout: () => reject(Object.assign(new Error("GM_xmlhttpRequest timed out"), { code: "GM_DOWNLOAD_TIMEOUT" })),
      });
    });
  }

  function downloadFile(url, filename, options = {}) {
    const saveAs = typeof options?.saveAs === "boolean" ? options.saveAs : false;
    const timeoutMs = (Number.isFinite(Number(options?.timeoutMs)) && Number(options.timeoutMs) > 0)
      ? Math.floor(Number(options.timeoutMs))
      : 20000;

    return new Promise((resolve, reject) => {
      if (typeof GM_download !== "function") {
        reject(new Error("GM_download unavailable"));
        return;
      }

      let settled = false;
      let manualTimeoutId = null;
      let downloadTask = null;

      function settle(next) {
        if (settled) return;
        settled = true;
        if (manualTimeoutId !== null) { clearTimeout(manualTimeoutId); manualTimeoutId = null; }
        next();
      }

      function toError(value) {
        if (value instanceof Error) { if (!value.code) value.code = "GM_DOWNLOAD_ERROR"; return value; }
        const msg = (typeof value === "string" && value.trim()) ? value.trim()
          : (value?.error || value?.message) ? String(value.error || value.message)
          : "GM_download failed";
        return Object.assign(new Error(msg), { code: "GM_DOWNLOAD_ERROR" });
      }

      try {
        downloadTask = GM_download({
          url,
          name: filename,
          saveAs,
          onload:   () => settle(() => resolve(true)),
          onerror:  (err) => settle(() => reject(toError(err))),
          ontimeout: () => settle(() => reject(Object.assign(new Error("GM_download timed out"), { code: "GM_DOWNLOAD_TIMEOUT" }))),
        });
        manualTimeoutId = setTimeout(() => {
          settle(() => reject(Object.assign(new Error(`GM_download timed out after ${timeoutMs}ms`), { code: "GM_DOWNLOAD_TIMEOUT" })));
          try { downloadTask?.abort?.(); } catch {}
        }, timeoutMs);
      } catch (err) {
        settle(() => reject(toError(err)));
      }
    });
  }

  function openTab(url, options = {}) {
    const targetUrl = typeof url === "string" ? url.trim() : "";
    if (!targetUrl) return;
    if (typeof GM_openInTab === "function") {
      try { GM_openInTab(targetUrl, { active: options.active !== false, insert: true, setParent: true }); return; } catch {}
      try { GM_openInTab(targetUrl, options.active !== false); return; } catch {}
    }
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  function openMultipleTabs(urls) {
    const unique = Array.from(new Set(
      (Array.isArray(urls) ? urls : []).map(u => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
    ));
    if (unique.length === 0) return;
    if (typeof GM_openInTab === "function") {
      unique.forEach((u, i) => openTab(u, { active: i === 0 }));
      return;
    }
    unique.forEach(u => window.open(u, "_blank", "noopener,noreferrer"));
  }

  function registerMenuCommand(label, fn) {
    if (typeof GM_registerMenuCommand === "function") {
      try { GM_registerMenuCommand(label, fn); } catch {}
    }
  }

  return { fetchUrl, downloadFile, openTab, openMultipleTabs, registerMenuCommand };
})();
```

- [ ] **Step 2 : Écrire `src/platform/extension.js`** (stub — sera complété lors de la migration extension)

Ce fichier ne doit jamais être inclus dans le build userscript. Il sert de point de départ documenté pour la future migration.

```js
// src/platform/extension.js
// Implémentation Chrome Extension de GramPlatform.
// À inclure à la place de platform/gm.js dans le build extension.
//
// fetchUrl  : déléguer à un background service worker via chrome.runtime.sendMessage
//             pour contourner les restrictions CORS du content script.
// downloadFile : chrome.downloads.download
// openTab      : chrome.tabs.create
// openMultipleTabs : plusieurs chrome.tabs.create
// registerMenuCommand : chrome.contextMenus.create (à appeler depuis background, pas content script)

const GramPlatform = (() => {
  function fetchUrl(options) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "GRAM_FETCH", options }, (result) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (result?.error) { reject(new Error(result.error)); return; }
        resolve(result);
      });
    });
  }

  function downloadFile(url, filename, _options = {}) {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        resolve(typeof downloadId === "number");
      });
    });
  }

  function openTab(url, options = {}) {
    chrome.tabs.create({ url, active: options.active !== false });
  }

  function openMultipleTabs(urls) {
    const unique = Array.from(new Set(
      (Array.isArray(urls) ? urls : []).map(u => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
    ));
    unique.forEach((u, i) => openTab(u, { active: i === 0 }));
  }

  function registerMenuCommand(_label, _fn) {
    // Les commandes de menu extension sont déclarées dans le background service worker
    // via chrome.contextMenus.create — pas depuis un content script.
  }

  return { fetchUrl, downloadFile, openTab, openMultipleTabs, registerMenuCommand };
})();
```

- [ ] **Step 3 : Commit**

```bash
git add src/platform/gm.js src/platform/extension.js
git commit -m "feat: add GramPlatform interface with GM and extension stubs"
```

---

## Tâche 4 — Refactoring de `src/core/download-pipeline.js`

**Files:**
- Modify: `src/core/download-pipeline.js`

`DOWNLOAD_PIPELINE_CORE` contient ses propres implémentations de `gmDownloadFile`, `openInNewTab`, `openMultipleInNewTabs`, et les appels directs à `GM_xmlhttpRequest`. Ces fonctions sont remplacées par des délégations à `GramPlatform`.

> **Repères dans `src/core/download-pipeline.js`** (numéros de ligne relatifs au fichier extrait, qui commence à la ligne 2935 de `amstragram.js` original) :
> - La fonction `gmRequestJson` appelle `GM_xmlhttpRequest` (chercher `GM_xmlhttpRequest` dans le fichier)
> - La fonction `gmRequestBinary` appelle `GM_xmlhttpRequest`
> - La fonction `gmFetchBlob` appelle `GM_xmlhttpRequest`
> - Les fonctions `openInNewTab` et `openMultipleInNewTabs` appellent `GM_openInTab`
> - La fonction `gmDownloadFile` appelle `GM_download`

- [ ] **Step 1 : Vérifier les occurrences à remplacer**

```bash
grep -n "GM_xmlhttpRequest\|GM_download\|GM_openInTab" src/core/download-pipeline.js
```

Noter les numéros de ligne pour les étapes suivantes.

- [ ] **Step 2 : Remplacer les appels GM_xmlhttpRequest dans les fonctions de fetch**

Pour chaque fonction qui construit un appel `GM_xmlhttpRequest({ method, url, headers, responseType, ... })`, remplacer le corps par un appel à `GramPlatform.fetchUrl`.

**Avant** (pattern général dans `gmRequestJson`) :
```js
function gmRequestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== "function") {
      reject(new Error("GM_xmlhttpRequest is unavailable"));
      return;
    }
    GM_xmlhttpRequest({
      method: options.method || "GET",
      url,
      headers: options.headers || {},
      responseType: "text",
      timeout: options.timeout || 30000,
      onload: (r) => { /* ... */ resolve(parseJsonFromGmResponse(r)); },
      onerror: (err) => reject(/* ... */),
      ontimeout: () => reject(/* ... */),
    });
  });
}
```

**Après** :
```js
function gmRequestJson(url, options = {}) {
  return GramPlatform.fetchUrl({
    method: options.method || "GET",
    url,
    headers: options.headers || {},
    responseType: "text",
    timeout: options.timeout || 30000,
  }).then(r => parseJsonFromGmResponse(r));
}
```

Appliquer le même principe à `gmRequestBinary` et `gmFetchBlob` (adapter selon leur logique de traitement de la réponse — responseType "arraybuffer" ou "blob").

> **Note :** `parseJsonFromGmResponse` et les traitements de réponse binaire restent inchangés — seul l'appel GM est remplacé.

- [ ] **Step 3 : Remplacer les fonctions openInNewTab et openMultipleInNewTabs**

Localiser les fonctions `openInNewTab` et `openMultipleInNewTabs` dans `src/core/download-pipeline.js`.

**Avant** :
```js
function openInNewTab(url, options = {}) {
  const targetUrl = typeof url === "string" ? url.trim() : "";
  if (!targetUrl) return;
  if (typeof GM_openInTab === "function") {
    try { GM_openInTab(targetUrl, { ... }); return; } catch {}
    try { GM_openInTab(targetUrl, options.active !== false); return; } catch {}
  }
  window.open(targetUrl, "_blank", "noopener,noreferrer");
}
```

**Après** :
```js
function openInNewTab(url, options = {}) {
  GramPlatform.openTab(url, options);
}

function openMultipleInNewTabs(urls) {
  GramPlatform.openMultipleTabs(urls);
}
```

- [ ] **Step 4 : Remplacer gmDownloadFile**

Localiser la fonction `gmDownloadFile` dans `src/core/download-pipeline.js`.

**Avant** : fonction de ~60 lignes appelant `GM_download` directement.

**Après** :
```js
function gmDownloadFile(url, filename, options = null) {
  return GramPlatform.downloadFile(url, filename, options);
}
```

- [ ] **Step 5 : Vérifier qu'il ne reste aucun appel GM direct**

```bash
grep -n "GM_xmlhttpRequest\|GM_download\|GM_openInTab" src/core/download-pipeline.js
```

Expected : aucun résultat.

- [ ] **Step 6 : Build + vérification partielle**

```bash
node scripts/build.mjs
grep -c "GM_xmlhttpRequest\|GM_download\|GM_openInTab" amstragram.js
```

Le count doit correspondre uniquement aux lignes `@grant` du header + aux occurrences dans `platform/gm.js` + aux occurrences restantes dans `src/main.js` (pas encore refactoré).

- [ ] **Step 7 : Commit**

```bash
git add src/core/download-pipeline.js
git commit -m "refactor: replace GM_* calls in DOWNLOAD_PIPELINE_CORE with GramPlatform"
```

---

## Tâche 5 — Refactoring du IIFE principal (`src/main.js`)

**Files:**
- Modify: `src/main.js`

Le IIFE principal contient ses propres copies de `openInNewTab`, `openMultipleInNewTabs`, `gmDownloadFile` (section "DOWNLOAD HELPER", repérable avec le commentaire `// =========================================` autour de la ligne correspondant à ~13093 dans `amstragram.js` original). Il utilise aussi `GM_getValue`/`GM_setValue` pour l'historique et `GM_registerMenuCommand` à l'init.

- [ ] **Step 1 : Repérer les fonctions à remplacer dans src/main.js**

```bash
grep -n "GM_xmlhttpRequest\|GM_download\|GM_openInTab\|GM_registerMenuCommand\|GM_getValue\|GM_setValue" src/main.js
```

Relever les numéros de ligne. Il doit y avoir :
- `GM_openInTab` : 2 occurrences (dans `openInNewTab` et `openMultipleInNewTabs`)
- `GM_download` : dans `gmDownloadFile`
- `GM_registerMenuCommand` : 1 occurrence (init)
- `GM_getValue` : 1 occurrence (historique downloads)
- `GM_setValue` : 1 occurrence (historique downloads)

- [ ] **Step 2 : Remplacer la section "DOWNLOAD HELPER" dans main.js**

Localiser le bloc `// DOWNLOAD HELPER` (chercher ce commentaire dans `src/main.js`). Il contient `openInNewTab`, `openMultipleInNewTabs`, `gmDownloadFile`.

Remplacer les corps de ces trois fonctions pour déléguer à GramPlatform (même pattern qu'en Tâche 4, Step 3 et 4) :

```js
function openInNewTab(url, options = {}) {
  GramPlatform.openTab(url, options);
}

function openMultipleInNewTabs(urls) {
  GramPlatform.openMultipleTabs(urls);
}

function gmDownloadFile(url, filename, options = null) {
  return GramPlatform.downloadFile(url, filename, options);
}
```

- [ ] **Step 3 : Remplacer GM_registerMenuCommand**

Localiser dans `src/main.js` le bloc :
```js
if (typeof GM_registerMenuCommand === "function") {
  try {
    GM_registerMenuCommand("Amstragram: Settings", openSettingsModal);
  } catch (err) { ... }
}
```

Remplacer par :
```js
GramPlatform.registerMenuCommand("Amstragram: Settings", openSettingsModal);
```

- [ ] **Step 4 : Supprimer les chemins GM_getValue/GM_setValue de l'historique**

Localiser les fonctions `readDownloadHistoryStorageValue` et `writeDownloadHistoryStorageValue` dans `src/main.js`.

**Avant** :
```js
function readDownloadHistoryStorageValue() {
  if (typeof GM_getValue === "function") {
    try {
      const stored = GM_getValue(DOWNLOAD_HISTORY_STORAGE_KEY, "");
      if (typeof stored === "string" && stored.trim()) return stored;
      if (Array.isArray(stored)) return stored;
    } catch (err) { ... }
  }
  try {
    return localStorage.getItem(DOWNLOAD_HISTORY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeDownloadHistoryStorageValue(serialized) {
  let wrote = false;
  if (typeof GM_setValue === "function") {
    try {
      GM_setValue(DOWNLOAD_HISTORY_STORAGE_KEY, serialized);
      wrote = true;
    } catch (err) { ... }
  }
  if (!wrote) {
    try {
      localStorage.setItem(DOWNLOAD_HISTORY_STORAGE_KEY, serialized);
    } catch (err) { ... }
  }
}
```

**Après** (localStorage uniquement — déjà le fallback, fonctionnellement identique) :
```js
function readDownloadHistoryStorageValue() {
  try {
    return localStorage.getItem(DOWNLOAD_HISTORY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeDownloadHistoryStorageValue(serialized) {
  try {
    localStorage.setItem(DOWNLOAD_HISTORY_STORAGE_KEY, serialized);
  } catch {}
}
```

- [ ] **Step 5 : Vérifier qu'il ne reste aucun appel GM direct dans main.js**

```bash
grep -n "GM_xmlhttpRequest\|GM_download\|GM_openInTab\|GM_registerMenuCommand\|GM_getValue\|GM_setValue" src/main.js
```

Expected : aucun résultat.

- [ ] **Step 6 : Commit**

```bash
git add src/main.js
git commit -m "refactor: replace GM_* calls in main IIFE with GramPlatform"
```

---

## Tâche 6 — Build final, vérification et nettoyage

**Files:**
- Modify: `amstragram.js` (remplacé par le build)
- Delete: `scripts/extract.mjs`
- Modify: `.gitignore` (optionnel)

- [ ] **Step 1 : Build final**

```bash
node scripts/build.mjs
```

Expected : `Built amstragram.js — ~30 000 000 chars, ~23 550 lines` (valeurs approchées)

- [ ] **Step 2 : Vérification complète**

```bash
node scripts/verify.mjs
```

Expected : `OK — build vérifié, aucune fuite GM détectée`

Si des fuites sont détectées, chercher dans le fichier signalé :
```bash
grep -n "GM_download\|GM_xmlhttpRequest\|GM_openInTab\|GM_registerMenuCommand\|GM_getValue\|GM_setValue" src/core/download-pipeline.js src/main.js
```

Corriger puis recommencer depuis Step 1.

- [ ] **Step 3 : Vérifier que le userscript est toujours valide**

```bash
head -25 amstragram.js
```

Expected : le bloc `// ==UserScript==` est présent en tête de fichier.

```bash
grep -c "const GramPlatform" amstragram.js
```

Expected : `1`

```bash
grep -n "const GramPlatform\|const UTILITIES_CORE\|const DOWNLOAD_PIPELINE_CORE\|(function () {" amstragram.js | head -10
```

Expected : GramPlatform apparaît avant UTILITIES_CORE, qui apparaît avant DOWNLOAD_PIPELINE_CORE, qui apparaît avant `(function () {`.

- [ ] **Step 4 : Test en navigateur**

Installer le `amstragram.js` builté dans Tampermonkey. Vérifier :
1. Le panneau Settings s'ouvre (raccourci ou bouton)
2. Un téléchargement individuel (clic droit → télécharger) fonctionne
3. Un téléchargement en bulk s'initialise

- [ ] **Step 5 : Supprimer le script d'extraction**

```bash
git rm scripts/extract.mjs
```

- [ ] **Step 6 : Optionnel — ajouter `.gitignore`**

Si vous voulez ignorer les fichiers temporaires de build futurs :

```bash
echo "node_modules/" >> .gitignore
git add .gitignore
```

- [ ] **Step 7 : Commit final**

```bash
git add amstragram.js scripts/
git commit -m "feat: migrate amstragram.js to modular sources + GramPlatform abstraction"
```

---

## Post-migration : utiliser le build au quotidien

À partir de maintenant, **ne jamais éditer `amstragram.js` directement**. Workflow :

1. Modifier le fichier source approprié dans `src/`
2. `npm run build` → regénère `amstragram.js`
3. `npm run verify` → vérifie l'intégrité
4. Recharger le script dans Tampermonkey

Pour la future migration extension :
- Créer `scripts/build-extension.mjs` qui utilise esbuild/Rollup
- Remplacer `platform/gm.js` par `platform/extension.js` dans la liste des fichiers
- Ajouter `manifest.json` à la racine

---

## Auto-review

**Couverture spec :**
- [x] Découpage en fichiers sources → Tâches 1-2
- [x] Couche Platform pour userscript → Tâche 3
- [x] Refactoring DOWNLOAD_PIPELINE_CORE → Tâche 4
- [x] Refactoring IIFE principal → Tâche 5
- [x] Build final vérifié → Tâche 6
- [x] Stub extension documenté → Tâche 3, Step 2
- [x] Suppression chemins GM_getValue/GM_setValue → Tâche 5, Step 4

**Vérifications :**
- Pas de TODO ou TBD dans le code des tâches — les stubs extension sont explicitement marqués comme "à compléter lors de la migration extension"
- Les signatures GramPlatform sont consistantes entre platform/gm.js (Tâche 3), download-pipeline.js (Tâche 4) et main.js (Tâche 5)
- `openMultipleTabs` (GramPlatform) / `openMultipleInNewTabs` (nom local inchangé dans main.js) — la délégation dans Tâche 5 Step 2 couvre cet écart de nommage
