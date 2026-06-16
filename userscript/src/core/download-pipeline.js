const DOWNLOAD_PIPELINE_CORE = (() => {
  // Keep filename sanitization local so this module stays standalone during extraction.
  function sanitizeFilenameToken(value, fallback = "") {
    const source = value === null || value === undefined ? "" : String(value);
    const cleaned = source
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");
    return (cleaned || fallback).slice(0, 120);
  }

  function sanitizeOutputFilename(value, fallback = "instagram_media") {
    return sanitizeFilenameToken(value, fallback).slice(0, 220);
  }

  function parseJsonFromGmResponse(response) {
    if (response?.response && typeof response.response === "object") {
      return response.response;
    }

    const raw = typeof response?.responseText === "string"
      ? response.responseText
      : (typeof response?.response === "string" ? response.response : "");

    if (!raw) return null;

    const parseCandidates = [];
    const trimmed = raw.trim();
    parseCandidates.push(trimmed);

    // Common anti-JSON-hijacking prefixes used by some endpoints.
    parseCandidates.push(trimmed.replace(/^\)\]\}'\s*/, ""));
    parseCandidates.push(trimmed.replace(/^for\s*\(;;\);\s*/, ""));
    parseCandidates.push(trimmed.replace(/^while\s*\(1\);\s*/, ""));

    for (const candidate of parseCandidates) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // Try next candidate.
      }
    }

    // Last resort: parse from first JSON object/array boundary.
    const firstObj = trimmed.indexOf("{");
    const lastObj = trimmed.lastIndexOf("}");
    if (firstObj !== -1 && lastObj > firstObj) {
      try {
        return JSON.parse(trimmed.slice(firstObj, lastObj + 1));
      } catch {
        // Fall through.
      }
    }

    const firstArr = trimmed.indexOf("[");
    const lastArr = trimmed.lastIndexOf("]");
    if (firstArr !== -1 && lastArr > firstArr) {
      try {
        return JSON.parse(trimmed.slice(firstArr, lastArr + 1));
      } catch {
        // Fall through.
      }
    }

    return null;
  }

  function gmRequestJson(url, headers) {
    return GramPlatform.fetchUrl({ method: "GET", url, headers, responseType: "text", withCredentials: true, timeout: 20000 })
      .then(r => {
        if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
        const data = parseJsonFromGmResponse(r);
        if (data === null) throw new Error("Invalid JSON response");
        return data;
      });
  }

  function openInNewTab(url, options = {}) {
    GramPlatform.openTab(url, options);
  }

  function openMultipleInNewTabs(urls) {
    GramPlatform.openMultipleTabs(urls);
  }

  function gmDownloadFile(url, filename, options = null) {
    return GramPlatform.downloadFile(url, filename, options || {});
  }

  function normalizeBinaryPayloadToBlob(payload) {
    if (payload instanceof Blob) {
      return payload;
    }
    if (payload instanceof ArrayBuffer) {
      return new Blob([payload]);
    }
    if (ArrayBuffer.isView(payload)) {
      const view = payload;
      const copy = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
      return new Blob([copy]);
    }
    throw new Error("Unsupported binary response payload");
  }

  function gmRequestBinary(url, responseType) {
    return GramPlatform.fetchUrl({ method: "GET", url, responseType, withCredentials: true, timeout: 20000 })
      .then(r => {
        const status = Number(r?.status);
        const body = r?.response;
        const hasBody = body !== null && typeof body !== "undefined";
        if (((status >= 200 && status < 300) || (status === 0 && hasBody)) && hasBody) return body;
        throw new Error(`HTTP ${Number.isFinite(status) ? status : "unknown"}`);
      });
  }

  async function gmFetchBlob(url) {
    try {
      const arrayBufferPayload = await gmRequestBinary(url, "arraybuffer");
      return normalizeBinaryPayloadToBlob(arrayBufferPayload);
    } catch {
      // Retry as blob below.
    }

    const blobPayload = await gmRequestBinary(url, "blob");
    return normalizeBinaryPayloadToBlob(blobPayload);
  }

  async function fetchMediaBlob(url) {
    try {
      return await gmFetchBlob(url);
    } catch {
      // Fall back to page fetch below.
    }

    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.blob();
  }

  function createNamedBinaryFile(blob, filename) {
    if (!(blob instanceof Blob)) return null;
    if (typeof File !== "function") return blob;
    try {
      return new File(
        [blob],
        sanitizeOutputFilename(filename || "instagram_media", "instagram_media"),
        { type: blob.type || "application/octet-stream" }
      );
    } catch {
      return blob;
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      if (!(blob instanceof Blob)) {
        reject(new Error("blobToDataUrl requires a Blob"));
        return;
      }
      if (typeof FileReader !== "function") {
        reject(new Error("FileReader unavailable"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string" && result.startsWith("data:")) {
          resolve(result);
          return;
        }
        reject(new Error("Failed to read blob as data URL"));
      };
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  }

  // Read a Blob's bytes into a Uint8Array allocated in the calling realm.
  // Firefox + Tampermonkey hand back cross-realm Blobs from GM_xmlhttpRequest;
  // calling `await blob.arrayBuffer()` directly returns an Xrays-wrapped buffer
  // and constructing a TypedArray on it throws "Accessing TypedArray data over
  // Xrays is slow, and forbidden..." FileReader copies the bytes through the
  // browser's internal pathway into a same-realm ArrayBuffer.
  function readBlobAsBytes(blob) {
    return new Promise((resolve, reject) => {
      if (!(blob instanceof Blob)) {
        reject(new Error("readBlobAsBytes requires a Blob"));
        return;
      }
      if (typeof FileReader === "function") {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
          } else {
            reject(new Error("FileReader returned non-ArrayBuffer result"));
          }
        };
        reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
        reader.readAsArrayBuffer(blob);
        return;
      }
      // Fallback for environments without FileReader (e.g. Node tests). The
      // cross-realm caveat does not apply outside of browser Xrays.
      blob.arrayBuffer().then(
        (buf) => resolve(new Uint8Array(buf)),
        (err) => reject(err)
      );
    });
  }

  function triggerBlobBrowserDownload(blob, filename, fallbackName = "download") {
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = sanitizeOutputFilename(filename, fallbackName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {
        // ignore revoke failures
      }
    }, 30000);
  }

  function isDownloadTimeoutError(err) {
    return !!err && (err.code === "GM_DOWNLOAD_TIMEOUT" || String(err?.message || "").toLowerCase().includes("timed out"));
  }

  // Like downloadResolvedVideo, but returns the bytes instead of triggering a
  // browser download. Used by the batch ZIP collector to embed muxed DASH
  // output directly in the archive instead of pulling 720p progressive.
  async function collectResolvedVideoBytes(plan) {
    if (!plan) throw new Error("collectResolvedVideoBytes: no plan provided");

    const container = plan.container === "mkv" ? "mkv" : "mp4";

    if (plan.source === "progressive" || (plan.source === "dash" && !plan.muxRequired)) {
      const url = plan.video && plan.video.url;
      if (!url) throw new Error("collectResolvedVideoBytes: plan has no video url");
      const blob = await fetchMediaBlob(url);
      const bytes = await readBlobAsBytes(blob);
      return {
        bytes,
        container,
        muxed: false,
        diagnostics: plan.diagnostics || null
      };
    }

    if (plan.source === "dash" && plan.muxRequired) {
      const videoUrl = plan.video && plan.video.url;
      const audioUrl = plan.audio && plan.audio.url;
      if (!videoUrl || !audioUrl) throw new Error("collectResolvedVideoBytes: dash split plan missing video or audio url");

      if (container === "mkv") {
        if (typeof MKV_MUX_CORE === "undefined" || typeof MKV_MUX_CORE.mux !== "function") {
          throw new Error("MKV_MUX_CORE unavailable");
        }
      } else {
        if (typeof MP4_REMUX_CORE === "undefined" || typeof MP4_REMUX_CORE.remux !== "function") {
          throw new Error("MP4_REMUX_CORE unavailable");
        }
      }

      const [videoBlob, audioBlob] = await Promise.all([
        fetchMediaBlob(videoUrl),
        fetchMediaBlob(audioUrl)
      ]);
      const [videoBytes, audioBytes] = await Promise.all([
        readBlobAsBytes(videoBlob),
        readBlobAsBytes(audioBlob)
      ]);
      const videoBuf = videoBytes.buffer.slice(videoBytes.byteOffset, videoBytes.byteOffset + videoBytes.byteLength);
      const audioBuf = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);

      const muxResult = container === "mkv"
        ? MKV_MUX_CORE.mux(videoBuf, audioBuf)
        : MP4_REMUX_CORE.remux(videoBuf, audioBuf);

      return {
        bytes: new Uint8Array(muxResult.output),
        container,
        muxed: true,
        diagnostics: { ...(plan.diagnostics || {}), mux: muxResult.diagnostics || null }
      };
    }

    throw new Error(`collectResolvedVideoBytes: unsupported plan shape (source=${plan.source}, muxRequired=${plan.muxRequired})`);
  }

  // VideoPlan dispatcher. Three shapes today:
  //   { source: "progressive" }                              → GM_download passthrough
  //   { source: "dash", muxRequired: false }                  → GM_download passthrough (single rep)
  //   { source: "dash", muxRequired: true, container: ... }   → fetch both, mux, blob-download
  //
  // The container field decides which muxer runs ("mp4" → MP4_REMUX_CORE,
  // "mkv" → MKV_MUX_CORE) and what MIME type the blob carries. The caller is
  // responsible for the filename's extension; we only use plan.container for
  // the fallback name.
  async function downloadResolvedVideo(plan, filename, _meta) {
    if (!plan) throw new Error("downloadResolvedVideo: no plan provided");

    const container = plan.container === "mkv" ? "mkv" : "mp4";

    if (plan.source === "progressive" || (plan.source === "dash" && !plan.muxRequired)) {
      const url = plan.video && plan.video.url;
      if (!url) throw new Error("downloadResolvedVideo: plan has no video url");
      await gmDownloadFile(url, filename);
      return {
        source: plan.source,
        tier: plan.tier,
        container,
        muxed: false,
        diagnostics: plan.diagnostics || null
      };
    }

    if (plan.source === "dash" && plan.muxRequired) {
      const videoUrl = plan.video && plan.video.url;
      const audioUrl = plan.audio && plan.audio.url;
      if (!videoUrl || !audioUrl) throw new Error("downloadResolvedVideo: dash split plan missing video or audio url");

      // Fail fast on missing muxer before pulling 20+ MB across the wire.
      if (container === "mkv") {
        if (typeof MKV_MUX_CORE === "undefined" || typeof MKV_MUX_CORE.mux !== "function") {
          throw new Error("MKV_MUX_CORE unavailable");
        }
      } else {
        if (typeof MP4_REMUX_CORE === "undefined" || typeof MP4_REMUX_CORE.remux !== "function") {
          throw new Error("MP4_REMUX_CORE unavailable");
        }
      }

      const [videoBlob, audioBlob] = await Promise.all([
        fetchMediaBlob(videoUrl),
        fetchMediaBlob(audioUrl)
      ]);
      const [videoBytes, audioBytes] = await Promise.all([
        readBlobAsBytes(videoBlob),
        readBlobAsBytes(audioBlob)
      ]);
      const videoBuf = videoBytes.buffer.slice(videoBytes.byteOffset, videoBytes.byteOffset + videoBytes.byteLength);
      const audioBuf = audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength);

      let muxResult;
      let mimeType;
      let fallbackName;
      if (container === "mkv") {
        muxResult = MKV_MUX_CORE.mux(videoBuf, audioBuf);
        mimeType = "video/x-matroska";
        fallbackName = "video.mkv";
      } else {
        muxResult = MP4_REMUX_CORE.remux(videoBuf, audioBuf);
        mimeType = "video/mp4";
        fallbackName = "video.mp4";
      }

      const muxedBlob = new Blob([muxResult.output], { type: mimeType });
      triggerBlobBrowserDownload(muxedBlob, filename, fallbackName);

      return {
        source: "dash",
        tier: plan.tier,
        container,
        muxed: true,
        diagnostics: { ...(plan.diagnostics || {}), mux: muxResult.diagnostics || null }
      };
    }

    throw new Error(`downloadResolvedVideo: unsupported plan shape (source=${plan.source}, muxRequired=${plan.muxRequired})`);
  }

  const CODEC_DISPLAY_NAMES = {
    avc1: "H.264",
    hvc1: "H.265",
    vp09: "VP9",
    av01: "AV1"
  };

  // Building blocks for the toast quality line. Format: `1080p, DASH muxed, 4.0 Mbps, VP9`.
  // For vertical reels IG reports width=1080 height=1920; "1080p" is the
  // smaller dimension, which matches the user-facing convention.
  function formatQualityLine(plan) {
    if (!plan) return "";
    const video = plan.video || null;
    const bits = [];

    if (video) {
      const w = Number(video.width) || 0;
      const h = Number(video.height) || 0;
      const resolution = w && h ? Math.min(w, h) : (w || h || 0);
      if (resolution) bits.push(`${resolution}p`);
    }

    if (plan.source === "dash") {
      bits.push(plan.muxRequired === false ? "DASH video-only" : "DASH muxed");
    } else if (plan.source === "progressive") {
      bits.push("progressive");
    }

    if (video && Number.isFinite(Number(video.bandwidth)) && Number(video.bandwidth) > 0) {
      bits.push(`${(Number(video.bandwidth) / 1_000_000).toFixed(1)} Mbps`);
    }

    if (video && video.codecs) {
      const prefix = String(video.codecs).slice(0, 4).toLowerCase();
      if (CODEC_DISPLAY_NAMES[prefix]) bits.push(CODEC_DISPLAY_NAMES[prefix]);
    }

    return bits.join(", ");
  }

  // Rolling diagnostic buffer for the debug log surface. The buffer caps at
  // DIAGNOSTIC_LOG_MAX entries; oldest gets evicted on overflow. Each entry
  // is timestamped on insert (caller cannot override) and the getter returns
  // a defensive slice so callers can't mutate the live buffer.
  const DIAGNOSTIC_LOG_MAX = 20;
  const diagnosticLog = [];

  function pushDiagnostic(entry) {
    if (!entry || typeof entry !== "object") return;
    const stamped = {
      ...entry,
      timestamp: typeof Date !== "undefined" ? Date.now() : 0
    };
    diagnosticLog.push(stamped);
    while (diagnosticLog.length > DIAGNOSTIC_LOG_MAX) diagnosticLog.shift();
  }

  function getDiagnosticLog() {
    return diagnosticLog.slice();
  }

  function pushMediaDiagnostic(entry) {
    if (!entry || typeof entry !== "object") return;
    if (entry.level && entry.level !== "fallback") return;
    pushDiagnostic(entry);
  }

  function getMediaDiagnosticLog() {
    return getDiagnosticLog();
  }

  return {
    parseJsonFromGmResponse,
    gmRequestJson,
    gmRequestBinary,
    gmFetchBlob,
    fetchMediaBlob,
    gmDownloadFile,
    normalizeBinaryPayloadToBlob,
    createNamedBinaryFile,
    blobToDataUrl,
    readBlobAsBytes,
    triggerBlobBrowserDownload,
    openInNewTab,
    openMultipleInNewTabs,
    isDownloadTimeoutError,
    collectResolvedVideoBytes,
    downloadResolvedVideo,
    formatQualityLine,
    pushDiagnostic,
    getDiagnosticLog,
    pushMediaDiagnostic,
    getMediaDiagnosticLog
  };
})();
