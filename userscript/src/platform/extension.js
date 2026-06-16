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
