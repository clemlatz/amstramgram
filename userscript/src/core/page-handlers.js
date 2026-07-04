const PAGE_HANDLERS_CORE = (() => {
  const { icons } = STYLES_CORE;
  const { sleepMs, randomIntBetween, getPageWindow } = UTILITIES_CORE;
  const { sanitizeAmstramgramUrl, PROFILE_RESERVED_PATHS } = SETTINGS_SCHEMA_CORE;
  const TAGGED_TRACE_ENABLED = false;

  function showToast(message, durationMs = 3500) {
    return TOAST_CORE.showToast(message, durationMs, { elementId: "ig-hd-toast" });
  }

  function taggedTrace(eventLabel, details) {
    try {
      if (typeof console === "undefined" || typeof console.log !== "function") return;
      if (typeof details === "undefined") {
        console.log("[Amstragram Tagged Trace]", eventLabel);
      } else {
        console.log("[Amstragram Tagged Trace]", eventLabel, details);
      }
    } catch {
      // Never let debug tracing break downloads.
    }
  }

  // Injected from main.js via _init()
  let RUNTIME_CONFIG = {};
  let _userSettingsGetter = () => null;
  function _getSettings() { return _userSettingsGetter(); }

  function debugLog(...args) {
    if (!RUNTIME_CONFIG.enableDebugLogs) return;
    console.log(...args);
  }

  let runBatchDownloadTasks = async () => {};
  let showBatchProgressIndicator = () => {};
  let ensureBatchRunRecord = () => {};
  let generateBatchJobId = () => "";
  let getActiveBulkPolicy = () => null;
  let getCurrentProfileUsername = () => "";
  let getDownloadHistoryKeyForTask = () => "";
  let hasDownloadedHistoryKey = () => false;
  let installSettingsLauncherRouteHooks = () => {};
  let installSettingsLauncherThemeHooks = () => {};
  let resolveDownloadFilenameForTransfer = () => "";
  let resolveVideoDownloadFilename = () => "";
  let saveBlobToCustomFolderWithResult = async () => false;
  let saveMetadataSidecarsToCustomFolder = async () => {};
  let scheduleAmstramgramImport = () => {};
  let syncAmstramgramShortcodes = () => {};
  let syncSettingsLauncherButton = () => {};
  let triggerMetadataSidecarBrowserDownloads = async () => {};
  let tryCustomFolderDownload = async () => false;
  let applyTheme = () => {};

  function _init(ctx) {
    if (ctx.runtimeConfig) RUNTIME_CONFIG = ctx.runtimeConfig;
    if (ctx.getUserSettings) _userSettingsGetter = ctx.getUserSettings;
    if (ctx.runBatchDownloadTasks) runBatchDownloadTasks = ctx.runBatchDownloadTasks;
    if (ctx.showBatchProgressIndicator) showBatchProgressIndicator = ctx.showBatchProgressIndicator;
    if (ctx.ensureBatchRunRecord) ensureBatchRunRecord = ctx.ensureBatchRunRecord;
    if (ctx.generateBatchJobId) generateBatchJobId = ctx.generateBatchJobId;
    if (ctx.getActiveBulkPolicy) getActiveBulkPolicy = ctx.getActiveBulkPolicy;
    if (ctx.getCurrentProfileUsername) getCurrentProfileUsername = ctx.getCurrentProfileUsername;
    if (ctx.getDownloadHistoryKeyForTask) getDownloadHistoryKeyForTask = ctx.getDownloadHistoryKeyForTask;
    if (ctx.hasDownloadedHistoryKey) hasDownloadedHistoryKey = ctx.hasDownloadedHistoryKey;
    if (ctx.installSettingsLauncherRouteHooks) installSettingsLauncherRouteHooks = ctx.installSettingsLauncherRouteHooks;
    if (ctx.installSettingsLauncherThemeHooks) installSettingsLauncherThemeHooks = ctx.installSettingsLauncherThemeHooks;
    if (ctx.resolveDownloadFilenameForTransfer) resolveDownloadFilenameForTransfer = ctx.resolveDownloadFilenameForTransfer;
    if (ctx.resolveVideoDownloadFilename) resolveVideoDownloadFilename = ctx.resolveVideoDownloadFilename;
    if (ctx.saveBlobToCustomFolderWithResult) saveBlobToCustomFolderWithResult = ctx.saveBlobToCustomFolderWithResult;
    if (ctx.saveMetadataSidecarsToCustomFolder) saveMetadataSidecarsToCustomFolder = ctx.saveMetadataSidecarsToCustomFolder;
    if (ctx.scheduleAmstramgramImport) scheduleAmstramgramImport = ctx.scheduleAmstramgramImport;
    if (ctx.syncAmstramgramShortcodes) syncAmstramgramShortcodes = ctx.syncAmstramgramShortcodes;
    if (ctx.syncSettingsLauncherButton) syncSettingsLauncherButton = ctx.syncSettingsLauncherButton;
    if (ctx.triggerMetadataSidecarBrowserDownloads) triggerMetadataSidecarBrowserDownloads = ctx.triggerMetadataSidecarBrowserDownloads;
    if (ctx.tryCustomFolderDownload) tryCustomFolderDownload = ctx.tryCustomFolderDownload;
    if (ctx.applyTheme) applyTheme = ctx.applyTheme;
  }

  // =========================================
  // PROFILE GRID — DOWNLOADED POST OVERLAY
  // =========================================
  let _profileGridObserver = null;
  let _profileGridSeenLinks = new Set();

  function _markProfileGridLink(link) {
    const overlay = document.createElement("div");
    overlay.className = "ig-hd-grid-overlay";
    const badge = document.createElement("div");
    badge.className = "ig-hd-grid-badge";
    badge.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    link.setAttribute("data-ig-hd-downloaded", "1");
    link.appendChild(overlay);
    link.appendChild(badge);
  }

  function _processProfileGridLinks(links) {
    for (const link of links) {
      if (_profileGridSeenLinks.has(link)) continue;
      _profileGridSeenLinks.add(link);
      const href = link.getAttribute("href") || "";
      const shortcode = extractInstagramPostShortcodeFromHref(href);
      if (!shortcode) continue;
      if (hasDownloadedHistoryKey(`shortcode:${shortcode}`)) {
        _markProfileGridLink(link);
      }
    }
  }

  function _startProfileGridObserver() {
    const root = document.querySelector("main") || document.body;
    if (!root || typeof MutationObserver !== "function") return;

    const selector = "a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']";

    const initialLinks = root.querySelectorAll(selector);
    _processProfileGridLinks(initialLinks);

    _profileGridObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const links = [];
          if (node.matches?.(selector)) links.push(node);
          const nested = node.querySelectorAll?.(selector);
          if (nested) links.push(...nested);
          if (links.length > 0) _processProfileGridLinks(links);
        }
      }
    });

    _profileGridObserver.observe(root, { childList: true, subtree: true });
  }

  function _stopProfileGridObserver() {
    if (_profileGridObserver) {
      _profileGridObserver.disconnect();
      _profileGridObserver = null;
    }
    _profileGridSeenLinks = new Set();
    const marked = document.querySelectorAll("[data-ig-hd-downloaded]");
    for (const el of marked) {
      el.removeAttribute("data-ig-hd-downloaded");
      el.querySelector(".ig-hd-grid-overlay")?.remove();
      el.querySelector(".ig-hd-grid-badge")?.remove();
    }
  }

  function syncProfileGridObserver() {
    const username = getCurrentProfileUsername();
    if (!username) {
      _stopProfileGridObserver();
      return;
    }
    _stopProfileGridObserver();
    _startProfileGridObserver();
  }

  function _setup() {
    installSettingsLauncherRouteHooks();
    installSettingsLauncherThemeHooks();
    if (document.body) {
      applyTheme();
      syncSettingsLauncherButton();
      syncProfileGridObserver();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        applyTheme();
        syncSettingsLauncherButton();
        syncProfileGridObserver();
      }, { once: true });
    }
  }

  // =========================================
  // GET APP ID
  // =========================================
  function getAppID() {
    let result = null;
    const scripts = document.querySelectorAll('script[type="application/json"]');
    const regexp = /"APP_ID":"([0-9]+)"/g;

    for (const script of scripts) {
      const matches = [...script.textContent.matchAll(regexp)];
      if (matches.length > 0) {
        result = matches[0][1];
        break;
      }
    }
    return result || RUNTIME_CONFIG.fallbackAppId;
  }

  // =========================================
  // DOWNLOAD HELPER
  // =========================================
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
    } catch (arrayBufferErr) {
      debugLog("[Amstragram] GM arraybuffer fetch failed, retrying as blob:", arrayBufferErr?.message || arrayBufferErr);
    }

    const blobPayload = await gmRequestBinary(url, "blob");
    return normalizeBinaryPayloadToBlob(blobPayload);
  }

  async function fetchMediaBlob(url) {
    try {
      return await gmFetchBlob(url);
    } catch (gmErr) {
      debugLog("[Amstragram] GM blob fetch failed, falling back to page fetch:", gmErr.message);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.blob();
  }

  async function downloadFile(url, filename, metaOrOptions = null, maybeOptions = null) {
    const ok = await _downloadFileImpl(url, filename, metaOrOptions, maybeOptions);
    // Any successful save lands a file in the amstramgram-synced folder; nudge the
    // server to import it (debounced/no-op when no amstramgram URL is configured).
    if (ok) scheduleAmstramgramImport();
    return ok;
  }

  async function _downloadFileImpl(url, filename, metaOrOptions = null, maybeOptions = null) {
    let meta = metaOrOptions;
    let options = maybeOptions && typeof maybeOptions === "object" ? maybeOptions : {};
    if (
      !maybeOptions &&
      metaOrOptions &&
      typeof metaOrOptions === "object" &&
      Object.prototype.hasOwnProperty.call(metaOrOptions, "allowOpenInTabFallback")
    ) {
      meta = null;
      options = metaOrOptions;
    }

    const resolvedFilename = resolveDownloadFilenameForTransfer(url, filename, meta);

    try {
      const customFolderResult = await tryCustomFolderDownload(url, resolvedFilename, meta);
      if (customFolderResult?.saved) {
        await saveMetadataSidecarsToCustomFolder(
          url,
          customFolderResult.fileName || resolvedFilename,
          meta
        );
        return true;
      }
    } catch (customFolderErr) {
      debugLog("[Amstragram] Custom folder save failed, falling back to browser download:", customFolderErr?.message || customFolderErr);
    }

    try {
      await gmDownloadFile(url, resolvedFilename);
      triggerMetadataSidecarBrowserDownloads(url, resolvedFilename, meta);
      return true;
    } catch (gmDownloadErr) {
      debugLog("[Amstragram] GM_download failed, falling back to blob download:", gmDownloadErr.message);
    }

    try {
      const blob = await fetchMediaBlob(url);
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Delay revocation so slower browsers can finish the download handoff.
      setTimeout(() => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (revokeErr) {
          console.warn("[Amstragram] Failed to revoke object URL:", revokeErr);
        }
      }, 30000);
      triggerMetadataSidecarBrowserDownloads(url, resolvedFilename, meta);
      return true;
    } catch (err) {
      console.error("[Amstragram] Download failed:", err);
      if (options?.allowOpenInTabFallback !== false) {
        // Fallback: open in new tab for direct/manual download actions.
        openInNewTab(url);
      }
      return false;
    }
  }

  // Single dispatcher for video downloads — used by every right-click "Download"
  // action that can carry a resolver plan. Owns the same wrapping invariant as
  // downloadFile (custom-folder save first, browser download fallback) plus
  // metadata sidecar emission, so any caller automatically gets sidecars and
  // honors the user's custom download folder. The pure byte transfer stays in
  // DOWNLOAD_PIPELINE_CORE; this dispatcher only orchestrates side effects.
  async function dispatchVideoDownload(plan, fallbackUrl, filename, meta, options = null) {
    const planUsable = !!plan
      && typeof DOWNLOAD_PIPELINE_CORE !== "undefined"
      && typeof DOWNLOAD_PIPELINE_CORE.downloadResolvedVideo === "function";

    if (!planUsable) {
      if (fallbackUrl) {
        return await downloadFile(fallbackUrl, filename, meta, options || undefined);
      }
      return false;
    }

    const resolvedFilename = resolveVideoDownloadFilename(plan, fallbackUrl, filename, meta);
    const sidecarSourceUrl = plan.video?.url || fallbackUrl || "";
    const isMuxedDash = plan.source === "dash" && plan.muxRequired === true;
    const wantsCustomFolder = !!_getSettings()?.downloads?.useCustomFolder;
    const collectAvailable = typeof DOWNLOAD_PIPELINE_CORE.collectResolvedVideoBytes === "function";

    function emitDiagnostic() {
      try {
        DOWNLOAD_PIPELINE_CORE.pushDiagnostic({
          source: plan.source || null,
          tier: plan.tier || null,
          container: plan.container || null,
          videoWidth: plan.video?.width ?? null,
          videoHeight: plan.video?.height ?? null,
          videoBandwidth: plan.video?.bandwidth ?? null,
          videoCodec: plan.video?.codecs ?? null,
          audioBandwidth: plan.audio?.bandwidth ?? null,
          audioCodec: plan.audio?.codecs ?? null,
          ...(options?.batch ? { batch: true } : {})
        });
      } catch (e) {
        debugLog?.("[Amstragram] pushDiagnostic threw:", e?.message || e);
      }
    }

    try {
      if (wantsCustomFolder) {
        try {
          let customResult = null;
          if (isMuxedDash) {
            if (collectAvailable) {
              const collected = await DOWNLOAD_PIPELINE_CORE.collectResolvedVideoBytes(plan);
              const mimeType = "video/mp4";
              const muxedBlob = new Blob([collected.bytes], { type: mimeType });
              customResult = await saveBlobToCustomFolderWithResult(muxedBlob, resolvedFilename, meta);
            }
          } else if (plan.video?.url) {
            customResult = await tryCustomFolderDownload(plan.video.url, resolvedFilename, meta);
          }
          if (customResult?.saved) {
            await saveMetadataSidecarsToCustomFolder(
              sidecarSourceUrl,
              customResult.fileName || resolvedFilename,
              meta
            );
            emitDiagnostic();
            return true;
          }
        } catch (customFolderErr) {
          debugLog?.("[Amstragram] Video custom folder save failed, falling back to browser download:", customFolderErr?.message || customFolderErr);
        }
      }

      await DOWNLOAD_PIPELINE_CORE.downloadResolvedVideo(plan, resolvedFilename, meta);
      triggerMetadataSidecarBrowserDownloads(sidecarSourceUrl, resolvedFilename, meta);
      emitDiagnostic();
      return true;
    } catch (err) {
      debugLog?.("[Amstragram] resolved video download failed; falling back to progressive:", err?.message || err);
      if (fallbackUrl) {
        return await downloadFile(fallbackUrl, filename, meta, options || undefined);
      }
      return false;
    }
  }

  // =========================================
  // COPY TO CLIPBOARD HELPER
  // =========================================
  async function copyImageToClipboard(url) {
    try {
      const blob = await fetchMediaBlob(url);

      // Convert to PNG for better clipboard compatibility
      // Some apps don't accept JPEG from clipboard
      const pngBlob = await convertToPng(blob);

      // Try writing the image to the clipboard.
      // Tampermonkey's sandbox often blocks ClipboardItem / navigator.clipboard.write,
      // so we attempt multiple contexts in order of preference.

      // Attempt 1: page's real window (unsafeWindow) — has full Clipboard API access
      const pageWindow = getPageWindow();
      if (pageWindow?.navigator?.clipboard?.write && typeof pageWindow.ClipboardItem !== "undefined") {
        try {
          await pageWindow.navigator.clipboard.write([
            new pageWindow.ClipboardItem({ 'image/png': pngBlob })
          ]);
          debugLog("[Amstragram] Image copied to clipboard via page context");
          showToast("Image copied to clipboard");
          return true;
        } catch (pageErr) {
          debugLog("[Amstragram] Page-context clipboard write failed:", pageErr.message);
        }
      }

      // Attempt 2: sandbox's own Clipboard API (works in some TM versions)
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob })
          ]);
          debugLog("[Amstragram] Image copied to clipboard via sandbox context");
          showToast("Image copied to clipboard");
          return true;
        } catch (sandboxErr) {
          debugLog("[Amstragram] Sandbox clipboard write failed:", sandboxErr.message);
        }
      }

      // Attempt 3: Fall back to copying the URL as text
      const clipboardText = pageWindow?.navigator?.clipboard || navigator.clipboard;
      if (clipboardText?.writeText) {
        await clipboardText.writeText(url);
        debugLog("[Amstragram] Clipboard image API unavailable; copied URL instead");
        showToast("Copied image URL to clipboard (image copy not supported in this browser)");
        return true;
      }

      throw new Error("Clipboard API unavailable");
    } catch (err) {
      console.error("[Amstragram] Copy failed:", err);
      showToast("Copy failed: " + (err?.message || "Unknown error"));
      return false;
    }
  }

  const MAX_PNG_DIMENSION = 8192;
  const MAX_PNG_PIXELS = 33554432; // 32MP safety cap to avoid large canvas allocations.

  // Convert image blob to PNG for clipboard compatibility
  async function convertToPng(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.onload = () => {
        const width = img.naturalWidth || 0;
        const height = img.naturalHeight || 0;
        if (!width || !height) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Invalid image dimensions'));
          return;
        }
        if (width > MAX_PNG_DIMENSION || height > MAX_PNG_DIMENSION || (width * height) > MAX_PNG_PIXELS) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Image too large for safe PNG conversion (${width}x${height})`));
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        canvas.toBlob(pngBlob => {
          if (pngBlob) {
            resolve(pngBlob);
          } else {
            reject(new Error('Failed to convert to PNG'));
          }
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };
      img.src = objectUrl;
    });
  }

  // =========================================
  // CONTEXT MENU
  // =========================================
  function createMenu(x, y, items) {
    return CONTEXT_MENU_CORE.createMenu(x, y, items, {
      menuId: "ig-hd-context-menu",
      classPrefix: "ig-hd-menu"
    });
  }

  document.addEventListener("click", CONTEXT_MENU_CORE.removeMenu);
  document.addEventListener("scroll", CONTEXT_MENU_CORE.removeMenu, true);

  // =========================================
  // PROFILE PICTURE URL HELPERS
  // =========================================
  function normalizeProfilePicUrl(url) {
    if (!url || typeof url !== "string") return "";
    return url.replace(/\\u0026/g, "&").replace(/\\/g, "");
  }

  function isTrustedInstagramHost(hostname) {
    if (!hostname) return false;
    const host = hostname.toLowerCase();
    return host === "instagram.com" ||
      host.endsWith(".instagram.com") ||
      host === "cdninstagram.com" ||
      host.endsWith(".cdninstagram.com") ||
      host === "fbcdn.net" ||
      host.endsWith(".fbcdn.net");
  }

  function isTrustedInstagramMediaUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const parsed = new URL(url, window.location.origin);
      if (!/^https?:$/.test(parsed.protocol)) return false;
      return isTrustedInstagramHost(parsed.hostname);
    } catch {
      return false;
    }
  }

  // Thumbnails have size indicators like s150x150, s320x320, etc.
  function isSmallProfileThumbnail(url) {
    if (!url) return true;
    const smallSizePattern = /s(64|100|150|160|240|320|480)x\1/i;
    if (smallSizePattern.test(url)) {
      return true;
    }

    const dimMatch = url.match(/_s(\d+)x(\d+)/i);
    if (dimMatch) {
      const width = parseInt(dimMatch[1], 10);
      const height = parseInt(dimMatch[2], 10);
      if (width < 500 || height < 500) {
        return true;
      }
    }
    return false;
  }

  function isPlaceholderProfilePicUrl(url) {
    if (!url) return true;
    const lower = url.toLowerCase();
    const placeholderTokens = [
      "anonymoususer",
      "anonymous_user",
      "anonymousprofile",
      "anonymous_profile",
      "anonprofile",
      "anon_profile",
      "default_profile",
      "default_avatar",
      "profile_pic_placeholder",
      "no_profile_pic",
      "placeholder",
      "sprite",
      "44884218_345707102882519_2446069589734326272_n"
    ];
    return placeholderTokens.some(token => lower.includes(token));
  }

  function isValidHdProfilePicUrl(url) {
    const normalized = normalizeProfilePicUrl(url);
    if (!normalized) return false;
    if (!isTrustedInstagramMediaUrl(normalized)) return false;
    if (isSmallProfileThumbnail(normalized)) return false;
    if (isPlaceholderProfilePicUrl(normalized)) return false;
    return true;
  }
  // =========================================
  // API: Fetch Post Info via GraphQL
  // =========================================
  async function fetchPostInfoGraphQL(shortcode) {
    const appId = getAppID();
    debugLog("[Amstragram] Fetching post media via GraphQL for shortcode:", shortcode);

    const variables = JSON.stringify({
      shortcode: shortcode,
      __relay_internal__pv__PolarisFeedShareMenurelayprovider: true,
      __relay_internal__pv__PolarisIsLoggedInrelayprovider: true
    });

    const url = `https://www.instagram.com/graphql/query/?query_id=${RUNTIME_CONFIG.queryIds.postInfo}&variables=${encodeURIComponent(variables)}`;
    const headers = {
      "User-Agent": RUNTIME_CONFIG.desktopUserAgent,
      "X-IG-App-ID": appId,
      "Accept": "*/*",
      "X-Requested-With": "XMLHttpRequest"
    };

    let data;
    if (typeof DOWNLOAD_PIPELINE_CORE !== "undefined" && typeof DOWNLOAD_PIPELINE_CORE.gmRequestJson === "function") {
      data = await DOWNLOAD_PIPELINE_CORE.gmRequestJson(url, headers);
    } else {
      const { "User-Agent": _userAgent, ...fetchHeaders } = headers;
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: fetchHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      data = await response.json();
    }

    const mediaInfo = data?.data?.xdt_api__v1__media__shortcode__web_info;

    if (!mediaInfo || !mediaInfo.items || mediaInfo.items.length === 0) {
      debugLog("[Amstragram] GraphQL response missing media items");
      throw new Error("No media found in response");
    }

    return mediaInfo.items[0];
  }

  function buildImageCandidatesFromNode(node) {
    const candidates = [];
    const seen = new Set();

    function pushCandidate(url, width = 0, height = 0) {
      if (!url || typeof url !== "string") return;
      if (seen.has(url)) return;
      seen.add(url);
      candidates.push({ url, width, height });
    }

    if (Array.isArray(node?.image_versions2?.candidates)) {
      for (const candidate of node.image_versions2.candidates) {
        pushCandidate(candidate?.url, candidate?.width || 0, candidate?.height || 0);
      }
    }

    if (Array.isArray(node?.display_resources)) {
      for (const resource of node.display_resources) {
        pushCandidate(resource?.src, resource?.config_width || resource?.width || 0, resource?.config_height || resource?.height || 0);
      }
    }

    pushCandidate(node?.display_url, node?.dimensions?.width || 0, node?.dimensions?.height || 0);
    pushCandidate(node?.thumbnail_src, node?.dimensions?.width || 0, node?.dimensions?.height || 0);

    return candidates;
  }

  function buildVideoVersionsFromNode(node) {
    const versions = [];
    const seen = new Set();

    function pushVersion(url, width = 0, height = 0) {
      if (!url || typeof url !== "string") return;
      if (seen.has(url)) return;
      seen.add(url);
      versions.push({ url, width, height });
    }

    function pushVersionCandidate(candidate) {
      if (!candidate || typeof candidate !== "object") return;
      pushVersion(
        candidate.url || candidate.src || candidate.video_url,
        candidate.width || candidate.config_width || candidate?.dimensions?.width || 0,
        candidate.height || candidate.config_height || candidate?.dimensions?.height || 0
      );
    }

    function pushVersionCollection(collection) {
      if (!collection) return;
      if (Array.isArray(collection)) {
        for (const version of collection) {
          pushVersionCandidate(version?.node || version);
        }
        return;
      }

      if (typeof collection !== "object") return;
      pushVersionCandidate(collection);

      for (const key of ["candidates", "edges", "nodes", "items"]) {
        const nested = collection[key];
        if (!Array.isArray(nested)) continue;
        for (const version of nested) {
          pushVersionCandidate(version?.node || version);
        }
      }
    }

    pushVersionCollection(node?.video_versions);
    pushVersionCollection(node?.video_resources);

    pushVersion(node?.video_url, node?.dimensions?.width || 0, node?.dimensions?.height || 0);
    return versions;
  }

  function normalizeLegacyNodeToMediaItem(node, fallbackCode) {
    if (!node || typeof node !== "object") return null;

    const ownerUsername = node?.owner?.username || node?.user?.username || "unknown";
    const ownerFullName = node?.owner?.full_name || node?.user?.full_name || "";
    const itemId = node?.pk || node?.id || null;
    const code = node?.code || node?.shortcode || fallbackCode || "post";

    const sidecarEdges = node?.edge_sidecar_to_children?.edges;
    if (Array.isArray(sidecarEdges) && sidecarEdges.length > 0) {
      const carousel_media = sidecarEdges
        .map((edge) => normalizeLegacyNodeToMediaItem(edge?.node, fallbackCode))
        .filter((media) => {
          if (!media) return false;
          const hasVideo = Array.isArray(media.video_versions) && media.video_versions.length > 0;
          const hasImage = Array.isArray(media.image_versions2?.candidates) && media.image_versions2.candidates.length > 0;
          return hasVideo || hasImage;
        });

      if (carousel_media.length === 0) return null;

      return {
        pk: itemId,
        id: itemId,
        code: code,
        user: { username: ownerUsername, full_name: ownerFullName },
        owner: { username: ownerUsername, full_name: ownerFullName },
        carousel_media: carousel_media
      };
    }

    const video_versions = buildVideoVersionsFromNode(node);
    const imageCandidates = buildImageCandidatesFromNode(node);
    if (video_versions.length === 0 && imageCandidates.length === 0) return null;

    const item = {
      pk: itemId,
      id: itemId,
      code: code,
      user: { username: ownerUsername, full_name: ownerFullName },
      owner: { username: ownerUsername, full_name: ownerFullName }
    };

    if (video_versions.length > 0) item.video_versions = video_versions;
    if (imageCandidates.length > 0) item.image_versions2 = { candidates: imageCandidates };
    return item;
  }

  function mediaItemMatchesRequestedShortcode(item, shortcode) {
    const expected = String(shortcode || "").trim();
    if (!expected || !item || typeof item !== "object") return true;
    const actual = item.code || item.shortcode || item?.node?.code || item?.node?.shortcode || "";
    if (!actual) return true;
    return String(actual) === expected;
  }

  function pickMatchingPostMediaCandidate(candidate, shortcode, sourceLabel) {
    if (!candidate) return null;
    if (mediaItemMatchesRequestedShortcode(candidate, shortcode)) return candidate;
    if (typeof debugLog === "function") {
      debugLog("[Amstragram] Post fallback rejected mismatched shortcode from", sourceLabel, "expected:", shortcode, "actual:", candidate.code || candidate.shortcode || "");
    }
    return null;
  }

  function pickPostMediaItemFromResponse(data, shortcode) {
    const directItem = data?.items?.[0];
    const matchedDirectItem = pickMatchingPostMediaCandidate(directItem, shortcode, "items[0]");
    if (matchedDirectItem) return matchedDirectItem;

    const nestedItem = data?.data?.items?.[0];
    const matchedNestedItem = pickMatchingPostMediaCandidate(nestedItem, shortcode, "data.items[0]");
    if (matchedNestedItem) return matchedNestedItem;

    const webInfoItem = data?.data?.xdt_api__v1__media__shortcode__web_info?.items?.[0];
    const matchedWebInfoItem = pickMatchingPostMediaCandidate(webInfoItem, shortcode, "web_info.items[0]");
    if (matchedWebInfoItem) return matchedWebInfoItem;

    const legacyNode =
      data?.graphql?.shortcode_media ||
      data?.data?.xdt_shortcode_media ||
      data?.data?.shortcode_media ||
      data?.shortcode_media;

    if (legacyNode) {
      if (!mediaItemMatchesRequestedShortcode(legacyNode, shortcode)) {
        if (typeof debugLog === "function") {
          debugLog("[Amstragram] Post fallback rejected mismatched legacy shortcode, expected:", shortcode, "actual:", legacyNode.code || legacyNode.shortcode || "");
        }
        return null;
      }
      return normalizeLegacyNodeToMediaItem(legacyNode, shortcode);
    }

    return null;
  }

  function decodeEscapedMediaUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    return rawUrl
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .replace(/\\/g, "");
  }

  function escapeRegExpLiteral(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizePostHtmlForIdentity(html) {
    return String(html || "")
      .replace(/\\u0026/g, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"')
      .replace(/&amp;/g, "&");
  }

  function readHtmlTagAttributes(tag) {
    const attrs = {};
    const attrPattern = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    for (const match of tag.matchAll(attrPattern)) {
      attrs[String(match[1] || "").toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
    }
    return attrs;
  }

  function htmlIdentifiesRequestedPost(html, shortcode) {
    const code = String(shortcode || "").trim();
    if (!code) return false;

    const normalized = normalizePostHtmlForIdentity(html);
    const escapedCode = escapeRegExpLiteral(code);
    const postUrlPattern = new RegExp(`/(?:p|reels?)/${escapedCode}(?:[/?#"'&<]|$)`, "i");
    const identityTags = normalized.match(/<(?:meta|link)\b[^>]*>/gi) || [];

    for (const tag of identityTags) {
      const attrs = readHtmlTagAttributes(tag);
      const kind = String(attrs.property || attrs.name || attrs.rel || "").toLowerCase();
      if (kind !== "og:url" && kind !== "twitter:url" && kind !== "canonical") continue;
      const value = attrs.content || attrs.href || "";
      if (postUrlPattern.test(value)) return true;
    }

    const jsonCodePattern = new RegExp(`"(?:shortcode|code)"\\s*:\\s*"${escapedCode}"`, "i");
    return jsonCodePattern.test(normalized);
  }

  function collectUniqueMatches(text, regexp) {
    const results = [];
    const seen = new Set();
    for (const match of text.matchAll(regexp)) {
      const candidate = decodeEscapedMediaUrl(match?.[1] || match?.[0] || "").trim();
      if (!candidate) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      results.push(candidate);
    }
    return results;
  }

  function extractUsernameFromPostHtml(html) {
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["'][^"']*\(@([A-Za-z0-9._]+)\)/i);
    if (titleMatch?.[1]) return titleMatch[1];

    const ownerMatch = html.match(/"owner"\s*:\s*\{[^}]*"username"\s*:\s*"([A-Za-z0-9._]+)"/);
    if (ownerMatch?.[1]) return ownerMatch[1];

    return "unknown";
  }

  function extractFullNameFromPostHtml(html) {
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*?)\s*\(@[A-Za-z0-9._]+\)/i);
    if (titleMatch?.[1]) {
      return titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
    }

    const ownerMatch = html.match(/"owner"\s*:\s*\{[^}]*"full_name"\s*:\s*"([^"]*)"/);
    if (ownerMatch?.[1]) return ownerMatch[1];

    return "";
  }

  function buildPostMediaItemFromHtml(html, shortcode) {
    if (!html || typeof html !== "string") return null;
    if (!htmlIdentifiesRequestedPost(html, shortcode)) {
      if (typeof debugLog === "function") {
        debugLog("[Amstragram] HTML fallback rejected because page did not identify shortcode:", shortcode);
      }
      return null;
    }

    const username = extractUsernameFromPostHtml(html);
    const fullName = extractFullNameFromPostHtml(html);
    const code = shortcode || "post";
    const baseItem = {
      pk: null,
      id: null,
      code: code,
      user: { username: username, full_name: fullName },
      owner: { username: username, full_name: fullName }
    };

    const videoMetaUrls = collectUniqueMatches(
      html,
      /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi
    );
    const videoJsonUrls = collectUniqueMatches(html, /"video_url"\s*:\s*"([^"]+)"/g);
    const videoRawUrls = collectUniqueMatches(html, /https?:\/\/[^"'<> ]+?\.mp4[^"'<> ]*/g);
    const videoUrls = [...videoMetaUrls, ...videoJsonUrls, ...videoRawUrls]
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url, idx, arr) => arr.indexOf(url) === idx);

    if (videoUrls.length > 0) {
      return {
        ...baseItem,
        video_versions: videoUrls.map((url) => ({ url: url, width: 1080 }))
      };
    }

    const imageMetaUrls = collectUniqueMatches(
      html,
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi
    );
    const imageJsonUrls = collectUniqueMatches(html, /"display_url"\s*:\s*"([^"]+)"/g);
    const imageFallbackUrls = imageMetaUrls.length > 0
      ? imageMetaUrls
      : imageJsonUrls.length === 1
        ? imageJsonUrls
        : [];
    const imageUrls = imageFallbackUrls
      .filter((url) => /^https?:\/\//i.test(url))
      .filter((url, idx, arr) => arr.indexOf(url) === idx);

    if (imageUrls.length > 0) {
      return {
        ...baseItem,
        image_versions2: {
          candidates: imageUrls.map((url) => ({ url: url, width: 1080 }))
        }
      };
    }

    return null;
  }

  async function fetchPostInfoFromHtml(shortcode) {
    const normalized = encodeURIComponent(shortcode);
    const paths = [`/p/${normalized}/`, `/reel/${normalized}/`];

    for (const path of paths) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`https://www.instagram.com${path}`, {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "text/html" },
          signal: controller.signal
        });
        if (!response.ok) continue;

        const html = await response.text();
        const item = buildPostMediaItemFromHtml(html, shortcode);
        if (item) {
          debugLog("[Amstragram] Post media resolved via HTML fallback:", path);
          return item;
        }
      } catch (err) {
        debugLog("[Amstragram] HTML fallback failed for", path, ":", err?.message || err);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return null;
  }

  async function fetchPostInfoWithFallback(shortcode) {
    try {
      return await fetchPostInfoGraphQL(shortcode);
    } catch (graphQlErr) {
      debugLog("[Amstragram] GraphQL post fetch failed; trying fallbacks:", graphQlErr?.message || graphQlErr);
    }

    const appId = getAppID();
    const encodedShortcode = encodeURIComponent(shortcode);
    // The two /api/v1/media/shortcode/<code>/info/ endpoints (i.instagram and
    // www.instagram) were deprecated by IG in 2024 — both return 404 HTML now.
    // GraphQL above is the live shortcode path; legacy __a stays as a last-
    // ditch fallback for niche cases where GraphQL also fails.
    const attempts = [
      {
        label: "legacy __a shortcode JSON",
        url: `https://www.instagram.com/p/${encodedShortcode}/?__a=1&__d=dis`,
        headers: { "X-IG-App-ID": appId, "Accept": "*/*", "X-Requested-With": "XMLHttpRequest" },
        useMobileUA: false
      }
    ];

    let lastError = null;
    for (const attempt of attempts) {
      try {
        const responseData = await gmFetch(attempt.url, {
          headers: attempt.headers,
          useMobileUA: attempt.useMobileUA
        });

        const mediaItem = pickPostMediaItemFromResponse(responseData, shortcode);
        if (mediaItem) {
          debugLog("[Amstragram] Post media resolved via fallback:", attempt.label);
          return mediaItem;
        }

        throw new Error("No media item in response");
      } catch (attemptErr) {
        lastError = attemptErr;
        debugLog("[Amstragram] Post fallback failed:", attempt.label, attemptErr?.message || attemptErr);
      }
    }

    try {
      const htmlItem = await fetchPostInfoFromHtml(shortcode);
      if (htmlItem) return htmlItem;
    } catch (htmlErr) {
      lastError = htmlErr;
      debugLog("[Amstragram] Post HTML fallback failed:", htmlErr?.message || htmlErr);
    }

    throw new Error(lastError?.message || "Could not fetch post media");
  }

  // =========================================
  // Extract direct media URLs from media item
  // =========================================
  function extractMediaUrls(item, options = {}) {
    const username = item.user?.username || item.owner?.username || "unknown";
    const fullName = item.user?.full_name || item.owner?.full_name || "";
    const code = item.code || "post";
    const isReel = options?.isReel === true || item?.product_type === "clips";
    const mediaType = isReel ? "reel" : "post";
    const permalinkBase = isReel ? "reel" : "p";
    const inferredPermalink = code && code !== "post"
      ? `https://www.instagram.com/${permalinkBase}/${code}/`
      : "";
    const sharedMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, {
      username: username,
      permalink: inferredPermalink
    });

    function videoResolverOptionsFromSettings() {
      return {};
    }

    const result = {
      username: username,
      fullName: fullName,
      code: code,
      isReel: isReel,
      isCarousel: !!item.carousel_media && item.carousel_media.length > 0,
      sharedMetadata: sharedMetadata,
      items: []
    };

    // url stays as the best-progressive URL even when the resolver returns a
    // DASH plan. Callers that only know about `url` (zip-mode batch fetch,
    // copy-link, open-in-tab) keep working with a single playable URL; the
    // DASH muxing happens through `videoPlan` in the resolved-video pipeline.
    function pickProgressiveUrl(versions) {
      const list = Array.isArray(versions) ? versions : [];
      if (list.length === 0) return undefined;
      const sorted = [...list].sort((a, b) => (b.width || 0) - (a.width || 0));
      return sorted[0]?.url;
    }

    function isVideoMediaItem(media, videoVersions) {
      if (Array.isArray(videoVersions) && videoVersions.length > 0) return true;
      if (media?.media_type === 2 || media?.is_video === true) return true;
      if (typeof media?.video_dash_manifest === "string" && media.video_dash_manifest.trim()) return true;
      const typename = String(media?.__typename || media?.typename || "");
      return /\bvideo\b/i.test(typename) || /GraphVideo/i.test(typename);
    }

    function getVideoResolverItem(media, videoVersions) {
      if (Array.isArray(videoVersions) && videoVersions.length > 0) {
        return { ...media, video_versions: videoVersions };
      }
      return media;
    }

    function selectMedia(media, mediaIndex = 1) {
      const videoVersions = buildVideoVersionsFromNode(media);
      const resolverItem = getVideoResolverItem(media, videoVersions);
      const explicitIntent = (options?.isReel === true || isVideoMediaItem(media, videoVersions))
        ? "video"
        : "unknown";
      const selectedMedia = MEDIA_SELECTION_CORE.selectBestMedia({
        type: mediaType,
        mediaKindIntent: explicitIntent,
        identity: { shortcode: code, index: mediaIndex },
        item: resolverItem
      }, {
        videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
        videoResolverOptions: videoResolverOptionsFromSettings()
      });
      const selectedUrl = selectedMedia.selected?.url || "";
      const progressiveUrl = selectedMedia.mediaKind === "video"
        ? pickProgressiveUrl(videoVersions)
        : "";
      return {
        selectedMedia,
        url: selectedMedia.selected?.source === "dash"
          ? (progressiveUrl || selectedUrl)
          : selectedUrl
      };
    }

    if (result.isCarousel) {
      result.items = item.carousel_media.map((media, i) => {
        const { selectedMedia, url } = selectMedia(media, i + 1);
        const mediaId = media.pk || media.id;
        const metadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(media, sharedMetadata);
        return {
          isVideo: selectedMedia.mediaKind === "video",
          url,
          videoPlan: selectedMedia.selected?.videoPlan || null,
          fallback: selectedMedia.fallback || null,
          selectedSource: selectedMedia.selected?.source || "",
          pk: mediaId,
          id: mediaId,
          metadata: metadata
        };
      });
    } else {
      const { selectedMedia, url } = selectMedia(item, 1);
      const mediaId = item.pk || item.id;
      result.items = [{
        isVideo: selectedMedia.mediaKind === "video",
        url,
        videoPlan: selectedMedia.selected?.videoPlan || null,
        fallback: selectedMedia.fallback || null,
        selectedSource: selectedMedia.selected?.source || "",
        pk: mediaId,
        id: mediaId,
        metadata: FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, sharedMetadata)
      }];
    }

    return result;
  }

  function buildPostDownloadMeta(parsed, item, shortcode, index, ext) {
    const sourceMetadata = item?.metadata && typeof item.metadata === "object"
      ? item.metadata
      : (parsed?.sharedMetadata && typeof parsed.sharedMetadata === "object" ? parsed.sharedMetadata : {});
    const isReel = parsed?.isReel === true;
    const mediaType = isReel ? "reel" : "post";
    const permalinkBase = isReel ? "reel" : "p";
    const fallbackPermalink = shortcode ? `https://www.instagram.com/${permalinkBase}/${shortcode}/` : "";
    const metadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(sourceMetadata, {
      username: parsed?.username || "instagram",
      permalink: fallbackPermalink
    });
    const mediaId = item?.id || item?.pk || index;

    return {
      type: mediaType,
      username: parsed?.username || "instagram",
      fullName: parsed?.fullName || "",
      shortcode: shortcode || parsed?.code || "",
      id: mediaId,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || (parsed?.username || "instagram"),
      permalink: metadata.permalink || fallbackPermalink,
      mediaKind: item?.isVideo ? "video" : "image",
      carouselTotal: parsed?.items?.length || 1
    };
  }

  function isValidInstagramProfileUsername(value) {
    const candidate = String(value || "").trim();
    if (!candidate) return "";
    if (!/^[A-Za-z0-9._]+$/.test(candidate)) return "";

    const reservedPaths = PROFILE_RESERVED_PATHS;

    if (reservedPaths.has(candidate.toLowerCase())) return "";
    return candidate;
  }

  function extractInstagramProfileUsernameFromHref(rawHref) {
    if (!rawHref || typeof rawHref !== "string") return "";

    const normalizedHref = rawHref.trim();
    if (!normalizedHref) return "";

    const pathText = normalizedHref
      .replace(/^https?:\/\/[^/]+/i, "")
      .split(/[?#]/)[0];
    const parts = pathText.split("/").filter(Boolean);
    return isValidInstagramProfileUsername(parts[0] || "");
  }

  function extractPostOwnerUsernameFromRoot(root) {
    if (!root?.querySelector) return "";

    const header = root.querySelector("header");
    if (!header?.querySelectorAll) return "";

    const anchors = header.querySelectorAll("a[href]");
    for (const anchor of anchors) {
      const href = anchor?.getAttribute?.("href") || anchor?.href || "";
      const username = extractInstagramProfileUsernameFromHref(href);
      if (username) return username;
    }

    return "";
  }

  function extractPostOwnerUsernameFromDocumentMeta() {
    const ogTitleMeta = document?.querySelector?.('meta[property="og:title"]');
    const ogTitleContent = ogTitleMeta?.getAttribute?.("content") || ogTitleMeta?.content || "";
    const titleMatch = String(ogTitleContent || document?.title || "").match(/\(@([A-Za-z0-9._]+)\)/i);
    return titleMatch?.[1] || "";
  }

  function resolvePostOwnerUsername(resolvedClick) {
    const candidateRoots = [
      resolvedClick?.media?.closest?.("article") || null,
      resolvedClick?.article || null,
      resolvedClick?.dialog || null,
      resolvedClick?.media?.closest?.("section") || null
    ];
    const seenRoots = new Set();

    for (const root of candidateRoots) {
      if (!root || seenRoots.has(root)) continue;
      seenRoots.add(root);

      const username = extractPostOwnerUsernameFromRoot(root);
      if (username) return username;
    }

    const metaUsername = extractPostOwnerUsernameFromDocumentMeta();
    if (metaUsername) return metaUsername;

    if (typeof getCurrentProfileUsername === "function") {
      const pageUsername = isValidInstagramProfileUsername(getCurrentProfileUsername());
      if (pageUsername) return pageUsername;
    }

    return "";
  }

  // =========================================
  // Get shortcode from element
  // =========================================
  function extractInstagramPostShortcodeFromPath(rawPath) {
    const pathText = String(rawPath || "")
      .trim()
      .replace(/^https?:\/\/[^/]+/i, "")
      .split(/[?#]/)[0];
    const parts = pathText.split("/").filter(Boolean);

    // Accept both the legacy bare form (/p/SHORT/, /reel/SHORT/) and the
    // username-prefixed form Instagram now uses on profile grids
    // (/<username>/p/SHORT/, /<username>/reel/SHORT/).
    for (let i = 0; i < parts.length - 1; i++) {
      const surface = parts[i];
      const shortcode = parts[i + 1];
      if (!shortcode) continue;
      if (surface === "p" || surface === "reel") return shortcode;
      // /reels/SHORT/ is a permalink; /reels/audio/... and /reels/ are utility
      // routes. Only accept "reels" when exactly one segment follows.
      if (surface === "reels" && i === parts.length - 2) return shortcode;
    }
    return null;
  }

  function instagramHrefIsReelPost(rawHref) {
    const pathText = String(rawHref || "")
      .trim()
      .replace(/^https?:\/\/[^/]+/i, "")
      .split(/[?#]/)[0];
    const parts = pathText.split("/").filter(Boolean);
    if (!extractInstagramPostShortcodeFromPath(pathText)) return false;
    for (let i = 0; i < parts.length - 1; i++) {
      const surface = parts[i];
      if (!parts[i + 1]) continue;
      if (surface === "p") return false;
      if (surface === "reel") return true;
      if (surface === "reels" && i === parts.length - 2) return true;
    }
    return false;
  }

  function extractInstagramPostShortcodeFromHref(rawHref) {
    return extractInstagramPostShortcodeFromPath(rawHref);
  }

  function findShortcodeInScopedLinks(root, { requireUnique = false } = {}) {
    if (!root?.querySelectorAll) return null;

    const shortcodes = [];
    const seen = new Set();
    const links = root.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']");
    for (const link of links) {
      const href = link?.href || link.getAttribute?.("href") || "";
      const shortcode = extractInstagramPostShortcodeFromHref(href);
      if (!shortcode || seen.has(shortcode)) continue;
      seen.add(shortcode);
      shortcodes.push(shortcode);
      if (!requireUnique) return shortcode;
    }

    if (requireUnique && shortcodes.length === 1) {
      return shortcodes[0];
    }

    return null;
  }

  function isDirectPostSurfacePath(pathname = window.location.pathname) {
    const pathText = String(pathname || "");
    return !!extractInstagramPostShortcodeFromPath(pathText)
      || /^\/reels\/?$/.test(pathText);
  }

  function getShortcodeFromElement(element) {
    if (!element) return null;

    const directLink = element.closest("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']");
    if (directLink) {
      const shortcode = extractInstagramPostShortcodeFromHref(
        directLink.href || directLink.getAttribute?.("href") || ""
      );
      if (shortcode) return shortcode;
    }

    const urlShortcode = extractInstagramPostShortcodeFromPath(window.location.pathname);
    if (urlShortcode) return urlShortcode;

    const article = element.closest("article");
    const articleTimeLink = article?.querySelector?.("time")?.closest?.("a");
    const articleTimeShortcode = extractInstagramPostShortcodeFromHref(
      articleTimeLink?.href || articleTimeLink?.getAttribute?.("href") || ""
    );
    if (articleTimeShortcode) return articleTimeShortcode;

    const articleShortcode = findShortcodeInScopedLinks(article, { requireUnique: true });
    if (articleShortcode) return articleShortcode;

    const section = element.closest?.("section");
    const sectionTimeLink = section?.querySelector?.("time")?.closest?.("a");
    const sectionTimeShortcode = extractInstagramPostShortcodeFromHref(
      sectionTimeLink?.href || sectionTimeLink?.getAttribute?.("href") || ""
    );
    if (sectionTimeShortcode) return sectionTimeShortcode;

    const sectionShortcode = findShortcodeInScopedLinks(section, { requireUnique: true });
    if (sectionShortcode) return sectionShortcode;

    const nestedShortcode = findShortcodeInScopedLinks(element, { requireUnique: true });
    if (nestedShortcode) return nestedShortcode;

    const main = element.closest?.("main") || document.querySelector?.("main") || null;
    const uniqueMainShortcode = findShortcodeInScopedLinks(main, { requireUnique: true });
    if (uniqueMainShortcode) return uniqueMainShortcode;

    return null;
  }

  function isReelShortcode(element, gridPostLink) {
    if (gridPostLink) {
      const href = gridPostLink.href || gridPostLink.getAttribute?.("href") || "";
      if (instagramHrefIsReelPost(href)) return true;
    }

    if (element) {
      const reelLink = element.closest?.("a[href*='/reel/']") || element.closest?.("a[href*='/reels/']");
      if (reelLink && instagramHrefIsReelPost(reelLink.href || reelLink.getAttribute?.("href") || "")) return true;

      const article = element.closest?.("article");
      if (article) {
        // Only check the post's own permalink link (time element's parent <a>),
        // not every reel link in the article (which may include suggested content)
        const timeLink = article.querySelector?.("time")?.closest?.("a");
        if (timeLink) {
          const timeLinkHref = timeLink.href || timeLink.getAttribute?.("href") || "";
          if (instagramHrefIsReelPost(timeLinkHref)) return true;
        }
      }
    }

    if (instagramHrefIsReelPost(window.location.pathname)) return true;
    if (/^\/reels\/?$/.test(String(window.location.pathname || ""))) return true;

    return false;
  }

  // =========================================
  // Detect current slide index in carousel
  // (Based on instantgram bookmarklet approach)
  // =========================================

  // Helper: Check if element is in viewport
  function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.bottom > 0 && rect.right > 0 &&
      rect.left < window.innerWidth && rect.top < window.innerHeight;
  }

  // Helper: Check if image is a profile picture (to exclude)
  function isProfileImage(img) {
    if (img.getAttribute('data-testid') === 'user-avatar') return true;
    if (img.width < 48) return true;
    const parent = img.parentElement;
    if (parent?.localName === 'span' || parent?.localName === 'a') return true;
    // Check if inside header
    let node = img;
    while (node) {
      if (node.nodeName === 'HEADER') return true;
      node = node.parentNode;
    }
    return false;
  }

  // Helper: Get carousel navigation buttons
  function getCarouselButtons(container) {
    const parent = container?.parentElement;
    if (!parent) return [];
    const buttons = Array.from(parent.querySelectorAll('button[aria-label]') || []);
    return buttons.filter(btn => btn.parentElement === parent);
  }

  // Helper: Find the currently visible image in a carousel
  function findCurrentVisibleImage(article) {
    if (!article) return null;
    const presentation = article.querySelector('[role="presentation"]');
    if (!presentation) return null;

    // Method 1: Find the carousel list and get the centered/active item
    const carouselList = article.querySelector('ul[style*="transform"]') ||
      article.querySelector('ul._acay') ||
      article.querySelector('[role="presentation"] ul');

    if (carouselList) {
      const listItems = carouselList.querySelectorAll(':scope > li');

      if (listItems.length > 0) {
        // Find which list item is currently centered
        const carouselRect = carouselList.getBoundingClientRect();
        const carouselCenter = carouselRect.left + carouselRect.width / 2;

        let closestItem = null;
        let closestDistance = Infinity;

        for (const li of listItems) {
          const liRect = li.getBoundingClientRect();
          const liCenter = liRect.left + liRect.width / 2;
          const distance = Math.abs(liCenter - carouselCenter);

          // Check if this item is visible (not off-screen)
          if (liRect.right > 0 && liRect.left < window.innerWidth) {
            if (distance < closestDistance) {
              closestDistance = distance;
              closestItem = li;
            }
          }
        }

        if (closestItem) {
          // Find the image inside this list item
          const img = closestItem.querySelector('img[draggable="false"], img[srcset], img');
          if (img && !isProfileImage(img)) {
            debugLog("[Amstragram] Found centered carousel image:", img.src?.substring(0, 100));
            return img;
          }
        }
      }
    }

    // Method 2: Fallback - find image closest to center of article
    const articleRect = article.getBoundingClientRect();
    const articleCenterX = articleRect.left + articleRect.width / 2;
    const articleCenterY = articleRect.top + articleRect.height / 2;

    const images = article.querySelectorAll('img[draggable="false"], img[srcset]');
    let bestImg = null;
    let bestDistance = Infinity;

    for (const img of images) {
      if (isProfileImage(img)) continue;

      const imgRect = img.getBoundingClientRect();
      // Skip tiny images
      if (imgRect.width < 100 || imgRect.height < 100) continue;

      const imgCenterX = imgRect.left + imgRect.width / 2;
      const imgCenterY = imgRect.top + imgRect.height / 2;

      const distance = Math.sqrt(
        Math.pow(imgCenterX - articleCenterX, 2) +
        Math.pow(imgCenterY - articleCenterY, 2)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestImg = img;
      }
    }

    if (bestImg) {
      debugLog("[Amstragram] Found closest image to center:", bestImg.src?.substring(0, 100));
      return bestImg;
    }

    return null;
  }

  // Helper: Match visible image URL to API data
  // Instagram image URLs contain identifiers we can match
  function matchVisibleImageToApiData(visibleImg, apiItems) {
    const visibleSrc = visibleImg.src || visibleImg.srcset?.split(' ')[0] || '';
    // Method 1: Extract ALL IDs from the URL (there can be multiple)
    // Instagram URLs often contain patterns like: /v/t51.29350-15/123456789_987654321_...
    const allVisibleIds = visibleSrc.match(/(\d{8,})/g) || [];
    debugLog("[Amstragram] All IDs in visible image URL:", allVisibleIds);

    // Get the first ID after the last slash (most likely the unique image ID)
    const filenameMatch = visibleSrc.split('/').pop()?.match(/^(\d{8,})/);
    const visibleId = filenameMatch ? filenameMatch[1] : (allVisibleIds[0] || null);

    debugLog("[Amstragram] Primary visible image ID:", visibleId);

    // Log all API item IDs for comparison
    debugLog("[Amstragram] API item IDs:", apiItems.map((item, i) => {
      const url = item.url || '';
      const idMatch = url.split('/').pop()?.match(/^(\d{8,})/);
      return `${i}: ${idMatch ? idMatch[1] : 'no-id'}`;
    }));

    for (let i = 0; i < apiItems.length; i++) {
      const apiUrl = apiItems[i].url || '';

      // Get ID from API URL
      const apiFilename = apiUrl.split('/').pop();
      const apiIdMatch = apiFilename?.match(/^(\d{8,})/);
      const apiId = apiIdMatch ? apiIdMatch[1] : null;

      // Try to match by URL ID
      if (visibleId && apiId && visibleId === apiId) {
        debugLog("[Amstragram] Matched by URL ID at index:", i);
        return i;
      }

      // Try to match by full filename
      const visibleFilename = visibleSrc.split('/').pop()?.split('?')[0];
      const cleanApiFilename = apiFilename?.split('?')[0];

      if (visibleFilename && cleanApiFilename && visibleFilename === cleanApiFilename) {
        debugLog("[Amstragram] Matched by filename at index:", i);
        return i;
      }
    }

    // No match found
    debugLog("[Amstragram] Could not match visible image to API data");
    return -1;
  }

  function detectCurrentSlideIndex(article, totalItems) {
    if (!article) return 0;

    try {
      // Find the presentation container (carousel wrapper)
      const presentation = article.querySelector('[role="presentation"]');
      if (!presentation) return 0;

      // Get all visible images in the carousel (excluding profile pics)
      const allImages = article.querySelectorAll('img');
      const visibleImages = [];
      allImages.forEach(img => {
        if (isElementInViewport(img) && !isProfileImage(img)) {
          visibleImages.push(img);
        }
      });

      debugLog("[Amstragram] Visible images in carousel:", visibleImages.length);

      // Get carousel buttons
      let buttons = getCarouselButtons(presentation);

      // If no buttons found, try triggering mouseover (Instagram lazy-loads buttons)
      if (buttons.length === 0) {
        const evt = new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true });
        presentation.dispatchEvent(evt);
        buttons = getCarouselButtons(presentation);
      }

      debugLog("[Amstragram] Carousel buttons found:", buttons.length);

      // Check button directions using DOM signals
      let hasPrevButton = false;
      let hasNextButton = false;

      for (const btn of buttons) {
        // Check aria-label first
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        if (ariaLabel.includes('back') || ariaLabel.includes('previous') || ariaLabel.includes('left')) {
          hasPrevButton = true;
        }
        if (ariaLabel.includes('next') || ariaLabel.includes('forward') || ariaLabel.includes('right')) {
          hasNextButton = true;
        }

        // Locale-independent fallback: infer direction from button side.
        const btnRect = btn.getBoundingClientRect();
        const presentationRect = presentation.getBoundingClientRect();
        if (btnRect.width > 0 && presentationRect.width > 0) {
          const btnCenterX = btnRect.left + btnRect.width / 2;
          const presentationCenterX = presentationRect.left + presentationRect.width / 2;
          if (btnCenterX < presentationCenterX) {
            hasPrevButton = true;
          } else {
            hasNextButton = true;
          }
        }
      }

      debugLog("[Amstragram] Has prev:", hasPrevButton, "Has next:", hasNextButton);

      // Logic based on buttons (from instantgram bookmarklet)
      if (buttons.length === 1 && hasNextButton && !hasPrevButton) {
        // Only next button visible = we're on first slide
        return 0;
      }

      if (buttons.length === 1 && hasPrevButton && !hasNextButton) {
        // Only prev button visible = we're on last slide
        return (totalItems || visibleImages.length) - 1;
      }

      if (buttons.length >= 2 || (hasPrevButton && hasNextButton)) {
        // Both buttons visible = we're somewhere in the middle
        // Try to determine exact position from visible images
        if (visibleImages.length === 3) {
          return 1; // Middle image when 3 are visible
        }
        if (visibleImages.length >= 1) {
          // For posts, usually 1 image visible at a time in the middle
          // We need another method - check dots
          const dots = article.querySelectorAll('div._acnb > div');
          if (dots.length > 1) {
            for (let i = 0; i < dots.length; i++) {
              const style = window.getComputedStyle(dots[i]);
              // Active dot is brighter
              if (style.transform !== 'none' ||
                style.backgroundColor.includes('255, 255, 255')) {
                return i;
              }
            }
          }
        }
      }

      // Fallback: if only 1 image visible and no clear button state
      if (visibleImages.length === 1 && !hasPrevButton && hasNextButton) {
        return 0;
      }

    } catch (err) {
      debugLog("[Amstragram] Error detecting carousel index:", err?.message || err);
    }

    debugLog("[Amstragram] Could not detect carousel index, defaulting to 0");
    return 0;
  }

  function getCarouselSlideIndexFromMedia(media, totalItems) {
    const slide = media?.closest?.("li");
    const carouselList = slide?.parentElement;
    if (!slide || !carouselList || carouselList.tagName !== "UL") return -1;

    const slides = Array.from(carouselList.querySelectorAll?.(":scope > li") || []);
    const index = slides.indexOf(slide);
    if (index === -1) return -1;

    // Instagram can keep buffered/offscreen slides in the DOM. Only trust DOM
    // position when it lines up with the resolved carousel item count.
    if (slides.length !== totalItems) return -1;
    return index;
  }

  // =========================================
  // INSTANT POST MEDIA EXTRACTION
  // =========================================

  function getBestSrcsetUrl(srcset) {
    if (!srcset || typeof srcset !== "string") return "";

    const sources = srcset
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        return {
          url: parts[0] || "",
          width: parseInt(parts[1], 10) || 0
        };
      })
      .filter((source) => source.url)
      .sort((a, b) => b.width - a.width);

    return sources[0]?.url || "";
  }

  function isSupportedDirectMediaUrl(url, { allowExternal = false } = {}) {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("blob:")) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    if (allowExternal) return true;
    return isTrustedInstagramMediaUrl(url);
  }

  function inferMediaFileExtension(url, fallbackExt) {
    const match = String(url || "").match(/\.([A-Za-z0-9]{2,5})(?:[?#]|$)/);
    if (!match?.[1]) return fallbackExt;

    const ext = match[1].toLowerCase();
    if (ext === "jpeg") return "jpg";
    if (["jpg", "png", "webp", "gif", "bmp", "mp4", "webm", "mov", "m4v"].includes(ext)) {
      return ext;
    }

    return fallbackExt;
  }

  function urlLooksLikeGif(url) {
    const normalizedUrl = String(url || "").trim().toLowerCase();
    if (!normalizedUrl) return false;

    return /\.gif(?:[?#]|$)/.test(normalizedUrl)
      || /[?&](?:format|fm|ext)=gif(?:[&#]|$)/.test(normalizedUrl)
      || normalizedUrl.includes("image/gif")
      || normalizedUrl.includes("image%2fgif");
  }

  function valueLooksLikeGif(value) {
    return /\bgif\b/i.test(String(value || ""));
  }

  function elementLooksLikeGif(media) {
    if (!media) return false;

    return [
      media.alt,
      media.getAttribute?.("alt"),
      media.getAttribute?.("aria-label"),
      media.getAttribute?.("title"),
      media.getAttribute?.("data-media-type"),
      media.getAttribute?.("data-content-type"),
      media.getAttribute?.("data-testid")
    ].some(valueLooksLikeGif);
  }

  function inferMediaSemanticType(media, url, ext, isVideo = false) {
    if (ext === "gif" || urlLooksLikeGif(url) || elementLooksLikeGif(media)) {
      return "gif";
    }
    if (isVideo) return "video";
    if (["jpg", "jpeg", "png", "webp", "bmp"].includes(String(ext || "").toLowerCase())) {
      return "image";
    }
    return "media";
  }

  function getDirectMediaInfo(media, { allowExternal = false, minimumSize = 100 } = {}) {
    if (!media || (media.tagName !== "IMG" && media.tagName !== "VIDEO")) return null;
    if (isProfileImage(media)) return null;

    const rect = media.getBoundingClientRect();
    if (rect.width < minimumSize || rect.height < minimumSize) return null;

    if (media.tagName === "IMG") {
      const url = getBestSrcsetUrl(media.srcset) || media.currentSrc || media.src || "";
      if (!isSupportedDirectMediaUrl(url, { allowExternal })) return null;
      const ext = inferMediaFileExtension(url, "jpg");

      return {
        url,
        isVideo: false,
        ext,
        semanticType: inferMediaSemanticType(media, url, ext, false)
      };
    }

    const source = media.querySelector?.("source");
    const url = media.currentSrc || media.src || source?.src || "";
    if (!isSupportedDirectMediaUrl(url, { allowExternal })) return null;
    const ext = inferMediaFileExtension(url, "mp4");

    return {
      url,
      isVideo: true,
      ext,
      semanticType: inferMediaSemanticType(media, url, ext, true)
    };
  }

  // Get instant media URL from visible post element
  function getInstantPostMedia(media) {
    const info = getDirectMediaInfo(media, {
      allowExternal: false,
      minimumSize: 100
    });
    if (!info) return null;

    return {
      url: info.url,
      isVideo: info.isVideo,
      ext: info.ext
    };
  }

  function isPointInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function getCurrentDirectPostShortcode(pathname = window.location.pathname) {
    return extractInstagramPostShortcodeFromPath(pathname);
  }

  function rectIntersectsViewport(rect) {
    if (!rect) return false;
    return rect.bottom > 0 && rect.right > 0 &&
      rect.left < window.innerWidth && rect.top < window.innerHeight;
  }

  function getRectDistanceToPoint(rect, x, y) {
    if (!rect || typeof x !== "number" || typeof y !== "number") return Number.MAX_SAFE_INTEGER;
    const clampedX = Math.max(rect.left, Math.min(x, rect.right));
    const clampedY = Math.max(rect.top, Math.min(y, rect.bottom));
    return Math.hypot(x - clampedX, y - clampedY);
  }

  function collectPostLinksFromRoot(root, bucket, seen) {
    if (!root || !bucket || !seen) return;

    const postLinkSelector = "a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']";

    if (root.matches?.(postLinkSelector)) {
      if (!seen.has(root)) {
        seen.add(root);
        bucket.push(root);
      }
    }

    const links = root.querySelectorAll?.(postLinkSelector) || [];
    for (const link of links) {
      if (!link || seen.has(link)) continue;
      seen.add(link);
      bucket.push(link);
    }
  }

  function findNearestVisiblePostShortcode(clientX, clientY, preferredRoots = []) {
    const roots = [];
    const seenRoots = new Set();
    function pushRoot(root) {
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root);
      roots.push(root);
    }

    for (const root of preferredRoots) pushRoot(root);
    pushRoot(document.querySelector?.("main"));
    pushRoot(document);

    const links = [];
    const seenLinks = new Set();
    for (const root of roots) {
      collectPostLinksFromRoot(root, links, seenLinks);
    }

    let best = null;
    const isReelsPath = /^\/reels(?:\/|$)/.test(String(window.location.pathname || ""));

    for (const link of links) {
      const href = link?.href || link?.getAttribute?.("href") || "";
      const shortcode = extractInstagramPostShortcodeFromHref(href);
      if (!shortcode) continue;

      const rect = link.getBoundingClientRect?.() || null;
      const visible = rectIntersectsViewport(rect);
      const width = Math.max(0, Number(rect?.width) || 0);
      const height = Math.max(0, Number(rect?.height) || 0);
      const area = width * height;
      let score = getRectDistanceToPoint(rect, clientX, clientY);

      if (!visible) score += 100000;
      if (area <= 0) score += 10000;
      if (rect && isPointInsideRect(clientX, clientY, rect)) score -= 5000;
      if (isReelsPath && /\/reels?\/[A-Za-z0-9_-]+/.test(href)) score -= 1000;

      for (let i = 0; i < preferredRoots.length; i++) {
        const root = preferredRoots[i];
        if (!root) continue;
        if (root === link || root.contains?.(link) || link.closest?.("section, article") === root) {
          score -= 4000 - i;
          break;
        }
      }

      if (!best || score < best.score) {
        best = { shortcode, score };
      }
    }

    return best?.shortcode || null;
  }

  function findFallbackShortcodeForResolvedClick(resolvedClick, target, clientX, clientY) {
    const preferredRoots = [
      resolvedClick?.media?.closest?.("section") || null,
      target?.closest?.("section") || null,
      resolvedClick?.article || null,
      resolvedClick?.dialog || null,
      resolvedClick?.gridPostLink || null,
      target?.closest?.("main") || null
    ].filter(Boolean);

    const seen = new Set();
    for (const root of preferredRoots) {
      if (!root || seen.has(root)) continue;
      seen.add(root);
      const uniqueShortcode = findShortcodeInScopedLinks(root, { requireUnique: true });
      if (uniqueShortcode) return uniqueShortcode;
    }

    return findNearestVisiblePostShortcode(clientX, clientY, preferredRoots);
  }

  function isEligiblePostMediaCandidate(media) {
    if (!media || (media.tagName !== "IMG" && media.tagName !== "VIDEO")) return false;
    if (media.getAttribute?.("data-testid") === "user-avatar") return false;
    if (media.closest?.("header")) return false;

    const rect = media.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return false;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) {
      return false;
    }

    return true;
  }

  function isLikelyPrimaryPostMedia(media) {
    if (!isEligiblePostMediaCandidate(media)) return false;

    if (media.closest?.('[role="presentation"], li[style*="translate"], div[role="button"]')) {
      return true;
    }

    const rect = media.getBoundingClientRect();
    return rect.width >= 240 || rect.height >= 240;
  }

  function collectPostMediaCandidates(root, bucket, seen) {
    if (!root || !bucket || !seen) return;

    const roots = root.matches?.("img, video") ? [root] : [];
    const mediaNodes = root.querySelectorAll?.("video, img[srcset], img") || [];
    for (const media of [...roots, ...mediaNodes]) {
      if (!isLikelyPrimaryPostMedia(media)) continue;
      if (seen.has(media)) continue;
      seen.add(media);
      bucket.push(media);
    }
  }

  function findPreferredClickedMedia(candidates, clientX, clientY, { preferVideo = false } = {}) {
    const hits = [];
    for (const media of candidates || []) {
      const rect = media?.getBoundingClientRect?.();
      if (!rect || !isPointInsideRect(clientX, clientY, rect)) continue;
      hits.push(media);
    }

    if (preferVideo) {
      const videos = hits.filter((media) => media?.tagName === "VIDEO");
      if (videos.length > 0) {
        return videos.sort((a, b) => getMediaRectArea(b) - getMediaRectArea(a))[0];
      }
    }

    return hits.sort((a, b) => getMediaRectArea(b) - getMediaRectArea(a))[0] || null;
  }

  function findPreferredOverlappingVideoForMedia(media, target, clientX, clientY) {
    if (!media || media.tagName === "VIDEO") return media || null;

    const roots = [];
    const seenRoots = new Set();
    function pushRoot(root) {
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root);
      roots.push(root);
    }

    pushRoot(getMediaStageAncestor(media));
    pushRoot(media.parentElement);
    pushRoot(target?.closest?.("section"));
    pushRoot(target?.closest?.("article"));
    pushRoot(target?.closest?.('[role="dialog"]'));

    const candidates = [];
    const seenMedia = new Set();
    for (const root of roots) {
      collectPostMediaCandidates(root, candidates, seenMedia);
    }

    const preferred = findPreferredClickedMedia(candidates, clientX, clientY, { preferVideo: true });
    return preferred?.tagName === "VIDEO" ? preferred : media;
  }

  function getDirectPostCandidateRoots(target, directPostShortcode) {
    const roots = [];
    const seen = new Set();

    function pushRoot(root) {
      if (!root || seen.has(root)) return;
      seen.add(root);
      roots.push(root);
    }

    const article = target.closest?.("article");
    if (article) {
      pushRoot(article);
      return roots;
    }

    const main = target.closest?.("main") || document.querySelector?.("main");
    if (!main) return roots;

    if (directPostShortcode && main.querySelectorAll) {
      const postLinks = main.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']");
      for (const link of postLinks) {
        const href = link?.href || link?.getAttribute?.("href") || "";
        if (!href.includes(`/${directPostShortcode}/`)) continue;

        const linkedRoot = link.closest?.("article") || link.closest?.("section");
        if (linkedRoot) {
          pushRoot(linkedRoot);
          return roots;
        }
      }
    }

    const section = target.closest?.("section");
    if (section) {
      pushRoot(section);
      return roots;
    }

    pushRoot(main);
    return roots;
  }

  function getMediaRectArea(media) {
    const rect = media?.getBoundingClientRect?.();
    if (!rect) return 0;
    return Math.max(0, rect.width) * Math.max(0, rect.height);
  }

  function isLikelyPostSurfaceLink(link) {
    if (!link?.getBoundingClientRect) return false;

    const rect = link.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 120) return false;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) {
      return false;
    }

    const href = link?.href || link?.getAttribute?.("href") || "";
    return /\/(?:p|reels?)\/[A-Za-z0-9_-]+/.test(href);
  }

  function isLooseVisibleMediaCandidate(media) {
    if (!media || (media.tagName !== "IMG" && media.tagName !== "VIDEO")) return false;
    if (isProfileImage(media)) return false;

    const rect = media.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return false;
    if (rect.bottom <= 0 || rect.right <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) {
      return false;
    }

    return true;
  }

  function getMediaStageAncestor(media) {
    if (!media) return null;

    return media.closest?.('[role="presentation"]')
      || media.closest?.('div[role="button"]')
      || media.closest?.("ul")
      || media.closest?.("li")
      || null;
  }

  function elementContainsNode(container, candidate) {
    if (!container || !candidate) return false;
    let node = candidate;
    while (node) {
      if (node === container) return true;
      node = node.parentElement || node.parentNode || null;
    }
    return false;
  }

  function targetSharesPostMediaSurface(target, media, clientX, clientY) {
    if (!target || !media) return false;
    if (target === media || elementContainsNode(media, target) || elementContainsNode(target, media)) return true;

    const mediaStage = getMediaStageAncestor(media);
    const targetStage = getMediaStageAncestor(target);
    const pointOverMedia = isPointInsideRect(clientX, clientY, media.getBoundingClientRect?.());
    if (!pointOverMedia) return false;
    if (mediaStage && targetStage && mediaStage === targetStage) return true;
    if (mediaStage && (mediaStage === target || elementContainsNode(mediaStage, target))) return true;

    // Modern Instagram wraps post/reel media in atomic-CSS divs without
    // role/list semantics, so the stage-ancestor heuristic above cannot
    // recognise transparent overlay siblings above the media. Two extra
    // cross-checks handle that case while keeping the comment-overlap test
    // (synthetic, no z-stack) rejecting:
    //   1. document.elementsFromPoint — if the target and media both appear
    //      in the click point's z-stack, the target is genuinely above the
    //      media (real overlay), not an unrelated element that overlaps by
    //      coordinate accident.
    //   2. Substantial rect overlap — a real overlay covers the full media
    //      rect (~100%); a comment row that spatially overlaps a media rect
    //      in a contrived test fixture only covers a small fraction.
    if (typeof document !== "undefined" && typeof document.elementsFromPoint === "function") {
      try {
        const stack = document.elementsFromPoint(clientX, clientY);
        if (Array.isArray(stack) && stack.includes(target) && stack.includes(media)) return true;
      } catch { /* ignore */ }
    }

    const targetRect = target.getBoundingClientRect?.();
    const mediaRect = media.getBoundingClientRect?.();
    if (targetRect && mediaRect) {
      const overlapW = Math.max(0, Math.min(targetRect.right, mediaRect.right) - Math.max(targetRect.left, mediaRect.left));
      const overlapH = Math.max(0, Math.min(targetRect.bottom, mediaRect.bottom) - Math.max(targetRect.top, mediaRect.top));
      const mediaArea = Math.max(0, mediaRect.width) * Math.max(0, mediaRect.height);
      if (mediaArea > 0 && (overlapW * overlapH) / mediaArea >= 0.5) return true;
    }

    return false;
  }

  function findDominantVisibleMedia(root) {
    if (!root) return null;

    const candidates = [];
    const seen = new Set();
    const mediaNodes = root.matches?.("img, video")
      ? [root, ...(root.querySelectorAll?.("img, video") || [])]
      : (root.querySelectorAll?.("img, video") || []);

    for (const media of mediaNodes) {
      if (!isLooseVisibleMediaCandidate(media)) continue;
      if (seen.has(media)) continue;
      seen.add(media);
      candidates.push(media);
    }

    let best = null;
    let bestArea = 0;
    for (const media of candidates) {
      const area = getMediaRectArea(media);
      if (area <= bestArea) continue;
      bestArea = area;
      best = media;
    }

    return best;
  }

  function buildDirectMediaFilename(url, fallbackStem, ext) {
    const lastSegment = String(url || "").split("/").pop()?.split(/[?#]/)[0] || "";
    const stemFromUrl = lastSegment.replace(/\.[^.]+$/, "");
    const safeStem = String(stemFromUrl || fallbackStem || "instagram_media")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "instagram_media";

    return `${safeStem}.${ext || "jpg"}`;
  }

  function getCurrentPageHref() {
    if (typeof window === "undefined" || !window.location) return "";
    return typeof window.location.href === "string" ? window.location.href : "";
  }

  function getCommentMediaHeaderLabel(mediaInfo) {
    const semanticType = String(mediaInfo?.semanticType || "").trim().toLowerCase();
    if (semanticType === "gif") return "GIF";
    if (semanticType === "video") return "Video";
    if (semanticType === "image") return "Image";

    const ext = String(mediaInfo?.ext || "").trim().toLowerCase();
    if (ext === "gif") return "GIF";
    if (mediaInfo?.isVideo) return "Video";
    if (["jpg", "jpeg", "png", "webp", "bmp"].includes(ext)) return "Image";
    return "Media";
  }

  function buildCommentMediaMenuItems(mediaInfo, filename, meta = {}) {
    const headerLabel = getCommentMediaHeaderLabel(mediaInfo);
    if (!mediaInfo?.url || !filename) return [{ header: headerLabel }];

    const resolvedMeta = {
      type: "comment_media",
      username: meta?.username || "instagram",
      shortcode: meta?.shortcode || "",
      id: meta?.id || "",
      index: 1,
      ext: meta?.ext || mediaInfo.ext,
      caption: "",
      altText: "",
      hashtags: [],
      takenAt: null,
      authorId: meta?.authorId || "",
      authorUsername: meta?.authorUsername || "",
      permalink: meta?.permalink || getCurrentPageHref(),
      mediaKind: mediaInfo?.isVideo ? "video" : "image",
      carouselTotal: 1
    };

    const menuItems = [{ header: headerLabel, section: true }];

    if (!mediaInfo.isVideo) {
      menuItems.push({
        icon: icons.copy(),
        label: "Copy",
        action: () => copyImageToClipboard(mediaInfo.url)
      });
    }

    menuItems.push({
      icon: icons.external(),
      label: "Open in new tab",
      action: () => openInNewTab(mediaInfo.url)
    });

    menuItems.push({
      icon: icons.download(),
      label: "Download",
      action: () => downloadFile(mediaInfo.url, filename, resolvedMeta)
    });

    return menuItems;
  }

  function resolveCommentMediaClick(target, clientX, clientY) {
    if (!target || typeof clientX !== "number" || typeof clientY !== "number") return null;

    const media = target.closest?.("img, video") || null;
    if (!media) return null;

    const mediaRect = media.getBoundingClientRect();
    if (!isPointInsideRect(clientX, clientY, mediaRect)) return null;

    const article = target.closest?.("article") || media.closest?.("article") || null;
    const dialog = target.closest?.('[role="dialog"]') || media.closest?.('[role="dialog"]') || null;
    const gridPostLink = target.closest?.("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']")
      || media.closest?.("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']")
      || null;
    if (gridPostLink && !article && !dialog) return null;

    const mediaInfo = getDirectMediaInfo(media, {
      allowExternal: true,
      minimumSize: 48
    });
    if (!mediaInfo) return null;

    const directPostShortcode = getCurrentDirectPostShortcode();
    let scopeRoot = article;
    if (!scopeRoot && directPostShortcode) {
      scopeRoot = getDirectPostCandidateRoots(target, directPostShortcode)[0] || null;
    }
    if (!scopeRoot) scopeRoot = dialog;
    if (!scopeRoot) return null;

    const dominantMedia = findDominantVisibleMedia(scopeRoot);
    const clickedArea = getMediaRectArea(media);
    const dominantArea = dominantMedia ? getMediaRectArea(dominantMedia) : 0;
    const clickedStage = getMediaStageAncestor(media);
    const dominantStage = getMediaStageAncestor(dominantMedia);
    const sharesStageAncestor = !!clickedStage && !!dominantStage && clickedStage === dominantStage;
    const hasMuchLargerSiblingMedia = !!dominantMedia &&
      dominantMedia !== media &&
      dominantArea >= clickedArea * 1.35 &&
      !sharesStageAncestor;

    if (!hasMuchLargerSiblingMedia && isLikelyPrimaryPostMedia(media)) {
      return null;
    }

    return {
      media,
      mediaInfo,
      article,
      dialog,
      gridPostLink,
      directPostShortcode,
      scopeRoot
    };
  }

  function resolveClickedPostMedia(target, clientX, clientY) {
    if (!target || typeof clientX !== "number" || typeof clientY !== "number") return null;

    const article = target.closest?.("article") || null;
    const dialog = target.closest?.('[role="dialog"]') || null;
    const gridPostLink = target.closest?.("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']") || null;
    const directPostShortcode = getCurrentDirectPostShortcode();

    let contextType = null;
    if (dialog) {
      contextType = "modal";
    } else if (gridPostLink && !article) {
      contextType = "profile-grid";
    } else if (directPostShortcode || isDirectPostSurfacePath()) {
      contextType = "direct-post";
    } else if (article) {
      contextType = "article";
    }

    if (!contextType) return null;

    const directMedia = target.closest?.("img, video") || null;
    if (
      directMedia &&
      isLikelyPrimaryPostMedia(directMedia) &&
      isPointInsideRect(clientX, clientY, directMedia.getBoundingClientRect())
    ) {
      const preferredMedia = findPreferredOverlappingVideoForMedia(directMedia, target, clientX, clientY);
      return {
        contextType,
        media: preferredMedia,
        article,
        dialog,
        gridPostLink,
        directPostShortcode
      };
    }

    const candidates = [];
    const seen = new Set();
    const mediaWrapperHint = target.closest?.('[role="presentation"], li[style*="translate"], div[role="button"]');
    collectPostMediaCandidates(mediaWrapperHint, candidates, seen);

    if (contextType === "profile-grid") {
      collectPostMediaCandidates(gridPostLink, candidates, seen);
    } else if (contextType === "modal") {
      collectPostMediaCandidates(article, candidates, seen);
      collectPostMediaCandidates(dialog, candidates, seen);
    } else if (contextType === "direct-post") {
      const roots = getDirectPostCandidateRoots(target, directPostShortcode);
      for (const root of roots) {
        collectPostMediaCandidates(root, candidates, seen);
      }
    } else {
      collectPostMediaCandidates(article, candidates, seen);
    }

    const matchedMedia = findPreferredClickedMedia(candidates, clientX, clientY, {
      preferVideo: true
    });

    if (!matchedMedia) {
      if (
        gridPostLink &&
        isLikelyPostSurfaceLink(gridPostLink) &&
        isPointInsideRect(clientX, clientY, gridPostLink.getBoundingClientRect())
      ) {
        return {
          contextType,
          media: null,
          article,
          dialog,
          gridPostLink,
          directPostShortcode
        };
      }
      return null;
    }

    // Profile grid: candidates were collected only from gridPostLink, so the
    // matched media is already constrained to the grid card. The hit-rect check
    // above is sufficient — don't apply the stage-ancestor check here, which
    // would reject clicks landing on hover overlays that sit alongside the IMG.
    if (contextType !== "profile-grid" && !targetSharesPostMediaSurface(target, matchedMedia, clientX, clientY)) {
      return null;
    }

    return {
      contextType,
      media: matchedMedia,
      article,
      dialog,
      gridPostLink,
      directPostShortcode
    };
  }

  function containerHasCurrentShortcodeLink(container, shortcode) {
    if (!container || !shortcode || !container.querySelectorAll) return false;

    const postLinks = container.querySelectorAll("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']");
    for (const link of postLinks) {
      const href = link?.href || link?.getAttribute?.("href") || "";
      if (href.includes(`/${shortcode}/`)) return true;
    }

    return false;
  }

  function resolvePostMediaContainer(resolvedClick, shortcode) {
    if (!resolvedClick) return null;

    if (resolvedClick.gridPostLink && !resolvedClick.media) {
      return resolvedClick.gridPostLink;
    }

    if (resolvedClick.contextType === "profile-grid") {
      return resolvedClick.gridPostLink ||
        resolvedClick.media?.closest?.("a[href*='/p/'], a[href*='/reel/'], a[href*='/reels/']") ||
        resolvedClick.media;
    }

    if (!resolvedClick.media) return null;

    if (resolvedClick.contextType === "modal") {
      return resolvedClick.media.closest?.("article") ||
        resolvedClick.article ||
        resolvedClick.dialog ||
        resolvedClick.media.parentElement ||
        resolvedClick.media;
    }

    if (resolvedClick.contextType === "direct-post") {
      let node = resolvedClick.media;
      while (node) {
        if ((node.tagName === "ARTICLE" || node.tagName === "SECTION") && containerHasCurrentShortcodeLink(node, shortcode)) {
          return node;
        }
        if (node.tagName === "MAIN") break;
        node = node.parentElement;
      }

      return resolvedClick.media.closest?.("article") ||
        resolvedClick.media.closest?.("section") ||
        resolvedClick.media.closest?.("main") ||
        resolvedClick.media.parentElement ||
        resolvedClick.media;
    }

    return resolvedClick.media.closest?.("article") ||
      resolvedClick.article ||
      resolvedClick.media.parentElement ||
      resolvedClick.media;
  }

  function isVideoIntentClick(resolvedClick, isReel) {
    if (isReel) return true;
    return resolvedClick?.media?.tagName === "VIDEO";
  }

  function hasOnlyImageMediaItems(parsed) {
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items.length > 0 && items.every((item) => item && !item.isVideo);
  }

  // =========================================
  // RIGHT-CLICK HANDLER FOR POSTS
  // =========================================
  async function showPostShareMenuFromShortcode(entry, x, y) {
    const shortcode = String(entry?.shortcode || "").trim();
    const isReel = entry?.kind === "reel";
    const label = isReel ? "reel" : "post";

    if (!shortcode) {
      createMenu(x, y, [{ header: isReel ? "Could not find reel ID" : "Could not find post ID" }]);
      return;
    }

    function findSharedMediaIndex(items, mediaPk) {
      const target = String(mediaPk || "").split("_")[0];
      if (!target || !Array.isArray(items)) return 0;
      const index = items.findIndex((item) => {
        const id = String(item?.pk || item?.id || "").split("_")[0];
        return id && id === target;
      });
      return index >= 0 ? index : 0;
    }

    createMenu(x, y, [{ header: "Loading..." }]);

    try {
      const mediaItem = await fetchPostInfoWithFallback(shortcode);
      const parsed = extractMediaUrls(mediaItem, { isReel });

      if (parsed.items.length === 0 || !parsed.items[0].url) {
        throw new Error("No media URLs found");
      }

      if (isReel && hasOnlyImageMediaItems(parsed)) {
        createMenu(x, y, [
          { header: "Could not load reel video" },
          { header: "(API returned no playable video URL)" },
          { icon: icons.external(), label: "Try again", action: () => showPostShareMenuFromShortcode(entry, x, y) }
        ]);
        return;
      }

      const menuItems = [{ header: parsed.isCarousel ? "Post" : parsed.isReel ? "Reel" : "Post", section: true }];

      if (parsed.isCarousel && parsed.items.length > 1) {
        const currentIndex = findSharedMediaIndex(parsed.items, entry?.mediaPk);
        const currentItem = parsed.items[currentIndex] || parsed.items[0];
        const ext = currentItem.isVideo
          ? (currentItem.videoPlan?.container || "mp4")
          : "jpg";

        if (!currentItem.isVideo) {
          menuItems.push({
            icon: icons.copy(),
            label: "Copy",
            action: () => copyImageToClipboard(currentItem.url)
          });
        }

        menuItems.push({
          icon: icons.external(),
          label: "Open in new tab",
          action: () => openInNewTab(currentItem.url)
        });

        menuItems.push({
          icon: icons.download(),
          label: "Download",
          action: async () => {
            const filename = `${parsed.username}_${shortcode}_${currentIndex + 1}.${ext}`;
            const meta = buildPostDownloadMeta(parsed, currentItem, shortcode, currentIndex + 1, ext);
            if (currentItem.isVideo) {
              await dispatchVideoDownload(currentItem.videoPlan || null, currentItem.url, filename, meta);
            } else {
              await downloadFile(currentItem.url, filename, meta);
            }
          }
        });

        menuItems.push({
          icon: icons.layers(),
          label: `Open all ${parsed.items.length} in new tabs`,
          action: () => {
            openMultipleInNewTabs(parsed.items.map(item => item.url));
          }
        });

        menuItems.push({
          icon: icons.download(),
          label: `Download all ${parsed.items.length}`,
          action: async () => {
            const tasks = parsed.items
              .map((item, i) => {
                if (!item?.url) return null;
                const itemExt = item.isVideo
                  ? (item.videoPlan?.container || "mp4")
                  : "jpg";
                return {
                  url: item.url,
                  videoPlan: item.isVideo ? (item.videoPlan || null) : null,
                  filename: `${parsed.username}_${shortcode}_${i + 1}.${itemExt}`,
                  meta: buildPostDownloadMeta(parsed, item, shortcode, i + 1, itemExt)
                };
              })
              .filter(Boolean);
            await runBatchDownloadTasks(tasks, getActiveBulkPolicy(), {
              label: `Carousel ${shortcode}`
            });
          }
        });
      } else {
        const item = parsed.items[0];
        const ext = item.isVideo
          ? (item.videoPlan?.container || "mp4")
          : "jpg";

        if (!item.isVideo) {
          menuItems.push({
            icon: icons.copy(),
            label: "Copy",
            action: () => copyImageToClipboard(item.url)
          });
        }

        menuItems.push({
          icon: icons.external(),
          label: "Open in new tab",
          action: () => openInNewTab(item.url)
        });

        menuItems.push({
          icon: icons.download(),
          label: "Download",
          action: async () => {
            const filename = `${parsed.username}_${shortcode}.${ext}`;
            const meta = buildPostDownloadMeta(parsed, item, shortcode, 1, ext);
            if (item.isVideo) {
              await dispatchVideoDownload(item.videoPlan || null, item.url, filename, meta);
            } else {
              await downloadFile(item.url, filename, meta);
            }
          }
        });
      }

      createMenu(x, y, menuItems);
    } catch (err) {
      console.error("[Amstragram] Error loading shared", label, ":", err);
      createMenu(x, y, [
        { header: "Error loading media" },
        { header: `(${err?.message || "Unknown error"})` },
        { icon: icons.external(), label: "Try again", action: () => showPostShareMenuFromShortcode(entry, x, y) }
      ]);
    }
  }

  async function handlePostRightClick(e) {
    const target = e.target;
    const commentClick = resolveCommentMediaClick(target, e?.clientX, e?.clientY);
    if (commentClick) {
      const parentShortcode = getShortcodeFromElement(target) || commentClick.directPostShortcode || "";
      const isReelContext = isReelShortcode(commentClick.media || target, commentClick.gridPostLink);
      const permalink = parentShortcode
        ? `https://www.instagram.com/${isReelContext ? "reel" : "p"}/${parentShortcode}/`
        : getCurrentPageHref();
      const fallbackStem = parentShortcode
        ? `instagram_comment_${parentShortcode}`
        : "instagram_comment_media";
      const filename = buildDirectMediaFilename(
        commentClick.mediaInfo.url,
        fallbackStem,
        commentClick.mediaInfo.ext
      );

      e.preventDefault();
      e.stopPropagation();
      createMenu(
        e.clientX,
        e.clientY,
        buildCommentMediaMenuItems(commentClick.mediaInfo, filename, {
          shortcode: parentShortcode,
          id: parentShortcode || filename.replace(/\.[^.]+$/, ""),
          ext: commentClick.mediaInfo.ext,
          permalink
        })
      );
      return;
    }

    const resolvedClick = resolveClickedPostMedia(target, e?.clientX, e?.clientY);
    if (!resolvedClick) return;

    const isDirectPostPage = resolvedClick.contextType === "direct-post";
    const clickedMedia = resolvedClick.media;

    const isProfilePic = target.closest('header') || target.alt?.includes("profile") ||
      (clickedMedia?.tagName === "IMG" && clickedMedia.complete && clickedMedia.naturalWidth > 0 && clickedMedia.naturalWidth < 100);

    if (isProfilePic) return;

    e.preventDefault();
    e.stopPropagation();

    // On direct post pages, get shortcode from URL; otherwise use element detection
    let shortcode = isDirectPostPage
      ? (resolvedClick.directPostShortcode || getShortcodeFromElement(clickedMedia || target))
      : getShortcodeFromElement(clickedMedia || target);
    if (!shortcode) {
      shortcode = findFallbackShortcodeForResolvedClick(resolvedClick, target, e?.clientX, e?.clientY);
    }
    debugLog("[Amstragram] Right-click on post, shortcode:", shortcode, "direct page:", isDirectPostPage);

    if (!shortcode) {
      const instantUrl = getInstantPostMedia(clickedMedia);
      const isReel = isReelShortcode(clickedMedia || target, resolvedClick.gridPostLink);
      if (instantUrl) {
        if (isReel && !instantUrl.isVideo) {
          debugLog("[Amstragram] Refusing image-only reel fallback without shortcode; avoiding poster/JPG menu.");
          createMenu(e.clientX, e.clientY, [{ header: "Could not find reel ID" }]);
          return;
        }

        const ownerUsername = resolvePostOwnerUsername(resolvedClick) || "instagram";
        const isVideo = instantUrl.isVideo;
        const ext = isVideo ? "mp4" : "jpg";
        const fallbackId = isReel ? "visible_reel" : "visible_post";
        const menuItems = [{ header: isReel ? "Reel" : "Post", section: true }];

        if (!isVideo) {
          menuItems.push({
            icon: icons.copy(),
            label: "Copy",
            action: () => copyImageToClipboard(instantUrl.url)
          });
        }

        menuItems.push({
          icon: icons.external(),
          label: "Open in new tab",
          action: () => openInNewTab(instantUrl.url)
        });

        menuItems.push({
          icon: icons.download(),
          label: "Download",
          action: () => downloadFile(instantUrl.url, `${ownerUsername}_${fallbackId}.${ext}`, {
            type: isReel ? "reel" : "post",
            username: ownerUsername,
            shortcode: "",
            id: fallbackId,
            index: 1,
            ext: ext,
            authorUsername: ownerUsername,
            permalink: getCurrentPageHref()
          })
        });

        createMenu(e.clientX, e.clientY, menuItems);
        return;
      }

      createMenu(e.clientX, e.clientY, [{ header: isReel ? "Could not find reel ID" : "Could not find post ID" }]);
      return;
    }

    const mediaContainer = resolvePostMediaContainer(resolvedClick, shortcode);
    const isReel = isReelShortcode(clickedMedia || target, resolvedClick.gridPostLink);

    function recordPostFallbackDiagnostic(parsed, item, sourceLabel) {
      const fallback = item?.fallback || null;
      if (!fallback) return;
      if (typeof DOWNLOAD_PIPELINE_CORE === "undefined" || typeof DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic !== "function") return;
      DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic({
        level: "fallback",
        surface: "right_click",
        type: parsed?.isReel ? "reel" : "post",
        mediaKind: item?.isVideo ? "video" : "image",
        identity: { shortcode },
        attempted: fallback.attempted || [],
        selected: {
          source: item?.selectedSource || sourceLabel || "",
          width: item?.metadata?.width || null,
          height: item?.metadata?.height || null,
          container: item?.videoPlan?.container || null
        },
        bestUnavailableReason: fallback.reason || "fallback"
      });
    }

    // API PATH: known post/reel identities use the canonical selector so
    // images, videos, DASH plans, and carousel entries all share quality rules.
    createMenu(e.clientX, e.clientY, [{ header: "Loading..." }]);

    try {
      const mediaItem = await fetchPostInfoWithFallback(shortcode);
      const parsed = extractMediaUrls(mediaItem, { isReel });

      debugLog("[Amstragram] Parsed media:", parsed);

      if (parsed.items.length === 0 || !parsed.items[0].url) {
        throw new Error("No media URLs found");
      }

      // Video surfaces can degrade to HTML metadata when GraphQL fails. That
      // fallback often contains only og:image (the cover poster), which must
      // not be exposed as a successful video download.
      if (isVideoIntentClick(resolvedClick, isReel) && hasOnlyImageMediaItems(parsed)) {
        debugLog("[Amstragram] Video right-click resolved to image-only item(s); refusing JPG fallback");
        createMenu(e.clientX, e.clientY, [
          { header: isReel ? "Could not load reel video" : "Could not load video" },
          { header: "(API returned no playable video URL)" },
          { icon: icons.external(), label: "Try again", action: () => handlePostRightClick(e) }
        ]);
        return;
      }

      // Try multiple methods to find the current slide
      let currentIndex = 0;

      // Method 1: Use the actual element that was right-clicked
      // Handle both images and videos
      let isClickedVideo = clickedMedia?.tagName === 'VIDEO';
      debugLog("[Amstragram] Right-click target:", target.tagName, target.className);
      debugLog("[Amstragram] Resolved clicked media:", clickedMedia ? clickedMedia.tagName : "none");

      // For videos, we need a different matching approach
      let clickedImg = null;
      let videoIndexFound = false;

      if (isClickedVideo) {
        debugLog("[Amstragram] Clicked on video, looking for video index in carousel");

        // Method 1 (MOST RELIABLE): Check indicator dots first
        // Dots directly represent the current slide position
        const dotContainer = mediaContainer?.querySelector('div._acnb');
        if (dotContainer && parsed.items.length > 1) {
          const dots = dotContainer.querySelectorAll(':scope > div');
          debugLog("[Amstragram] Found", dots.length, "indicator dots");
          for (let i = 0; i < dots.length; i++) {
            const dot = dots[i];
            const style = window.getComputedStyle(dot);
            const bgColor = style.backgroundColor;
            // Active dots are usually fully white (255,255,255) vs semi-transparent
            // Parse the rgba values to check brightness
            const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbMatch) {
              const brightness = (parseInt(rgbMatch[1]) + parseInt(rgbMatch[2]) + parseInt(rgbMatch[3])) / 3;
              // Active dot is bright (close to 255), inactive is dim
              if (brightness > 200) {
                debugLog("[Amstragram] Found active dot at index:", i, "brightness:", brightness);
                if (i < parsed.items.length) {
                  currentIndex = i;
                  videoIndexFound = true;
                }
                break;
              }
            }
          }
        }

        // Method 2: Calculate from carousel transform
        if (!videoIndexFound && parsed.items.length > 1) {
          const carouselUl = mediaContainer?.querySelector('ul[style*="transform"]') ||
            mediaContainer?.querySelector('[role="presentation"] ul');
          if (carouselUl) {
            const transformStyle = carouselUl.style.transform || window.getComputedStyle(carouselUl).transform;
            const transformMatch = transformStyle?.match(/translateX\((-?\d+)/);
            if (transformMatch) {
              const translateX = Math.abs(parseInt(transformMatch[1]));
              const firstLi = carouselUl.querySelector(':scope > li');
              const itemWidth = firstLi?.offsetWidth || firstLi?.getBoundingClientRect().width || 0;
              if (itemWidth > 0) {
                const calculatedIndex = Math.round(translateX / itemWidth);
                debugLog("[Amstragram] Calculated index from transform:", calculatedIndex, "(translateX:", translateX, "itemWidth:", itemWidth, ")");
                if (calculatedIndex < parsed.items.length) {
                  currentIndex = calculatedIndex;
                  videoIndexFound = true;
                }
              }
            }
          }
        }

        // Method 3: Find video position in carousel li elements
        // Note: This can be unreliable if Instagram uses extra li elements for buffering
        if (!videoIndexFound) {
          const videoIndex = getCarouselSlideIndexFromMedia(clickedMedia, parsed.items.length);
          if (videoIndex !== -1) {
            debugLog("[Amstragram] Video is in carousel li index:", videoIndex);
            currentIndex = videoIndex;
            videoIndexFound = true;
          }
        }

        // Method 4: If only one video in carousel, use that
        if (!videoIndexFound && parsed.items.length > 1) {
          const videoIndices = parsed.items.map((item, i) => item.isVideo ? i : -1).filter(i => i !== -1);
          debugLog("[Amstragram] Video indices in API data:", videoIndices);
          if (videoIndices.length === 1) {
            currentIndex = videoIndices[0];
            videoIndexFound = true;
            debugLog("[Amstragram] Only one video in carousel, using index:", currentIndex);
          }
        }

        debugLog("[Amstragram] Video detection result - index:", currentIndex, "found:", videoIndexFound);
      } else {
        clickedImg = clickedMedia;
      }

      // Use our video detection result
      let indexFoundViaVideo = isClickedVideo && videoIndexFound;

      if (!indexFoundViaVideo && clickedImg && !isProfileImage(clickedImg) && parsed.items.length > 1) {
        debugLog("[Amstragram] Using right-clicked image:", clickedImg.src?.substring(0, 100));
        const matchedIndex = matchVisibleImageToApiData(clickedImg, parsed.items);
        if (matchedIndex !== -1) {
          currentIndex = matchedIndex;
          debugLog("[Amstragram] Matched clicked image to index:", currentIndex);
        } else {
          const slideIndex = getCarouselSlideIndexFromMedia(clickedImg, parsed.items.length);
          if (slideIndex !== -1) {
            currentIndex = slideIndex;
            debugLog("[Amstragram] Matched clicked image carousel li to index:", currentIndex);
          } else {
            // Method 2: Try finding visible image
            const visibleImg = findCurrentVisibleImage(mediaContainer);
            if (visibleImg) {
              const visibleMatchedIndex = matchVisibleImageToApiData(visibleImg, parsed.items);
              if (visibleMatchedIndex !== -1) {
                currentIndex = visibleMatchedIndex;
                debugLog("[Amstragram] Matched visible image to index:", currentIndex);
              } else {
                currentIndex = detectCurrentSlideIndex(mediaContainer, parsed.items.length);
              }
            } else {
              currentIndex = detectCurrentSlideIndex(mediaContainer, parsed.items.length);
            }
          }
        }
      } else if (!indexFoundViaVideo && !isClickedVideo && parsed.items.length > 1) {
        // Fallback for non-video items when image matching failed
        const visibleImg = findCurrentVisibleImage(mediaContainer);
        if (visibleImg) {
          const matchedIndex = matchVisibleImageToApiData(visibleImg, parsed.items);
          if (matchedIndex !== -1) {
            currentIndex = matchedIndex;
          } else {
            currentIndex = detectCurrentSlideIndex(mediaContainer, parsed.items.length);
          }
        } else {
          currentIndex = detectCurrentSlideIndex(mediaContainer, parsed.items.length);
        }
      } else if (!indexFoundViaVideo && isClickedVideo && parsed.items.length > 1) {
        // Last resort for videos: use detectCurrentSlideIndex
        debugLog("[Amstragram] Video detection failed, using slide index detection");
        currentIndex = detectCurrentSlideIndex(mediaContainer, parsed.items.length);
      }

      debugLog("[Amstragram] Final carousel index:", currentIndex, "of", parsed.items.length);
      const menuItems = [{ header: parsed.isCarousel ? "Post" : parsed.isReel ? "Reel" : "Post", section: true }];

      if (parsed.isCarousel && parsed.items.length > 1) {
        const currentItem = parsed.items[currentIndex] || parsed.items[0];
        recordPostFallbackDiagnostic(parsed, currentItem, "carousel_current");
        const ext = currentItem.isVideo
          ? (currentItem.videoPlan?.container || "mp4")
          : "jpg";

        // Copy current (images only)
        if (!currentItem.isVideo) {
          menuItems.push({
            icon: icons.copy(),
            label: "Copy",
            action: () => copyImageToClipboard(currentItem.url)
          });
        }

        // Open current
        menuItems.push({
          icon: icons.external(),
          label: "Open in new tab",
          action: () => openInNewTab(currentItem.url)
        });

        // Download current
        menuItems.push({
          icon: icons.download(),
          label: "Download",
          action: async () => {
            const filename = `${parsed.username}_${shortcode}_${currentIndex + 1}.${ext}`;
            const meta = buildPostDownloadMeta(parsed, currentItem, shortcode, currentIndex + 1, ext);
            if (currentItem.isVideo) {
              await dispatchVideoDownload(currentItem.videoPlan || null, currentItem.url, filename, meta);
            } else {
              await downloadFile(currentItem.url, filename, meta);
            }
          }
        });

        // Open all
        menuItems.push({
          icon: icons.layers(),
          label: `Open all ${parsed.items.length} in new tabs`,
          action: () => {
            openMultipleInNewTabs(parsed.items.map(item => item.url));
          }
        });

        // Download all
        menuItems.push({
          icon: icons.download(),
          label: `Download all ${parsed.items.length}`,
          action: async () => {
            const tasks = parsed.items
              .map((item, i) => {
                if (!item?.url) return null;
                const itemExt = item.isVideo
                  ? (item.videoPlan?.container || "mp4")
                  : "jpg";
                return {
                  url: item.url,
                  videoPlan: item.isVideo ? (item.videoPlan || null) : null,
                  filename: `${parsed.username}_${shortcode}_${i + 1}.${itemExt}`,
                  meta: buildPostDownloadMeta(parsed, item, shortcode, i + 1, itemExt)
                };
              })
              .filter(Boolean);
            await runBatchDownloadTasks(tasks, getActiveBulkPolicy(), {
              label: `Carousel ${shortcode}`
            });
          }
        });
      } else {
        const item = parsed.items[0];
        recordPostFallbackDiagnostic(parsed, item, "single_item");
        const ext = item.isVideo
          ? (item.videoPlan?.container || "mp4")
          : "jpg";

        // Copy (images only)
        if (!item.isVideo) {
          menuItems.push({
            icon: icons.copy(),
            label: "Copy",
            action: () => copyImageToClipboard(item.url)
          });
        }

        // Open
        menuItems.push({
          icon: icons.external(),
          label: "Open in new tab",
          action: () => openInNewTab(item.url)
        });

        // Download
        menuItems.push({
          icon: icons.download(),
          label: "Download",
          action: async () => {
            const filename = `${parsed.username}_${shortcode}.${ext}`;
            const meta = buildPostDownloadMeta(parsed, item, shortcode, 1, ext);
            if (item.isVideo) {
              await dispatchVideoDownload(item.videoPlan || null, item.url, filename, meta);
            } else {
              await downloadFile(item.url, filename, meta);
            }
          }
        });
      }

      createMenu(e.clientX, e.clientY, menuItems);

    } catch (err) {
      console.error("[Amstragram] Error:", err);
      createMenu(e.clientX, e.clientY, [
        { header: "Error loading media" },
        { header: `(${err?.message || "Unknown error"})` },
        { icon: icons.external(), label: "Try again", action: () => handlePostRightClick(e) }
      ]);
    }
  }
  // =========================================
  // PROFILE PICTURE RIGHT-CLICK HANDLER
  // =========================================
  async function handleProfilePicRightClick(e) {
    const target = e.target;

    // Check if this is a profile picture
    const isProfilePic = target.tagName === "IMG" && (
      target.alt?.toLowerCase().includes("profile picture") ||
      target.getAttribute('data-testid') === 'user-avatar' ||
      target.closest('header')?.contains(target)
    );

    if (!isProfilePic) return;

    // Get username from the page
    let username = null;

    // Method 1: From URL if on profile page
    const path = window.location.pathname;
    const nonProfilePaths = ["/explore", "/reels", "/direct", "/accounts", "/settings", "/language", "/create", "/notifications", "/nametag", "/directory", "/ar", "/legal", "/terms", "/about", "/emails", "/session", "/challenge", "/lite", "/stories", "/p/", "/reel/", "/tv/"];
    if (path !== "/" && !nonProfilePaths.some(p => path.startsWith(p))) {
      username = path.split("/").filter(Boolean)[0];
    }

    // Method 2: From nearby link (for profile pics in posts/comments)
    if (!username) {
      const nearbyLinks = [
        target.closest('a[href*="/"]'),
        target.closest('header')?.querySelector('a[href*="/"]')
      ].filter(Boolean);
      for (const nearbyLink of nearbyLinks) {
        const linkMatch = nearbyLink.href.match(/instagram\.com\/([^/?]+)/);
        if (linkMatch && !['p', 'reel', 'stories', 'explore'].includes(linkMatch[1])) {
          username = linkMatch[1];
          break;
        }
      }
    }

    if (!username) {
      debugLog("[Amstragram] Could not determine username for profile pic");
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const storyRingContext = getProfileStoryRingContext(target, username);
    const storyRingDetected = Boolean(storyRingContext);
    const isHeaderProfilePic = Boolean(target.closest('header')?.contains(target));
    const shouldAttemptStoryMenu = storyRingDetected || isHeaderProfilePic;

    debugLog("[Amstragram] Profile picture right-click for:", username, "stories:", storyRingDetected, "story-fetch:", shouldAttemptStoryMenu);

    // FAST PATH: Try to get profile picture URL from page data first
    const hdUrlFromPage = getProfilePicFromPageData(username);

    if (hdUrlFromPage) {
      debugLog("[Amstragram] Found profile pic candidate in page data");
    }

    // Always confirm with API first. Page data can be stale and briefly point to
    // Instagram's anonymous/default avatar on initial loads.
    createMenu(e.clientX, e.clientY, [{ header: "Loading..." }]);

    const appId = getAppID();

    try {
      const response = await fetchProfileInfoDirect(username, appId);
      const apiUrl = normalizeProfilePicUrl(response?.hdUrl);
      const fallbackUrl = normalizeProfilePicUrl(hdUrlFromPage);
      const profileUserId = response?.userId ? String(response.userId) : "";
      const profileFullName = response?.fullName ? String(response.fullName) : "";
      let profilePicUrl = null;

      if (response?.success && apiUrl && isTrustedInstagramMediaUrl(apiUrl) && !isPlaceholderProfilePicUrl(apiUrl)) {
        profilePicUrl = apiUrl;
      } else if (isValidHdProfilePicUrl(fallbackUrl)) {
        debugLog("[Amstragram] API profile picture unavailable, using validated page-data fallback");
        profilePicUrl = fallbackUrl;
      }

      if (!profilePicUrl) {
        const reason = response?.error || "Profile picture unavailable";
        debugLog("[Amstragram] Profile pic fetch failed:", reason);
        createMenu(e.clientX, e.clientY, [
          { header: "Could not load profile picture" },
          { header: `(${reason})` }
        ]);
        return;
      }

      const profileItems = buildProfilePicMenuItems(profilePicUrl, username, profileUserId, profileFullName);
      if (!shouldAttemptStoryMenu) {
        createMenu(e.clientX, e.clientY, profileItems);
        return;
      }

      try {
        const storyLookupUsername = storyRingContext?.username || username;
        const canReuseProfileUserId = profileUserId && (!storyRingContext?.username || storyLookupUsername === username);
        const storyRes = await fetchStoryInfoDirect(storyLookupUsername, null, appId, {
          userId: canReuseProfileUserId ? profileUserId : ""
        });
        if (storyRes?.success && storyRes.data?.items?.length > 0) {
          const allStoryItems = Array.isArray(storyRes.allItemsData) && storyRes.allItemsData.length > 0
            ? storyRes.allItemsData
            : storyRes.data.items;
          const firstItem = storyRes.data.items[0] || allStoryItems[0];
          const storyMediaId = firstItem?.pk || firstItem?.id || "media";
          const storyItems = buildStoryMenuItems(firstItem, storyLookupUsername, storyMediaId, false, allStoryItems);
          showCombinedProfileMenu(profileItems, storyItems, e.clientX, e.clientY);
          return;
        }

        debugLog("[Amstragram] No active stories returned for profile avatar");
      } catch (storyErr) {
        debugLog("[Amstragram] Story fetch failed, showing profile pic only:", storyErr?.message || storyErr);
      }

      createMenu(e.clientX, e.clientY, profileItems);
    } catch (err) {
      console.error("[Amstragram] Profile pic fetch error:", err);
      createMenu(e.clientX, e.clientY, [
        { header: "Error loading profile picture" },
        { header: err?.message || "Unknown error" }
      ]);
    }
  }

  function parseProfileStoryUsernameFromHref(href) {
    if (!href) return null;

    try {
      const url = new URL(href, window.location?.origin || "https://www.instagram.com");
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "stories" || parts[1] === "highlights") return null;

      const candidate = parts[1] || "";
      if (!candidate || !/^[A-Za-z0-9._]+$/.test(candidate)) return null;
      return candidate;
    } catch (err) {
      return null;
    }
  }

  // Instagram does not keep the story-ring link structure stable.
  // Sometimes the avatar image is nested inside the link; other times the link only exists elsewhere in the header.
  function getProfileStoryRingContext(imgElement, expectedUsername = "") {
    if (!imgElement) return null;

    const normalizedExpected = String(expectedUsername || "").trim().toLowerCase();
    const candidateRoots = [
      typeof imgElement.closest === "function" ? imgElement.closest('a[href*="/stories/"]') : null,
      typeof imgElement.closest === "function" ? imgElement.closest("header") : null,
      typeof imgElement.closest === "function" ? imgElement.closest("section") : null,
      imgElement.parentElement || null
    ].filter(Boolean);

    const visitedLinks = new Set();
    const selector = 'a[href*="/stories/"]';

    for (const root of candidateRoots) {
      const links = [];
      const rootHref = root.getAttribute?.("href") || root.href || "";
      if (rootHref) {
        links.push(root);
      }
      if (typeof root.matches === "function" && root.matches(selector)) {
        links.push(root);
      }
      if (typeof root.querySelectorAll === "function") {
        links.push(...root.querySelectorAll(selector));
      }

      for (const link of links) {
        if (!link || visitedLinks.has(link)) continue;
        visitedLinks.add(link);

        const href = link.getAttribute?.("href") || link.href || "";
        const storyUsername = parseProfileStoryUsernameFromHref(href);
        if (!storyUsername) continue;
        if (normalizedExpected && storyUsername.toLowerCase() !== normalizedExpected) continue;

        return {
          link: link,
          href: href,
          username: storyUsername
        };
      }
    }

    return null;
  }

  // Highlights use /stories/highlights/{id}/ and should not trigger the story profile menu.
  function hasStoryRing(imgElement, expectedUsername = "") {
    return Boolean(getProfileStoryRingContext(imgElement, expectedUsername));
  }

  const profileTestExportHook = typeof window !== "undefined" && typeof window._testExport === "function"
    ? window._testExport
    : null;

  if (profileTestExportHook) profileTestExportHook("getProfileStoryRingContext", getProfileStoryRingContext);
  if (profileTestExportHook) profileTestExportHook("hasStoryRing", hasStoryRing);

  // Build profile picture menu items without rendering a menu.
  function buildProfilePicMenuItems(url, username, profileUserId = "", fullName = "") {
    return [
      { header: "Profile picture", section: true },
      {
        icon: icons.copy(),
        label: "Copy",
        action: () => copyImageToClipboard(url)
      },
      {
        icon: icons.external(),
        label: "Open in new tab",
        action: () => openInNewTab(url)
      },
      {
        icon: icons.download(),
        label: "Download",
        action: () => downloadFile(url, `${username}_profile.jpg`, {
          type: "profile_pic",
          username: username,
          fullName: fullName || "",
          id: username,
          index: 1,
          ext: "jpg",
          caption: "",
          altText: "",
          hashtags: [],
          takenAt: null,
          authorId: profileUserId || "",
          authorUsername: username,
          permalink: `https://www.instagram.com/${username}/`,
          mediaKind: "image",
          carouselTotal: 1
        })
      }
    ];
  }

  if (profileTestExportHook) profileTestExportHook("buildProfilePicMenuItems", buildProfilePicMenuItems);

  function showCombinedProfileMenu(profileItems, storyItems, x, y) {
    createMenu(x, y, [...profileItems, { divider: true }, ...storyItems]);
  }

  // Try to extract profile picture URL from the page's embedded data
  function getProfilePicFromPageData(username) {
    // Instagram embeds user data in JSON script tags on profile pages
    const scripts = document.querySelectorAll('script[type="application/json"]');
    const normalizedUsername = (username || "").toLowerCase();

    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.length > 1000000) continue; // Skip huge scripts
      const lowerContent = content.toLowerCase();

      // Scope search to the current username when possible to avoid stale cached data
      const usernameIndex = normalizedUsername ? lowerContent.indexOf(`"username":"${normalizedUsername}"`) : -1;
      const searchArea = usernameIndex !== -1
        ? content.substring(Math.max(0, usernameIndex - 5000), Math.min(content.length, usernameIndex + 5000))
        : content;

      // Look for profile picture URL patterns
      // Instagram uses hd_profile_pic_url_info or hd_profile_pic_versions

      // Pattern 1: hd_profile_pic_url_info - look for highest quality
      // The URL with "1080" in the encoding tag is typically the largest candidate
      const hdInfoMatches = searchArea.matchAll(/"hd_profile_pic_url_info"\s*:\s*\{[^}]*?"url"\s*:\s*"([^"]+)"/g);
      for (const match of hdInfoMatches) {
        const url = normalizeProfilePicUrl(match[1]);
        if (isValidHdProfilePicUrl(url)) {
          debugLog("[Amstragram] Found profile picture URL from hd_profile_pic_url_info");
          return url;
        }
      }

      // Pattern 2: hd_profile_pic_versions array - get the largest one
      const versionsMatch = searchArea.match(/"hd_profile_pic_versions"\s*:\s*\[([^\]]+)\]/);
      if (versionsMatch) {
        // Extract all URLs from the versions array and pick the largest
        const urlMatches = versionsMatch[1].matchAll(/\{[^}]*?"url"\s*:\s*"([^"]+)"[^}]*?\}/g);
        let bestUrl = null;
        let bestWidth = 0;
        for (const urlMatch of urlMatches) {
          const url = normalizeProfilePicUrl(urlMatch[1]);
          // Try to find width in the same object
          const widthMatch = urlMatch[0].match(/"width"\s*:\s*(\d+)/);
          const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
          if (isValidHdProfilePicUrl(url)) {
            if (width > bestWidth) {
              bestWidth = width;
              bestUrl = url;
            } else if (!bestUrl) {
              bestUrl = url;
            }
          }
        }
        if (bestUrl) {
          debugLog("[Amstragram] Found profile picture URL from hd_profile_pic_versions");
          return bestUrl;
        }
      }

      // Pattern 3: profile_pic_url_hd (older format)
      const hdMatch2 = searchArea.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/);
      if (hdMatch2) {
        const url = normalizeProfilePicUrl(hdMatch2[1]);
        if (isValidHdProfilePicUrl(url)) {
          debugLog("[Amstragram] Found profile picture URL from profile_pic_url_hd");
          return url;
        }
      }
    }

    return null;
  }

  // STORY HANDLING
  // =========================================

  // Parse the story/highlight URL to get type and IDs
  function parseStoryUrl() {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);

    // URL patterns:
    // /stories/username/media_id/ - regular story
    // /stories/highlights/highlight_id/ - story highlight
    // /stories/highlights/highlight_id/media_id/ - specific item in highlight

    if (parts[0] !== "stories") return null;

    const isHighlight = parts[1] === "highlights";

    if (isHighlight) {
      // Highlight URL: /stories/highlights/highlight_id/
      const highlightId = parts[2] || null;
      // There might be a specific media ID as the 4th part
      const mediaId = parts[3] && /^\d{10,}$/.test(parts[3]) ? parts[3] : null;

      return {
        type: "highlight",
        highlightId: highlightId,
        mediaId: mediaId,
        username: null // We'll need to get this from the page or API
      };
    } else {
      // Regular story URL: /stories/username/media_id/
      const username = parts[1] || null;
      const mediaId = parts.find(p => /^\d{10,}$/.test(p)) || null;

      return {
        type: "story",
        username: username,
        mediaId: mediaId,
        highlightId: null
      };
    }
  }

  // Try to resolve the highlight owner's username for filename generation.
  // Highlight URLs don't include username, so we infer from nearby profile links.
  function getHighlightOwnerUsername(section) {
    const reserved = new Set(["stories", "highlights", "explore", "reels", "direct", "accounts", "p", "reel", "tv"]);

    function parseUsernameFromHref(href) {
      if (!href) return null;
      try {
        const url = new URL(href, window.location.origin);
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length === 0) return null;
        const candidate = parts[0];
        if (!candidate || reserved.has(candidate.toLowerCase())) return null;
        if (!/^[A-Za-z0-9._]+$/.test(candidate)) return null;
        return candidate;
      } catch (e) {
        return null;
      }
    }

    const roots = [section, getActiveStorySection(), document];
    const selectors = [
      "header a[href]",
      "a[href^='/'][role='link']",
      "a[href*='instagram.com/']"
    ];

    for (const root of roots) {
      if (!root || typeof root.querySelectorAll !== "function") continue;
      for (const selector of selectors) {
        const anchors = root.querySelectorAll(selector);
        for (const anchor of anchors) {
          const username = parseUsernameFromHref(anchor.getAttribute("href") || anchor.href);
          if (username) return username;
        }
      }
    }

    return null;
  }

  function getHighlightBubbleContext(target) {
    if (!target || typeof target.closest !== "function") return null;

    const link = target.closest("a[href*='/stories/highlights/']");
    if (!link) return null;

    const href = link.getAttribute("href") || link.href || "";
    if (!href) return null;

    try {
      const url = new URL(href, window.location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] !== "stories" || parts[1] !== "highlights") return null;

      const highlightId = parts[2] || "";
      if (!highlightId || !/^[A-Za-z0-9._-]+$/.test(highlightId)) return null;

      const mediaId = parts[3] && /^\d{10,}$/.test(parts[3]) ? parts[3] : null;

      return {
        highlightId: highlightId,
        mediaId: mediaId,
        link: link
      };
    } catch (e) {
      return null;
    }
  }

  function getStoryBubbleContext(target) {
    if (!target) return null;

    function isLikelyStoryBubbleImage(node) {
      if (!node || node.tagName !== "IMG") return false;

      const rect = typeof node.getBoundingClientRect === "function"
        ? node.getBoundingClientRect()
        : null;
      const width = Number(rect?.width || node.width || node.clientWidth || 0);
      const height = Number(rect?.height || node.height || node.clientHeight || 0);
      if (width < 28 || height < 28 || width > 140 || height > 140) return false;

      const ratio = width / Math.max(height, 1);
      if (ratio < 0.8 || ratio > 1.25) return false;

      const top = Number(rect?.top);
      if (Number.isFinite(top) && top > 420) return false;

      return true;
    }

    function extractUsernameTextFromRoot(root) {
      if (!root) return null;

      const reserved = new Set([
        "stories",
        "highlights",
        "following",
        "suggested",
        "watch",
        "view",
        "live",
        "new",
        "add",
        "your",
        "story"
      ]);

      const textCandidates = [];
      const seen = new Set();

      function addCandidate(rawValue) {
        const value = String(rawValue || "").trim();
        if (!value || seen.has(value)) return;
        seen.add(value);
        if (value.length > 30) return;
        if (!/^[A-Za-z0-9._]+$/.test(value)) return;
        if (reserved.has(value.toLowerCase())) return;
        textCandidates.push(value);
      }

      addCandidate(root.textContent);

      if (typeof root.querySelectorAll === "function") {
        const nodes = root.querySelectorAll("[dir='auto'], span, div, a, button");
        for (const node of nodes) {
          addCandidate(node.textContent);
        }
      }

      return textCandidates[0] || null;
    }

    function parseStoryLink(link) {
      if (!link) return null;
      const href = link.getAttribute?.("href") || link.href || "";
      if (!href) return null;

      try {
        const url = new URL(href, window.location?.origin || "https://www.instagram.com");
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts[0] !== "stories" || parts[1] === "highlights") return null;

        const username = parts[1] || "";
        if (!username || !/^[A-Za-z0-9._]+$/.test(username)) return null;

        const mediaId = parts.find((part, index) => index >= 2 && /^\d{10,}$/.test(part)) || null;

        return {
          username: username,
          mediaId: mediaId,
          link: link
        };
      } catch (e) {
        return null;
      }
    }

    const selector = "a[href*='/stories/']";
    const candidateRoots = [];
    if (typeof target.closest === "function") {
      candidateRoots.push(target.closest(selector));
      candidateRoots.push(target.closest("[role='button']"));
      candidateRoots.push(target.closest("button"));
      candidateRoots.push(target.closest("li"));
      candidateRoots.push(target.closest("article"));
      candidateRoots.push(target.closest("header"));
      candidateRoots.push(target.closest("section"));
      candidateRoots.push(target.closest("main"));
    }

    let ancestor = target;
    let depth = 0;
    while (ancestor && depth < 8) {
      candidateRoots.push(ancestor);
      candidateRoots.push(ancestor.parentElement || null);
      ancestor = ancestor.parentElement || null;
      depth += 1;
    }

    const visitedRoots = new Set();
    const visitedLinks = new Set();

    for (const root of candidateRoots) {
      if (!root || visitedRoots.has(root)) continue;
      visitedRoots.add(root);

      const links = [];
      const rootHref = root.getAttribute?.("href") || root.href || "";
      if (rootHref) links.push(root);
      if (typeof root.querySelectorAll === "function") {
        links.push(...root.querySelectorAll(selector));
      }
      if (root.parentElement && typeof root.parentElement.querySelectorAll === "function") {
        links.push(...root.parentElement.querySelectorAll(selector));
      }

      for (const link of links) {
        if (!link || visitedLinks.has(link)) continue;
        visitedLinks.add(link);
        const parsed = parseStoryLink(link);
        if (parsed) return parsed;
      }
    }

    if (!isLikelyStoryBubbleImage(target)) {
      return null;
    }

    for (const root of candidateRoots) {
      if (!root) continue;
      const username = extractUsernameTextFromRoot(root);
      if (!username) continue;

      return {
        username: username,
        mediaId: null,
        link: null
      };
    }

    return null;
  }

  const storyTestExportHook = typeof window !== "undefined" && typeof window._testExport === "function"
    ? window._testExport
    : null;

  if (storyTestExportHook) storyTestExportHook("getStoryBubbleContext", getStoryBubbleContext);

  async function handleStoryBubbleRightClick(e) {
    if (window.location.pathname !== "/") return false;

    const context = getStoryBubbleContext(e.target);
    if (!context) return false;

    e.preventDefault();
    e.stopPropagation();

    const section = context.link?.closest?.("section")
      || (typeof e.target?.closest === "function" ? e.target.closest("section") : null);
    const displayName = context.username || "story";
    const targetMediaId = context.mediaId || null;
    const menuMediaId = targetMediaId || "media";

    createMenu(e.clientX, e.clientY, [{ header: "Loading story..." }]);

    const appId = getAppID();

    try {
      const [storyResult, profileResult] = await Promise.allSettled([
        fetchStoryInfoDirect(context.username, targetMediaId, appId),
        fetchProfileInfoDirect(context.username, appId)
      ]);

      const res = storyResult.status === "fulfilled" ? storyResult.value : null;
      debugLog("[Amstragram] Story bubble API response:", res);

      let profileItems = null;
      if (profileResult.status === "fulfilled") {
        const profileInfo = profileResult.value;
        const profileUrl = normalizeProfilePicUrl(profileInfo?.hdUrl);
        const profileUserId = profileInfo?.userId ? String(profileInfo.userId) : "";
        const profileFullName = profileInfo?.fullName ? String(profileInfo.fullName) : "";
        if (profileInfo?.success && isValidHdProfilePicUrl(profileUrl) && typeof buildProfilePicMenuItems === "function") {
          profileItems = buildProfilePicMenuItems(profileUrl, context.username, profileUserId, profileFullName);
        }
      } else {
        debugLog("[Amstragram] Story bubble profile fetch failed:", profileResult.reason?.message || profileResult.reason);
      }

      if (res?.success && res.data?.items?.length > 0) {
        const allStoryItems = Array.isArray(res.allItemsData) && res.allItemsData.length > 0
          ? res.allItemsData
          : res.data.items;
        const firstItem = res.data.items[0] || allStoryItems[0];
        const storyMediaId = firstItem?.pk || firstItem?.id || menuMediaId;
        const storyItems = buildStoryMenuItems(firstItem, context.username, storyMediaId, false, allStoryItems);

        if (profileItems && typeof showCombinedProfileMenu === "function") {
          showCombinedProfileMenu(profileItems, storyItems, e.clientX, e.clientY);
          return true;
        }

        createMenu(e.clientX, e.clientY, storyItems);
        return true;
      }

      if (profileItems) {
        createMenu(e.clientX, e.clientY, profileItems);
        return true;
      }

      if (storyResult.status === "fulfilled") {
        handleStoryApiResponse(
          res,
          displayName,
          targetMediaId,
          menuMediaId,
          e.clientX,
          e.clientY,
          appId,
          section,
          false,
          ""
        );
        return true;
      }

      throw storyResult.reason;
    } catch (err) {
      console.error("[Amstragram] Story bubble fetch error:", err);
      createMenu(e.clientX, e.clientY, [
        { header: "Error loading story" },
        { header: err?.message || "Unknown error" }
      ]);
    }

    return true;
  }

  async function handleHighlightBubbleRightClick(e) {
    if (window.location.pathname.includes("/stories/")) return false;

    const context = getHighlightBubbleContext(e.target);
    if (!context) return false;

    e.preventDefault();
    e.stopPropagation();

    const section = context.link.closest("section");
    const profileUsername = typeof getCurrentProfileUsername === "function"
      ? getCurrentProfileUsername()
      : "";
    const displayName = profileUsername || getHighlightOwnerUsername(section) || "highlight";
    const targetMediaId = context.mediaId || null;
    const menuMediaId = targetMediaId || context.highlightId || "media";

    createMenu(e.clientX, e.clientY, [{ header: "Loading highlight..." }]);

    const appId = getAppID();

    try {
      const res = await fetchHighlightInfoDirect(context.highlightId, targetMediaId, appId);
      debugLog("[Amstragram] Highlight bubble API response:", res);
      handleStoryApiResponse(
        res,
        displayName,
        targetMediaId,
        menuMediaId,
        e.clientX,
        e.clientY,
        appId,
        section,
        true,
        ""
      );
    } catch (err) {
      console.error("[Amstragram] Highlight bubble fetch error:", err);
      createMenu(e.clientX, e.clientY, [
        { header: "Error loading highlight" },
        { header: err?.message || "Unknown error" }
      ]);
    }

    return true;
  }

  // =========================================
  // UNIFIED MEDIA RESOLVER
  // Single source of truth for stories AND highlights.
  // CRITICAL RULE: if a video element is visible, NEVER return image data.
  // =========================================
  function getPointerPoint(pointer) {
    const x = Number(pointer?.x);
    const y = Number(pointer?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function resolveCurrentStoryMedia(section, pointer = null) {
    const activeSection = getActiveStorySection() || section;
    if (!activeSection) return null;

    // --- VIDEO ---
    const point = getPointerPoint(pointer);
    const video = (point ? getStoryVideoAtPoint(point.x, point.y, activeSection) : null)
      || getPrimaryStoryVideo(activeSection);
    if (video) {
      debugLog("[Amstragram] Visible video element found.");

      // Method 1: Use direct video source/currentSrc when available.
      const videoUrl = getBestStoryVideoUrl(video);
      const posterUrl = video.poster || video.getAttribute('poster') || '';
      const resolvedVideo = STORY_MATCHING_CORE.resolveStoryDomMedia({
        hasVideo: true,
        videoUrl: videoUrl,
        videoPosterUrl: posterUrl,
        videoWidth: video.videoWidth || 1080
      });

      if (resolvedVideo?.type === "video") {
        debugLog("[Amstragram] Resolved video via getBestStoryVideoUrl");
        return resolvedVideo;
      }

      // All DOM source methods exhausted for this video.
      // DO NOT fall through to image - return a sentinel so the caller
      // knows to use the API path.  The poster attribute (if present) is
      // attached so the API path can use it for item matching.
      debugLog("[Amstragram] Video URL extraction failed; using API fallback path.");
      return resolvedVideo;
    }

    // --- IMAGE (only when there is NO video element at all) ---
    const img = getPrimaryStoryImage(activeSection);
    if (img) {
      const src = img.src || '';
      if (src && !src.startsWith('data:') &&
        isTrustedInstagramMediaUrl(src)) {
        let bestUrl = src;
        if (img.srcset) {
          const sources = img.srcset.split(',').map(s => {
            const parts = s.trim().split(' ');
            return { url: parts[0], width: parseInt(parts[1]) || 0 };
          }).sort((a, b) => b.width - a.width);
          if (sources[0]?.url) bestUrl = sources[0].url;
        }
        const resolvedImage = STORY_MATCHING_CORE.resolveStoryDomMedia({
          hasVideo: false,
          imageUrl: bestUrl,
          imageWidth: img.naturalWidth || 1080
        });
        if (resolvedImage) {
          debugLog("[Amstragram] Resolved image URL from DOM");
        }
        return resolvedImage;
      }
    }

    return null;
  }

  async function handleStoryRightClick(e) {
    if (!window.location.pathname.includes("/stories/")) return;

    const target = e.target;
    const section = target.closest("section");
    if (!section) return;

    const isMedia = target.tagName === "IMG" || target.tagName === "VIDEO" ||
      section.querySelector("img, video");
    if (!isMedia) return;

    e.preventDefault();
    e.stopPropagation();

    const urlInfo = parseStoryUrl();
    debugLog("[Amstragram] Parsed URL info:", urlInfo);

    if (!urlInfo) {
      createMenu(e.clientX, e.clientY, [{ header: "Could not parse story URL" }]);
      return;
    }

    const isHighlight = urlInfo.type === "highlight";
    const highlightOwner = isHighlight ? getHighlightOwnerUsername(section) : null;
    const displayName = isHighlight ? (highlightOwner || "highlight") : (urlInfo.username || "story");
    const targetMediaId = urlInfo.mediaId || null;
    const menuMediaId = urlInfo.mediaId || urlInfo.highlightId || "media";
    const shouldForceApiForBatch = isHighlight;

    // ── STEP 1: TRY DOM RESOLVER ─────────────────────────────────────
    const pointerPoint = { x: e.clientX, y: e.clientY };
    const resolved = resolveCurrentStoryMedia(section, pointerPoint);

    // Story images and videos both go through the API path first so the shared
    // selector can use the highest-quality candidates instead of the displayed
    // DOM asset. DOM media remains available through the existing fallback path.

    // ── STEP 2: API PATH ─────────────────────────────────────────────
    // Either resolved is null (no media at all) or type === 'video-needs-api'
    // (video element exists but URL extraction failed — MUST use API).
    const videoPosterForMatching = resolved?.posterUrl || '';
    const expectedMediaType = (resolved?.type === "video" || resolved?.type === "video-needs-api") ? "video" : "";
    const domVideoFallbackItem = (resolved?.type === "video" && resolved?.data) ? resolved.data : null;
    const apiPathReason = shouldForceApiForBatch
      ? 'highlight-bulk-mode'
      : (resolved?.type === "image" ? 'image-quality-check' : (resolved ? 'video-needs-api' : 'no-media-found'));
    debugLog("[Amstragram] → API path.",
      "Reason:", apiPathReason,
      "Poster for matching:", videoPosterForMatching.substring(0, 80));

    createMenu(e.clientX, e.clientY, [{ header: `Loading ${isHighlight ? "highlight" : "story"}...` }]);

    const appId = getAppID();

    if (isHighlight) {
      fetchHighlightInfoDirect(urlInfo.highlightId, urlInfo.mediaId, appId).then((res) => {
        debugLog("[Amstragram] Highlight API response:", res);
        handleStoryApiResponse(res, displayName, targetMediaId, menuMediaId,
          e.clientX, e.clientY, appId, section, isHighlight, videoPosterForMatching,
          expectedMediaType, pointerPoint, domVideoFallbackItem);
      }).catch((err) => {
        console.error("[Amstragram] Highlight fetch error:", err);
        createMenu(e.clientX, e.clientY, [
          { header: "Error loading highlight" },
          { header: err?.message || "Unknown error" }
        ]);
      });
    } else {
      fetchStoryInfoDirect(urlInfo.username, urlInfo.mediaId, appId).then((res) => {
        debugLog("[Amstragram] Story API response:", res);
        handleStoryApiResponse(res, displayName, targetMediaId, menuMediaId,
          e.clientX, e.clientY, appId, section, isHighlight, videoPosterForMatching,
          expectedMediaType, pointerPoint, domVideoFallbackItem);
      }).catch((err) => {
        console.error("[Amstragram] Story fetch error:", err);
        createMenu(e.clientX, e.clientY, [
          { header: "Error loading story" },
          { header: err?.message || "Unknown error" }
        ]);
      });
    }
  }

  // Get the active story viewer section (use LAST section like instantgram does)
  function getActiveStorySection() {
    const sections = document.querySelectorAll('section');
    // Instagram uses the last section as the active story viewer
    return sections.length > 0 ? sections[sections.length - 1] : null;
  }

  // Highlights often keep preloaded media nodes in DOM; this filters to what is
  // actually visible/active to avoid selecting cached previous/next items.
  function isVisibleStoryMediaElement(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;

    const rect = el.getBoundingClientRect();
    if (rect.width < 150 || rect.height < 150) return false;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
    if (rect.right <= 0 || rect.left >= window.innerWidth) return false;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (parseFloat(style.opacity || "1") < 0.05) return false;
    if (el.closest('[aria-hidden="true"]')) return false;

    return true;
  }

  function getPrimaryStoryVideo(section) {
    if (!section) return null;
    const visibleVideos = Array.from(section.querySelectorAll('video'))
      .filter(video => isVisibleStoryMediaElement(video));

    if (visibleVideos.length === 0) return null;
    if (visibleVideos.length === 1) return visibleVideos[0];

    // Prefer a playing/ready video when multiple visible video tags exist.
    return visibleVideos.find(video => !video.paused || video.currentTime > 0 || video.readyState >= 2) || visibleVideos[0];
  }

  function getPrimaryStoryImage(section) {
    if (!section) return null;
    const candidates = Array.from(section.querySelectorAll('img[draggable="false"], img'))
      .filter(img => !isProfileImage(img) && isVisibleStoryMediaElement(img));

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

    return candidates[0];
  }

  function getStoryVideoAtPoint(x, y, section) {
    const root = section || document;
    const videos = Array.from(root.querySelectorAll('video'))
      .filter(video => isVisibleStoryMediaElement(video));

    const pointingAt = videos.filter(video => {
      const rect = video.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    if (pointingAt.length > 0) {
      return pointingAt[0];
    }

    if (typeof document.elementsFromPoint === "function") {
      const pointed = document.elementsFromPoint(x, y)
        .find(el => el.tagName === "VIDEO" && isVisibleStoryMediaElement(el));
      if (pointed) return pointed;
    }

    return null;
  }

  function getBestStoryVideoUrl(videoElement) {
    if (!videoElement) return null;

    const source = videoElement.querySelector('source[src]');
    const candidates = [
      videoElement.currentSrc,
      videoElement.src,
      videoElement.getAttribute("src"),
      source?.src,
      source?.getAttribute("src")
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const url = candidate.trim();
      if (!url || url.startsWith("blob:")) continue;
      return url;
    }

    return null;
  }

  // Handle the API response for both stories and highlights.
  // videoPosterUrl: poster attribute from the visible <video> element (if any),
  //   used as an extra matching signal for highlights.
  function storyItemHasVideo(item) {
    return Array.isArray(item?.video_versions)
      && item.video_versions.some((version) => typeof version?.url === "string" && version.url.trim());
  }

  function pickStoryVideoItem(items, preferredIndex = -1) {
    if (!Array.isArray(items) || items.length === 0) return null;
    if (Number.isInteger(preferredIndex) && preferredIndex >= 0 && preferredIndex < items.length && storyItemHasVideo(items[preferredIndex])) {
      return items[preferredIndex];
    }
    return items.find((item) => storyItemHasVideo(item)) || null;
  }

  function handleStoryApiResponse(res, displayName, targetMediaId, menuMediaId, x, y, appId, section, isHighlight = false, videoPosterUrl = '', expectedMediaType = '', pointerPoint = null, domVideoFallbackItem = null) {
    if (res?.success && res.data?.items?.length > 0) {
      const availableItems = Array.isArray(res.allItemsData) && res.allItemsData.length > 0
        ? res.allItemsData
        : res.data.items;
      let selectedItem = res.data.items[0] || availableItems[0];
      const targetId = targetMediaId ? String(targetMediaId) : null;

      // If we have multiple items (highlight with multiple slides), find the current one
      if (availableItems.length > 1 || res.allItems) {
        debugLog("[Amstragram] Multiple items found:", availableItems.length, "- trying to match current");
        const matchedItem = findCurrentItemFromAPI(availableItems, section, targetId, videoPosterUrl, expectedMediaType, pointerPoint);

        if (matchedItem) {
          selectedItem = matchedItem;
          debugLog("[Amstragram] Matched current item pk:", selectedItem.pk,
            "has_video:", !!selectedItem.video_versions);
        } else {
          debugLog("[Amstragram] ⚠ Could not match — using first item (pk:", selectedItem.pk, ")");
        }
      }

      if (expectedMediaType === "video" && !storyItemHasVideo(selectedItem)) {
        const videoFallback = pickStoryVideoItem(availableItems);
        if (videoFallback) {
          selectedItem = videoFallback;
          debugLog("[Amstragram] Visible story is video; using first API video item instead of image fallback.");
        } else if (storyItemHasVideo(domVideoFallbackItem)) {
          const resolvedMenuId = menuMediaId || targetMediaId || domVideoFallbackItem.pk || domVideoFallbackItem.id || "media";
          debugLog("[Amstragram] API returned no video item; using visible DOM video fallback.");
          showStoryMenu(domVideoFallbackItem, displayName, resolvedMenuId, x, y, isHighlight, availableItems);
          return;
        }
      }

      const resolvedMenuId = menuMediaId || targetMediaId || selectedItem.pk || selectedItem.id || "media";
      showStoryMenu(selectedItem, displayName, resolvedMenuId, x, y, isHighlight, availableItems);
    } else if (targetMediaId) {
      debugLog("[Amstragram] Trying fallback media endpoint...");
      fetchMediaInfoDirect(targetMediaId, appId).then((fallbackRes) => {
        debugLog("[Amstragram] Fallback response:", fallbackRes);
        if (fallbackRes?.success && fallbackRes.data?.items?.[0]) {
          const fallbackItem = fallbackRes.data.items[0];
          const resolvedMenuId = menuMediaId || targetMediaId || fallbackItem.pk || fallbackItem.id || "media";
          showStoryMenu(fallbackItem, displayName, resolvedMenuId, x, y, isHighlight);
        } else {
          const domStory = extractMediaFromDOM(section);
          if (domStory) {
            debugLog("[Amstragram] Using media extracted from DOM");
            showStoryMenu(domStory, displayName, menuMediaId || targetMediaId || "media", x, y, isHighlight);
          } else {
            createMenu(x, y, [
              { header: "Could not load media" },
              { header: res?.error || "(Try refreshing the page)" }
            ]);
          }
        }
      }).catch((err) => {
        console.error("[Amstragram] Media info fetch error:", err);
        const domStory = extractMediaFromDOM(section);
        if (domStory) {
          debugLog("[Amstragram] Using DOM fallback after fetch error");
          showStoryMenu(domStory, displayName, menuMediaId || targetMediaId || "media", x, y, isHighlight);
        } else {
          createMenu(x, y, [
            { header: "Error loading media" },
            { header: err?.message || "Unknown error" }
          ]);
        }
      });
    } else {
      const domStory = extractMediaFromDOM(section);
      if (domStory) {
        debugLog("[Amstragram] Using media extracted from DOM (no target media ID)");
        showStoryMenu(domStory, displayName, menuMediaId || "media", x, y, isHighlight);
      } else {
        createMenu(x, y, [
          { header: "Could not load media" },
          { header: res?.error || "(Try refreshing the page)" }
        ]);
      }
    }
  }

  // Find the currently displayed item from API results by matching with visible media
  function findCurrentItemFromAPI(items, sectionOverride, targetMediaId, videoPosterUrl = '', expectedMediaType = '', pointerPoint = null) {
    // Use the active (last) section for more reliable detection
    const section = getActiveStorySection() || sectionOverride || document.querySelector('section');
    if (!section || !Array.isArray(items) || items.length === 0) return null;

    debugLog("[Amstragram] Finding current item from", items.length, "API items");
    const visibleMedia = getVisibleStoryMedia(section, pointerPoint);
    const currentIndex = getCurrentStoryIndex(section);
    const matchedItem = STORY_MATCHING_CORE.selectStoryItemBySignals({
      items: items,
      targetMediaId: targetMediaId,
      videoPosterUrl: videoPosterUrl,
      visibleMedia: visibleMedia,
      currentIndex: currentIndex
    });

    if (matchedItem) {
      if (expectedMediaType === "video" && !storyItemHasVideo(matchedItem)) {
        const videoItem = pickStoryVideoItem(items, currentIndex);
        if (videoItem) {
          debugLog("[Amstragram] Matched item was an image but visible media is video; using video candidate.");
          return videoItem;
        }
        return null;
      }
      return matchedItem;
    }

    if (expectedMediaType === "video") {
      const videoItem = pickStoryVideoItem(items, currentIndex);
      if (videoItem) {
        debugLog("[Amstragram] No exact match for visible video; using video candidate.");
        return videoItem;
      }
    }

    debugLog("[Amstragram] Could not match current item - will use first item as fallback");
    return null;
  }

  // Get the visible story media element and its URL
  function getVisibleStoryMedia(sectionOverride, pointerPoint = null) {
    const section = getActiveStorySection() || sectionOverride || document.querySelector('section');
    if (!section) return null;

    // Check visible/active video first.
    const point = getPointerPoint(pointerPoint);
    const video = (point ? getStoryVideoAtPoint(point.x, point.y, section) : null)
      || getPrimaryStoryVideo(section);
    if (video) {
      const videoUrl = getBestStoryVideoUrl(video) || '';
      if (videoUrl && !videoUrl.startsWith('blob:')) {
        return { type: 'video', url: videoUrl };
      }

      // Try to get poster attribute
      const poster = video.getAttribute('poster');
      if (poster && !poster.startsWith('data:')) {
        return { type: 'video-poster', url: poster };
      }
    }

    // Check visible main image.
    const img = getPrimaryStoryImage(section);
    if (img && img.src && !img.src.startsWith('data:')) {
      // Prefer srcset for higher quality match
      if (img.srcset) {
        const sources = img.srcset.split(',').map(s => s.trim().split(' ')[0]);
        if (sources[0]) {
          return { type: 'image-srcset', url: sources[0] };
        }
      }
      return { type: 'image', url: img.src };
    }

    return null;
  }

  // Get current story/highlight index from progress bars
  function getCurrentStoryIndex(sectionOverride) {
    debugLog("[Amstragram] Detecting current story/highlight index...");

    // Find the story viewer section (use last/active section)
    const section = getActiveStorySection() || sectionOverride || document.querySelector('section');
    if (!section) {
      debugLog("[Amstragram] No section found");
      return -1;
    }

    debugLog("[Amstragram] Section found, children:", section.children.length);

    // Method 1: Look for the progress bar container in the header area
    const header = section.querySelector('header') || section.firstElementChild;
    if (!header) {
      debugLog("[Amstragram] No header found");
      return -1;
    }

    debugLog("[Amstragram] Header found:", header.tagName, "children:", header.children.length);

    // The progress bars are typically in a flex container near the top
    // Search all divs in header for ones that look like progress bar containers
    const possibleProgressContainers = header.querySelectorAll('div');
    debugLog("[Amstragram] Possible progress containers:", possibleProgressContainers.length);

    // Also search in section directly - Instagram sometimes puts progress bars outside header
    const sectionProgressContainers = section.querySelectorAll('div');
    const allContainers = [...possibleProgressContainers];

    // Also check first few divs in section that might be progress bars
    for (let i = 0; i < Math.min(20, sectionProgressContainers.length); i++) {
      if (!allContainers.includes(sectionProgressContainers[i])) {
        allContainers.push(sectionProgressContainers[i]);
      }
    }

    for (const container of allContainers) {
      const children = Array.from(container.children);
      // Progress bars container has multiple children (one per story/highlight item)
      if (children.length < 2) continue;

      // Check if children look like progress bar segments (thin horizontal bars)
      const firstChild = children[0];
      const rect = firstChild.getBoundingClientRect();

      // Progress bars are thin horizontal lines
      // Height should be small (< 10px)
      // Width can be very small for highlights with many items (150 items = ~2px each)
      // Minimum width of 1px, and the container should span most of the section width
      if (rect.height > 10 || rect.height < 1) continue;
      if (rect.width < 1) continue;

      // Check if this container spans a reasonable width (progress bars span the story width)
      const containerRect = container.getBoundingClientRect();
      if (containerRect.width < 100) continue; // Container too narrow

      // For many items, individual bars can be very small, so just check uniformity loosely
      const allSimilar = children.every(child => {
        const r = child.getBoundingClientRect();
        return Math.abs(r.height - rect.height) < 5;
      });
      if (!allSimilar) continue;

      debugLog("[Amstragram] Found progress container with", children.length, "segments");

      // Method A: Find partially filled bar (active/animating)
      for (let i = 0; i < children.length; i++) {
        const segment = children[i];
        const inner = segment.querySelector('div') || segment;
        const style = window.getComputedStyle(inner);
        const transform = style.transform || '';

        // Check for animation (active bar is often animating)
        const animation = style.animation || style.webkitAnimation || '';
        if (animation && animation !== 'none' && !animation.includes('0s')) {
          debugLog("[Amstragram] Found animated progress bar at index:", i);
          return i;
        }

        // Check for partial scaleX (active bar has 0 < scale < 1)
        const scaleMatch = transform.match(/scaleX\(([\d.]+)\)/);
        if (scaleMatch) {
          const scale = parseFloat(scaleMatch[1]);
          if (scale > 0.01 && scale < 0.99) {
            debugLog("[Amstragram] Found partial scaleX at index:", i, "scale:", scale);
            return i;
          }
        }

        // Check matrix transform (scaleX is first value in matrix)
        const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
        if (matrixMatch) {
          const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
          if (values.length >= 1) {
            const scale = values[0];
            if (scale > 0.01 && scale < 0.99) {
              debugLog("[Amstragram] Found partial matrix scale at index:", i, "scale:", scale);
              return i;
            }
          }
        }
      }

      // Method B: Count completed bars to find current position
      // Completed = scaleX(1) or matrix with scale 1, Upcoming = scaleX(0)
      let completedCount = 0;
      for (let i = 0; i < children.length; i++) {
        const segment = children[i];
        const inner = segment.querySelector('div') || segment;
        const style = window.getComputedStyle(inner);
        const transform = style.transform || '';

        // Parse scale value
        let scale = null;
        const scaleMatch = transform.match(/scaleX\(([\d.]+)\)/);
        if (scaleMatch) {
          scale = parseFloat(scaleMatch[1]);
        } else {
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
          if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 1) scale = values[0];
          }
        }

        if (scale !== null) {
          if (scale > 0.99) {
            // Completed bar
            completedCount++;
          } else if (scale < 0.01) {
            // Upcoming bar - current is the one just before this
            debugLog("[Amstragram] Current index by completed count:", completedCount);
            return completedCount;
          } else {
            // Partially filled - this is the current one
            debugLog("[Amstragram] Current index by partial fill:", i);
            return i;
          }
        }
      }

      // All bars completed = we're on the last one
      if (completedCount === children.length) {
        debugLog("[Amstragram] All bars complete, returning last index:", children.length - 1);
        return children.length - 1;
      }

      // Have some completed bars
      if (completedCount > 0) {
        debugLog("[Amstragram] Returning completed count as index:", completedCount);
        return completedCount;
      }
    }

    // Method 2: Try aria attributes
    const ariaProgress = section.querySelector('[aria-valuenow]');
    if (ariaProgress) {
      const current = parseInt(ariaProgress.getAttribute('aria-valuenow') || '0');
      debugLog("[Amstragram] Found aria-valuenow:", current);
      return current;
    }

    debugLog("[Amstragram] Could not determine current story index");
    return -1;
  }

  // Extract media directly from visible DOM elements - specifically for stories
  function extractMediaFromDOM(sectionOverride) {
    debugLog("[Amstragram] Extracting media from DOM for story...");

    // For stories, look specifically in the story viewer area
    // Stories are viewed in a modal/overlay that contains the story content

    // The story viewer typically has these characteristics:
    // - Full screen or near-full screen overlay
    // - Contains a single main image or video
    // - Has progress bars at the top
    // - Has navigation arrows on sides

    // Look for story-specific containers
    // Instagram story viewer usually has a specific structure with the story content
    // centered and taking up most of the viewport

    // Method 1: Look for the story image/video by checking what's in the center of the screen
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    // Get all images and videos on the page
    const root = sectionOverride || document;
    const allMedia = [...root.querySelectorAll('img, video')];

    // Filter to find the one that's:
    // 1. Large enough to be story content (not icons/thumbnails)
    // 2. Positioned in the center of the viewport
    // 3. Has story-like aspect ratio (portrait or square, typically 9:16 or similar)

    let bestMedia = null;
    let bestScore = 0;

    for (const media of allMedia) {
      const rect = media.getBoundingClientRect();

      // Skip tiny elements
      if (rect.width < 200 || rect.height < 200) continue;

      // Skip elements not visible
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;

      // Skip profile pictures (locale-neutral check + English alt fallback)
      if (media.getAttribute('data-testid') === 'user-avatar') continue;
      const alt = (media.alt || '').toLowerCase();
      if (alt.includes('profile') || alt.includes('avatar')) continue;

      // Calculate how centered this element is
      const mediaCenterX = rect.left + rect.width / 2;
      const mediaCenterY = rect.top + rect.height / 2;
      const distanceFromCenter = Math.sqrt(
        Math.pow(mediaCenterX - viewportCenterX, 2) +
        Math.pow(mediaCenterY - viewportCenterY, 2)
      );

      // Calculate size score (bigger is better for stories)
      const sizeScore = rect.width * rect.height;

      // Stories are typically portrait (taller than wide)
      const aspectRatio = rect.width / rect.height;
      const isPortraitish = aspectRatio < 1.2; // Allow some tolerance

      // Score: prioritize centered, large, portrait-ish content
      const centerScore = Math.max(0, 1000 - distanceFromCenter);
      const score = centerScore * 2 + sizeScore / 1000 + (isPortraitish ? 500 : 0);

      debugLog("[Amstragram] Media candidate:", {
        tag: media.tagName,
        width: rect.width,
        height: rect.height,
        distanceFromCenter,
        aspectRatio,
        score
      });

      if (score > bestScore) {
        // For images, make sure it has a valid src that looks like Instagram CDN
        if (media.tagName === 'IMG') {
          const src = media.src || '';
          // Instagram story images come from their CDN
          if (isTrustedInstagramMediaUrl(src)) {
            bestScore = score;
            bestMedia = media;
          }
        } else if (media.tagName === 'VIDEO') {
          const src = media.src || media.currentSrc || '';
          if (!src.startsWith('blob:')) {
            bestScore = score;
            bestMedia = media;
          }
        }
      }
    }

    if (bestMedia) {
      debugLog("[Amstragram] Best media found:", bestMedia.tagName);

      if (bestMedia.tagName === 'VIDEO') {
        const source = bestMedia.querySelector('source');
        let videoUrl = source?.src || bestMedia.src || bestMedia.currentSrc;
        if (videoUrl && !videoUrl.startsWith('blob:')) {
          return { video_versions: [{ url: videoUrl, width: bestMedia.videoWidth || 1080 }] };
        }
      } else {
        // Image
        const srcset = bestMedia.srcset;
        if (srcset) {
          const sources = srcset.split(',').map(s => {
            const parts = s.trim().split(' ');
            return { url: parts[0], width: parseInt(parts[1]) || 0 };
          }).sort((a, b) => b.width - a.width);

          if (sources[0]?.url) {
            return { image_versions2: { candidates: sources } };
          }
        }

        if (bestMedia.src) {
          return { image_versions2: { candidates: [{ url: bestMedia.src, width: bestMedia.naturalWidth || 1080 }] } };
        }
      }
    }

    debugLog("[Amstragram] No suitable story media found in DOM");
    return null;
  }

  function getBestStoryItemMedia(item) {
    const selectedMedia = MEDIA_SELECTION_CORE.selectBestMedia({
      type: "story",
      mediaKindIntent: storyItemHasVideo(item) ? "video" : "unknown",
      identity: { storyId: item?.pk || item?.id || "" },
      item: item
    }, {
      videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
      videoResolverOptions: {}
    });

    return {
      isVideo: selectedMedia.mediaKind === "video",
      url: selectedMedia.selected?.url || "",
      ext: selectedMedia.selected?.ext || (selectedMedia.mediaKind === "video" ? "mp4" : "jpg"),
      videoPlan: selectedMedia.selected?.videoPlan || null,
      selectedSource: selectedMedia.selected?.source || "",
      fallback: selectedMedia.fallback || null
    };
  }

  function buildStoryDownloadMeta(item, safeName, isHighlight, idForName, index, ext, storyShortcode = "", isVideo = false) {
    const normalizedShortcode = (typeof storyShortcode === "string" && storyShortcode.trim())
      ? storyShortcode.trim()
      : (isHighlight ? "highlight" : "story");
    const type = isHighlight ? "highlight" : "story";
    const fallbackPermalink = "";
    const metadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, {
      username: safeName,
      permalink: fallbackPermalink
    });

    return {
      type: type,
      username: safeName,
      shortcode: normalizedShortcode,
      id: idForName,
      index: index,
      ext: ext,
      caption: metadata.caption || "",
      altText: metadata.altText || "",
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
      takenAt: metadata.takenAt ?? null,
      authorId: metadata.authorId || "",
      authorUsername: metadata.authorUsername || safeName,
      permalink: metadata.permalink || fallbackPermalink,
      mediaKind: isVideo ? "video" : "image",
      carouselTotal: 1
    };
  }

  function buildStoryBatchTasks(items, safeName, isHighlight = false, storyShortcode = "") {
    if (!Array.isArray(items)) return [];
    const tasks = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const media = getBestStoryItemMedia(item);
      if (!media.url) continue;
      const itemId = item?.pk || item?.id || `${i + 1}`;
      tasks.push({
        url: media.url,
        videoPlan: media.isVideo ? (media.videoPlan || null) : null,
        filename: `${safeName}_${isHighlight ? "highlight" : "story"}_${itemId}.${media.ext}`,
        meta: buildStoryDownloadMeta(item, safeName, isHighlight, itemId, i + 1, media.ext, storyShortcode, media.isVideo)
      });
    }
    return tasks;
  }

  // Build story/highlight menu items without rendering a menu.
  // This keeps the standalone story menu and the profile-pic combined menu identical.
  function buildStoryMenuItems(item, username, storyMediaId, isHighlight = false, allItems = null) {
    const media = getBestStoryItemMedia(item);
    if (media.fallback && typeof DOWNLOAD_PIPELINE_CORE !== "undefined" && typeof DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic === "function") {
      DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic({
        level: "fallback",
        surface: "right_click",
        type: isHighlight ? "highlight" : "story",
        mediaKind: media.isVideo ? "video" : "image",
        identity: { storyId: storyMediaId || item?.pk || item?.id || "" },
        attempted: media.fallback.attempted || [],
        selected: {
          source: media.selectedSource || "",
          container: media.videoPlan?.container || null
        },
        bestUnavailableReason: media.fallback.reason || "fallback"
      });
    }
    const isVideo = media.isVideo;
    const url = media.url;
    const ext = media.ext;
    const headerLabel = isHighlight ? "Highlight" : "Story";

    if (!url) {
      return [
        { header: headerLabel, section: true },
        { header: "Could not resolve media URL (try refresh)." }
      ];
    }

    const ownerUsername = item?.user?.username || item?.owner?.username || null;
    const safeName = username || ownerUsername || (isHighlight ? "highlight" : "story");
    const idForName = storyMediaId || item.pk || item.id || "media";
    const storyShortcode = isHighlight
      ? String(storyMediaId || item?.id || item?.pk || "highlight")
      : "story";
    const filenameBase = `${safeName}_${isHighlight ? "highlight" : "story"}_${idForName}`;
    const batchTasks = buildStoryBatchTasks(allItems, safeName, isHighlight, storyShortcode);

    const storyMenuItems = [{ header: headerLabel, section: true }];

    // Copy (images only)
    if (!isVideo) {
      storyMenuItems.push({
        icon: icons.copy(),
        label: "Copy",
        action: () => url && copyImageToClipboard(url)
      });
    }

    storyMenuItems.push({
      icon: icons.external(),
      label: "Open in new tab",
      action: () => url && openInNewTab(url)
    });

    storyMenuItems.push({
      icon: icons.download(),
      label: "Download",
      action: async () => {
        if (!url) return;
        const filename = `${filenameBase}.${ext}`;
        const meta = buildStoryDownloadMeta(item, safeName, isHighlight, idForName, 1, ext, storyShortcode, media.isVideo);
        if (media.isVideo) {
          await dispatchVideoDownload(media.videoPlan || null, url, filename, meta);
        } else {
          await downloadFile(url, filename, meta);
        }
      }
    });

    if (batchTasks.length > 1) {
      storyMenuItems.push({
        icon: icons.layers(),
        label: `Open all ${batchTasks.length} in new tabs`,
        action: () => openMultipleInNewTabs(batchTasks.map((task) => task.url))
      });
      storyMenuItems.push({
        icon: icons.download(),
        label: `Download all ${batchTasks.length}`,
        action: async () => {
          await runBatchDownloadTasks(batchTasks, getActiveBulkPolicy(), {
            label: isHighlight ? "Highlight batch" : "Story batch"
          });
        }
      });
    }

    return storyMenuItems;
  }

  function findStoryShareItem(items, storyPk) {
    const target = String(storyPk || "");
    if (!target || !Array.isArray(items)) return null;
    return items.find((item) => String(item?.pk || item?.id || "") === target) || null;
  }

  async function showStoryShareMenuFromEntry(entry, x, y) {
    const username = String(entry?.username || "").trim();
    const storyPk = String(entry?.storyPk || "").trim();

    if (!username || !storyPk) {
      createMenu(x, y, [
        { header: "Shared story", section: true },
        { header: "Could not find story ID" }
      ]);
      return;
    }

    createMenu(x, y, [{ header: "Loading story..." }]);

    try {
      const appId = getAppID();
      const res = await fetchStoryInfoDirect(username, storyPk, appId);
      const availableItems = Array.isArray(res?.allItemsData) && res.allItemsData.length > 0
        ? res.allItemsData
        : (res?.data?.items || []);
      const selectedItem = findStoryShareItem(availableItems, storyPk)
        || res?.data?.items?.[0]
        || availableItems[0];

      if (res?.success && selectedItem) {
        showStoryMenu(selectedItem, username, storyPk, x, y, false, availableItems);
        return;
      }

      if (typeof fetchMediaInfoDirect === "function") {
        const fallbackRes = await fetchMediaInfoDirect(storyPk, appId);
        const fallbackItem = fallbackRes?.data?.items?.[0];
        if (fallbackRes?.success && fallbackItem) {
          showStoryMenu(fallbackItem, username, storyPk, x, y, false);
          return;
        }
      }

      createMenu(x, y, [
        { header: "Could not load media" },
        { header: res?.error || "(Try refreshing the page)" }
      ]);
    } catch (err) {
      console.error("[Amstragram] Shared story fetch error:", err);
      createMenu(x, y, [
        { header: "Error loading story" },
        { header: err?.message || "Unknown error" }
      ]);
    }
  }

  if (storyTestExportHook) storyTestExportHook("buildStoryMenuItems", buildStoryMenuItems);

  // Helper to display story menu
  function showStoryMenu(item, username, storyMediaId, x, y, isHighlight = false, allItems = null) {
    const storyMenuItems = buildStoryMenuItems(item, username, storyMediaId, isHighlight, allItems);
    createMenu(x, y, storyMenuItems);
  }

  // =========================================
  // DM LIGHTSPEED SHARE HOOK
  // =========================================
  const DM_LIGHTSPEED_MESSAGE_SOURCE = "amstragram:dm-lightspeed";
  const DM_LIGHTSPEED_SHARE_MAP = new Map();
  const DM_LIGHTSPEED_MAX_ENTRIES = 1000;

  function normalizeDirectMessageMid(value) {
    const mid = String(value || "").trim();
    if (!mid) return "";
    return mid.startsWith("mid.$") ? mid : "";
  }

  function normalizeDirectMessageShareEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const mid = normalizeDirectMessageMid(entry.mid);
    if (!mid) return null;
    const kind = entry.kind === "post" || entry.kind === "reel" || entry.kind === "story"
      ? entry.kind
      : "";
    if (!kind) return null;

    return {
      mid,
      kind,
      shortcode: entry.shortcode || null,
      mediaPk: entry.mediaPk || null,
      username: entry.username || null,
      storyPk: entry.storyPk || null,
      webUrl: entry.webUrl || "",
      deepLink: entry.deepLink || "",
      threadId: entry.threadId || null
    };
  }

  function storeDirectMessageLightspeedEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return 0;
    let stored = 0;
    for (const entry of entries) {
      const normalized = normalizeDirectMessageShareEntry(entry);
      if (!normalized) continue;
      DM_LIGHTSPEED_SHARE_MAP.set(normalized.mid, normalized);
      stored++;
    }

    while (DM_LIGHTSPEED_SHARE_MAP.size > DM_LIGHTSPEED_MAX_ENTRIES) {
      const oldest = DM_LIGHTSPEED_SHARE_MAP.keys().next().value;
      if (!oldest) break;
      DM_LIGHTSPEED_SHARE_MAP.delete(oldest);
    }

    return stored;
  }

  function getDirectMessageLightspeedShare(mid) {
    const normalizedMid = normalizeDirectMessageMid(mid);
    if (!normalizedMid) return null;
    const entry = DM_LIGHTSPEED_SHARE_MAP.get(normalizedMid);
    return entry ? { ...entry } : null;
  }

  function handleDirectMessageLightspeedMessage(event) {
    if (event?.source && event.source !== window) return;
    const data = event?.data;
    if (!data || data.source !== DM_LIGHTSPEED_MESSAGE_SOURCE || data.type !== "entries") return;
    const stored = storeDirectMessageLightspeedEntries(data.entries);
    if (stored && typeof debugLog === "function") {
      debugLog("[Amstragram] Captured DM Lightspeed share entries:", stored);
    }
  }

  function installDirectMessageLightspeedHook() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (typeof DM_LIGHTSPEED_CORE === "undefined" || typeof DM_LIGHTSPEED_CORE.parseLightspeedPayload !== "function") return;

    window.addEventListener("message", handleDirectMessageLightspeedMessage, false);

    const root = document.documentElement || document.head || document.body;
    if (!root) {
      document.addEventListener("DOMContentLoaded", installDirectMessageLightspeedHook, { once: true });
      return;
    }

    const parserSource = DM_LIGHTSPEED_CORE.parseLightspeedPayload.toString();
    const hookSource = `
(() => {
  const SOURCE = ${JSON.stringify(DM_LIGHTSPEED_MESSAGE_SOURCE)};
  if (window.__amstragramDmLightspeedFetchHookInstalled) return;
  try {
    Object.defineProperty(window, "__amstragramDmLightspeedFetchHookInstalled", {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
  } catch (_err) {
    window.__amstragramDmLightspeedFetchHookInstalled = true;
  }

  const parseLightspeedPayload = ${parserSource};

  function isLightspeedGraphqlRequest(input, init, response) {
    const method = String(init?.method || input?.method || "GET").toUpperCase();
    const url = String(
      (typeof input === "string" ? input : "") ||
      input?.url ||
      response?.url ||
      ""
    );
    return method === "POST" && url.includes("/graphql/query");
  }

  function getLightspeedPayload(data) {
    return data?.data?.lightspeed_web_request_for_igd?.payload || "";
  }

  function postEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    window.postMessage({ source: SOURCE, type: "entries", entries }, "*");
  }

  async function inspectResponse(response) {
    if (!response || typeof response.clone !== "function") return;
    try {
      const data = await response.clone().json();
      const payload = getLightspeedPayload(data);
      if (typeof payload !== "string" || !payload.includes("insertAttachmentCta")) return;
      postEntries(parseLightspeedPayload(payload));
    } catch (_err) {
      // Ignore non-JSON GraphQL responses and consumed/opaque bodies.
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch !== "function") return;

  window.fetch = function amstragramLightspeedFetch(input, init) {
    return originalFetch.apply(this, arguments).then((response) => {
      try {
        if (isLightspeedGraphqlRequest(input, init, response)) {
          void inspectResponse(response);
        }
      } catch (_err) {
        // Never let diagnostics interfere with Instagram's own request flow.
      }
      return response;
    });
  };
})();
`;

    try {
      const blob = new Blob([hookSource], { type: "text/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      const script = document.createElement("script");
      script.src = blobUrl;
      script.addEventListener("load", () => {
        URL.revokeObjectURL(blobUrl);
        if (script.parentNode) script.parentNode.removeChild(script);
      }, { once: true });
      script.addEventListener("error", () => {
        URL.revokeObjectURL(blobUrl);
        debugLog("[Amstragram] DM Lightspeed blob script failed to load");
      }, { once: true });
      root.appendChild(script);
    } catch (err) {
      debugLog("[Amstragram] Failed to install DM Lightspeed page hook:", err?.message || err);
    }
  }

  installDirectMessageLightspeedHook();
  // =========================================
  // GM_xmlhttpRequest WRAPPER + API FUNCTIONS
  // =========================================

  function gmRequestJson(url, headers) {
    return DOWNLOAD_PIPELINE_CORE.gmRequestJson(url, headers);
  }

  /**
   * Promise-based wrapper around GM_xmlhttpRequest.
   * Sends cookies and optionally injects a specific UA.
   */
  async function gmFetch(url, { headers = {}, useMobileUA = false, useDesktopUA = false } = {}) {
    const baseHeaders = { ...headers };

    if (useMobileUA) {
      try {
        return await gmRequestJson(url, { ...baseHeaders, "User-Agent": RUNTIME_CONFIG.mobileUserAgent });
      } catch (err) {
        debugLog("[Amstragram] GM request with mobile User-Agent failed, retrying without UA override:", err.message);
      }
    }

    if (useDesktopUA) {
      try {
        return await gmRequestJson(url, { ...baseHeaders, "User-Agent": RUNTIME_CONFIG.desktopUserAgent });
      } catch (err) {
        debugLog("[Amstragram] GM request with desktop User-Agent failed, retrying without UA override:", err.message);
      }
    }

    return gmRequestJson(url, baseHeaders);
  }

  /** Deduplicate API items by pk/id */
  function dedupeItemsById(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      const key = String(item?.pk || item?.id || "");
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // =========================================
  // DIRECT MESSAGE MEDIA HELPERS (v1.5.1)
  // =========================================

  function stripStpParam(url) {
    if (typeof url !== "string" || url.length === 0) return url;
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has("stp")) return url;
      parsed.searchParams.delete("stp");
      return parsed.toString();
    } catch (_err) {
      return url;
    }
  }

  function stripDownloadDisposition(url) {
    if (typeof url !== "string" || url.length === 0) return url;
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has("dl")) return url;
      parsed.searchParams.delete("dl");
      return parsed.toString();
    } catch (_err) {
      return url;
    }
  }

  function parseDirectThreadIdFromPath(pathname) {
    if (pathname === undefined && typeof window !== "undefined") {
      pathname = window.location?.pathname;
    }
    const str = String(pathname || "");
    const match = str.match(/^\/direct\/t\/([^/?#]+)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function buildDirectMessageFilenameMeta(resolved, ext) {
    const displayName = resolved?.displayName || "";
    return {
      type: "direct_message",
      username: displayName || "instagram",
      shortcode: "",
      id: resolved?.itemId || "",
      index: 1,
      ext,
      caption: "",
      altText: "",
      hashtags: [],
      takenAt: null,
      authorId: "",
      authorUsername: displayName,
      permalink: typeof window !== "undefined" ? (window.location?.href || "") : ""
    };
  }

  async function fetchDirectMessageItem(threadId, itemId, appId) {
    const safeThread = encodeURIComponent(String(threadId || ""));
    const safeItem = encodeURIComponent(String(itemId || ""));
    const url = `https://www.instagram.com/api/v1/direct_v2/threads/${safeThread}/items/${safeItem}/`;
    debugLog("[Amstragram] fetchDirectMessageItem:", url);
    return gmFetch(url, {
      headers: {
        "X-IG-App-ID": appId,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "*/*"
      }
    });
  }

  function findDirectMessageBubble(target) {
    if (!target || typeof target.closest !== "function") return null;
    // Only accept ancestors that ARE bubbles. Walking up and querying
    // descendants is unsafe — IG keeps DM state (mid.$ ids) in the DOM
    // even when the user is on a profile or reels page, which would
    // otherwise cause this handler to claim non-DM right-clicks.
    let b = target.closest('[aria-roledescription="message"][data-scope="messages_table"]');
    if (b) return b;
    b = target.closest('[aria-roledescription="message"]');
    if (b) return b;
    b = target.closest('[id^="mid.$"]');
    if (b) return b;
    return null;
  }

  function resolveDirectMessageThreadIdFromBubble(bubble) {
    if (!bubble) return "";
    const midEl = bubble.querySelector?.('[id^="mid.$"]');
    if (!midEl || typeof getDirectMessageLightspeedShare !== "function") return "";
    const entry = getDirectMessageLightspeedShare(midEl.id);
    return entry?.threadId || "";
  }

  function resolveDirectMessageClick(target, threadId) {
    if (!target || typeof target.closest !== "function") return null;

    // Priority 1: expanded viewer (dialog-scoped)
    const dialog = target.closest('[role="dialog"][aria-modal="true"]');
    if (dialog) {
      // Require the click target to actually be on the media (or its controls
      // overlay), not on dialog chrome — close button, backdrop, header, etc.
      // Without this, right-clicking anywhere inside the dialog would surface
      // a menu for whatever video/img happened to exist in the dialog tree.
      const onMedia = !!(
        target.closest?.('video') ||
        target.closest?.('img') ||
        target.closest?.('[role="group"][aria-label="Video player"]')
      );
      if (!onMedia) return null;

      const video = dialog.querySelector("video");
      if (video) {
        const videoUrl = video.getAttribute("src") || video.src || "";
        if (videoUrl.startsWith("blob:")) {
          // The expanded viewer is opened from a thread bubble; walk the thread
          // DOM in reverse to find the most recent video bubble and pull its
          // message ID. If we can correlate, route through the API resolver —
          // otherwise fall back to the legacy "can't resolve" placeholder.
          let candidateItemId = "";
          if (typeof document !== "undefined" && typeof document.querySelectorAll === "function") {
            try {
              // Match the same lenient bubble selector as findDirectMessageBubble —
              // IG variants drop data-scope="messages_table" on bubbles, which is
              // why the strict selector below stopped finding candidates.
              const videoBubbles = document.querySelectorAll('[aria-roledescription="message"]');
              for (let i = videoBubbles.length - 1; i >= 0 && !candidateItemId; i--) {
                const poster = videoBubbles[i].querySelector?.('img[alt="Open Video"]');
                if (!poster) continue;
                const midEl = videoBubbles[i].querySelector?.('[id^="mid.$"]');
                if (!midEl) continue;
                const rawId = String(midEl.getAttribute?.("id") || "");
                if (rawId.startsWith("mid.$")) candidateItemId = rawId.slice(5);
              }
            } catch {
              // DOM lookup failed — fall through to the placeholder branch.
            }
          }
          if (candidateItemId) {
            return { kind: "expanded_video_api", itemId: candidateItemId, threadId };
          }
          return { kind: "expanded_video_dash", threadId };
        }
        if (videoUrl) {
          return { kind: "expanded_video", videoUrl, threadId };
        }
      }
      const img = dialog.querySelector('img[src*="fbcdn.net"]')
                || dialog.querySelector('img[src*="cdninstagram.com"]');
      if (img) {
        const imgUrl = img.getAttribute("src") || img.src || "";
        return { kind: "expanded_photo", imgUrl, threadId };
      }
      return null;
    }

    // Priority 2: thread bubble. Use lenient detection — IG's bubble layout
    // changes; the only stable marker across variants is the mid.$xxx descendant.
    const bubble = findDirectMessageBubble(target);
    if (!bubble) return null;

    const midEl = bubble.querySelector('[id^="mid.$"]');
    const rawId = midEl ? String(midEl.getAttribute("id") || "") : "";
    const mid = rawId.startsWith("mid.$") ? rawId : "";
    const itemId = mid ? mid.slice(5) : "";
    const lightspeedShare = mid && typeof getDirectMessageLightspeedShare === "function"
      ? getDirectMessageLightspeedShare(mid)
      : null;

    function resolveLightspeedShareEntry(entry) {
      if (!entry || entry.mid !== mid) return null;
      if (entry.kind === "post" || entry.kind === "reel") {
        if (!entry.shortcode) return null;
        return {
          kind: entry.kind === "reel" ? "reshare_reel" : "reshare_post",
          mid,
          itemId,
          threadId,
          shortcode: entry.shortcode,
          mediaPk: entry.mediaPk || null,
          webUrl: entry.webUrl || "",
          deepLink: entry.deepLink || "",
          shareEntry: entry
        };
      }
      if (entry.kind === "story") {
        if (!entry.username || !entry.storyPk) return null;
        return {
          kind: "reshare_story",
          mid,
          itemId,
          threadId,
          username: entry.username,
          storyPk: entry.storyPk,
          webUrl: entry.webUrl || "",
          deepLink: entry.deepLink || "",
          shareEntry: entry
        };
      }
      return null;
    }

    const ariaLabel = String(bubble.getAttribute("aria-label") || "");
    const labelMatch = ariaLabel.match(/^At\s+([^,]+),\s*(.+)$/);
    const takenAtRaw = labelMatch ? labelMatch[1].trim() : "";
    const displayName = labelMatch ? labelMatch[2].trim() : "";

    // Story reshare: detected by a[aria-label="Preview"][href*="/stories/"]
    const storyAnchor = bubble.querySelector('a[aria-label="Preview"]');
    if (storyAnchor) {
      const href = storyAnchor.getAttribute("href") || storyAnchor.href || "";
      if (href.includes("/stories/")) {
        const routedStory = resolveLightspeedShareEntry(lightspeedShare);
        if (routedStory?.kind === "reshare_story") return routedStory;
        return { kind: "reshare_story_unsupported", threadId };
      }
    }

    // Thread photo / video take priority over reshare-post heuristics: if the
    // canonical alt attributes are present, this bubble is a regular media bubble
    // regardless of any enclosing double-tap-to-like wrapper.
    const photoImg = bubble.querySelector('img[alt="Open photo"]');
    if (photoImg) {
      return {
        kind: "thread_photo",
        imgUrl: photoImg.getAttribute("src") || photoImg.src || "",
        itemId,
        threadId,
        displayName,
        takenAtRaw
      };
    }
    const videoPoster = bubble.querySelector('img[alt="Open Video"]');
    if (videoPoster) {
      return {
        kind: "thread_video",
        posterUrl: videoPoster.getAttribute("src") || videoPoster.src || "",
        itemId,
        threadId,
        displayName,
        takenAtRaw
      };
    }

    // Post/reel reshare: bubble has role="button" aria-label="Double tap to like"
    // with a preview <img> inside. Distinguishing reel vs. post is the presence
    // of svg[aria-label="Clip"]. Shortcode is NOT extractable from DOM (deferred
    // to v1.5.2), so surface a hint-only kind.
    const doubleTapBtn = bubble.querySelector('[role="button"][aria-label="Double tap to like"]');
    if (doubleTapBtn) {
      const hasPreviewImg = !!bubble.querySelector("img");
      if (hasPreviewImg) {
        const routedShare = resolveLightspeedShareEntry(lightspeedShare);
        if (routedShare) return routedShare;
        const isReel = !!bubble.querySelector('svg[aria-label="Clip"]');
        return {
          kind: isReel ? "reshare_reel_unsupported" : "reshare_post_unsupported",
          threadId
        };
      }
    }

    return null;
  }

  function _dmDeriveExtFromUrl(url) {
    try {
      const pathname = new URL(url).pathname;
      const m = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
      return (m ? m[1] : "").toLowerCase() || "";
    } catch (_err) { return ""; }
  }

  function selectDirectMessageVideoMedia(dmItem, resolved) {
    return MEDIA_SELECTION_CORE.selectBestMedia({
      type: "direct_message",
      mediaKindIntent: "video",
      identity: {
        directThreadId: resolved?.threadId || "",
        directItemId: resolved?.itemId || ""
      },
      item: dmItem
    }, {
      videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
      videoResolverOptions: {}
    });
  }

  function selectDirectMessageImageMedia(dmItem, resolved, domUrl = "") {
    const cleanDomUrl = stripStpParam(domUrl || "");
    return MEDIA_SELECTION_CORE.selectBestMedia({
      type: "direct_message",
      mediaKindIntent: "image",
      identity: {
        directThreadId: resolved?.threadId || "",
        directItemId: resolved?.itemId || ""
      },
      item: dmItem,
      domMedia: cleanDomUrl ? { kind: "image", url: cleanDomUrl } : null
    });
  }

  function recordDirectMessageVideoFallbackDiagnostic(selectedMedia, resolved, ext) {
    if (!selectedMedia?.fallback) return;
    if (typeof DOWNLOAD_PIPELINE_CORE === "undefined" || typeof DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic !== "function") return;
    DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic({
      level: "fallback",
      surface: "right_click",
      type: "direct_message",
      mediaKind: "video",
      identity: { directThreadId: resolved?.threadId || "", directItemId: resolved?.itemId || "" },
      attempted: selectedMedia.fallback.attempted || [],
      selected: { source: selectedMedia.selected?.source || "", container: ext },
      bestUnavailableReason: selectedMedia.fallback.reason || "fallback"
    });
  }

  function createDirectMessagePhotoMenu(resolved, x, y, photoUrl) {
    const ext = _dmDeriveExtFromUrl(photoUrl) || "jpg";
    const meta = buildDirectMessageFilenameMeta(resolved, ext);
    const defaultFilename = `dm_${resolved.itemId || "photo"}.${ext}`;

    createMenu(x, y, [
      { header: "Direct Message – Photo", section: true },
      { icon: icons.copy(), label: "Copy", action: () => copyImageToClipboard(photoUrl) },
      { icon: icons.external(), label: "Open in new tab", action: () => openInNewTab(photoUrl) },
      { icon: icons.download(), label: "Download", action: () => downloadFile(photoUrl, defaultFilename, meta) }
    ]);
  }

  async function showDirectMessageMenu(resolved, x, y) {
    if (!resolved) return;

    if (resolved.kind === "expanded_video_api") {
      createMenu(x, y, [{ header: "Loading direct message video..." }]);
      try {
        const appId = typeof getAppID === "function" ? getAppID() : "";
        const response = await fetchDirectMessageItem(resolved.threadId, resolved.itemId, appId);
        const dmItem = response?.items?.[0]?.media || response?.items?.[0] || {};
        const selectedMedia = selectDirectMessageVideoMedia(dmItem, resolved);
        const plan = selectedMedia.selected?.videoPlan || null;
        const url = selectedMedia.selected?.url || "";
        if (!url || selectedMedia.mediaKind !== "video") {
          createMenu(x, y, [
            { header: "Direct Message – Video", section: true },
            { header: "No downloadable video versions found" }
          ]);
          return;
        }
        const openUrl = stripDownloadDisposition(url);
        const ext = selectedMedia.selected?.ext || _dmDeriveExtFromUrl(url) || "mp4";
        const meta = buildDirectMessageFilenameMeta({ itemId: resolved.itemId, displayName: "" }, ext);
        const defaultFilename = `dm_${resolved.itemId || "video"}.${ext}`;
        recordDirectMessageVideoFallbackDiagnostic(selectedMedia, resolved, ext);
        createMenu(x, y, [
          { header: "Direct Message – Video", section: true },
          { icon: icons.external(), label: "Open in new tab", action: () => openInNewTab(openUrl) },
          {
            icon: icons.download(),
            label: "Download",
            action: () => dispatchVideoDownload(plan, url, defaultFilename, meta)
          }
        ]);
      } catch (err) {
        createMenu(x, y, [
          { header: "Error loading direct message video" },
          { header: err?.message || String(err) }
        ]);
      }
      return;
    }

    if (resolved.kind === "expanded_video_dash") {
      createMenu(x, y, [
        { header: "Direct Message – Video (DASH)", section: true },
        { header: "Can't resolve this video here." },
        { header: "Close the viewer and right-click the video bubble in the thread." }
      ]);
      return;
    }

    if (resolved.kind === "reshare_story_unsupported") {
      createMenu(x, y, [
        { header: "Shared story", section: true },
        { header: "Open the story bubble and right-click it directly." }
      ]);
      return;
    }

    if (resolved.kind === "reshare_story") {
      if (typeof showStoryShareMenuFromEntry === "function") {
        await showStoryShareMenuFromEntry(resolved.shareEntry || resolved, x, y);
      } else {
        createMenu(x, y, [
          { header: "Shared story", section: true },
          { header: "Open the story bubble and right-click it directly." }
        ]);
      }
      return;
    }

    if (resolved.kind === "reshare_post" || resolved.kind === "reshare_reel") {
      if (typeof showPostShareMenuFromShortcode === "function") {
        await showPostShareMenuFromShortcode(resolved.shareEntry || resolved, x, y);
      } else {
        const label = resolved.kind === "reshare_reel" ? "reel" : "post";
        createMenu(x, y, [
          { header: `Shared ${label}`, section: true },
          { header: `Downloading shared ${label}s from DMs isn't supported yet.` },
          { header: "Click the bubble to open it in Instagram, then right-click there." }
        ]);
      }
      return;
    }

    if (resolved.kind === "reshare_post_unsupported" || resolved.kind === "reshare_reel_unsupported") {
      const label = resolved.kind === "reshare_reel_unsupported" ? "reel" : "post";
      createMenu(x, y, [
        { header: `Shared ${label}`, section: true },
        { header: `Downloading shared ${label}s from DMs isn't supported yet.` },
        { header: "Click the bubble to open it in Instagram, then right-click there." }
      ]);
      return;
    }

    if (resolved.kind === "expanded_photo" || resolved.kind === "thread_photo") {
      const rawUrl = resolved.imgUrl || "";
      const hdUrl = resolved.kind === "thread_photo" ? stripStpParam(rawUrl) : rawUrl;

      if (resolved.kind === "thread_photo" && resolved.threadId && resolved.itemId) {
        createMenu(x, y, [{ header: "Loading direct message photo..." }]);
        try {
          const appId = typeof getAppID === "function" ? getAppID() : "";
          const response = await fetchDirectMessageItem(resolved.threadId, resolved.itemId, appId);
          const dmItem = response?.items?.[0]?.media || response?.items?.[0] || {};
          const selectedMedia = selectDirectMessageImageMedia(dmItem, resolved, hdUrl);
          const selectedUrl = selectedMedia.mediaKind === "image"
            ? (selectedMedia.selected?.url || "")
            : "";
          if (selectedUrl) {
            createDirectMessagePhotoMenu(resolved, x, y, selectedUrl);
            return;
          }
        } catch (err) {
          debugLog("[Amstragram] Direct message photo API lookup failed:", err?.message || err);
        }
      }

      createDirectMessagePhotoMenu(resolved, x, y, hdUrl);
      return;
    }

    if (resolved.kind === "expanded_video") {
      const url = resolved.videoUrl || "";
      const openUrl = stripDownloadDisposition(url);
      const ext = _dmDeriveExtFromUrl(url) || "mp4";
      const meta = buildDirectMessageFilenameMeta(resolved, ext);
      const defaultFilename = `dm_video.${ext}`;
      createMenu(x, y, [
        { header: "Direct Message – Video", section: true },
        { icon: icons.external(), label: "Open in new tab", action: () => openInNewTab(openUrl) },
        { icon: icons.download(), label: "Download", action: () => downloadFile(url, defaultFilename, meta) }
      ]);
      return;
    }

    if (resolved.kind === "thread_video") {
      createMenu(x, y, [{ header: "Loading direct message video..." }]);
      try {
        const appId = typeof getAppID === "function" ? getAppID() : "";
        const response = await fetchDirectMessageItem(resolved.threadId, resolved.itemId, appId);
        const dmItem = response?.items?.[0]?.media || response?.items?.[0] || {};
        const selectedMedia = selectDirectMessageVideoMedia(dmItem, resolved);
        const plan = selectedMedia.selected?.videoPlan || null;
        const url = selectedMedia.selected?.url || "";
        if (!url || selectedMedia.mediaKind !== "video") {
          createMenu(x, y, [
            { header: "Direct Message – Video", section: true },
            { header: "No downloadable video versions found" }
          ]);
          return;
        }
        const openUrl = stripDownloadDisposition(url);
        const ext = selectedMedia.selected?.ext || _dmDeriveExtFromUrl(url) || "mp4";
        const meta = buildDirectMessageFilenameMeta(resolved, ext);
        const defaultFilename = `dm_${resolved.itemId || "video"}.${ext}`;
        recordDirectMessageVideoFallbackDiagnostic(selectedMedia, resolved, ext);
        createMenu(x, y, [
          { header: "Direct Message – Video", section: true },
          { icon: icons.external(), label: "Open in new tab", action: () => openInNewTab(openUrl) },
          {
            icon: icons.download(),
            label: "Download",
            action: () => dispatchVideoDownload(plan, url, defaultFilename, meta)
          }
        ]);
      } catch (err) {
        createMenu(x, y, [
          { header: "Error loading direct message video" },
          { header: err?.message || String(err) }
        ]);
      }
      return;
    }
  }

  async function handleDirectMessageRightClick(e) {
    // DM context = a real DM bubble in the click ancestor chain OR we're on
    // a /direct/t/<id>/ URL. Dialog alone is NOT a DM signal — Instagram's
    // post and reel viewer modals also use [role="dialog"][aria-modal="true"]
    // and would otherwise hijack right-clicks on regular posts/reels.
    //
    // Tradeoff: DM popup expanded media viewers (clicking a photo inside a
    // DM drawer on instagram.com/ to fullscreen it) won't trigger a Amstragram
    // menu unless the user right-clicks the bubble in the thread directly.
    const target = e?.target;
    const bubble = findDirectMessageBubble(target);
    const onDmThreadUrl = !!parseDirectThreadIdFromPath();

    if (!bubble && !onDmThreadUrl) return false;

    let threadId = parseDirectThreadIdFromPath() || "";
    if (!threadId && bubble) threadId = resolveDirectMessageThreadIdFromBubble(bubble);

    const resolved = resolveDirectMessageClick(target, threadId);
    if (!resolved) {
      // In DM context but nothing actionable here (text bubble, voice note,
      // empty area). Claim the event to prevent the post handler from running,
      // but don't preventDefault — let the native menu work for text copy.
      return true;
    }
    e.preventDefault();
    e.stopPropagation();
    await showDirectMessageMenu(resolved, e.clientX, e.clientY);
    return true;
  }

  // =========================================
  // GRAPHQL REQUEST HELPERS
  // =========================================

  /**
   * Try GraphQL reels query for stories (public accounts).
   * This is a same-origin call to www.instagram.com so we use normal fetch.
   */
  async function tryGraphQLReels(userId, storyMediaId, appId) {
    const variables = { reel_ids: [userId] };
    const url = `https://www.instagram.com/graphql/query/?query_id=${RUNTIME_CONFIG.queryIds.reels}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
    const normalizedTargetId = String(storyMediaId || "").trim();

    debugLog("[Amstragram] Trying GraphQL reels query...");

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "X-IG-App-ID": appId,
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);

    const data = await response.json();

    const reels = data?.data?.xdt_api__v1__feed__reels_media?.reels_media ||
      data?.data?.reels_media ||
      [];
    debugLog("[Amstragram] GraphQL reels returned", reels.length, "reel buckets");

    let firstItem = null;
    for (const reel of reels) {
      const items = reel?.items || [];
      for (const item of items) {
        if (!firstItem && item) firstItem = item;
        if (normalizedTargetId && (String(item.pk) === normalizedTargetId || String(item.id) === normalizedTargetId)) {
          return item;
        }
      }
    }

    if (!normalizedTargetId) {
      return firstItem;
    }

    return null;
  }

  const TAGGED_GRAPHQL_RELAY_ROOT_FIELD = "xdt_api__v1__usertags__user_id__feed_connection";
  const TAGGED_GRAPHQL_RELAY_FRIENDLY_NAME = "PolarisProfileTaggedTabContentQuery_connection";
  const TAGGED_GRAPHQL_RELAY_INITIAL_FRIENDLY_NAME = "PolarisProfileTaggedTabContentQuery";
  const TAGGED_GRAPHQL_RELAY_INITIAL_DOC_ID_FALLBACK = "25816465598018010";
  const TAGGED_GRAPHQL_RELAY_ACTOR_ID_FALLBACK = "17841475318038192";
  let cachedInstagramRelayPageTokens = null;
  let cachedInstagramRelayPageTokensAt = 0;

  function getCookieValueByName(cookieName) {
    const normalizedName = typeof cookieName === "string" ? cookieName.trim() : "";
    if (!normalizedName) return "";
    let cookieText;
    try {
      cookieText = String(document?.cookie || "");
    } catch {
      cookieText = "";
    }
    if (!cookieText) return "";
    const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = cookieText.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  function computeJazoestFromSeed(seed) {
    const normalized = typeof seed === "string" ? seed : "";
    if (!normalized) return "";
    let sum = 0;
    for (let i = 0; i < normalized.length; i++) {
      sum += normalized.charCodeAt(i);
    }
    return `2${sum}`;
  }

  function matchFirstTokenPattern(text, patterns) {
    if (typeof text !== "string" || !text) return "";
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match && typeof match[1] === "string" && match[1]) {
        return match[1];
      }
    }
    return "";
  }

  function readInstagramRelayPageTokens() {
    const now = Date.now();
    const currentCsrf = getCookieValueByName("csrftoken");
    if (
      cachedInstagramRelayPageTokens &&
      (now - cachedInstagramRelayPageTokensAt) < 5 * 60 * 1000 &&
      (!currentCsrf || currentCsrf === cachedInstagramRelayPageTokens.csrfToken)
    ) {
      return { ...cachedInstagramRelayPageTokens };
    }

    const tokens = {
      csrfToken: currentCsrf || "",
      lsd: "",
      fbDtsg: "",
      jazoest: "",
      actorId: TAGGED_GRAPHQL_RELAY_ACTOR_ID_FALLBACK
    };

    try {
      const lsdInputValue = document?.querySelector?.('input[name="lsd"]')?.value;
      if (typeof lsdInputValue === "string" && lsdInputValue.trim()) {
        tokens.lsd = lsdInputValue.trim();
      }
    } catch {
      // Ignore DOM access issues.
    }

    try {
      const dtsgInputValue = document?.querySelector?.('input[name="fb_dtsg"]')?.value;
      if (typeof dtsgInputValue === "string" && dtsgInputValue.trim()) {
        tokens.fbDtsg = dtsgInputValue.trim();
      }
    } catch {
      // Ignore DOM access issues.
    }

    const lsdPatterns = [
      /"LSD",\[\],\{"token":"([^"]+)"/,
      /"lsd"\s*:\s*"([^"]+)"/,
      /name="lsd"\s+value="([^"]+)"/
    ];
    const dtsgPatterns = [
      /"DTSGInitialData",\[\],\{"token":"([^"]+)"/,
      /"token":"([^"]+)","async_get_token"/,
      /"fb_dtsg"\s*:\s*"([^"]+)"/,
      /name="fb_dtsg"\s+value="([^"]+)"/
    ];
    const actorIdPatterns = [
      /"av"\s*:\s*"([0-9]+)"/,
      /"actorID"\s*:\s*"([0-9]+)"/
    ];

    const tryExtractFromText = (text) => {
      if (!tokens.lsd) tokens.lsd = matchFirstTokenPattern(text, lsdPatterns);
      if (!tokens.fbDtsg) tokens.fbDtsg = matchFirstTokenPattern(text, dtsgPatterns);
      if (!tokens.actorId || tokens.actorId === TAGGED_GRAPHQL_RELAY_ACTOR_ID_FALLBACK) {
        const actorIdMatch = matchFirstTokenPattern(text, actorIdPatterns);
        if (actorIdMatch) tokens.actorId = actorIdMatch;
      }
      return !!(tokens.lsd && tokens.fbDtsg);
    };

    try {
      const scripts = Array.from(document?.scripts || []);
      for (const scriptEl of scripts) {
        const scriptText = typeof scriptEl?.textContent === "string" ? scriptEl.textContent : "";
        if (!scriptText) continue;
        if (tryExtractFromText(scriptText)) break;
      }
    } catch {
      // Ignore script scanning issues.
    }

    if (!tokens.lsd || !tokens.fbDtsg) {
      try {
        const htmlText = String(document?.documentElement?.innerHTML || "");
        if (htmlText) {
          tryExtractFromText(htmlText.slice(0, Math.min(htmlText.length, 2500000)));
        }
      } catch {
        // Ignore HTML scanning issues.
      }
    }

    if (tokens.fbDtsg) {
      tokens.jazoest = computeJazoestFromSeed(tokens.fbDtsg);
    }

    cachedInstagramRelayPageTokens = { ...tokens };
    cachedInstagramRelayPageTokensAt = now;
    return tokens;
  }

  /**
   * Try GraphQL tagged-feed query for profile tagged posts.
   * Uses the runtime-configured numeric doc_id/query identifier.
   */
  async function tryGraphQLTaggedFeed(userId, appId, after = null) {
    const normalizedUserId = String(userId || "").trim();
    const normalizedAfter = (typeof after === "string" && after.trim())
      ? after.trim()
      : "";
    const relayTokens = readInstagramRelayPageTokens();
    const taggedConnectionDocId = String(RUNTIME_CONFIG.queryIds.tagged || "").trim();
    const relayRequestUrl = "https://www.instagram.com/graphql/query";
    const taggedConnectionVariables = {
      after: normalizedAfter || null,
      before: null,
      count: 12,
      first: 12,
      last: null,
      user_id: normalizedUserId
    };
    const taggedInitialVariables = {
      count: 12,
      user_id: normalizedUserId
    };

    const buildRelayBody = (friendlyName, docId, variables) => {
      const body = new URLSearchParams();
      const actorId = String(relayTokens.actorId || TAGGED_GRAPHQL_RELAY_ACTOR_ID_FALLBACK || "").trim();
      if (actorId) body.set("av", actorId);
      body.set("__d", "www");
      body.set("__user", "0");
      body.set("__a", "1");
      body.set("__req", normalizedAfter ? "1b" : "1a");
      body.set("dpr", String(Math.max(4, Number(window?.devicePixelRatio || 1))));
      body.set("__comet_req", "7");
      body.set("__crn", "comet.igweb.PolarisProfileTaggedTabRoute");
      if (relayTokens.fbDtsg) body.set("fb_dtsg", relayTokens.fbDtsg);
      if (relayTokens.jazoest) body.set("jazoest", relayTokens.jazoest);
      if (relayTokens.lsd) body.set("lsd", relayTokens.lsd);
      body.set("fb_api_caller_class", "RelayModern");
      body.set("fb_api_req_friendly_name", friendlyName);
      body.set("server_timestamps", "true");
      body.set("variables", JSON.stringify(variables));
      body.set("doc_id", String(docId || "").trim());
      return body.toString();
    };

    const buildRelayHeaders = (friendlyName) => {
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": appId,
        "X-Requested-With": "XMLHttpRequest",
        "X-FB-Friendly-Name": friendlyName,
        "X-Root-Field-Name": TAGGED_GRAPHQL_RELAY_ROOT_FIELD
      };
      if (relayTokens.csrfToken) headers["X-CSRFToken"] = relayTokens.csrfToken;
      if (relayTokens.lsd) headers["X-FB-LSD"] = relayTokens.lsd;
      return headers;
    };

    const requestSpecs = [];
    if (taggedConnectionDocId) {
      requestSpecs.push({
        requestFlavor: "relay_connection",
        method: "POST",
        url: relayRequestUrl,
        headers: buildRelayHeaders(TAGGED_GRAPHQL_RELAY_FRIENDLY_NAME),
        body: buildRelayBody(TAGGED_GRAPHQL_RELAY_FRIENDLY_NAME, taggedConnectionDocId, taggedConnectionVariables),
        friendlyName: TAGGED_GRAPHQL_RELAY_FRIENDLY_NAME,
        docId: taggedConnectionDocId,
        variableKeys: Object.keys(taggedConnectionVariables)
      });
    }
    if (!normalizedAfter) {
      requestSpecs.push({
        requestFlavor: "relay_initial",
        method: "POST",
        url: relayRequestUrl,
        headers: buildRelayHeaders(TAGGED_GRAPHQL_RELAY_INITIAL_FRIENDLY_NAME),
        body: buildRelayBody(TAGGED_GRAPHQL_RELAY_INITIAL_FRIENDLY_NAME, TAGGED_GRAPHQL_RELAY_INITIAL_DOC_ID_FALLBACK, taggedInitialVariables),
        friendlyName: TAGGED_GRAPHQL_RELAY_INITIAL_FRIENDLY_NAME,
        docId: TAGGED_GRAPHQL_RELAY_INITIAL_DOC_ID_FALLBACK,
        variableKeys: Object.keys(taggedInitialVariables)
      });
    }

    // Preserve the old guessed GET path as a final fallback in case Instagram rolls back.
    const legacyGetVariables = { id: normalizedUserId, first: 12 };
    if (normalizedAfter) legacyGetVariables.after = normalizedAfter;
    const encodedLegacyGetVariables = encodeURIComponent(JSON.stringify(legacyGetVariables));
    if (taggedConnectionDocId) {
      requestSpecs.push({
        requestFlavor: "legacy_get_doc_id",
        method: "GET",
        url: `https://www.instagram.com/graphql/query/?doc_id=${encodeURIComponent(taggedConnectionDocId)}&variables=${encodedLegacyGetVariables}`,
        headers: {
          "X-IG-App-ID": appId,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: null,
        friendlyName: "",
        docId: taggedConnectionDocId,
        variableKeys: Object.keys(legacyGetVariables)
      });
      requestSpecs.push({
        requestFlavor: "legacy_get_query_id",
        method: "GET",
        url: `https://www.instagram.com/graphql/query/?query_id=${encodeURIComponent(taggedConnectionDocId)}&variables=${encodedLegacyGetVariables}`,
        headers: {
          "X-IG-App-ID": appId,
          "X-Requested-With": "XMLHttpRequest"
        },
        body: null,
        friendlyName: "",
        docId: taggedConnectionDocId,
        variableKeys: Object.keys(legacyGetVariables)
      });
    }

    debugLog("[Amstragram] Trying GraphQL tagged feed query...");
    TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged request start", {
      userId: normalizedUserId,
      appId: String(appId || ""),
      after: normalizedAfter || null,
      taggedDocId: taggedConnectionDocId || "",
      relayTokenPresence: {
        csrfToken: !!relayTokens.csrfToken,
        lsd: !!relayTokens.lsd,
        fbDtsg: !!relayTokens.fbDtsg,
        jazoest: !!relayTokens.jazoest
      },
      requestFlavors: requestSpecs.map((spec) => spec.requestFlavor)
    });

    let lastError = null;
    for (let i = 0; i < requestSpecs.length; i++) {
      const requestSpec = requestSpecs[i];
      const response = await fetch(requestSpec.url, {
        method: requestSpec.method,
        credentials: "include",
        headers: requestSpec.headers,
        body: requestSpec.body
      });
      const responseContentType = String(response.headers?.get?.("content-type") || "");
      TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged HTTP response", {
        requestFlavor: requestSpec.requestFlavor,
        method: requestSpec.method,
        status: response.status,
        ok: response.ok,
        redirected: !!response.redirected,
        contentType: responseContentType,
        url: requestSpec.url.slice(0, 220),
        docId: requestSpec.docId,
        friendlyName: requestSpec.friendlyName,
        variableKeys: requestSpec.variableKeys
      });

      let responseText;
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }

      if (response.ok) {
        let json;
        try {
          json = JSON.parse(responseText);
        } catch (parseErr) {
          TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged OK but non-JSON body", {
            requestFlavor: requestSpec.requestFlavor,
            status: response.status,
            parseError: String(parseErr?.message || parseErr),
            bodySnippet: responseText.slice(0, 600)
          });
          lastError = new Error("GraphQL Tagged OK response was not JSON");
          if (i < requestSpecs.length - 1) continue;
          throw lastError;
        }

        const dataKeys = Object.keys(json?.data || {});
        const errorList = Array.isArray(json?.errors) ? json.errors : [];
        const extensionsKeys = Object.keys(json?.extensions || {});
        TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged payload shape", {
          requestFlavor: requestSpec.requestFlavor,
          topLevelKeys: Object.keys(json || {}),
          dataKeys,
          status: json?.status || null,
          errorCount: errorList.length,
          extensionsKeys
        });
        if (errorList.length > 0) {
          TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged payload errors", {
            requestFlavor: requestSpec.requestFlavor,
            errors: errorList.slice(0, 3).map((entry) => ({
              message: String(entry?.message || ""),
              severity: String(entry?.severity || ""),
              code: String(entry?.code || ""),
              path: Array.isArray(entry?.path) ? entry.path.slice(0, 6) : []
            }))
          });
        }
        if (dataKeys.length === 0) {
          TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged empty data payload", {
            requestFlavor: requestSpec.requestFlavor,
            bodySnippet: responseText.slice(0, 800)
          });
          lastError = new Error("GraphQL Tagged empty data payload");
          if (i < requestSpecs.length - 1) {
            TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged empty data: trying alternate request flavor", {
              from: requestSpec.requestFlavor,
              next: requestSpecs[i + 1]?.requestFlavor || null
            });
            continue;
          }
        }
        return json;
      }

      TAGGED_TRACE_ENABLED && taggedTrace("GraphQL tagged HTTP failure", {
        requestFlavor: requestSpec.requestFlavor,
        status: response.status,
        bodySnippet: responseText.slice(0, 600)
      });
      lastError = new Error(`GraphQL Tagged HTTP ${response.status}`);
      if (i < requestSpecs.length - 1) continue;
      throw lastError;
    }

    throw lastError || new Error("GraphQL Tagged request failed");
  }

  // =========================================
  // SAVED COLLECTIONS
  // =========================================

  /**
   * Fetch the logged-in user's saved collections list via GraphQL.
   * Returns an array of { id, name, mediaCount } sorted with "All posts" first.
   */
  async function fetchSavedCollections(appId) {
    const relayTokens = readInstagramRelayPageTokens();
    const docId = String(RUNTIME_CONFIG.queryIds.savedCollections || "").trim();
    if (!docId) {
      throw new Error("No savedCollections query ID configured");
    }

    const allCollections = [];
    const seenCollectionIds = new Set();
    let afterCursor = null;
    let pageCount = 0;

    while (true) {
      pageCount += 1;
      if (pageCount > 50) {
        debugLog("[Amstragram] Saved collections pagination guard triggered at 50 pages.");
        break;
      }

      const variables = {
        collection_types: ["ALL_MEDIA_AUTO_COLLECTION", "MEDIA", "AUDIO_AUTO_COLLECTION"],
        count: 12,
        get_cover_media_lists: true
      };
      if (afterCursor) {
        variables.after = afterCursor;
      }

      const body = new URLSearchParams();
      const actorId = String(relayTokens.actorId || "").trim();
      if (actorId) body.set("av", actorId);
      body.set("__d", "www");
      body.set("__user", "0");
      body.set("__a", "1");
      body.set("__req", afterCursor ? "1b" : "1a");
      body.set("dpr", String(Math.max(4, Number(window?.devicePixelRatio || 1))));
      body.set("__comet_req", "7");
      if (relayTokens.fbDtsg) body.set("fb_dtsg", relayTokens.fbDtsg);
      if (relayTokens.jazoest) body.set("jazoest", relayTokens.jazoest);
      if (relayTokens.lsd) body.set("lsd", relayTokens.lsd);
      body.set("fb_api_caller_class", "RelayModern");
      body.set("fb_api_req_friendly_name", "PolarisProfileSavedTabContentQuery");
      body.set("server_timestamps", "true");
      body.set("variables", JSON.stringify(variables));
      body.set("doc_id", docId);

      const url = "https://www.instagram.com/graphql/query";
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "X-IG-App-ID": String(appId || ""),
        "X-FB-Friendly-Name": "PolarisProfileSavedTabContentQuery",
        "X-Root-Field-Name": "xdt_api__v1__collections__list_graphql_connection",
        "X-FB-LSD": relayTokens.lsd || "",
        "X-CSRFToken": relayTokens.csrfToken || ""
      };
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: body.toString()
      });
      let responseText;
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }
      if (!response.ok) {
        throw new Error(`Saved collections GraphQL HTTP ${response.status}`);
      }

      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        throw new Error("Saved collections GraphQL response was not JSON");
      }

      const errorList = Array.isArray(responseJson?.errors) ? responseJson.errors : [];
      if (errorList.length > 0) {
        const firstMessage = String(errorList[0]?.message || "").trim();
        throw new Error(firstMessage || "Saved collections GraphQL returned errors");
      }

      const connection = responseJson?.data?.xdt_api__v1__collections__list_graphql_connection;
      if (!connection || !Array.isArray(connection.edges)) {
        throw new Error("Saved collections GraphQL response did not include collections data");
      }
      const edges = Array.isArray(connection?.edges) ? connection.edges : [];

      for (const edge of edges) {
        const node = edge?.node;
        if (!node) continue;
        const collectionId = String(node.collection_id || "").trim();
        if (!collectionId || seenCollectionIds.has(collectionId)) continue;
        seenCollectionIds.add(collectionId);
        allCollections.push({
          id: collectionId,
          name: String(node.collection_name || "").trim() || collectionId,
          mediaCount: Math.max(0, Number(node.collection_media_count) || 0)
        });
      }

      const pageInfo = connection?.page_info;
      if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
        afterCursor = pageInfo.end_cursor;
      } else {
        break;
      }
    }

    // Sort: "All posts" first, then alphabetically by name
    allCollections.sort((a, b) => {
      if (a.id === "ALL_MEDIA_AUTO_COLLECTION") return -1;
      if (b.id === "ALL_MEDIA_AUTO_COLLECTION") return 1;
      return a.name.localeCompare(b.name);
    });

    return allCollections;
  }

  /**
   * Fetch one page of saved items from a collection feed.
   *
   * @param {string} collectionId - "ALL_MEDIA_AUTO_COLLECTION" or a numeric collection ID
   * @param {string} appId - Instagram app ID
   * @param {string|null} maxId - Pagination cursor (null for first page)
   * @returns {{ items: Array, moreAvailable: boolean, nextMaxId: string|null }}
   */
  async function fetchSavedFeedPage(collectionId, appId, maxId = null) {
    const isAllSaved = collectionId === "ALL_MEDIA_AUTO_COLLECTION";
    const basePath = isAllSaved
      ? "/api/v1/feed/saved/posts/"
      : `/api/v1/feed/collection/${encodeURIComponent(collectionId)}/posts/`;

    let url = `https://i.instagram.com${basePath}`;
    if (maxId) {
      url += `?max_id=${encodeURIComponent(maxId)}`;
    }

    const page = await gmFetch(url, {
      headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
      useMobileUA: true
    });

    // Extract items — different structure for "All Saved" vs specific collection.
    let rawItems;
    let moreAvailable;
    let nextMaxId;

    if (isAllSaved) {
      // "All Saved" historically nests items under save_media_response and save_clips_response.
      // Instagram may return items at page.items directly in newer API versions.
      const mediaResponse = page?.save_media_response;
      const clipsResponse = page?.save_clips_response;
      const mediaItems = Array.isArray(mediaResponse?.items) ? mediaResponse.items : [];
      const clipItems = Array.isArray(clipsResponse?.items) ? clipsResponse.items : [];
      rawItems = [...mediaItems, ...clipItems];
      // Fall back to top-level items if the nested structure is absent.
      if (rawItems.length === 0 && Array.isArray(page?.items)) {
        rawItems = page.items;
        moreAvailable = !!page.more_available;
        nextMaxId = page.more_available && page.next_max_id ? String(page.next_max_id) : null;
      } else {
        // Pagination: check both sections, take the one that has more.
        moreAvailable = !!(mediaResponse?.more_available || clipsResponse?.more_available);
        nextMaxId = (mediaResponse?.more_available && mediaResponse?.next_max_id)
          ? String(mediaResponse.next_max_id)
          : (clipsResponse?.more_available && clipsResponse?.next_max_id)
            ? String(clipsResponse.next_max_id)
            : null;
      }
    } else {
      // Specific collection: items at top level.
      rawItems = Array.isArray(page?.items) ? page.items : [];
      moreAvailable = !!page?.more_available;
      nextMaxId = page?.next_max_id ? String(page.next_max_id) : null;
    }

    // Unwrap: items may be wrapped under .media, or may be the media object directly.
    const items = [];
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const media = rawItem.media ?? (rawItem.id || rawItem.pk ? rawItem : null);
      if (media) {
        items.push(media);
      }
    }

    return { items, moreAvailable, nextMaxId };
  }

  /**
   * Collect download tasks from a single saved collection feed.
   *
   * @param {string} collectionId - "ALL_MEDIA_AUTO_COLLECTION" or numeric collection ID
   * @param {string} collectionName - Human-readable name for subfolder/logging
   * @param {string} appId - Instagram app ID
   * @param {object} policy - Pacing policy (for randomIntBetween delays)
   * @param {number} maxItems - 0 = unlimited
   * @param {object} options - { onProgressText, useCollectionSubfolder }
   * @returns {{ tasks, deltaSyncSkippedCount, deltaSyncTerminatedEarly }}
   */
  async function collectSavedDownloadTasks(collectionId, collectionName, appId, policy, maxItems = 0, options = {}) {
    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const useCollectionSubfolder = options?.useCollectionSubfolder === true;
    const deltaSyncEnabled = !_getSettings()?.downloads?.forceRedownload;
    let deltaSyncConsecutiveHits = 0;
    let deltaSyncSkippedCount = 0;
    let deltaSyncTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      deltaSyncTerminatedEarly,
      deltaSyncSkippedCount
    });

    const safeCollectionName = FILE_METADATA_CORE.sanitizeFilenameToken(collectionName || collectionId, "saved");

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Saved feed pagination guard triggered at 800 pages.");
        break;
      }

      if (onProgressText) {
        onProgressText(`collecting saved "${collectionName}" \u2022 page ${pageCount}`);
      }

      const feedPage = await fetchSavedFeedPage(collectionId, appId, maxId);
      const items = feedPage.items;
      if (items.length === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 3) {
          debugLog("[Amstragram] Saved feed: stopping after 3 consecutive empty pages (moreAvailable was:", feedPage.moreAvailable, ")");
          break;
        }
      } else {
        emptyPageStreak = 0;
      }

      for (const mediaItem of items) {
        // Saved items come from many users — use each item's owner username
        const itemUsername = mediaItem?.user?.username || "unknown";
        const isReel = mediaItem?.product_type === "clips";
        const hydratedMediaItem = await PROFILE_BULK_DOWNLOAD_CORE.hydrateMediaItemForDesktopDash(mediaItem);
        const itemTasks = PROFILE_BULK_DOWNLOAD_CORE.buildProfileItemDownloadTasks(hydratedMediaItem, itemUsername, { isReel });

        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);

          if (deltaSyncEnabled) {
            const historyKey = getDownloadHistoryKeyForTask(task);
            if (historyKey && hasDownloadedHistoryKey(historyKey)) {
              deltaSyncConsecutiveHits += 1;
              deltaSyncSkippedCount += 1;
              if (deltaSyncConsecutiveHits >= 20) {
                deltaSyncTerminatedEarly = true;
              }
              continue;
            } else {
              deltaSyncConsecutiveHits = 0;
            }
          }

          // Prepend subfolder path if enabled
          if (useCollectionSubfolder) {
            task.archivePath = `Saved/${safeCollectionName}/${task.filename}`;
          }

          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }

      if (deltaSyncTerminatedEarly) break;

      if (feedPage.moreAvailable && feedPage.nextMaxId) {
        maxId = feedPage.nextMaxId;
        // Apply pacing between pages
        const delayMs = randomIntBetween(policy?.minDelayMs || 400, policy?.maxDelayMs || 1200);
        if (delayMs > 0) await sleepMs(delayMs);
      } else {
        break;
      }
    }

    return buildResult();
  }

  /**
   * Orchestrate downloading saved collections. Called by the UI when
   * the user clicks "Download Saved" with saved mode enabled.
   *
   * @param {object} options
   * @param {Array<{id: string, name: string}>} options.collections - selected collections
   * @param {object} [options.policy] - pacing policy override
   * @param {number} [options.maxItems] - 0 = unlimited
   * @param {boolean} [options.useCollectionSubfolder] - prepend Saved/{name}/ to paths
   * @returns {Promise<{total: number, completed: number, failed: number}>}
   */
  async function startSavedBulkDownload(options = {}) {
    const collections = Array.isArray(options.collections) ? options.collections : [];
    if (collections.length === 0) {
      showToast("No saved collections selected.", 5500);
      return { total: 0, completed: 0, failed: 0 };
    }

    const amstramgramBaseUrl = sanitizeAmstramgramUrl(_getSettings()?.downloads?.amstramgramUrl ?? "");
    if (amstramgramBaseUrl) {
      try {
        const { added, total } = await syncAmstramgramShortcodes(amstramgramBaseUrl);
        if (added > 0) showToast(`Amstramgram: synced ${added} new shortcode${added !== 1 ? "s" : ""} (${total} total).`, 4000);
      } catch (err) {
        showToast(`Amstramgram sync failed: ${err?.message || "Unknown error"}`, 4000);
      }
    }

    const policy = options?.policy && typeof options.policy === "object"
      ? options.policy
      : getActiveBulkPolicy();
    const maxItems = UTILITIES_CORE.toBoundedPositiveInt(options?.maxItems, _getSettings().profileDownload.maxItems, 0, 20000);
    const useCollectionSubfolder = options?.useCollectionSubfolder !== false;
    const appId = getAppID();

    const collectionNames = collections.map(c => c.name || c.id).join(", ");
    const savedBatchLabel = `Saved (${collectionNames})`;
    const savedBulkJobId = generateBatchJobId();
    const savedBulkSetupStartedAt = Date.now();
    let savedBulkSetupVisible = false;
    let savedBulkSetupLastUiUpdateAt = 0;

    function updateSavedBulkSetupProgress(progress = {}, force = false) {
      const now = Date.now();
      if (!force && now - savedBulkSetupLastUiUpdateAt < 150) return;
      savedBulkSetupLastUiUpdateAt = now;
      const phase = typeof progress?.phase === "string" ? progress.phase : "collecting saved items";
      const collectedCount = Math.max(0, Number(progress?.collected) || 0);

      showBatchProgressIndicator({
        jobId: savedBulkJobId,
        label: savedBatchLabel,
        mode: "download",
        state: "running",
        phase: phase,
        total: 0,
        processed: collectedCount,
        completed: 0,
        failed: 0,
        cancelled: 0,
        indeterminate: true,
        elapsedMs: Math.max(0, now - savedBulkSetupStartedAt),
        forceVisible: true
      });
      savedBulkSetupVisible = true;
    }

    function finishSavedBulkSetupProgress(status = "completed", phase = "") {
      if (!savedBulkSetupVisible) return;
      showBatchProgressIndicator({
        jobId: savedBulkJobId,
        label: savedBatchLabel,
        mode: "download",
        state: "finished",
        status: status,
        phase: phase || "batch preparation finished",
        total: 0,
        processed: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        indeterminate: false,
        elapsedMs: Math.max(0, Date.now() - savedBulkSetupStartedAt),
        forceVisible: false,
        final: true
      });
      savedBulkSetupVisible = false;
    }

    try {
      const scopedTasks = [];
      const seen = new Set();

      const addUniqueScopedTasks = (tasks) => {
        for (const task of tasks) {
          // Deduplicate across collections by media pk (from task.meta.id)
          const dedupeKey = task.meta?.id
            ? `pk:${task.meta.id}`
            : `${task.url}|${task.filename}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          scopedTasks.push(task);
        }
      };

      let combinedDeltaSyncSkippedCount = 0;

      for (const collection of collections) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems > 0 && remainingLimit <= 0) break;

        updateSavedBulkSetupProgress({
          phase: `collecting saved "${collection.name}"`,
          collected: scopedTasks.length
        }, true);
        showToast(`Saved: collecting "${collection.name}"...`, 2600);

        const result = await collectSavedDownloadTasks(
          collection.id,
          collection.name,
          appId,
          policy,
          remainingLimit,
          {
            useCollectionSubfolder,
            onProgressText: (text) => {
              updateSavedBulkSetupProgress({
                phase: text,
                collected: scopedTasks.length
              });
            }
          }
        );

        addUniqueScopedTasks(result.tasks);
        combinedDeltaSyncSkippedCount += Number(result.deltaSyncSkippedCount) || 0;
      }

      if (scopedTasks.length === 0) {
        finishSavedBulkSetupProgress("completed", "no downloadable content found");
        let noContentMsg = "Saved: no downloadable content found.";
        if (combinedDeltaSyncSkippedCount > 0) {
          noContentMsg += ` (${combinedDeltaSyncSkippedCount} skipped as previously downloaded)`;
        }
        showToast(noContentMsg, 5500);
        return { total: 0, completed: 0, failed: 0 };
      }

      showToast(`Saved: ${scopedTasks.length} file(s) queued.`, 3200);
      if (combinedDeltaSyncSkippedCount > 0) {
        ensureBatchRunRecord({ jobId: savedBulkJobId }).skipped = combinedDeltaSyncSkippedCount;
      }
      if (savedBulkSetupVisible) {
        showBatchProgressIndicator({
          jobId: savedBulkJobId,
          label: savedBatchLabel,
          mode: "download",
          state: "running",
          phase: "queued, starting downloads",
          total: Math.max(1, scopedTasks.length),
          processed: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          skipped: combinedDeltaSyncSkippedCount,
          indeterminate: false,
          elapsedMs: Math.max(0, Date.now() - savedBulkSetupStartedAt),
          forceVisible: false
        });
        savedBulkSetupVisible = false;
      }

      return await runBatchDownloadTasks(scopedTasks, policy, {
        label: savedBatchLabel,
        jobId: savedBulkJobId
      });
    } catch (err) {
      finishSavedBulkSetupProgress("failed", "batch preparation failed");
      const message = err?.message || "Unknown error";
      if (message.includes("429")) {
        showToast("Saved: rate-limited (HTTP 429).", 7000);
      } else {
        showToast(`Saved: ${message}`, 7000);
      }
      throw err;
    }
  }

  // =========================================
  // DIRECT MEDIA API HELPERS
  // =========================================

  // ----- fetchProfileInfoDirect -----
  async function fetchProfileInfoDirect(username, appId) {
    debugLog("[Amstragram] fetchProfileInfoDirect called for:", username);
    let resolvedUserId = "";
    let resolvedFullName = "";
    try {
      // Step 1: web_profile_info → get user ID
      const profileUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
      const profileData = await gmFetch(profileUrl, {
        headers: { "X-IG-App-ID": appId },
        useMobileUA: true
      });

      const userId = profileData?.data?.user?.id;
      if (!userId) throw new Error("Could not get user ID");
      resolvedUserId = String(userId);
      resolvedFullName = String(profileData?.data?.user?.full_name || "").trim();
      const profilePicHdFromWebInfo = normalizeProfilePicUrl(profileData?.data?.user?.profile_pic_url_hd);

      // Step 2: users/{id}/info/ with mobile UA → profile pic
      const hdUrl = `https://i.instagram.com/api/v1/users/${userId}/info/`;
      const userData = await gmFetch(hdUrl, {
        headers: { "X-IG-App-ID": appId },
        useMobileUA: true
      });

      const userInfoFullName = String(userData?.user?.full_name || "").trim();
      if (userInfoFullName) resolvedFullName = userInfoFullName;

      // Try to get the best available URL in order of preference
      let hdPicUrl = null;

      // 1. hd_profile_pic_url_info (usually best quality)
      const hdInfoUrl = normalizeProfilePicUrl(userData?.user?.hd_profile_pic_url_info?.url);
      if (isValidHdProfilePicUrl(hdInfoUrl)) {
        hdPicUrl = hdInfoUrl;
        debugLog("[Amstragram] Using hd_profile_pic_url_info");
      }

      // 2. hd_profile_pic_versions — get the largest
      if (!hdPicUrl && userData?.user?.hd_profile_pic_versions?.length > 0) {
        const versions = [...userData.user.hd_profile_pic_versions]
          .sort((a, b) => (b.width || 0) - (a.width || 0));
        for (const version of versions) {
          const candidateUrl = normalizeProfilePicUrl(version.url);
          if (isValidHdProfilePicUrl(candidateUrl)) {
            hdPicUrl = candidateUrl;
            debugLog("[Amstragram] Using hd_profile_pic_versions, width:", version.width);
            break;
          }
        }
      }

      // 3. profile_pic_url_hd (older API, last resort)
      if (!hdPicUrl) {
        const legacyUrl = normalizeProfilePicUrl(userData?.user?.profile_pic_url_hd);
        if (isValidHdProfilePicUrl(legacyUrl)) {
          hdPicUrl = legacyUrl;
          debugLog("[Amstragram] Using profile_pic_url_hd (legacy)");
        }
      }

      // 4. profile_pic_url_hd from web_profile_info (step 1) — fallback when /info/ returns empty user.
      // Do NOT modify the stp parameter — the CDN signature (oh) covers it; upgrading the size breaks it.
      if (!hdPicUrl && profilePicHdFromWebInfo) {
        if (isTrustedInstagramMediaUrl(profilePicHdFromWebInfo) && !isPlaceholderProfilePicUrl(profilePicHdFromWebInfo)) {
          hdPicUrl = profilePicHdFromWebInfo;
          debugLog("[Amstragram] Using profile_pic_url_hd from web_profile_info");
        }
      }

      if (hdPicUrl) {
        return { success: true, hdUrl: hdPicUrl, userId: resolvedUserId, fullName: resolvedFullName };
      } else {
        return { success: false, error: "Profile picture not available", userId: resolvedUserId, fullName: resolvedFullName };
      }
    } catch (err) {
      debugLog("[Amstragram] Profile info error:", err?.message || err);
      return { success: false, error: err.message, userId: resolvedUserId, fullName: resolvedFullName };
    }
  }

  // ----- fetchStoryInfoDirect -----
  async function fetchStoryInfoDirect(username, storyMediaId, appId, options = {}) {
    debugLog("[Amstragram] fetchStoryInfoDirect called for:", username, storyMediaId);
    try {
      let graphQlMatchedItem = null;
      const normalizedStoryMediaId = String(storyMediaId || "").trim();
      let userId = String(options?.userId || "").trim();

      // Step 1: Get user ID
      if (!userId) {
        const profileUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        const profileData = await gmFetch(profileUrl, {
          headers: { "X-IG-App-ID": appId },
          useMobileUA: true
        });

        userId = String(profileData?.data?.user?.id || "").trim();
      } else {
        debugLog("[Amstragram] Reusing known profile user ID for story lookup");
      }

      if (!userId) throw new Error("Could not get user ID");

      // Method 1: GraphQL reels query (same-origin, works for public accounts)
      try {
        graphQlMatchedItem = await tryGraphQLReels(userId, normalizedStoryMediaId, appId);
        if (graphQlMatchedItem) {
          debugLog("[Amstragram] Story found via GraphQL");
        }
      } catch (e) {
        debugLog("[Amstragram] GraphQL method failed:", e.message);
      }

      // Method 2: reels_media API endpoint (cross-origin, needs GM_xmlhttpRequest).
      // Desktop UA is intentional: under mobile UA IG strips the DASH manifest down
      // to avc1 720p; desktop UA exposes the full vp09 1080p ladder.
      const reelsUrl = `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`;
      debugLog("[Amstragram] Fetching reels:", reelsUrl);

      const reelsData = await gmFetch(reelsUrl, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useDesktopUA: true
      });

      // Parse response — multiple possible structures
      let allItems = [];

      // Structure 1: { reels: { "userId": { items: [...] } } }
      if (reelsData?.reels) {
        for (const key in reelsData.reels) {
          if (reelsData.reels[key]?.items) {
            allItems = allItems.concat(reelsData.reels[key].items);
          }
        }
      }

      // Structure 2: { reels_media: [ { items: [...] } ] }
      if (reelsData?.reels_media && Array.isArray(reelsData.reels_media)) {
        for (const reel of reelsData.reels_media) {
          if (reel?.items) {
            allItems = allItems.concat(reel.items);
          }
        }
      }

      // Structure 3: Direct items array
      if (reelsData?.items && Array.isArray(reelsData.items)) {
        allItems = allItems.concat(reelsData.items);
      }

      allItems = dedupeItemsById(allItems);
      debugLog("[Amstragram] All story items found:", allItems.length);

      // Try to find matching story by ID
      let storyItem = null;
      if (normalizedStoryMediaId) {
        for (const item of allItems) {
          const itemPk = String(item.pk || "");
          const itemId = String(item.id || "");

          if (
            STORY_MATCHING_CORE.mediaIdsMatch(itemPk, normalizedStoryMediaId) ||
            STORY_MATCHING_CORE.mediaIdsMatch(itemId, normalizedStoryMediaId)
          ) {
            storyItem = item;
            debugLog("[Amstragram] Found matching story item!");
            break;
          }
        }
      }

      if (!storyItem && graphQlMatchedItem) {
        storyItem = graphQlMatchedItem;
      }

      if (storyItem) {
        return {
          success: true,
          data: { items: [storyItem] },
          allStories: allItems.length > 1,
          allItemsData: allItems.length > 0 ? allItems : [storyItem]
        };
      } else if (allItems.length > 0) {
        debugLog("[Amstragram] Could not match specific story, returning all items");
        return { success: true, data: { items: allItems }, allStories: true, allItemsData: allItems };
      } else if (graphQlMatchedItem) {
        return {
          success: true,
          data: { items: [graphQlMatchedItem] },
          allStories: false,
          allItemsData: [graphQlMatchedItem]
        };
      } else {
        throw new Error("No stories found for this user");
      }
    } catch (err) {
      debugLog("[Amstragram] Story info error:", err?.message || err);
      return { success: false, error: err.message };
    }
  }

  // ----- fetchHighlightInfoDirect -----
  async function fetchHighlightInfoDirect(highlightId, mediaId, appId) {
    debugLog("[Amstragram] fetchHighlightInfoDirect called for:", highlightId, "media:", mediaId);
    try {
      // Method 1: reels_media with highlight: prefix.
      // Desktop UA is intentional (see fetchStoryInfoDirect); mobile UA degrades
      // the DASH manifest to avc1 720p instead of vp09 1080p.
      const reelsUrl = `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=highlight%3A${highlightId}`;
      debugLog("[Amstragram] Fetching highlight via reels_media:", reelsUrl);

      let allItems = [];

      try {
        const reelsData = await gmFetch(reelsUrl, {
          headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
          useDesktopUA: true
        });

        // Structure: { reels: { "highlight:123": { items: [...] } } }
        if (reelsData?.reels) {
          for (const key in reelsData.reels) {
            if (reelsData.reels[key]?.items) {
              allItems = allItems.concat(reelsData.reels[key].items);
            }
          }
        }

        // Also check reels_media array
        if (reelsData?.reels_media && Array.isArray(reelsData.reels_media)) {
          for (const reel of reelsData.reels_media) {
            if (reel?.items) {
              allItems = allItems.concat(reel.items);
            }
          }
        }

        allItems = dedupeItemsById(allItems);
        debugLog("[Amstragram] Highlight items found:", allItems.length);
      } catch (e) {
        debugLog("[Amstragram] reels_media highlight fetch failed:", e.message);
      }

      if (allItems.length > 0) {
        // If we have a specific media ID, try to find it
        if (mediaId) {
          const targetItem = allItems.find(item =>
            String(item.pk) === String(mediaId) ||
            String(item.id) === String(mediaId)
          );
          if (targetItem) {
            return {
              success: true,
              data: { items: [targetItem] },
              allItems: true,
              allItemsData: allItems
            };
          }
        }
        // Return all items for content-side matching
        return { success: true, data: { items: allItems }, allItems: true, allItemsData: allItems };
      }

      // Method 2: highlights_tray fallback
      debugLog("[Amstragram] reels_media empty, trying highlights_tray...");
      const trayUrl = `https://i.instagram.com/api/v1/highlights/${highlightId}/highlights_tray/`;

      const trayData = await gmFetch(trayUrl, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useDesktopUA: true
      });

      const trayItems = trayData?.reels?.[`highlight:${highlightId}`]?.items ||
        trayData?.items ||
        [];

      if (trayItems.length > 0) {
        return { success: true, data: { items: trayItems }, allItems: true, allItemsData: trayItems };
      } else {
        throw new Error("No items found in highlight");
      }
    } catch (err) {
      debugLog("[Amstragram] Highlight info error:", err?.message || err);
      return { success: false, error: err.message };
    }
  }

  // ----- fetchMediaInfoDirect -----
  async function fetchMediaInfoDirect(mediaId, appId) {
    debugLog("[Amstragram] fetchMediaInfoDirect called for:", mediaId);
    try {
      const url = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
      const data = await gmFetch(url, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useDesktopUA: true
      });

      debugLog("[Amstragram] Media info fetched successfully");
      return { success: true, data: data };
    } catch (err) {
      debugLog("[Amstragram] Media info error:", err?.message || err);
      return { success: false, error: err.message };
    }
  }

  // =========================================
  // TAGGED FEED EXTRACTION AND FALLBACKS
  // =========================================

  function mediaContainsTaggedProfile(media, taggedUserId = "", taggedUsername = "") {
    if (!media || typeof media !== "object") return false;
    const normalizedUserId = taggedUserId ? String(taggedUserId) : "";
    const normalizedUsername = typeof taggedUsername === "string"
      ? taggedUsername.trim().toLowerCase()
      : "";
    const rawTags = media?.usertags?.in ?? media?.usertags?.users ?? media?.usertags;
    const tagEntries = Array.isArray(rawTags) ? rawTags : [];

    for (const tagEntry of tagEntries) {
      const user = tagEntry?.user && typeof tagEntry.user === "object"
        ? tagEntry.user
        : tagEntry;
      const taggedId = user?.pk || user?.id || "";
      const taggedName = typeof user?.username === "string"
        ? user.username.trim().toLowerCase()
        : "";
      if (normalizedUserId && taggedId && STORY_MATCHING_CORE.mediaIdsMatch(taggedId, normalizedUserId)) return true;
      if (normalizedUsername && taggedName && taggedName === normalizedUsername) return true;
    }

    return false;
  }

  function hasDownloadableProfileMedia(item) {
    if (!item || typeof item !== "object") return false;
    if (Array.isArray(item?.video_versions) && item.video_versions.length > 0) return true;
    if (Array.isArray(item?.image_versions2?.candidates) && item.image_versions2.candidates.length > 0) return true;
    if (Array.isArray(item?.carousel_media) && item.carousel_media.length > 0) return true;
    if (typeof item?.display_url === "string" && item.display_url.trim()) return true;
    return false;
  }

  function coerceTaggedFeedCandidateToProfileItem(candidate, fallbackCode = "") {
    if (!candidate || typeof candidate !== "object") return null;
    if (hasDownloadableProfileMedia(candidate)) return candidate;

    const normalizedLegacy = normalizeLegacyNodeToMediaItem(candidate, fallbackCode);
    if (hasDownloadableProfileMedia(normalizedLegacy)) return normalizedLegacy;
    return null;
  }

  function extractTaggedFeedMediaItems(page) {
    const feedEntries = [];
    const feedSources = [
      page,
      page?.data,
      page?.feed,
      page?.data?.feed,
      page?.payload,
      page?.payload?.data,
      page?.response,
      page?.response?.data
    ];
    for (const source of feedSources) {
      if (!source || typeof source !== "object") continue;
      if (Array.isArray(source.items)) feedEntries.push(...source.items);
      if (Array.isArray(source.feed_items)) feedEntries.push(...source.feed_items);
      if (Array.isArray(source.sectional_items)) feedEntries.push(...source.sectional_items);
      if (Array.isArray(source.sections)) feedEntries.push(...source.sections);
    }

    const items = [];
    const seen = new Set();

    for (const entry of feedEntries) {
      if (!entry || typeof entry !== "object") continue;

      const layoutMedias = Array.isArray(entry?.layout_content?.medias)
        ? entry.layout_content.medias
        : [];
      const candidates = [
        entry,
        entry?.media_or_ad,
        entry?.media,
        entry?.item,
        entry?.node,
        entry?.post,
        entry?.post_data,
        entry?.layout_content?.media,
        entry?.content?.media,
        entry?.explore_item_info?.media,
        ...layoutMedias.map((layoutItem) =>
          layoutItem?.media_or_ad || layoutItem?.media || layoutItem?.item || layoutItem?.node || layoutItem
        )
      ];

      let matchedItem = null;
      for (const candidate of candidates) {
        const fallbackCode = candidate?.code || candidate?.shortcode || entry?.code || entry?.shortcode || "";
        const normalized = coerceTaggedFeedCandidateToProfileItem(candidate, fallbackCode);
        if (normalized) {
          matchedItem = normalized;
          break;
        }
      }
      if (!matchedItem) continue;

      const dedupeKey = String(
        matchedItem?.pk
        || matchedItem?.id
        || matchedItem?.code
        || matchedItem?.shortcode
        || ""
      ).trim();
      const key = dedupeKey || [
        matchedItem?.video_versions?.[0]?.url || "",
        matchedItem?.image_versions2?.candidates?.[0]?.url || "",
        matchedItem?.display_url || "",
        matchedItem?.carousel_media?.[0]?.video_versions?.[0]?.url || "",
        matchedItem?.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url || "",
        matchedItem?.carousel_media?.[0]?.display_url || ""
      ].find(Boolean);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      items.push(matchedItem);
    }

    return items;
  }

  function isLikelyInstagramShortcode(value) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_-]{5,15}$/.test(normalized)) return false;
    return /[A-Za-z]/.test(normalized);
  }

  function addShortcodeMatchesFromText(text, shortcodes) {
    if (typeof text !== "string" || !text) return;

    const pathPatterns = [
      /(?:https?:\/\/(?:www\.)?instagram\.com)?\/(?:p|reel)\/([A-Za-z0-9_-]{5,15})/g,
      /(?:https?:\\\/\\\/(?:www\\\.)?instagram\.com)?\\\/(?:p|reel)\\\/([A-Za-z0-9_-]{5,15})/g
    ];
    const codePatterns = [
      /"shortcode"\s*:\s*"([A-Za-z0-9_-]{5,15})"/g,
      /\\"shortcode\\"\s*:\s*\\"([A-Za-z0-9_-]{5,15})\\"/g
    ];

    for (const pattern of pathPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const shortcode = match[1];
        if (isLikelyInstagramShortcode(shortcode)) shortcodes.add(shortcode);
      }
    }
    for (const pattern of codePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const shortcode = match[1];
        if (isLikelyInstagramShortcode(shortcode)) shortcodes.add(shortcode);
      }
    }
  }

  function normalizePotentiallyEscapedTaggedPageText(text) {
    if (typeof text !== "string" || !text) return "";
    return text
      .replace(/\\u002[fF]/g, "/")
      .replace(/\\\//g, "/")
      .replace(/&#x2[fF];/g, "/")
      .replace(/&#47;/g, "/")
      .replace(/&sol;/g, "/");
  }

  function extractTaggedShortcodesFromProfilePayload(payload) {
    const shortcodes = new Set();
    const containers = [
      payload?.data?.user?.edge_user_to_photos_of_you,
      payload?.graphql?.user?.edge_user_to_photos_of_you,
      payload?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__users__web_profile_info?.data?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__users__web_profile_info?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__usertags__user_id__feed,
      payload?.data?.xdt_api__v1__usertags__user_id__feed_connection,
      payload?.xdt_api__v1__usertags__user_id__feed,
      payload?.xdt_api__v1__usertags__user_id__feed_connection
    ];

    for (const container of containers) {
      const edges = Array.isArray(container?.edges) ? container.edges : [];
      for (const edge of edges) {
        const shortcode = edge?.node?.shortcode || edge?.shortcode || "";
        if (isLikelyInstagramShortcode(shortcode)) {
          shortcodes.add(shortcode);
        }
      }
    }

    return Array.from(shortcodes);
  }

  function extractTaggedShortcodesFromPayloadDeep(payload) {
    const shortcodes = new Set(extractTaggedShortcodesFromProfilePayload(payload));
    const nodes = extractTaggedGridNodesFromPayload(payload);

    for (const node of nodes) {
      const shortcode = node?.shortcode || node?.code || "";
      if (isLikelyInstagramShortcode(shortcode)) {
        shortcodes.add(shortcode);
      }
    }

    return Array.from(shortcodes);
  }

  function normalizeTaggedGraphQLPageInfo(pageInfo) {
    if (!pageInfo || typeof pageInfo !== "object") return null;
    const endCursorRaw = pageInfo.end_cursor ?? pageInfo.endCursor;
    const endCursor = (typeof endCursorRaw === "string")
      ? endCursorRaw.trim()
      : "";
    const hasNextRaw = pageInfo.has_next_page ?? pageInfo.hasNextPage;
    const hasNextPage = (typeof hasNextRaw === "boolean")
      ? hasNextRaw
      : !!(hasNextRaw && endCursor);
    return { hasNextPage: hasNextPage, endCursor: endCursor };
  }

  function extractTaggedGraphQLPageInfo(payload) {
    const explicitContainers = [
      payload?.data?.user?.edge_user_to_photos_of_you,
      payload?.graphql?.user?.edge_user_to_photos_of_you,
      payload?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__users__web_profile_info?.data?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__users__web_profile_info?.user?.edge_user_to_photos_of_you,
      payload?.data?.xdt_api__v1__usertags__user_id__feed,
      payload?.data?.xdt_api__v1__usertags__user_id__feed_connection,
      payload?.xdt_api__v1__usertags__user_id__feed,
      payload?.xdt_api__v1__usertags__user_id__feed_connection
    ];

    for (const container of explicitContainers) {
      const pageInfo = normalizeTaggedGraphQLPageInfo(container?.page_info ?? container?.pageInfo);
      if (pageInfo) return pageInfo;
    }

    const seenObjects = typeof WeakSet !== "undefined" ? new WeakSet() : null;
    const stack = [payload];
    let visitedCount = 0;

    while (stack.length > 0 && visitedCount < 4000) {
      const current = stack.pop();
      if (!current || typeof current !== "object") continue;
      if (seenObjects) {
        if (seenObjects.has(current)) continue;
        seenObjects.add(current);
      }
      visitedCount += 1;

      if (Array.isArray(current)) {
        for (let i = current.length - 1; i >= 0; i--) {
          const child = current[i];
          if (child && typeof child === "object") stack.push(child);
        }
        continue;
      }

      const pageInfo = normalizeTaggedGraphQLPageInfo(current.page_info ?? current.pageInfo);
      if (pageInfo) {
        const edges = Array.isArray(current.edges) ? current.edges : [];
        const edgeLooksTagged = edges.some((edge) => {
          const node = edge?.node && typeof edge.node === "object" ? edge.node : edge;
          const shortcode = node?.shortcode || node?.code || "";
          return isLikelyInstagramShortcode(shortcode);
        });
        const keyLooksTagged = Object.keys(current).some((key) => /tagged|photos_of_you|usertags/i.test(key));
        if (edgeLooksTagged || keyLooksTagged) {
          return pageInfo;
        }
      }

      for (const child of Object.values(current)) {
        if (child && typeof child === "object") {
          stack.push(child);
        }
      }
    }

    return null;
  }

  function summarizeTaggedItemForTrace(item, taggedUserId = "", taggedUsername = "") {
    if (!item || typeof item !== "object") return null;
    const author = item?.user && typeof item.user === "object"
      ? item.user
      : (item?.owner && typeof item.owner === "object" ? item.owner : null);
    const firstCarouselItem = Array.isArray(item?.carousel_media) && item.carousel_media.length > 0
      ? item.carousel_media[0]
      : null;
    return {
      id: String(item?.pk || item?.id || ""),
      shortcode: String(item?.code || item?.shortcode || ""),
      mediaType: item?.media_type ?? item?.product_type ?? null,
      authorUsername: author?.username || "",
      authorId: String(author?.pk || author?.id || ""),
      hasDownloadableMedia: hasDownloadableProfileMedia(item),
      hasCarousel: Array.isArray(item?.carousel_media) ? item.carousel_media.length : 0,
      firstCarouselShortcode: String(firstCarouselItem?.code || firstCarouselItem?.shortcode || ""),
      taggedTargetMatch: mediaContainsTaggedProfile(item, taggedUserId, taggedUsername)
    };
  }

  function pushTaggedNodesFromContainer(container, sink) {
    if (!container) return;
    const entries = Array.isArray(container?.edges)
      ? container.edges
      : (Array.isArray(container?.items) ? container.items : (Array.isArray(container) ? container : []));
    for (const entry of entries) {
      const node = entry?.node && typeof entry.node === "object"
        ? entry.node
        : (entry?.media && typeof entry.media === "object" ? entry.media : (entry && typeof entry === "object" ? entry : null));
      if (node) sink.push(node);
    }
  }

  function extractTaggedGridNodesFromPayload(payload) {
    const nodes = [];
    const seenObjects = typeof WeakSet !== "undefined" ? new WeakSet() : null;

    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (seenObjects) {
        if (seenObjects.has(value)) return;
        seenObjects.add(value);
      }

      if (Array.isArray(value)) {
        for (const entry of value) visit(entry);
        return;
      }

      const explicitContainers = [
        value.edge_user_to_photos_of_you,
        value.edge_media_to_tagged_user,
        value.edge_tagged_media,
        value.photos_of_you
      ];
      for (const container of explicitContainers) {
        pushTaggedNodesFromContainer(container, nodes);
      }

      for (const [key, child] of Object.entries(value)) {
        if (!child || typeof child !== "object") continue;
        const lowered = key.toLowerCase();
        if ((lowered.includes("photos_of_you") || lowered.includes("tagged") || lowered.includes("usertags")) && Array.isArray(child?.edges)) {
          pushTaggedNodesFromContainer(child, nodes);
        }
        visit(child);
      }
    };

    visit(payload);

    const deduped = [];
    const seen = new Set();
    for (const node of nodes) {
      const key = String(
        node?.pk
        || node?.id
        || node?.shortcode
        || node?.code
        || ""
      ).trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(node);
    }
    return deduped;
  }

  function collectTaggedTasksFromProfilePayload(profilePayload, username, userId, maxItems = 0, options = {}) {
    const includeAllCarouselMedia = options?.includeAllCarouselMedia === true;
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const nodes = extractTaggedGridNodesFromPayload(profilePayload);
    const tasks = [];
    const seen = new Set();

    for (const node of nodes) {
      const fallbackCode = node?.shortcode || node?.code || "";
      const item = coerceTaggedFeedCandidateToProfileItem(node, fallbackCode);
      if (!item) continue;

      const itemTasks = PROFILE_BULK_DOWNLOAD_CORE.buildProfileItemDownloadTasks(item, username, {
        includeAllCarouselMedia: includeAllCarouselMedia,
        taggedUserId: userId,
        taggedUsername: username
      });

      for (const task of itemTasks) {
        const key = `${task.url}|${task.filename}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push(task);
        if (limit > 0 && tasks.length >= limit) {
          return tasks;
        }
      }
    }

    return tasks;
  }

  function parseJsonLikeText(rawText) {
    if (typeof rawText !== "string") return null;
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    const parseCandidates = [
      trimmed,
      trimmed.replace(/^\)\]\}'\s*/, ""),
      trimmed.replace(/^for\s*\(;;\);\s*/, ""),
      trimmed.replace(/^while\s*\(1\);\s*/, "")
    ];

    for (const candidate of parseCandidates) {
      if (!candidate) continue;
      try {
        return JSON.parse(candidate);
      } catch {
        // continue
      }
    }
    return null;
  }

  function extractJsonPayloadsFromTaggedPageHtml(html) {
    if (typeof html !== "string" || !html) return [];
    const payloads = [];
    const seen = new Set();

    const scriptJsonPattern = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptJsonPattern.exec(html)) !== null) {
      const parsed = parseJsonLikeText(scriptMatch[1] || "");
      if (!parsed || typeof parsed !== "object") continue;
      const key = JSON.stringify(parsed)?.slice(0, 512) || "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      payloads.push(parsed);
    }

    const additionalDataPattern = /window\.__(?:additional|initial)DataLoaded\([^,]+,\s*(\{[\s\S]*?\})\s*\);/g;
    let additionalMatch;
    while ((additionalMatch = additionalDataPattern.exec(html)) !== null) {
      const parsed = parseJsonLikeText(additionalMatch[1] || "");
      if (!parsed || typeof parsed !== "object") continue;
      const key = JSON.stringify(parsed)?.slice(0, 512) || "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      payloads.push(parsed);
    }

    return payloads;
  }

  function extractShortcodesFromText(text) {
    if (typeof text !== "string" || !text) return [];
    const shortcodes = new Set();
    addShortcodeMatchesFromText(text, shortcodes);
    const normalizedText = normalizePotentiallyEscapedTaggedPageText(text);
    if (normalizedText && normalizedText !== text) {
      addShortcodeMatchesFromText(normalizedText, shortcodes);
    }
    return Array.from(shortcodes);
  }

  function extractHttpStatusCodeFromError(error) {
    const message = String(error?.message || error || "");
    const match = message.match(/HTTP\s+(\d{3})/i);
    if (!match?.[1]) return 0;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isRetryableTaggedRequestStatus(statusCode) {
    if (!Number.isFinite(statusCode) || statusCode <= 0) return false;
    return statusCode === 403 || statusCode === 429 || statusCode >= 500;
  }

  function extractTaggedShortcodesFromDocument(username = "", rootDocument = null) {
    const doc = rootDocument && typeof rootDocument.querySelectorAll === "function"
      ? rootDocument
      : (typeof document !== "undefined" && document && typeof document.querySelectorAll === "function"
        ? document
        : null);
    if (!doc) return [];

    const normalizedUsername = typeof username === "string"
      ? username.trim().toLowerCase()
      : "";
    let locationHref = "";

    if (typeof doc?.location?.href === "string") {
      locationHref = doc.location.href;
    } else if (typeof window !== "undefined" && typeof window?.location?.href === "string") {
      locationHref = window.location.href;
    }

    if (normalizedUsername && locationHref) {
      try {
        const parsed = new URL(locationHref, "https://www.instagram.com");
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const pageUsername = (pathParts[0] || "").trim().toLowerCase();
        if (pageUsername && pageUsername !== normalizedUsername) return [];
      } catch {
        // Ignore malformed location URLs and continue extraction.
      }
    }

    const selectors = [
      "main a[href*='/p/']",
      "main a[href*='/reel/']",
      "a[href^='/p/']",
      "a[href^='/reel/']",
      "a[href*='instagram.com/p/']",
      "a[href*='instagram.com/reel/']"
    ];
    const anchorNodes = doc.querySelectorAll(selectors.join(","));
    const shortcodes = new Set();

    for (const anchor of anchorNodes) {
      const rawHref = (typeof anchor?.getAttribute === "function")
        ? (anchor.getAttribute("href") || "")
        : (typeof anchor?.href === "string" ? anchor.href : "");
      if (!rawHref) continue;

      let pathname;
      try {
        pathname = new URL(rawHref, "https://www.instagram.com").pathname || "";
      } catch {
        continue;
      }

      const match = pathname.match(/^\/(?:p|reel)\/([A-Za-z0-9_-]{5,15})(?:\/|$)/i);
      if (!match?.[1]) continue;
      const shortcode = match[1];
      if (isLikelyInstagramShortcode(shortcode)) {
        shortcodes.add(shortcode);
      }
    }

    return Array.from(shortcodes);
  }

  async function collectTaggedTasksFromProfilePageFallback(username, userId, policy, maxItems = 0, options = {}) {
    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const includeAllCarouselMedia = options?.includeAllCarouselMedia === true;
    const appId = getAppID();
    const retryCount = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryCount, 0, 0, 8);
    const retryBackoffMs = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryBackoffMs, 0, 0, 600000);
    const traceSampleLimit = 5;
    let shortcodeTraceCount = 0;
    const shortcodeSet = new Set();
    const shortcodeFailureStatuses = new Map();
    const rememberShortcodeFailureStatus = (statusCode) => {
      if (!Number.isFinite(statusCode) || statusCode <= 0) return;
      const previous = shortcodeFailureStatuses.get(statusCode) || 0;
      shortcodeFailureStatuses.set(statusCode, previous + 1);
    };
    const profileInfoCandidates = [
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    ];

    TAGGED_TRACE_ENABLED && taggedTrace("Fallback pipeline start", {
      username: String(username || ""),
      userId: String(userId || ""),
      limit,
      includeAllCarouselMedia,
      retryCount,
      retryBackoffMs
    });

    for (const profileInfoUrl of profileInfoCandidates) {
      try {
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback web_profile_info request", { url: profileInfoUrl });
        const profileResponse = await fetch(profileInfoUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            "X-IG-App-ID": appId,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "*/*"
          }
        });
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback web_profile_info response", { url: profileInfoUrl, status: profileResponse.status, ok: profileResponse.ok });
        if (!profileResponse.ok) continue;
        const profileData = await profileResponse.json();
        const directTasks = collectTaggedTasksFromProfilePayload(
          profileData,
          username,
          userId,
          limit > 0 ? Math.max(0, limit - collected.length) : 0,
          { includeAllCarouselMedia: includeAllCarouselMedia }
        );
        for (const task of directTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return collected;
          }
        }
        const profileShortcodes = extractTaggedShortcodesFromProfilePayload(profileData);
        for (const shortcode of profileShortcodes) {
          shortcodeSet.add(shortcode);
        }
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback web_profile_info extraction", {
          url: profileInfoUrl,
          directTasks: directTasks.length,
          profileShortcodes: profileShortcodes.length,
          profileShortcodeSample: profileShortcodes.slice(0, traceSampleLimit),
          taskAuthorSample: directTasks.slice(0, traceSampleLimit).map((task) => ({
            filename: task?.filename || "",
            metaType: task?.meta?.type || "",
            authorUsername: task?.meta?.authorUsername || "",
            shortcode: task?.meta?.shortcode || ""
          }))
        });
        if (shortcodeSet.size > 0 || collected.length > 0) break;
      } catch (err) {
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback web_profile_info error", { url: profileInfoUrl, error: String(err?.message || err) });
        debugLog("[Amstragram] Tagged fallback web_profile_info fetch failed:", err?.message || err);
      }
    }

    if (shortcodeSet.size === 0) {
      const domShortcodes = extractTaggedShortcodesFromDocument(username);
      for (const shortcode of domShortcodes) {
        shortcodeSet.add(shortcode);
      }
      if (domShortcodes.length > 0) {
        debugLog("[Amstragram] Tagged fallback found shortcodes from current DOM:", domShortcodes.length);
      }
      TAGGED_TRACE_ENABLED && taggedTrace("Fallback DOM shortcode extraction", {
        count: domShortcodes.length,
        sample: domShortcodes.slice(0, traceSampleLimit)
      });
    }

    if (shortcodeSet.size === 0) {
      const taggedJsonCandidates = [
        `https://www.instagram.com/${encodeURIComponent(username)}/tagged/?__a=1&__d=dis`,
        `https://www.instagram.com/${encodeURIComponent(username)}/?__a=1&__d=dis`
      ];
      for (const taggedJsonUrl of taggedJsonCandidates) {
        try {
          TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged JSON request", { url: taggedJsonUrl });
          const jsonResponse = await fetch(taggedJsonUrl, {
            method: "GET",
            credentials: "include",
            headers: {
              "X-IG-App-ID": appId,
              "X-Requested-With": "XMLHttpRequest",
              "Accept": "*/*"
            }
          });
          TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged JSON response", { url: taggedJsonUrl, status: jsonResponse.status, ok: jsonResponse.ok });
          if (!jsonResponse.ok) continue;

          const payload = await jsonResponse.json();
          const directTasks = collectTaggedTasksFromProfilePayload(
            payload,
            username,
            userId,
            limit > 0 ? Math.max(0, limit - collected.length) : 0,
            { includeAllCarouselMedia: includeAllCarouselMedia }
          );
          for (const task of directTasks) {
            const key = `${task.url}|${task.filename}`;
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(task);
            if (limit > 0 && collected.length >= limit) {
              return collected;
            }
          }

          const payloadShortcodes = extractTaggedShortcodesFromProfilePayload(payload);
          for (const shortcode of payloadShortcodes) {
            shortcodeSet.add(shortcode);
          }
          TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged JSON extraction", {
            url: taggedJsonUrl,
            directTasks: directTasks.length,
            payloadShortcodes: payloadShortcodes.length,
            payloadShortcodeSample: payloadShortcodes.slice(0, traceSampleLimit)
          });
          if (shortcodeSet.size > 0 || collected.length > 0) break;
        } catch (err) {
          TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged JSON error", { url: taggedJsonUrl, error: String(err?.message || err) });
          debugLog("[Amstragram] Tagged JSON fallback failed:", taggedJsonUrl, err?.message || err);
        }
      }
    }

    if (shortcodeSet.size === 0) {
      const taggedPageUrl = `https://www.instagram.com/${encodeURIComponent(username)}/tagged/`;
      try {
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged HTML request", { url: taggedPageUrl });
        const response = await fetch(taggedPageUrl, {
          method: "GET",
          credentials: "include",
          headers: { "Accept": "text/html" }
        });
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged HTML response", { url: taggedPageUrl, status: response.status, ok: response.ok });
        if (!response.ok) {
          throw new Error(`Tagged tab fetch failed (HTTP ${response.status})`);
        }

        const html = await response.text();
        const htmlPayloads = extractJsonPayloadsFromTaggedPageHtml(html);
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged HTML parsed payloads", {
          htmlLength: html.length,
          payloadCount: htmlPayloads.length
        });
        for (const payload of htmlPayloads) {
          const directTasks = collectTaggedTasksFromProfilePayload(
            payload,
            username,
            userId,
            limit > 0 ? Math.max(0, limit - collected.length) : 0,
            { includeAllCarouselMedia: includeAllCarouselMedia }
          );
          for (const task of directTasks) {
            const key = `${task.url}|${task.filename}`;
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(task);
            if (limit > 0 && collected.length >= limit) {
              return collected;
            }
          }

          const payloadShortcodes = extractTaggedShortcodesFromProfilePayload(payload);
          for (const shortcode of payloadShortcodes) {
            shortcodeSet.add(shortcode);
          }
        }

        const htmlShortcodes = extractShortcodesFromText(html);
        for (const shortcode of htmlShortcodes) {
          shortcodeSet.add(shortcode);
        }
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged HTML shortcode extraction", {
          htmlShortcodes: htmlShortcodes.length,
          htmlShortcodeSample: htmlShortcodes.slice(0, traceSampleLimit),
          shortcodeSetSizeAfterHtml: shortcodeSet.size,
          collectedTasksSoFar: collected.length
        });
      } catch (err) {
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback tagged HTML error", { error: String(err?.message || err) });
        debugLog("[Amstragram] Tagged tab HTML fallback failed:", err?.message || err);
        if (collected.length > 0) {
          return collected;
        }
      }
    }

    const shortcodes = Array.from(shortcodeSet);
    TAGGED_TRACE_ENABLED && taggedTrace("Fallback final shortcode set", {
      count: shortcodes.length,
      sample: shortcodes.slice(0, 12),
      collectedTasksBeforeShortcodeResolution: collected.length
    });
    if (shortcodes.length === 0) {
      TAGGED_TRACE_ENABLED && taggedTrace("Fallback no shortcodes", {
        collectedTasks: collected.length,
        username: String(username || "")
      });
      if (collected.length > 0) return collected;
      throw new Error("Tagged tab did not expose any post shortcodes");
    }

    for (let i = 0; i < shortcodes.length; i++) {
      const shortcode = shortcodes[i];
      if (shortcodeTraceCount < 12) {
        TAGGED_TRACE_ENABLED && taggedTrace("Fallback resolving shortcode", {
          index: i + 1,
          total: shortcodes.length,
          shortcode
        });
      }
      let resolved = false;
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          let mediaItem = await fetchPostInfoWithFallback(shortcode);
          if (!mediaItem) {
            mediaItem = await fetchPostInfoFromHtml(shortcode);
          }
          const itemTasks = PROFILE_BULK_DOWNLOAD_CORE.buildProfileItemDownloadTasks(mediaItem, username, {
            includeAllCarouselMedia: includeAllCarouselMedia,
            taggedUserId: userId,
            taggedUsername: username
          });

          for (const task of itemTasks) {
            const key = `${task.url}|${task.filename}`;
            if (seen.has(key)) continue;
            seen.add(key);
            collected.push(task);
            if (limit > 0 && collected.length >= limit) {
              return collected;
            }
          }

          if (shortcodeTraceCount < 12) {
            TAGGED_TRACE_ENABLED && taggedTrace("Fallback shortcode resolved", {
              shortcode,
              itemSummary: summarizeTaggedItemForTrace(mediaItem, userId, username),
              taskCount: itemTasks.length,
              taskSample: itemTasks.slice(0, traceSampleLimit).map((task) => ({
                filename: task?.filename || "",
                authorUsername: task?.meta?.authorUsername || "",
                metaType: task?.meta?.type || "",
                shortcode: task?.meta?.shortcode || ""
              }))
            });
            shortcodeTraceCount += 1;
          }

          resolved = true;
          break;
        } catch (err) {
          const statusCode = extractHttpStatusCodeFromError(err);
          rememberShortcodeFailureStatus(statusCode);
          if (shortcodeTraceCount < 12) {
            TAGGED_TRACE_ENABLED && taggedTrace("Fallback shortcode resolve attempt failed", {
              shortcode,
              attempt,
              statusCode,
              error: String(err?.message || err)
            });
          }
          const shouldRetry = isRetryableTaggedRequestStatus(statusCode) && attempt < retryCount;
          if (!shouldRetry) {
            debugLog("[Amstragram] Tagged fallback shortcode fetch failed:", shortcode, err?.message || err);
            break;
          }

          const backoffMs = retryBackoffMs * (attempt + 1);
          if (backoffMs > 0) await sleepMs(backoffMs);
        }
      }

      if (!resolved) {
        if (shortcodeTraceCount < 12) {
          TAGGED_TRACE_ENABLED && taggedTrace("Fallback shortcode unresolved", { shortcode });
          shortcodeTraceCount += 1;
        }
        debugLog("[Amstragram] Tagged fallback could not resolve shortcode:", shortcode);
      }

      if (i < shortcodes.length - 1) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    if (collected.length === 0 && shortcodeFailureStatuses.size > 0) {
      const summary = Array.from(shortcodeFailureStatuses.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([statusCode, count]) => `${statusCode}x${count}`)
        .join(", ");
      showToast(`Tagged post requests were blocked (${summary}). Try Safe speed + reload tagged tab.`, 7000);
    }

    TAGGED_TRACE_ENABLED && taggedTrace("Fallback pipeline complete", {
      totalTasks: collected.length,
      shortcodeFailures: Array.from(shortcodeFailureStatuses.entries())
    });

    return collected;
  }

  return {
    _init,
    _setup,
    collectTaggedTasksFromProfilePageFallback,
    extractHttpStatusCodeFromError,
    extractTaggedFeedMediaItems,
    extractTaggedGraphQLPageInfo,
    extractTaggedShortcodesFromPayloadDeep,
    fetchHighlightInfoDirect,
    fetchPostInfoFromHtml,
    fetchPostInfoWithFallback,
    fetchProfileInfoDirect,
    getAppID,
    getBestStoryItemMedia,
    gmFetch,
    handleDirectMessageRightClick,
    handleHighlightBubbleRightClick,
    handlePostRightClick,
    handleProfilePicRightClick,
    handleStoryBubbleRightClick,
    handleStoryRightClick,
    isLikelyInstagramShortcode,
    isRetryableTaggedRequestStatus,
    isValidHdProfilePicUrl,
    mediaContainsTaggedProfile,
    normalizeProfilePicUrl,
    summarizeTaggedItemForTrace,
    syncProfileGridObserver,
    tryGraphQLTaggedFeed,
    dispatchVideoDownload,
    downloadFile,
    fetchSavedCollections,
    startSavedBulkDownload,
  };
})();
