const GramPlatform = (() => {
  function fetchUrl({ method = "GET", url, headers = {}, responseType = "text", timeout = 30000, withCredentials = true }) {
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
        withCredentials,
        onload: (r) => resolve({ status: r.status, response: r.response, responseText: r.responseText }),
        onerror: (err) => reject(new Error(err?.error || String(err) || "GM_xmlhttpRequest failed")),
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
          onload: () => settle(() => resolve(true)),
          onerror: (err) => settle(() => reject(toError(err))),
          ontimeout: () => settle(() => reject(Object.assign(new Error("GM_download timed out"), { code: "GM_DOWNLOAD_TIMEOUT" }))),
        });
        manualTimeoutId = setTimeout(() => {
          settle(() => reject(Object.assign(new Error(`GM_download timed out after ${timeoutMs}ms`), { code: "GM_DOWNLOAD_TIMEOUT" })));
          try { downloadTask?.abort?.(); } catch {}
        }, timeoutMs);
      } catch (err) {
        const exceptionError = err instanceof Error ? err : new Error(String(err?.message || err));
        exceptionError.code = "GM_DOWNLOAD_EXCEPTION";
        settle(() => reject(exceptionError));
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
