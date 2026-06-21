(function () {
  "use strict";
  // Built from modular sources via scripts/build-userscript.mjs.

  const { icons, SETTINGS_LAUNCHER_ICON_SVG } = STYLES_CORE;

  // =========================================
  // RUNTIME CONFIG
  // Optional overrides:
  //   window.__IG_HD_CONFIG__
  //   localStorage keys: IG_HD_CONFIG / ig_hd_config (JSON string)
  // =========================================
  const DEFAULT_RUNTIME_CONFIG = {
    fallbackAppId: "936619743392459",
    queryIds: {
      postInfo: "9496392173716084",
      reels: "303923573826982",
      tagged: "26089518974011577",
      savedCollections: "26523442937261068"
    },
    desktopUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    mobileUserAgent: "Mozilla/5.0 (Linux; Android 15; SM-S938B Build/AP3A.241005.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.200 Mobile Safari/537.36 Instagram 344.0.0.42.88",
    enableDebugLogs: false,
    limits: {
      maxScriptTagsToScan: 120,
      maxScriptCharsToScan: 2000000,
      maxWindowKeysToScan: 80,
      maxObjectTraversalNodes: 3000,
      maxObjectKeysPerNode: 120,
      maxArrayItemsPerNode: 250,
      maxHtmlCharsToScan: 2500000,
      maxStoryHtmlHitsPerTerm: 20
    }
  };


  function computeSettingsTooltipPosition(anchorRect, tooltipRect, viewportWidth = window.innerWidth || 0, viewportHeight = window.innerHeight || 0) {
    return UTILITIES_CORE.computeSettingsTooltipPosition(anchorRect, tooltipRect, viewportWidth, viewportHeight);
  }

  function readRuntimeOverrides() {
    const merged = {};

    for (const storageKey of ["IG_HD_CONFIG", "ig_hd_config"]) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          Object.assign(merged, parsed);
        }
      } catch {
        // Ignore malformed or inaccessible storage values.
      }
    }

    try {
      if (window.__IG_HD_CONFIG__ && typeof window.__IG_HD_CONFIG__ === "object") {
        Object.assign(merged, window.__IG_HD_CONFIG__);
      }
    } catch {
      // Ignore inaccessible page globals.
    }

    return merged;
  }

  function buildRuntimeConfig() {
    const overrides = readRuntimeOverrides();
    const overrideQueryIds = overrides?.queryIds && typeof overrides.queryIds === "object"
      ? overrides.queryIds
      : {};
    const overrideLimits = overrides?.limits && typeof overrides.limits === "object"
      ? overrides.limits
      : {};

    return {
      fallbackAppId: UTILITIES_CORE.normalizeNumericIdentifier(overrides.fallbackAppId, DEFAULT_RUNTIME_CONFIG.fallbackAppId),
      queryIds: {
        postInfo: UTILITIES_CORE.normalizeNumericIdentifier(overrideQueryIds.postInfo, DEFAULT_RUNTIME_CONFIG.queryIds.postInfo),
        reels: UTILITIES_CORE.normalizeNumericIdentifier(overrideQueryIds.reels, DEFAULT_RUNTIME_CONFIG.queryIds.reels),
        tagged: UTILITIES_CORE.normalizeNumericIdentifier(overrideQueryIds.tagged, DEFAULT_RUNTIME_CONFIG.queryIds.tagged),
        savedCollections: UTILITIES_CORE.normalizeNumericIdentifier(overrideQueryIds.savedCollections, DEFAULT_RUNTIME_CONFIG.queryIds.savedCollections)
      },
      desktopUserAgent: (typeof overrides.desktopUserAgent === "string" && overrides.desktopUserAgent.trim())
        ? overrides.desktopUserAgent.trim()
        : DEFAULT_RUNTIME_CONFIG.desktopUserAgent,
      mobileUserAgent: (typeof overrides.mobileUserAgent === "string" && overrides.mobileUserAgent.trim())
        ? overrides.mobileUserAgent.trim()
        : DEFAULT_RUNTIME_CONFIG.mobileUserAgent,
      enableDebugLogs: (typeof overrides.enableDebugLogs === "boolean")
        ? overrides.enableDebugLogs
        : DEFAULT_RUNTIME_CONFIG.enableDebugLogs,
      limits: {
        maxScriptTagsToScan: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxScriptTagsToScan, DEFAULT_RUNTIME_CONFIG.limits.maxScriptTagsToScan, 1, 1000),
        maxScriptCharsToScan: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxScriptCharsToScan, DEFAULT_RUNTIME_CONFIG.limits.maxScriptCharsToScan, 50000, 10000000),
        maxWindowKeysToScan: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxWindowKeysToScan, DEFAULT_RUNTIME_CONFIG.limits.maxWindowKeysToScan, 1, 1000),
        maxObjectTraversalNodes: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxObjectTraversalNodes, DEFAULT_RUNTIME_CONFIG.limits.maxObjectTraversalNodes, 100, 20000),
        maxObjectKeysPerNode: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxObjectKeysPerNode, DEFAULT_RUNTIME_CONFIG.limits.maxObjectKeysPerNode, 5, 1000),
        maxArrayItemsPerNode: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxArrayItemsPerNode, DEFAULT_RUNTIME_CONFIG.limits.maxArrayItemsPerNode, 5, 2000),
        maxHtmlCharsToScan: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxHtmlCharsToScan, DEFAULT_RUNTIME_CONFIG.limits.maxHtmlCharsToScan, 50000, 10000000),
        maxStoryHtmlHitsPerTerm: UTILITIES_CORE.toBoundedPositiveInt(overrideLimits.maxStoryHtmlHitsPerTerm, DEFAULT_RUNTIME_CONFIG.limits.maxStoryHtmlHitsPerTerm, 1, 500)
      }
    };
  }

  const RUNTIME_CONFIG = buildRuntimeConfig();

  function debugLog(...args) {
    if (!RUNTIME_CONFIG.enableDebugLogs) return;
    console.log(...args);
  }

  // Temporary tagged bulk tracing helper. Disabled for public builds.
  const TAGGED_TRACE_ENABLED = false;
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

  function getPageWindow() {
    return UTILITIES_CORE.getPageWindow();
  }

  function isAndroidUserAgent() {
    return UTILITIES_CORE.isAndroidUserAgent();
  }

  const SETTINGS_STORAGE_KEY = "IG_HD_USER_SETTINGS_V1";
  const DOWNLOAD_HISTORY_STORAGE_KEY = "IG_HD_DOWNLOAD_HISTORY_V1";
  const DOWNLOAD_HISTORY_MAX_ENTRIES = 100000;
  const DOWNLOAD_HISTORY_TRIM_TARGET = 90000;
  const OUTPUT_HANDLE_DB_NAME = "IG_HD_OUTPUT_HANDLE_DB";
  const OUTPUT_HANDLE_STORE_NAME = "handles";
  const OUTPUT_HANDLE_KEY = "selected_output_folder";
  const {
    PROFILE_RESERVED_PATHS,
    DEFAULT_USER_SETTINGS,
    sanitizeRiskPreset,
    sanitizeHotkey,
    sanitizeShowSettingsLauncher,
    sanitizeTheme,
    sanitizeProfileDownloadScope,
    getLegacyProfileDownloadTargetsFromScope,
    sanitizeProfileDownloadSelection,
    areAllProfileDownloadTargetsEnabled,
    getProfileDownloadSelectionLabel,
    sanitizeOutputFolderLabel,
    sanitizeFilenameTemplate,
    sanitizeAmstramgramUrl,
    sanitizeDownloadSettings,
    sanitizeSavedDownloadSettings,
    sanitizeDownloadSource,
    sanitizePolicy,
    normalizeDateFilter,
    computeDateFilterVisibilityState,
    normalizeUserSettings,
    migrateLegacyMetadataSettings
  } = SETTINGS_SCHEMA_CORE;
  function readStoredUserSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return normalizeUserSettings(null);
      const parsed = JSON.parse(raw);
      const metadataMigration = migrateLegacyMetadataSettings(parsed);
      const migratedParsed = metadataMigration.settings;
      const shouldResetLegacyThemeToAuto = migratedParsed
        && typeof migratedParsed === "object"
        && sanitizeTheme(migratedParsed.theme) !== "auto";
      const normalized = normalizeUserSettings(shouldResetLegacyThemeToAuto
        ? {
            ...migratedParsed,
            // The theme picker is gone, so old explicit UI selections should
            // fall back to auto-follow instead of trapping users on one theme.
            theme: "auto"
          }
        : migratedParsed);
      if (metadataMigration.migrated || shouldResetLegacyThemeToAuto) {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
        } catch {}
      }
      if (metadataMigration.removedTxtSidecar && typeof console !== "undefined" && typeof console.info === "function") {
        console.info("[Amstragram] Metadata TXT sidecars were removed. Use JSON or XMP sidecars instead.");
      }
      return normalized;
    } catch {
      return normalizeUserSettings(null);
    }
  }

  function persistUserSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(USER_SETTINGS));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeDownloadHistoryToken(value) {
    if (value === null || value === undefined) return "";
    const token = String(value).trim();
    if (!token) return "";
    return token.slice(0, 200);
  }

  function normalizeDownloadHistoryUrl(value) {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw, window.location.origin);
      parsed.hash = "";
      parsed.search = "";
      const pathname = parsed.pathname.replace(/\/+$/, "");
      return `${parsed.origin}${pathname}`;
    } catch {
      return "";
    }
  }

  function getDownloadHistoryKeyForTask(task) {
    const meta = task?.meta && typeof task.meta === "object" ? task.meta : null;
    const mediaId = normalizeDownloadHistoryToken(meta?.id ?? meta?.media_id ?? meta?.mediaId ?? meta?.pk);
    const shortcode = normalizeDownloadHistoryToken(meta?.shortcode ?? meta?.code);
    const itemIndex = normalizeDownloadHistoryToken(meta?.index);
    if (shortcode && mediaId) return `shortcode:${shortcode}|id:${mediaId}`;
    if (shortcode && itemIndex) return `shortcode:${shortcode}|index:${itemIndex}`;
    if (shortcode) return `shortcode:${shortcode}`;
    if (mediaId) return `id:${mediaId}`;

    const permalink = normalizeDownloadHistoryUrl(meta?.permalink);
    if (permalink) return `permalink:${permalink}`;

    const normalizedUrl = normalizeDownloadHistoryUrl(task?.url);
    if (normalizedUrl) return `url:${normalizedUrl}`;

    return "";
  }

  function parseStoredDownloadHistory(rawValue) {
    let parsed = rawValue;
    if (typeof parsed === "string") {
      const trimmed = parsed.trim();
      if (!trimmed) return [];
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return [];
      }
    }

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
      parsed = parsed.items;
    }
    if (!Array.isArray(parsed)) return [];

    const normalized = [];
    const seen = new Set();
    for (const value of parsed) {
      const token = normalizeDownloadHistoryToken(value);
      if (!token || seen.has(token)) continue;
      seen.add(token);
      normalized.push(token);
    }
    return normalized;
  }

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

  let downloadHistoryLoaded = false;
  let downloadHistoryOrder = [];
  let downloadHistorySet = new Set();

  function ensureDownloadHistoryLoaded() {
    if (downloadHistoryLoaded) return;
    const raw = readDownloadHistoryStorageValue();
    const parsed = parseStoredDownloadHistory(raw);
    downloadHistoryOrder = parsed.slice(-DOWNLOAD_HISTORY_MAX_ENTRIES);
    downloadHistorySet = new Set(downloadHistoryOrder);
    downloadHistoryLoaded = true;
  }

  function persistDownloadHistory() {
    if (downloadHistoryOrder.length > DOWNLOAD_HISTORY_MAX_ENTRIES) {
      downloadHistoryOrder = downloadHistoryOrder.slice(-DOWNLOAD_HISTORY_MAX_ENTRIES);
      downloadHistorySet = new Set(downloadHistoryOrder);
    }
    writeDownloadHistoryStorageValue(JSON.stringify(downloadHistoryOrder));
  }

  function hasDownloadedHistoryKey(key) {
    const normalizedKey = normalizeDownloadHistoryToken(key);
    if (!normalizedKey) return false;
    ensureDownloadHistoryLoaded();
    return downloadHistorySet.has(normalizedKey);
  }

  function rememberDownloadedHistoryKeys(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (list.length === 0) return 0;

    ensureDownloadHistoryLoaded();

    let added = 0;
    for (const rawKey of list) {
      const key = normalizeDownloadHistoryToken(rawKey);
      if (!key || downloadHistorySet.has(key)) continue;
      downloadHistorySet.add(key);
      downloadHistoryOrder.push(key);
      added += 1;
    }

    if (added === 0) return 0;

    if (downloadHistoryOrder.length > DOWNLOAD_HISTORY_MAX_ENTRIES + 500) {
      downloadHistoryOrder = downloadHistoryOrder.slice(-DOWNLOAD_HISTORY_TRIM_TARGET);
      downloadHistorySet = new Set(downloadHistoryOrder);
    }
    persistDownloadHistory();
    return added;
  }

  let USER_SETTINGS = readStoredUserSettings();
  function applyUserSettingsSideEffects() {
    applyTheme();
    syncSettingsLauncherButton();
    renderBatchProgressIndicator();
  }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("storage", (e) => {
      if (e.key !== SETTINGS_STORAGE_KEY) return;
      USER_SETTINGS = readStoredUserSettings();
      applyUserSettingsSideEffects();
      const openOverlay = document.getElementById("ig-hd-settings-overlay");
      if (!openOverlay) return;
      const activeTab = openOverlay.querySelector(".ig-hd-settings-tab.active")?.dataset.tab || "preferences";
      openSettingsModal();
      if (activeTab !== "preferences") {
        document.querySelector(`#ig-hd-settings-overlay .ig-hd-settings-tab[data-tab="${activeTab}"]`)?.click();
      }
    });
  }
  let settingsLauncherButton = null;
  let settingsLauncherSyncRaf = null;
  let settingsLauncherSyncTimeout = null;
  let settingsLauncherSyncLastRun = 0;
  let settingsLauncherRouteHooksInstalled = false;
  let settingsLauncherThemeObserver = null;
  let settingsLauncherObservedMain = null;
  let settingsLauncherThemeMediaQuery = null;
  let settingsTooltipCleanup = null;
  let settingsPreviewFullNameCleanup = null;
  let settingsModalCloseRequest = null;
  let appliedTheme = null;
  let cooldownIndicator = null;
  let batchProgressIndicator = null;
  let batchManagerSelectedJobId = null;
  let batchManagerTickTimeout = null;
  let batchManagerHiddenByUser = false;
  let batchManagerDismissedJobId = "";
  let batchManagerMinimized = false;
  let batchManagerRunsCollapsed = false;
  let batchFailedListExpandedForJobId = "";
  let batchManagerMenuOpen = false;
  let batchManagerDocumentMenuHandlerInstalled = false;
  let batchManagerDragSession = null;
  let batchManagerManualPosition = { left: 12, top: 12 };
  let outputDirectoryHandleCache = null;
  let outputDirectoryLoadPromise = null;
  let lastCustomFolderWarningAt = 0;
  let riskAckAcknowledgedThisSession = false;
  const activeBatchJobs = new Map();
  const batchRunRecords = new Map();
  const MAX_BATCH_MANAGER_RUNS = 8;

  function getRiskAckSessionAcknowledged() {
    return !!riskAckAcknowledgedThisSession;
  }

  function setRiskAckSessionAcknowledged(acknowledged) {
    riskAckAcknowledgedThisSession = !!acknowledged;
  }

  function syncRiskAckControls(riskAckInput, profileDownloadButton) {
    if (!riskAckInput || !profileDownloadButton) return;
    profileDownloadButton.disabled = !riskAckInput.checked;
  }

  function supportsDirectoryPicker() {
    return typeof window.showDirectoryPicker === "function";
  }

  function supportsPersistentDirectoryHandleStorage() {
    return typeof indexedDB !== "undefined";
  }

  function openOutputHandleDb() {
    return new Promise((resolve, reject) => {
      if (!supportsPersistentDirectoryHandleStorage()) {
        resolve(null);
        return;
      }

      const request = indexedDB.open(OUTPUT_HANDLE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(OUTPUT_HANDLE_STORE_NAME)) {
          db.createObjectStore(OUTPUT_HANDLE_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open output handle DB"));
    });
  }

  async function readStoredOutputDirectoryHandle() {
    try {
      const db = await openOutputHandleDb();
      if (!db) return null;
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(OUTPUT_HANDLE_STORE_NAME, "readonly");
        const store = tx.objectStore(OUTPUT_HANDLE_STORE_NAME);
        const request = store.get(OUTPUT_HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("Could not read output handle"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      });
    } catch (err) {
      debugLog("[Amstragram] Could not read stored output folder handle:", err?.message || err);
      return null;
    }
  }

  async function persistOutputDirectoryHandle(handle) {
    try {
      const db = await openOutputHandleDb();
      if (!db) return false;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(OUTPUT_HANDLE_STORE_NAME, "readwrite");
        const store = tx.objectStore(OUTPUT_HANDLE_STORE_NAME);
        const request = store.put(handle, OUTPUT_HANDLE_KEY);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error("Could not store output handle"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      });
      return true;
    } catch (err) {
      debugLog("[Amstragram] Could not persist output folder handle:", err?.message || err);
      return false;
    }
  }

  async function clearStoredOutputDirectoryHandle() {
    try {
      const db = await openOutputHandleDb();
      if (!db) return false;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(OUTPUT_HANDLE_STORE_NAME, "readwrite");
        const store = tx.objectStore(OUTPUT_HANDLE_STORE_NAME);
        const request = store.delete(OUTPUT_HANDLE_KEY);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error || new Error("Could not clear output handle"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      });
      return true;
    } catch (err) {
      debugLog("[Amstragram] Could not clear output folder handle:", err?.message || err);
      return false;
    }
  }

  async function getStoredOutputDirectoryHandle() {
    if (outputDirectoryHandleCache) return outputDirectoryHandleCache;
    if (!outputDirectoryLoadPromise) {
      outputDirectoryLoadPromise = readStoredOutputDirectoryHandle().then((handle) => {
        outputDirectoryHandleCache = handle || null;
        return outputDirectoryHandleCache;
      });
    }
    return outputDirectoryLoadPromise;
  }

  async function ensureDirectoryReadWritePermission(handle, allowPrompt = false) {
    if (!handle) return false;
    if (typeof handle.queryPermission !== "function") return false;
    try {
      const current = await handle.queryPermission({ mode: "readwrite" });
      if (current === "granted") return true;
      if (allowPrompt && typeof handle.requestPermission === "function") {
        const next = await handle.requestPermission({ mode: "readwrite" });
        return next === "granted";
      }
    } catch (err) {
      debugLog("[Amstragram] Failed to query/request folder permissions:", err?.message || err);
    }
    return false;
  }

  async function pickAndStoreOutputDirectoryHandle() {
    if (!supportsDirectoryPicker()) {
      throw new Error("Folder picker is not supported in this browser.");
    }
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const granted = await ensureDirectoryReadWritePermission(handle, true);
    if (!granted) {
      throw new Error("Folder access was not granted.");
    }
    outputDirectoryHandleCache = handle;
    outputDirectoryLoadPromise = Promise.resolve(handle);
    await persistOutputDirectoryHandle(handle);
    return handle;
  }

  async function clearOutputDirectorySelection() {
    outputDirectoryHandleCache = null;
    outputDirectoryLoadPromise = Promise.resolve(null);
    await clearStoredOutputDirectoryHandle();
  }


  function getArchiveTypeSubfolderOptions() {
    return {
      useTypeSubfolders: !!USER_SETTINGS?.downloads?.useTypeSubfolders
    };
  }

  function applyTypeSubfolderToArchivePath(filename, meta) {
    return FILE_METADATA_CORE.applyTypeSubfolderToArchivePath(
      filename,
      meta,
      getArchiveTypeSubfolderOptions()
    );
  }


  function formatDateToken(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatTimeToken(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}-${mm}-${ss}`;
  }

  function buildZipDownloadName(label = "") {
    const safeLabel = FILE_METADATA_CORE.sanitizeFilenameToken(label || "instagram_media", "instagram_media");
    return `${safeLabel}_${formatDateToken()}_${formatTimeToken()}.zip`;
  }

  function triggerBlobBrowserDownload(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = FILE_METADATA_CORE.sanitizeOutputFilename(filename, "instagram_media.zip");
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (revokeErr) {
        debugLog("[Amstragram] Failed to revoke zip blob URL:", revokeErr?.message || revokeErr);
      }
    }, 30000);
  }


  function getDownloadFilenameResolutionOptions() {
    return {
      filenameTemplate: USER_SETTINGS?.downloads?.filenameTemplate || ""
    };
  }

  function resolveDownloadFilename(defaultFilename, meta = null) {
    return FILE_METADATA_CORE.resolveDownloadFilename(
      defaultFilename,
      meta,
      getDownloadFilenameResolutionOptions()
    );
  }

  function deriveDownloadDefaultFilename(url, fallbackFilename, meta = null) {
    const cdnStem = FILE_METADATA_CORE.extractCdnFilenameStemFromUrl(url);
    if (!cdnStem) return fallbackFilename;
    const ext = meta?.ext
      || FILE_METADATA_CORE.extractFileExtension(fallbackFilename)
      || FILE_METADATA_CORE.extractFileExtension(String(url || "").split(/[?#]/)[0])
      || "jpg";
    return `${cdnStem}.${ext}`;
  }

  function resolveDownloadFilenameForTransfer(url, fallbackFilename, meta = null) {
    const effectiveDefault = deriveDownloadDefaultFilename(url, fallbackFilename, meta);
    return resolveDownloadFilename(effectiveDefault, meta);
  }

  function resolveVideoDownloadFilename(plan, fallbackUrl, fallbackFilename, meta = null) {
    const sourceUrl = plan?.video?.url || fallbackUrl || "";
    const planExt = plan?.container === "mkv" ? "mkv" : (plan ? "mp4" : "");
    const effectiveMeta = (planExt && meta && typeof meta === "object")
      ? { ...meta, ext: planExt }
      : meta;
    const baseName = resolveDownloadFilenameForTransfer(sourceUrl, fallbackFilename, effectiveMeta);
    if (plan?.container !== "mkv") return baseName;
    return /\.mkv$/i.test(baseName)
      ? baseName
      : baseName.replace(/\.[^.\\/]+$/, "") + ".mkv";
  }


  function getXmpSidecarFlags() {
    return {
      xmp: !!USER_SETTINGS?.downloads?.saveMetadataXmp,
      iptc: !!USER_SETTINGS?.downloads?.saveMetadataIptc,
      exif: !!USER_SETTINGS?.downloads?.saveMetadataXmpExif
    };
  }

  function getMetadataSidecarArchiveOptions() {
    return {
      saveMetadataJson: !!USER_SETTINGS?.downloads?.saveMetadataJson,
      saveMetadataXmp: !!USER_SETTINGS?.downloads?.saveMetadataXmp,
      saveMetadataIptc: !!USER_SETTINGS?.downloads?.saveMetadataIptc,
      saveMetadataXmpExif: !!USER_SETTINGS?.downloads?.saveMetadataXmpExif
    };
  }

  function buildMetadataSidecarArchiveEntries(sourceUrl, archivePath, meta = null, archivePaths = null) {
    return FILE_METADATA_CORE.buildMetadataSidecarArchiveEntries(
      sourceUrl,
      archivePath,
      meta,
      archivePaths,
      getMetadataSidecarArchiveOptions()
    );
  }

  async function fileExistsInDirectory(directoryHandle, fileName) {
    try {
      await directoryHandle.getFileHandle(fileName, { create: false });
      return true;
    } catch (err) {
      if (err?.name === "NotFoundError") return false;
      throw err;
    }
  }

  async function makeUniqueFilename(directoryHandle, desiredName) {
    const safeName = FILE_METADATA_CORE.sanitizeOutputFilename(desiredName, "instagram_media.jpg");
    if (!(await fileExistsInDirectory(directoryHandle, safeName))) {
      return safeName;
    }
    const dotIndex = safeName.lastIndexOf(".");
    const stem = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
    const ext = dotIndex > 0 ? safeName.slice(dotIndex) : "";
    for (let i = 1; i <= 999; i++) {
      const candidate = `${stem} (${i})${ext}`;
      if (!(await fileExistsInDirectory(directoryHandle, candidate))) {
        return candidate;
      }
    }
    throw new Error("Could not allocate a unique filename.");
  }

  async function getCustomFolderTargetDirectory(rootHandle, meta = null) {
    if (!USER_SETTINGS?.downloads?.useTypeSubfolders) return rootHandle;
    const folderName = FILE_METADATA_CORE.sanitizeFilenameToken(FILE_METADATA_CORE.mapDownloadTypeToFolder(meta), "misc").replace(/\s+/g, "_");
    return await rootHandle.getDirectoryHandle(folderName, { create: true });
  }

  function showCustomFolderFallbackNotice() {
    const now = Date.now();
    if (now - lastCustomFolderWarningAt < 5000) return;
    lastCustomFolderWarningAt = now;
    showToast("Custom folder unavailable, using browser default downloads.", 4500);
  }

  async function saveBlobToCustomFolderWithResult(blob, filename, meta = null) {
    if (!USER_SETTINGS?.downloads?.useCustomFolder) {
      return { saved: false, fileName: "" };
    }
    const handle = await getStoredOutputDirectoryHandle();
    if (!handle) {
      showCustomFolderFallbackNotice();
      return { saved: false, fileName: "" };
    }

    const hasPermission = await ensureDirectoryReadWritePermission(handle, false);
    if (!hasPermission) {
      showCustomFolderFallbackNotice();
      return { saved: false, fileName: "" };
    }

    const targetDirectory = await getCustomFolderTargetDirectory(handle, meta);
    const uniqueName = await makeUniqueFilename(targetDirectory, filename);
    const fileHandle = await targetDirectory.getFileHandle(uniqueName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { saved: true, fileName: uniqueName };
  }

  async function saveBlobToCustomFolder(blob, filename, meta = null) {
    const result = await saveBlobToCustomFolderWithResult(blob, filename, meta);
    return !!result?.saved;
  }

  async function tryCustomFolderDownload(url, filename, meta = null) {
    const blob = await fetchMediaBlob(url);
    return await saveBlobToCustomFolderWithResult(blob, filename, meta);
  }

  async function saveMetadataSidecarsToCustomFolder(sourceUrl, mediaFilename, meta = null) {
    const wantJson = !!USER_SETTINGS?.downloads?.saveMetadataJson;
    const xmpFlags = getXmpSidecarFlags();
    const wantXmpFile = xmpFlags.xmp || xmpFlags.iptc || xmpFlags.exif;
    if (!wantJson && !wantXmpFile) return;

    const payload = FILE_METADATA_CORE.buildMetadataSidecarPayload(sourceUrl, mediaFilename, meta);
    const sidecarNames = FILE_METADATA_CORE.getMetadataSidecarFilenames(mediaFilename);

    if (wantJson) {
      try {
        const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        await saveBlobToCustomFolder(jsonBlob, sidecarNames.json, meta);
      } catch (sidecarJsonErr) {
        debugLog("[Amstragram] Metadata JSON sidecar save failed:", sidecarJsonErr?.message || sidecarJsonErr);
      }
    }

    if (wantXmpFile) {
      try {
        const xmlText = FILE_METADATA_CORE.buildXmpSidecarDocument(payload, xmpFlags);
        const xmpBlob = new Blob([xmlText], { type: "application/rdf+xml;charset=utf-8" });
        await saveBlobToCustomFolder(xmpBlob, sidecarNames.xmp, meta);
      } catch (sidecarXmpErr) {
        debugLog("[Amstragram] Metadata XMP sidecar save failed:", sidecarXmpErr?.message || sidecarXmpErr);
      }
    }
  }

  function triggerMetadataSidecarBrowserDownloads(sourceUrl, mediaFilename, meta = null) {
    const wantJson = !!USER_SETTINGS?.downloads?.saveMetadataJson;
    const xmpFlags = getXmpSidecarFlags();
    const wantXmpFile = xmpFlags.xmp || xmpFlags.iptc || xmpFlags.exif;
    if (!wantJson && !wantXmpFile) return;

    const payload = FILE_METADATA_CORE.buildMetadataSidecarPayload(sourceUrl, mediaFilename, meta);
    const sidecarNames = FILE_METADATA_CORE.getMetadataSidecarFilenames(mediaFilename);

    if (wantJson) {
      try {
        const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        triggerBlobBrowserDownload(jsonBlob, sidecarNames.json);
      } catch (sidecarJsonErr) {
        debugLog("[Amstragram] Metadata JSON sidecar browser download failed:", sidecarJsonErr?.message || sidecarJsonErr);
      }
    }

    if (wantXmpFile) {
      try {
        const xmlText = FILE_METADATA_CORE.buildXmpSidecarDocument(payload, xmpFlags);
        const xmpBlob = new Blob([xmlText], { type: "application/rdf+xml;charset=utf-8" });
        triggerBlobBrowserDownload(xmpBlob, sidecarNames.xmp);
      } catch (sidecarXmpErr) {
        debugLog("[Amstragram] Metadata XMP sidecar browser download failed:", sidecarXmpErr?.message || sidecarXmpErr);
      }
    }
  }

  function showToast(message, durationMs = 3500) {
    return TOAST_CORE.showToast(message, durationMs, { elementId: "ig-hd-toast" });
  }

  function isBatchManagerVisible() {
    return Boolean(batchProgressIndicator?.root?.isConnected && batchProgressIndicator.root.style.display !== "none");
  }

  function getActiveBatchRecord(records = []) {
    if (!Array.isArray(records) || records.length === 0) return null;
    return records.find((record) => {
      const state = normalizeBatchManagerState(record?.state);
      return state === "running" || state === "paused" || state === "cancelling";
    }) || null;
  }

  function doesBatchRecordMeetVisibilityThreshold(record) {
    return record != null && typeof record === "object";
  }

  function clampBatchManagerPosition(position, root) {
    const fallback = { left: 12, top: 12 };
    const source = position && typeof position === "object" ? position : fallback;
    const viewportWidth = Math.max(320, Number(window?.innerWidth) || 1280);
    const viewportHeight = Math.max(240, Number(window?.innerHeight) || 720);
    const rect = (root && typeof root.getBoundingClientRect === "function")
      ? root.getBoundingClientRect()
      : null;
    const width = Math.max(240, Number(rect?.width) || Number(root?.offsetWidth) || 390);
    const height = Math.max(64, Number(rect?.height) || Number(root?.offsetHeight) || 120);
    const margin = 4;
    const maxLeft = Math.max(margin, viewportWidth - width - margin);
    const maxTop = Math.max(margin, viewportHeight - height - margin);
    const rawLeft = Math.round(Number(source.left) || fallback.left);
    const rawTop = Math.round(Number(source.top) || fallback.top);
    return {
      left: Math.min(maxLeft, Math.max(margin, rawLeft)),
      top: Math.min(maxTop, Math.max(margin, rawTop))
    };
  }

  function applyBatchManagerPosition(root) {
    if (!root || !root.style) return;
    const clamped = clampBatchManagerPosition(batchManagerManualPosition, root);
    batchManagerManualPosition = clamped;
    root.style.left = `${clamped.left}px`;
    root.style.top = `${clamped.top}px`;
  }

  function showBatchToast(message, durationMs = 3500, options = {}) {
    if (!message) return;
    const important = Boolean(options?.important);
    if (!important && isBatchManagerVisible()) return;
    showToast(message, durationMs);
  }

  function formatDurationShort(ms) {
    const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    return `${seconds}s`;
  }

  function normalizeBatchManagerState(value) {
    switch (value) {
      case "running":
      case "paused":
      case "cancelling":
      case "finished":
      case "idle":
        return value;
      default:
        return "idle";
    }
  }

  function normalizeBatchMode(value) {
    return value === "zip" ? "zip" : "download";
  }

  function deriveBatchResultStatus(record = {}) {
    const completed = Math.max(0, Number(record.completed) || 0);
    const failed = Math.max(0, Number(record.failed) || 0);
    const cancelled = Math.max(0, Number(record.cancelled) || 0);
    if (cancelled > 0) return "cancelled";
    if (failed > 0) return completed > 0 ? "partial" : "failed";
    return "completed";
  }

  function estimateBatchEtaMs(record = {}) {
    if (record.indeterminate) return null;
    const total = Math.max(0, Number(record.total) || 0);
    const processed = Math.max(0, Number(record.processed) || 0);
    const elapsedMs = Math.max(0, Number(record.elapsedMs) || 0);
    if (!total || processed >= total) return 0;
    if (processed < 1 || elapsedMs <= 0) return null;
    if (processed < 3 && elapsedMs < 10000) return null;
    const rate = processed / elapsedMs;
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const remaining = Math.max(0, total - processed);
    return Math.max(0, Math.round(remaining / rate));
  }

  function getBatchRunRecordKey(status = {}) {
    const statusJobId = typeof status?.jobId === "string" ? status.jobId.trim() : "";
    if (statusJobId) return statusJobId;
    const controllerJobId = typeof status?.controller?.jobId === "string" ? status.controller.jobId.trim() : "";
    if (controllerJobId) return controllerJobId;
    return "batch_legacy";
  }

  function ensureBatchRunRecord(status = {}) {
    const key = getBatchRunRecordKey(status);
    let record = batchRunRecords.get(key);
    if (record) return record;
    record = {
      jobId: key,
      label: "Batch download",
      mode: "download",
      state: "idle",
      status: null,
      phase: "",
      total: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      indeterminate: false,
      forceVisible: false,
      elapsedMs: 0,
      etaMs: null,
      cooldownSeconds: 0,
      startedAt: null,
      finishedAt: null,
      failedItems: [],
      policySnapshot: null,
      controller: null,
      retryInFlight: false,
      lastUpdateAt: Date.now()
    };
    batchRunRecords.set(key, record);
    return record;
  }

  function pruneBatchHistoryRecords() {
    if (batchRunRecords.size <= MAX_BATCH_MANAGER_RUNS) return;
    const oldestFirst = Array.from(batchRunRecords.values())
      .sort((a, b) => (a.lastUpdateAt || 0) - (b.lastUpdateAt || 0));

    for (const record of oldestFirst) {
      if (batchRunRecords.size <= MAX_BATCH_MANAGER_RUNS) break;
      const state = normalizeBatchManagerState(record.state);
      const isActive = state === "running" || state === "paused" || state === "cancelling";
      if (isActive) continue;
      if (record.jobId === batchManagerSelectedJobId) continue;
      batchRunRecords.delete(record.jobId);
    }

    if (batchManagerSelectedJobId && !batchRunRecords.has(batchManagerSelectedJobId)) {
      batchManagerSelectedJobId = null;
    }
  }

  function updateBatchRunFromController(record, controller) {
    if (!record || !controller) return;
    record.controller = controller;
    if (typeof controller.label === "string" && controller.label.trim()) {
      record.label = controller.label.trim();
    }
    record.mode = normalizeBatchMode(controller.mode);
    record.state = normalizeBatchManagerState(controller.state);
    record.total = Math.max(0, Number(controller.total) || 0);
    record.completed = Math.max(0, Number(controller.completed) || 0);
    record.failed = Math.max(0, Number(controller.failed) || 0);
    record.cancelled = Math.max(0, Number(controller.cancelled) || 0);
    record.processed = record.completed + record.failed + record.cancelled;
    if (record.total > 0) {
      record.processed = Math.min(record.total, record.processed);
    }
    record.failedItems = Array.isArray(controller.failedItems)
      ? controller.failedItems.map((item) => ({ ...item }))
      : [];
    if (controller.policy && typeof controller.policy === "object") {
      record.policySnapshot = { ...controller.policy };
    }

    const timing = controller.timing && typeof controller.timing === "object" ? controller.timing : null;
    if (timing) {
      if (timing.startedAt) record.startedAt = timing.startedAt;
      if (timing.finishedAt) record.finishedAt = timing.finishedAt;
      if (typeof timing.elapsedMs === "number" && Number.isFinite(timing.elapsedMs)) {
        record.elapsedMs = Math.max(0, timing.elapsedMs);
      }
    }
  }

  function syncBatchRunRecord(status = {}) {
    const record = ensureBatchRunRecord(status);
    const controller = status?.controller && typeof status.controller === "object"
      ? status.controller
      : null;

    if (controller) {
      updateBatchRunFromController(record, controller);
    }

    if (typeof status?.label === "string" && status.label.trim()) {
      record.label = status.label.trim();
    }
    if (typeof status?.mode === "string") {
      record.mode = normalizeBatchMode(status.mode);
    }
    if (typeof status?.state === "string") {
      record.state = normalizeBatchManagerState(status.state);
    }
    if (typeof status?.phase === "string") {
      record.phase = status.phase.trim();
    }
    if (typeof status?.status === "string" && status.status.trim()) {
      record.status = status.status.trim();
    }
    if (status?.indeterminate !== undefined) {
      record.indeterminate = Boolean(status.indeterminate);
    }
    if (status?.forceVisible !== undefined) {
      record.forceVisible = Boolean(status.forceVisible);
    }

    if (status?.total !== undefined) {
      record.total = Math.max(0, Number(status.total) || 0);
    }
    if (status?.processed !== undefined) {
      record.processed = Math.max(0, Number(status.processed) || 0);
    }
    if (status?.completed !== undefined) {
      record.completed = Math.max(0, Number(status.completed) || 0);
    }
    if (status?.failed !== undefined) {
      record.failed = Math.max(0, Number(status.failed) || 0);
    }
    if (status?.cancelled !== undefined) {
      record.cancelled = Math.max(0, Number(status.cancelled) || 0);
    }
    if (status?.skipped !== undefined) {
      record.skipped = Math.max(0, Number(status.skipped) || 0);
    }
    if (Array.isArray(status?.failedItems)) {
      record.failedItems = status.failedItems.map((item) => ({ ...item }));
    }
    if (status?.policy && typeof status.policy === "object") {
      record.policySnapshot = { ...status.policy };
    }
    if (status?.timing && typeof status.timing === "object") {
      if (status.timing.startedAt) record.startedAt = status.timing.startedAt;
      if (status.timing.finishedAt) record.finishedAt = status.timing.finishedAt;
      if (typeof status.timing.elapsedMs === "number" && Number.isFinite(status.timing.elapsedMs)) {
        record.elapsedMs = Math.max(0, status.timing.elapsedMs);
      }
    }
    if (typeof status?.elapsedMs === "number" && Number.isFinite(status.elapsedMs)) {
      record.elapsedMs = Math.max(0, status.elapsedMs);
    }

    const result = status?.result && typeof status.result === "object" ? status.result : null;
    if (result) {
      if (typeof result.status === "string" && result.status.trim()) {
        record.status = result.status.trim();
      }
      if (result.total !== undefined) record.total = Math.max(0, Number(result.total) || 0);
      if (result.completed !== undefined) record.completed = Math.max(0, Number(result.completed) || 0);
      if (result.failed !== undefined) record.failed = Math.max(0, Number(result.failed) || 0);
      if (result.cancelled !== undefined) record.cancelled = Math.max(0, Number(result.cancelled) || 0);
      if (Array.isArray(result.failedItems)) {
        record.failedItems = result.failedItems.map((item) => ({ ...item }));
      }
      if (result.timing && typeof result.timing === "object") {
        if (result.timing.startedAt) record.startedAt = result.timing.startedAt;
        if (result.timing.finishedAt) record.finishedAt = result.timing.finishedAt;
        if (typeof result.timing.elapsedMs === "number" && Number.isFinite(result.timing.elapsedMs)) {
          record.elapsedMs = Math.max(0, result.timing.elapsedMs);
        }
      }
    }

    if (status?.final) {
      record.state = "finished";
      if (!record.finishedAt) {
        record.finishedAt = new Date().toISOString();
      }
    }

    const minProcessed = record.completed + record.failed;
    if (record.processed < minProcessed) {
      record.processed = minProcessed;
    }
    if (record.total > 0) {
      record.processed = Math.min(record.total, record.processed);
    }

    if (record.state === "finished") {
      record.indeterminate = false;
      record.forceVisible = false;
      if (!record.status) {
        record.status = deriveBatchResultStatus(record);
      }
      record.etaMs = 0;
    } else {
      record.etaMs = estimateBatchEtaMs(record);
    }

    record.lastUpdateAt = Date.now();
    pruneBatchHistoryRecords();
    return record;
  }

  function refreshBatchRunLiveMetrics() {
    for (const record of batchRunRecords.values()) {
      if (!record?.controller) continue;
      updateBatchRunFromController(record, record.controller);
      if (record.state === "finished") {
        if (!record.status) {
          record.status = deriveBatchResultStatus(record);
        }
        record.indeterminate = false;
        record.etaMs = 0;
      } else {
        record.etaMs = estimateBatchEtaMs(record);
        record.lastUpdateAt = Date.now();
      }
    }
    pruneBatchHistoryRecords();
  }

  function getBatchRecordsSortedNewest() {
    return Array.from(batchRunRecords.values())
      .sort((a, b) => (b.lastUpdateAt || 0) - (a.lastUpdateAt || 0));
  }

  function getBatchSelectedRecord(records) {
    if (!Array.isArray(records) || records.length === 0) return null;
    const activeRecord = records.find((record) => {
      const state = normalizeBatchManagerState(record.state);
      return state === "running" || state === "paused" || state === "cancelling";
    });
    if (activeRecord) {
      batchManagerSelectedJobId = activeRecord.jobId;
      return activeRecord;
    }
    if (batchManagerSelectedJobId && batchRunRecords.has(batchManagerSelectedJobId)) {
      return batchRunRecords.get(batchManagerSelectedJobId);
    }
    const fallback = records[0];
    batchManagerSelectedJobId = fallback?.jobId || null;
    return fallback || null;
  }

  function getBatchRecordForJob(jobId) {
    const key = typeof jobId === "string" ? jobId.trim() : "";
    if (key && batchRunRecords.has(key)) {
      return batchRunRecords.get(key);
    }
    const records = getBatchRecordsSortedNewest();
    return getBatchSelectedRecord(records);
  }

  function setBatchElementJobId(element, jobId) {
    if (!element) return;
    const safeJobId = typeof jobId === "string" ? jobId : "";
    if (!element.dataset || typeof element.dataset !== "object") {
      element.dataset = {};
    }
    element.dataset.jobId = safeJobId;
    element.__igHdJobId = safeJobId;
  }

  function getBatchElementJobId(element) {
    const datasetJobId = typeof element?.dataset?.jobId === "string"
      ? element.dataset.jobId
      : "";
    const fallbackJobId = typeof element?.__igHdJobId === "string"
      ? element.__igHdJobId
      : "";
    return datasetJobId || fallbackJobId || "";
  }

  async function retryBatchFailedRun(jobId) {
    const record = getBatchRecordForJob(jobId);
    if (!record || record.retryInFlight) return;
    const controller = record.controller;
    if (!controller || controller.state !== "finished") return;

    const retryController = controller.retryFailed();
    if (!retryController) {
      showToast(`${record.label}: no retryable failed items found.`, 3800);
      return;
    }

    record.retryInFlight = true;
    renderBatchProgressIndicator();
    try {
      await retryController.run();
    } catch (err) {
      showToast(`${record.label}: retry failed (${err?.message || "Unknown error"}).`, 6500);
    } finally {
      record.retryInFlight = false;
      renderBatchProgressIndicator();
    }
  }

  async function runBatchAgainFromRecord(jobId) {
    const record = getBatchRecordForJob(jobId);
    if (!record || record.retryInFlight) return;
    const controller = record.controller;
    if (!controller || controller.state !== "finished") {
      showToast("This batch can't be re-run right now.", 3800);
      return;
    }

    const allItems = Array.isArray(controller.items) ? controller.items : [];
    if (allItems.length === 0) {
      showToast(`${record.label}: original items unavailable.`, 3800);
      return;
    }

    const skipPreviouslyDownloaded = !!USER_SETTINGS?.downloads?.skipPreviouslyDownloaded;
    const itemsWithKeys = allItems.map(item => ({
      ...item,
      historyKey: item.historyKey || getDownloadHistoryKeyForTask(item)
    }));

    let skippedCount = 0;
    const queuedItems = itemsWithKeys.filter(item => {
      if (skipPreviouslyDownloaded && item.historyKey && hasDownloadedHistoryKey(item.historyKey)) {
        skippedCount += 1;
        return false;
      }
      return true;
    });

    if (skippedCount > 0) {
      showToast(`Skipped ${skippedCount} previously downloaded item(s).`, 3800);
    }
    if (queuedItems.length === 0) {
      showToast("All items were already downloaded.", 4000);
      return;
    }

    const completedHistoryKeys = new Set();
    const onItemResult = (detail) => {
      if (detail?.status === "done" && Number.isInteger(detail.index) && detail.index >= 0 && detail.index < queuedItems.length) {
        const historyKey = queuedItems[detail.index]?.historyKey;
        if (historyKey) completedHistoryKeys.add(historyKey);
      }
    };

    const rerunController = new BatchJobController(queuedItems, {
      policy: controller.policy,
      label: `${record.label} (run again)`,
      mode: controller.mode,
      onStateChange: controller._onStateChange,
      onItemResult,
      zipOptions: controller.zipOptions
    });

    if (skippedCount > 0) {
      ensureBatchRunRecord({ jobId: rerunController.jobId }).skipped = skippedCount;
    }
    record.retryInFlight = true;
    renderBatchProgressIndicator();
    try {
      const result = await rerunController.run();
      if (result?.completed > 0 && completedHistoryKeys.size > 0) {
        rememberDownloadedHistoryKeys(Array.from(completedHistoryKeys));
      }
    } catch (err) {
      showToast(`${record.label}: run again failed (${err?.message || "Unknown error"}).`, 6500);
    } finally {
      record.retryInFlight = false;
      renderBatchProgressIndicator();
    }
  }

  function exportBatchFailedList(jobId) {
    const record = getBatchRecordForJob(jobId);
    if (!record) return;
    const failedItems = Array.isArray(record.failedItems) ? record.failedItems : [];
    if (failedItems.length === 0) return;

    const payload = {
      exportedAt: new Date().toISOString(),
      job: {
        jobId: record.jobId,
        label: record.label,
        mode: record.mode,
        state: record.state,
        status: record.status || deriveBatchResultStatus(record),
        phase: record.phase || "",
        total: record.total,
        processed: record.processed,
        completed: record.completed,
        failed: record.failed,
        cancelled: record.cancelled,
        timing: {
          startedAt: record.startedAt || null,
          finishedAt: record.finishedAt || null,
          elapsedMs: Math.max(0, Number(record.elapsedMs) || 0)
        }
      },
      policySnapshot: record.policySnapshot || null,
      failedItems: failedItems.map((item) => ({ ...item }))
    };

    const safeLabel = FILE_METADATA_CORE.sanitizeFilenameToken(record.label || "batch_download", "batch_download");
    const filename = `${safeLabel}_failed_${formatDateToken()}_${formatTimeToken()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    triggerBlobBrowserDownload(blob, filename);
  }

  function handleBatchRetryFailed(event) {
    const jobId = getBatchElementJobId(event?.currentTarget);
    void retryBatchFailedRun(jobId);
  }

  function handleBatchExportFailed(event) {
    const jobId = getBatchElementJobId(event?.currentTarget);
    exportBatchFailedList(jobId);
  }

  function handleBatchHistoryRowClick(event) {
    const jobId = getBatchElementJobId(event?.currentTarget);
    if (!jobId) return;
    batchManagerSelectedJobId = jobId;
    renderBatchProgressIndicator();
  }

  function ensureBatchManagerTick() {
    if (batchManagerTickTimeout) return;
    batchManagerTickTimeout = setTimeout(() => {
      batchManagerTickTimeout = null;
      renderBatchProgressIndicator();
    }, 1000);
  }

  const BATCH_UI_ICON_MARKUP = {
    pause: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="2" height="8" rx=".5"/><rect x="7" y="2" width="2" height="8" rx=".5"/></svg>',
    play: '<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 2l7 4-7 4V2z"/></svg>',
    retry: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.2 4.2A4 4 0 1 0 10.6 7"/><polyline points="10.2 1.8 10.2 4.2 7.8 4.2"/></svg>',
    folder: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 3.5h3l1 1.2h5v5.3h-9v-6.5z"/></svg>',
    spinner: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="4" stroke-dasharray="18 8"><animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="1s" repeatCount="indefinite"/></circle></svg>',
    close: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg>'
  };

  const BATCH_UI_STATE_CONFIG = {
    running: {
      badgeLabel: "Running",
      subtitle: (mode) => mode === "zip" ? "Collecting files for ZIP" : "Downloading files",
      primary: { label: "Pause", icon: "pause", kind: "primary", action: "pauseResume", requiresController: true },
      secondary: { label: "Cancel", action: "cancel", target: "active" },
      primaryTarget: "active",
      showCooldown: false,
      showEta: true,
      forcePercent: null
    },
    paused: {
      badgeLabel: "Paused",
      subtitle: (mode) => `Paused — ${mode === "zip" ? "Collecting files for ZIP" : "Downloading files"}`,
      primary: { label: "Resume", icon: "play", kind: "primary", action: "pauseResume", requiresController: true },
      secondary: { label: "Cancel", action: "cancel", target: "active" },
      primaryTarget: "active",
      showCooldown: false,
      showEta: false,
      forcePercent: null
    },
    cooldown: {
      badgeLabel: "Cooldown",
      subtitle: () => "Safety cooldown",
      primary: { label: "Pause", icon: "pause", kind: "primary", action: "pauseResume", requiresController: true },
      secondary: { label: "Cancel", action: "cancel", target: "active" },
      primaryTarget: "active",
      showCooldown: true,
      showEta: true,
      forcePercent: null
    },
    cancelling: {
      badgeLabel: "Cancelling",
      subtitle: (mode) => `Cancelling — ${mode === "zip" ? "Collecting files for ZIP" : "Downloading files"}`,
      primary: { label: "Cancelling…", icon: "spinner", kind: "secondary", action: "noop", disabled: true },
      secondary: null,
      primaryTarget: "active",
      showCooldown: false,
      showEta: false,
      forcePercent: null
    },
    completed: {
      badgeLabel: "Completed",
      subtitle: () => "All files downloaded",
      primary: { label: "Run again", icon: "retry", kind: "primary", action: "runAgain" },
      secondary: { label: "Close", action: "close" },
      primaryTarget: "selected",
      showCooldown: false,
      showEta: false,
      forcePercent: 100
    },
    partial: {
      badgeLabel: "Partial",
      subtitle: () => "Completed with errors",
      primary: { label: "Retry failed", icon: "retry", kind: "primary", action: "retry" },
      secondary: { label: "Export failed", action: "exportFailed" },
      primaryTarget: "selected",
      showCooldown: false,
      showEta: false,
      forcePercent: 100
    },
    failed: {
      badgeLabel: "Failed",
      subtitle: () => "Run failed",
      primary: { label: "Retry", icon: "retry", kind: "primary", action: "retry" },
      secondary: { label: "Export failed", action: "exportFailed" },
      primaryTarget: "selected",
      showCooldown: false,
      showEta: false,
      forcePercent: null
    },
    cancelled: {
      badgeLabel: "Cancelled",
      subtitle: () => "Cancelled",
      primary: { label: "Run again", icon: "retry", kind: "primary", action: "runAgain" },
      secondary: { label: "Close", action: "close" },
      primaryTarget: "selected",
      showCooldown: false,
      showEta: false,
      forcePercent: null
    },
    idle: {
      badgeLabel: "Idle",
      subtitle: (mode) => mode === "zip" ? "Preparing ZIP…" : "Preparing…",
      primary: { label: "Pause", icon: "pause", kind: "primary", action: "pauseResume", disabled: true },
      secondary: { label: "Cancel", action: "cancel", target: "active", disabled: true },
      primaryTarget: "active",
      showCooldown: false,
      showEta: false,
      forcePercent: null
    }
  };

  function getBatchUIState(record) {
    const rawState = normalizeBatchManagerState(record?.state);
    if (rawState === "running") {
      const phase = typeof record?.phase === "string" ? record.phase : "";
      if (/^Safety cooldown/i.test(phase)) return "cooldown";
      return "running";
    }
    if (rawState === "paused") return "paused";
    if (rawState === "cancelling") return "cancelling";
    if (rawState === "finished") {
      const status = typeof record?.status === "string" && record.status.trim()
        ? record.status.trim()
        : deriveBatchResultStatus(record || {});
      if (status === "failed") return "failed";
      if (status === "partial") return "partial";
      if (status === "cancelled") return "cancelled";
      return "completed";
    }
    return "idle";
  }

  function formatBatchRelativeTime(ms, nowMs = Date.now()) {
    const target = Number(ms);
    if (!Number.isFinite(target)) return "";
    const diff = Math.max(0, nowMs - target);
    const s = Math.floor(diff / 1000);
    if (s < 10) return "Just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}w ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  function formatBatchEtaText(ms) {
    const value = Number(ms);
    if (ms == null || !Number.isFinite(value) || value < 0) return "—";
    if (value === 0) return "Now";
    return `${formatDurationShort(value)} left`;
  }

  function resolveBatchRateText(record, uiState) {
    if (uiState === "paused") return "Paused";
    if (uiState === "cooldown") return "Cooling down";
    if (uiState === "cancelling" || uiState === "failed" || uiState === "cancelled"
        || uiState === "completed" || uiState === "partial") return "—";
    const processed = Math.max(0, Number(record?.processed) || 0);
    const elapsedSeconds = Math.max(0, Number(record?.elapsedMs) || 0) / 1000;
    if (processed <= 0 || elapsedSeconds <= 0) return uiState === "idle" ? "—" : "Starting…";
    const rate = processed / elapsedSeconds;
    if (!Number.isFinite(rate) || rate <= 0) return "—";
    const fixed = rate >= 10 ? rate.toFixed(0) : rate.toFixed(rate >= 1 ? 1 : 2);
    return `${fixed} items / sec`;
  }

  function buildBatchRunMeta(record, uiState, nowMs = Date.now()) {
    const startedMs = record?.startedAt ? Date.parse(record.startedAt) : NaN;
    const finishedMs = record?.finishedAt ? Date.parse(record.finishedAt) : NaN;
    const isLive = uiState === "running" || uiState === "paused" || uiState === "cancelling" || uiState === "cooldown" || uiState === "idle";
    const parts = [];
    if (isLive) {
      if (Number.isFinite(startedMs)) parts.push(`Started ${formatBatchRelativeTime(startedMs, nowMs)}`);
    } else if (Number.isFinite(finishedMs)) {
      parts.push(formatBatchRelativeTime(finishedMs, nowMs));
    } else if (Number.isFinite(startedMs)) {
      parts.push(formatBatchRelativeTime(startedMs, nowMs));
    }
    const total = Math.max(0, Number(record?.total) || 0);
    const processed = Math.max(0, Number(record?.processed) || 0);
    const failed = Math.max(0, Number(record?.failed) || 0);
    if (!isLive && total > 0) {
      parts.push(`${Math.min(total, processed)}/${total}`);
    }
    if (!isLive) {
      const elapsedMs = Math.max(0, Number(record?.elapsedMs) || 0);
      if (elapsedMs > 0) parts.push(formatDurationShort(elapsedMs));
    }
    if (failed > 0) parts.push(`${failed} failed`);
    return parts.join(" · ");
  }

  function buildBatchRunStateLabel(record, uiState) {
    const total = Math.max(0, Number(record?.total) || 0);
    const processedRaw = Math.max(0, Number(record?.processed) || 0);
    const processed = total > 0 ? Math.min(total, processedRaw) : processedRaw;
    if (uiState === "running" || uiState === "cooldown") {
      return total > 0 ? `${processed}/${total}` : String(processed);
    }
    if (uiState === "paused") return "Paused";
    if (uiState === "cancelling") return "Cancelling";
    if (uiState === "completed") return "Done";
    if (uiState === "partial") return "Partial";
    if (uiState === "failed") return "Failed";
    if (uiState === "cancelled") return "Cancelled";
    return "—";
  }

  function closeBatchManagerMenu() {
    if (!batchManagerMenuOpen) return;
    batchManagerMenuOpen = false;
    const ui = batchProgressIndicator;
    if (ui?.menu) {
      ui.menu.classList.remove("open");
    }
    if (ui?.menuTrigger) {
      ui.menuTrigger.setAttribute("aria-expanded", "false");
    }
  }

  function installBatchManagerDocumentMenuHandler() {
    if (batchManagerDocumentMenuHandlerInstalled) return;
    if (typeof document === "undefined" || !document?.addEventListener) return;
    document.addEventListener("click", () => {
      if (batchManagerMenuOpen) closeBatchManagerMenu();
    });
    batchManagerDocumentMenuHandlerInstalled = true;
  }

  function dispatchBatchUIAction(action, jobId) {
    switch (action) {
      case "pauseResume": {
        const record = getBatchRecordForJob(jobId);
        const controller = record?.controller;
        if (!controller) return;
        if (controller.state === "running") controller.pause();
        else if (controller.state === "paused") controller.resume();
        renderBatchProgressIndicator();
        return;
      }
      case "cancel": {
        const record = getBatchRecordForJob(jobId);
        const controller = record?.controller;
        if (!controller) return;
        controller.cancel();
        renderBatchProgressIndicator();
        return;
      }
      case "retry":
        void retryBatchFailedRun(jobId);
        return;
      case "exportFailed":
        exportBatchFailedList(jobId);
        return;
      case "close":
        dismissBatchManagerForJob(jobId);
        return;
      case "runAgain":
        void runBatchAgainFromRecord(jobId);
        return;
      default:
        return;
    }
  }

  function dismissBatchManagerForJob(jobId) {
    const records = getBatchRecordsSortedNewest();
    const active = getActiveBatchRecord(records);
    const selected = getBatchSelectedRecord(records);
    batchManagerHiddenByUser = true;
    batchManagerDismissedJobId = (typeof jobId === "string" && jobId)
      ? jobId
      : (active?.jobId || selected?.jobId || "");
    closeBatchManagerMenu();
    renderBatchProgressIndicator();
  }

  function handleBatchClearHistory() {
    const preserved = new Map();
    for (const [id, record] of batchRunRecords.entries()) {
      const state = normalizeBatchManagerState(record?.state);
      if (state === "running" || state === "paused" || state === "cancelling") {
        preserved.set(id, record);
      }
    }
    batchRunRecords.clear();
    for (const [id, record] of preserved.entries()) {
      batchRunRecords.set(id, record);
    }
    if (batchManagerSelectedJobId && !batchRunRecords.has(batchManagerSelectedJobId)) {
      batchManagerSelectedJobId = null;
    }
    closeBatchManagerMenu();
    renderBatchProgressIndicator();
  }

  function handleBatchExportLog(event) {
    const jobId = getBatchElementJobId(event?.currentTarget);
    const record = getBatchRecordForJob(jobId);
    if (!record) {
      showToast("No batch run data available yet.", 3000);
      return;
    }

    const failedItems = Array.isArray(record.failedItems) ? record.failedItems : [];
    const payload = {
      exportedAt: new Date().toISOString(),
      job: {
        jobId: record.jobId,
        label: record.label,
        mode: record.mode,
        state: record.state,
        status: record.status || deriveBatchResultStatus(record),
        phase: record.phase || "",
        total: record.total,
        processed: record.processed,
        completed: record.completed,
        failed: record.failed,
        cancelled: record.cancelled,
        timing: {
          startedAt: record.startedAt || null,
          finishedAt: record.finishedAt || null,
          elapsedMs: Math.max(0, Number(record.elapsedMs) || 0)
        }
      },
      policySnapshot: record.policySnapshot || null,
      failedItems: failedItems.map((item) => ({ ...item }))
    };

    const safeLabel = FILE_METADATA_CORE.sanitizeFilenameToken(record.label || "batch_download", "batch_download");
    const filename = `${safeLabel}_log_${formatDateToken()}_${formatTimeToken()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    triggerBlobBrowserDownload(blob, filename);

    closeBatchManagerMenu();
    showToast(`Log exported: ${filename}`, 3200);
  }

  function renderBatchRunsList(ui, records, selected, nowMs = Date.now()) {
    ui.runsList.textContent = "";
    const recentRecords = records.slice(0, MAX_BATCH_MANAGER_RUNS);
    for (const record of recentRecords) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "gm-run";
      setBatchElementJobId(row, record.jobId || "");
      const rowUiState = getBatchUIState(record);
      row.dataset.state = rowUiState;
      if (selected && record.jobId === selected.jobId) {
        row.classList.add("active");
      }
      row.addEventListener("click", handleBatchHistoryRowClick);

      const rowLabel = document.createElement("span");
      rowLabel.className = "gm-run-label";
      rowLabel.textContent = record.label || "Batch download";

      const rowMeta = document.createElement("span");
      rowMeta.className = "gm-run-meta";
      const metaText = buildBatchRunMeta(record, rowUiState, nowMs);
      rowMeta.textContent = metaText || "—";

      const rowState = document.createElement("span");
      rowState.className = "gm-run-state";
      rowState.textContent = buildBatchRunStateLabel(record, rowUiState);

      row.append(rowLabel, rowMeta, rowState);
      ui.runsList.appendChild(row);
    }
  }

  function applyBatchPrimaryButton(ui, cfg, record) {
    const button = ui.primaryBtn;
    const icon = cfg.primary.icon || null;
    button.className = `gm-btn ${cfg.primary.kind === "secondary" ? "gm-btn-secondary" : "gm-btn-primary"}`;
    if (icon && BATCH_UI_ICON_MARKUP[icon]) {
      ui.primaryIconSlot.innerHTML = BATCH_UI_ICON_MARKUP[icon];
      ui.primaryIconSlot.style.display = "";
    } else {
      ui.primaryIconSlot.innerHTML = "";
      ui.primaryIconSlot.style.display = "none";
    }
    ui.primaryLabel.textContent = cfg.primary.label;
    button.dataset.action = cfg.primary.action || "";
    const needsController = Boolean(cfg.primary.requiresController);
    button.disabled = Boolean(cfg.primary.disabled) || (needsController && !record?.controller);
    setBatchElementJobId(button, record?.jobId || "");
  }

  function applyBatchSecondaryButton(ui, cfg, selected, activeRecord) {
    const button = ui.secondaryBtn;
    if (!cfg.secondary) {
      button.style.display = "none";
      button.disabled = true;
      return;
    }
    button.style.display = "";
    button.textContent = cfg.secondary.label;
    button.dataset.action = cfg.secondary.action || "";
    const target = cfg.secondary.target === "active" ? activeRecord : selected;
    button.disabled = Boolean(cfg.secondary.disabled);
    setBatchElementJobId(button, target?.jobId || "");
  }

  function renderBatchProgressIndicator() {
    const ui = ensureBatchProgressIndicator();
    if (!ui) return;

    refreshBatchRunLiveMetrics();
    const records = getBatchRecordsSortedNewest();
    if (records.length === 0) {
      ui.root.style.display = "none";
      closeBatchManagerMenu();
      return;
    }

    const selected = getBatchSelectedRecord(records);
    if (!selected) {
      ui.root.style.display = "none";
      closeBatchManagerMenu();
      return;
    }
    const activeRecord = getActiveBatchRecord(records);

    if (batchManagerHiddenByUser && activeRecord?.jobId && activeRecord.jobId !== batchManagerDismissedJobId) {
      batchManagerHiddenByUser = false;
      batchManagerDismissedJobId = "";
    }

    const visibilitySource = activeRecord || selected;
    const meetsVisibilityThreshold = doesBatchRecordMeetVisibilityThreshold(visibilitySource);
    if (batchManagerHiddenByUser || !meetsVisibilityThreshold) {
      ui.root.style.display = "none";
      closeBatchManagerMenu();
      return;
    }

    ui.root.style.display = "block";
    applyBatchManagerPosition(ui.root);

    if (batchManagerMinimized) ui.root.classList.add("minimized");
    else ui.root.classList.remove("minimized");

    ui.minimizeBtn.title = batchManagerMinimized ? "Expand" : "Collapse";
    ui.minimizeBtn.setAttribute("aria-label", batchManagerMinimized ? "Expand" : "Collapse");

    const uiState = getBatchUIState(selected);
    const mode = selected.mode === "zip" ? "zip" : "download";
    ui.root.dataset.state = uiState;
    ui.root.dataset.mode = mode;

    const cfg = BATCH_UI_STATE_CONFIG[uiState] || BATCH_UI_STATE_CONFIG.idle;

    ui.title.textContent = selected.label || "Batch download";
    ui.subtitle.textContent = typeof cfg.subtitle === "function"
      ? cfg.subtitle(mode, selected)
      : (cfg.subtitle || "");

    const safeTotal = Math.max(0, Number(selected.total) || 0);
    const safeProcessedRaw = Math.max(0, Number(selected.processed) || 0);
    const safeProcessed = safeTotal > 0 ? Math.min(safeTotal, safeProcessedRaw) : safeProcessedRaw;
    const safeCompleted = Math.max(0, Number(selected.completed) || 0);
    const safeFailed = Math.max(0, Number(selected.failed) || 0);
    const safeElapsedMs = Math.max(0, Number(selected.elapsedMs) || 0);
    const etaMs = selected.state === "finished" ? 0 : estimateBatchEtaMs(selected);
    selected.etaMs = etaMs;

    ui.badge.textContent = cfg.badgeLabel;

    const isIndeterminate = Boolean(selected.indeterminate) && selected.state !== "finished";
    let percent;
    if (cfg.forcePercent != null) percent = cfg.forcePercent;
    else if (safeTotal > 0) percent = Math.max(0, Math.min(100, Math.round((safeProcessed / safeTotal) * 100)));
    else percent = 0;

    if (isIndeterminate) {
      ui.percent.textContent = "—";
      ui.barFill.classList.add("indeterminate");
      ui.barFill.style.width = "";
      ui.miniBar.style.width = "100%";
    } else {
      ui.percent.textContent = `${percent}%`;
      ui.barFill.classList.remove("indeterminate");
      ui.barFill.style.width = `${percent}%`;
      ui.miniBar.style.width = `${percent}%`;
    }

    ui.countsProcessed.textContent = String(safeProcessed);
    ui.countsTotal.textContent = String(safeTotal);

    ui.rate.textContent = resolveBatchRateText(selected, uiState);
    const showEta = cfg.showEta && !isIndeterminate;
    if (showEta) {
      ui.etaWrap.style.display = "";
      ui.etaText.textContent = formatBatchEtaText(etaMs);
    } else {
      ui.etaWrap.style.display = "none";
    }

    if (cfg.showCooldown) {
      ui.cooldownCard.hidden = false;
      const seconds = Math.max(0, Math.ceil(Number(selected.cooldownSeconds) || 0));
      ui.cooldownTime.textContent = seconds > 0 ? `${seconds}s` : "—";
    } else {
      ui.cooldownCard.hidden = true;
    }

    ui.valueCompleted.textContent = String(safeCompleted);
    const safeSkipped = Math.max(0, Number(selected.skipped) || 0);
    ui.valueSkipped.textContent = String(safeSkipped);
    ui.skippedRow.hidden = safeSkipped === 0;
    ui.valueFailed.textContent = String(safeFailed);
    ui.valueFailed.classList.toggle("fail", safeFailed > 0);
    ui.valueElapsed.textContent = formatDurationShort(safeElapsedMs);

    const primaryRecord = cfg.primaryTarget === "active" ? (activeRecord || selected) : selected;
    applyBatchPrimaryButton(ui, cfg, primaryRecord);
    applyBatchSecondaryButton(ui, cfg, selected, activeRecord || selected);

    const selectedFailedItems = Array.isArray(selected.failedItems) ? selected.failedItems : [];
    const hasFailedItems = selectedFailedItems.length > 0;
    ui.failedRow.classList.toggle("linkish", hasFailedItems);
    if (hasFailedItems) {
      ui.failedRow.tabIndex = 0;
      ui.failedRow.setAttribute("role", "button");
      ui.failedChev.style.display = "";
    } else {
      ui.failedRow.removeAttribute("tabindex");
      ui.failedRow.removeAttribute("role");
      ui.failedChev.style.display = "none";
    }
    if (!hasFailedItems && batchFailedListExpandedForJobId === (selected.jobId || "")) {
      batchFailedListExpandedForJobId = "";
    }
    const failedListExpanded = hasFailedItems
      && batchFailedListExpandedForJobId === (selected.jobId || "");
    ui.failedRow.classList.toggle("expanded", failedListExpanded);
    ui.failedRow.setAttribute("aria-expanded", failedListExpanded ? "true" : "false");
    ui.failedList.hidden = !failedListExpanded;
    if (failedListExpanded) {
      const FAILED_LIST_DISPLAY_CAP = 50;
      const frag = document.createDocumentFragment();
      const shown = selectedFailedItems.slice(0, FAILED_LIST_DISPLAY_CAP);
      for (const item of shown) {
        const row = document.createElement("div");
        row.className = "gm-failed-item";
        const name = document.createElement("div");
        name.className = "gm-failed-item-name";
        name.textContent = String(item?.filename || item?.url || "(unnamed item)");
        const reason = document.createElement("div");
        reason.className = "gm-failed-item-reason";
        reason.textContent = String(item?.error || item?.reason || "Unknown error");
        row.append(name, reason);
        frag.append(row);
      }
      if (selectedFailedItems.length > FAILED_LIST_DISPLAY_CAP) {
        const footer = document.createElement("div");
        footer.className = "gm-failed-list-footer";
        footer.textContent = `+${selectedFailedItems.length - FAILED_LIST_DISPLAY_CAP} more — use “Export failed” for the full list.`;
        frag.append(footer);
      }
      ui.failedList.replaceChildren(frag);
    } else {
      ui.failedList.replaceChildren();
    }
    const canRetry = Boolean(
      selected.controller
      && selected.controller.state === "finished"
      && hasFailedItems
      && !selected.retryInFlight
    );
    setBatchElementJobId(ui.menuRetry, selected.jobId || "");
    ui.menuRetry.disabled = !canRetry;
    setBatchElementJobId(ui.menuExport, selected.jobId || "");
    ui.menuExport.disabled = !hasFailedItems;
    setBatchElementJobId(ui.menuExportLog, selected.jobId || "");
    const retryVisibleAsButton = cfg.primary?.action === "retry";
    const exportFailedVisibleAsButton = cfg.secondary?.action === "exportFailed";
    ui.menuRetry.hidden = retryVisibleAsButton;
    ui.menuExport.hidden = exportFailedVisibleAsButton;

    const nowMs = Date.now();
    renderBatchRunsList(ui, records, selected, nowMs);

    const runsCount = records.length;
    ui.runsCountLabel.textContent = runsCount === 1 ? "1 run" : `${runsCount} runs`;
    ui.runs.classList.toggle("collapsed", batchManagerRunsCollapsed);

    if (activeRecord) {
      ensureBatchManagerTick();
    } else if (batchManagerTickTimeout) {
      clearTimeout(batchManagerTickTimeout);
      batchManagerTickTimeout = null;
    }
  }

  function ensureBatchProgressIndicator() {
    if (batchProgressIndicator?.root?.isConnected) {
      return batchProgressIndicator;
    }
    if (!document.body) {
      return null;
    }

    const root = document.createElement("div");
    root.id = "ig-hd-batch-progress";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-labelledby", "ig-hd-batch-progress-title");
    root.dataset.state = "running";
    root.dataset.mode = "download";
    root.style.display = "none";

    const header = document.createElement("header");
    header.className = "gm-header";

    const headerMain = document.createElement("div");
    headerMain.className = "gm-header-main";

    const title = document.createElement("div");
    title.className = "gm-title";
    title.id = "ig-hd-batch-progress-title";

    const subtitle = document.createElement("div");
    subtitle.className = "gm-subtitle";

    headerMain.append(title, subtitle);

    const controls = document.createElement("div");
    controls.className = "gm-controls";

    const minimizeBtn = document.createElement("button");
    minimizeBtn.type = "button";
    minimizeBtn.className = "gm-ctrl";
    minimizeBtn.title = "Collapse";
    minimizeBtn.setAttribute("aria-label", "Collapse");
    minimizeBtn.innerHTML = '<svg class="gm-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 10 12 15 17 10"/></svg>';
    minimizeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      batchManagerMinimized = !batchManagerMinimized;
      closeBatchManagerMenu();
      renderBatchProgressIndicator();
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "gm-ctrl";
    closeBtn.title = "Close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="7" x2="17" y2="17"/><line x1="17" y1="7" x2="7" y2="17"/></svg>';
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissBatchManagerForJob("");
    });

    controls.append(minimizeBtn, closeBtn);
    header.append(headerMain, controls);

    function stopBatchManagerDrag(pointerId = null) {
      if (!batchManagerDragSession) return;
      if (pointerId !== null && pointerId !== undefined && batchManagerDragSession.pointerId !== pointerId) {
        return;
      }
      if (typeof header.releasePointerCapture === "function" && batchManagerDragSession.pointerId !== undefined) {
        try {
          header.releasePointerCapture(batchManagerDragSession.pointerId);
        } catch {
          // ignore pointer capture failures
        }
      }
      batchManagerDragSession = null;
      root.classList.remove("dragging");
    }

    header.addEventListener("pointerdown", (event) => {
      if (!event) return;
      if (event.button !== undefined && event.button !== 0) return;
      const rawTarget = event.target;
      if (rawTarget && typeof rawTarget.closest === "function" && rawTarget.closest("button, a, input, select, textarea, label")) {
        return;
      }
      const rect = typeof root.getBoundingClientRect === "function"
        ? root.getBoundingClientRect()
        : { left: Number(root.style.left) || 12, top: Number(root.style.top) || 12 };
      batchManagerDragSession = {
        pointerId: event.pointerId,
        startX: Number(event.clientX) || 0,
        startY: Number(event.clientY) || 0,
        startLeft: Number(rect?.left) || 12,
        startTop: Number(rect?.top) || 12
      };
      if (typeof header.setPointerCapture === "function" && event.pointerId !== undefined) {
        try {
          header.setPointerCapture(event.pointerId);
        } catch {
          // ignore pointer capture failures
        }
      }
      root.classList.add("dragging");
      event.preventDefault();
    });

    header.addEventListener("pointermove", (event) => {
      if (!batchManagerDragSession || !event) return;
      if (event.pointerId !== undefined && event.pointerId !== batchManagerDragSession.pointerId) return;
      const deltaX = (Number(event.clientX) || 0) - batchManagerDragSession.startX;
      const deltaY = (Number(event.clientY) || 0) - batchManagerDragSession.startY;
      const clamped = clampBatchManagerPosition({
        left: batchManagerDragSession.startLeft + deltaX,
        top: batchManagerDragSession.startTop + deltaY
      }, root);
      batchManagerManualPosition = clamped;
      root.style.left = `${clamped.left}px`;
      root.style.top = `${clamped.top}px`;
      event.preventDefault();
    });

    header.addEventListener("pointerup", (event) => {
      stopBatchManagerDrag(event?.pointerId);
    });
    header.addEventListener("pointercancel", (event) => {
      stopBatchManagerDrag(event?.pointerId);
    });

    const miniBar = document.createElement("div");
    miniBar.className = "gm-mini-bar";

    const body = document.createElement("div");
    body.className = "gm-body";

    // Progress card
    const progressCard = document.createElement("div");
    progressCard.className = "gm-progress-card";

    const progressTop = document.createElement("div");
    progressTop.className = "gm-progress-top";
    const percent = document.createElement("div");
    percent.className = "gm-percent";
    percent.textContent = "0%";
    const badge = document.createElement("div");
    badge.className = "gm-badge";
    badge.textContent = "Idle";
    progressTop.append(percent, badge);

    const counts = document.createElement("div");
    counts.className = "gm-progress-counts";
    const countsProcessed = document.createElement("strong");
    countsProcessed.textContent = "0";
    const countsTotal = document.createElement("span");
    countsTotal.textContent = "0";
    counts.append(countsProcessed, document.createTextNode(" of "), countsTotal, document.createTextNode(" items"));

    const bar = document.createElement("div");
    bar.className = "gm-bar";
    const barFill = document.createElement("div");
    barFill.className = "gm-bar-fill";
    bar.appendChild(barFill);

    const progressBottom = document.createElement("div");
    progressBottom.className = "gm-progress-bottom";
    const rate = document.createElement("span");
    rate.className = "gm-rate";
    rate.textContent = "—";
    const etaWrap = document.createElement("span");
    etaWrap.className = "gm-eta";
    etaWrap.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="6" cy="6" r="4.5"/><path d="M6 3.5v2.8l1.8 1"/></svg>';
    const etaText = document.createElement("span");
    etaText.textContent = "—";
    etaWrap.appendChild(etaText);
    progressBottom.append(rate, etaWrap);

    progressCard.append(progressTop, counts, bar, progressBottom);

    // Cooldown card
    const cooldownCard = document.createElement("div");
    cooldownCard.className = "gm-cooldown-card";
    cooldownCard.hidden = true;
    const cooldownSpinner = document.createElement("span");
    cooldownSpinner.className = "gm-cooldown-spinner";
    cooldownSpinner.setAttribute("aria-hidden", "true");
    const cooldownText = document.createElement("div");
    cooldownText.className = "gm-cooldown-text";
    const cooldownStrong = document.createElement("strong");
    cooldownStrong.textContent = "Safety cooldown";
    const cooldownTime = document.createElement("span");
    cooldownTime.textContent = "—";
    cooldownText.append(
      cooldownStrong,
      document.createTextNode(" — resuming in "),
      cooldownTime,
      document.createTextNode(". This pacing helps avoid rate-limits.")
    );
    cooldownCard.append(cooldownSpinner, cooldownText);

    // Details card
    const detailsCard = document.createElement("div");
    detailsCard.className = "gm-details-card";

    function createDetailsRow(label) {
      const row = document.createElement("div");
      row.className = "gm-row";
      const rowLabel = document.createElement("span");
      rowLabel.className = "gm-row-label";
      rowLabel.textContent = label;
      const rowValue = document.createElement("span");
      rowValue.className = "gm-row-value";
      rowValue.textContent = "0";
      row.append(rowLabel, rowValue);
      return { row, rowLabel, rowValue };
    }

    const completedRow = createDetailsRow("Completed");
    const skippedRow = createDetailsRow("Skipped");
    skippedRow.row.hidden = true;
    skippedRow.rowValue.classList.add("secondary");

    const failedRow = document.createElement("div");
    failedRow.className = "gm-row linkish";
    failedRow.tabIndex = 0;
    failedRow.setAttribute("role", "button");
    const failedLabel = document.createElement("span");
    failedLabel.className = "gm-row-label";
    failedLabel.textContent = "Failed";
    const failedValueWrap = document.createElement("span");
    failedValueWrap.className = "gm-row-value-wrap";
    const failedValue = document.createElement("span");
    failedValue.className = "gm-row-value";
    failedValue.textContent = "0";
    const failedChev = document.createElement("span");
    failedChev.className = "gm-row-chev";
    failedChev.setAttribute("aria-hidden", "true");
    failedChev.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 2 8 6 4 10"/></svg>';
    failedValueWrap.append(failedValue, failedChev);
    failedRow.append(failedLabel, failedValueWrap);
    failedRow.setAttribute("aria-expanded", "false");
    const failedList = document.createElement("div");
    failedList.className = "gm-failed-list";
    failedList.hidden = true;
    const toggleFailedRow = () => {
      const selectedId = batchManagerSelectedJobId || "";
      if (!selectedId) return;
      const selected = batchRunRecords.get(selectedId);
      const items = Array.isArray(selected?.failedItems) ? selected.failedItems : [];
      if (items.length === 0) return;
      batchFailedListExpandedForJobId = batchFailedListExpandedForJobId === selectedId
        ? ""
        : selectedId;
      renderBatchProgressIndicator();
    };
    failedRow.addEventListener("click", (event) => {
      event.preventDefault();
      toggleFailedRow();
    });
    failedRow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFailedRow();
      }
    });

    const elapsedRow = createDetailsRow("Elapsed");
    elapsedRow.rowValue.classList.add("secondary");

    detailsCard.append(completedRow.row, skippedRow.row, failedRow, failedList, elapsedRow.row);

    // Actions row with overflow menu
    const actions = document.createElement("div");
    actions.className = "gm-actions";

    const primaryBtn = document.createElement("button");
    primaryBtn.type = "button";
    primaryBtn.className = "gm-btn gm-btn-primary";
    const primaryIconSlot = document.createElement("span");
    primaryIconSlot.className = "gm-btn-icon-slot";
    const primaryLabel = document.createElement("span");
    primaryLabel.textContent = "Pause";
    primaryBtn.append(primaryIconSlot, primaryLabel);
    primaryBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const action = event.currentTarget?.dataset?.action || "";
      const jobId = getBatchElementJobId(event.currentTarget);
      dispatchBatchUIAction(action, jobId);
    });

    const secondaryBtn = document.createElement("button");
    secondaryBtn.type = "button";
    secondaryBtn.className = "gm-btn gm-btn-secondary";
    secondaryBtn.textContent = "Cancel";
    secondaryBtn.addEventListener("click", (event) => {
      event.preventDefault();
      const action = event.currentTarget?.dataset?.action || "";
      const jobId = getBatchElementJobId(event.currentTarget);
      dispatchBatchUIAction(action, jobId);
    });

    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "gm-btn gm-btn-icon";
    moreBtn.title = "More";
    moreBtn.setAttribute("aria-label", "More");
    moreBtn.setAttribute("aria-haspopup", "menu");
    moreBtn.setAttribute("aria-expanded", "false");
    moreBtn.innerHTML = '<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/></svg>';

    const menu = document.createElement("div");
    menu.className = "gm-menu";
    menu.setAttribute("role", "menu");
    menu.addEventListener("click", (event) => event.stopPropagation());

    function createMenuItem({ label, icon, danger = false }) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `gm-menu-item${danger ? " danger" : ""}`;
      item.setAttribute("role", "menuitem");
      const iconSlot = document.createElement("span");
      iconSlot.innerHTML = icon;
      iconSlot.style.display = "inline-flex";
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      item.append(iconSlot, labelSpan);
      return item;
    }

    const menuRetry = createMenuItem({
      label: "Retry failed",
      icon: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.5 4.5A5 5 0 1 0 12 7"/><polyline points="11.5 1.5 11.5 4.5 8.5 4.5"/></svg>'
    });
    menuRetry.disabled = true;
    menuRetry.addEventListener("click", (event) => {
      event.preventDefault();
      closeBatchManagerMenu();
      handleBatchRetryFailed(event);
    });

    const menuExport = createMenuItem({
      label: "Export failed list",
      icon: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 1.5v8"/><polyline points="4 6.5 7 9.5 10 6.5"/><path d="M2.5 11.5h9"/></svg>'
    });
    menuExport.addEventListener("click", (event) => {
      event.preventDefault();
      closeBatchManagerMenu();
      handleBatchExportFailed(event);
    });

    const menuExportLog = createMenuItem({
      label: "Export log",
      icon: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 1.5v8"/><polyline points="4 6.5 7 9.5 10 6.5"/><path d="M2.5 11.5h9"/></svg>'
    });
    menuExportLog.addEventListener("click", (event) => {
      event.preventDefault();
      handleBatchExportLog(event);
    });

    const menuDivider = document.createElement("div");
    menuDivider.className = "gm-menu-divider";

    const menuClearHistory = createMenuItem({
      label: "Clear history",
      icon: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h8M6 4V2.5h2V4M4.5 4l.5 7h4l.5-7"/></svg>',
      danger: true
    });
    menuClearHistory.addEventListener("click", (event) => {
      event.preventDefault();
      handleBatchClearHistory();
    });

    menu.append(menuRetry, menuExport, menuExportLog, menuDivider, menuClearHistory);

    moreBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      batchManagerMenuOpen = !batchManagerMenuOpen;
      menu.classList.toggle("open", batchManagerMenuOpen);
      moreBtn.setAttribute("aria-expanded", batchManagerMenuOpen ? "true" : "false");
    });

    actions.append(primaryBtn, secondaryBtn, moreBtn, menu);

    // Recent runs section
    const runs = document.createElement("div");
    runs.className = "gm-runs";

    const runsHeading = document.createElement("div");
    runsHeading.className = "gm-runs-heading";
    const runsTitle = document.createElement("span");
    runsTitle.className = "gm-runs-title";
    runsTitle.textContent = "Recent runs";
    const runsToggle = document.createElement("button");
    runsToggle.type = "button";
    runsToggle.className = "gm-runs-toggle";
    runsToggle.setAttribute("aria-label", "Toggle recent runs");
    const runsCountLabel = document.createElement("span");
    runsCountLabel.textContent = "0 runs";
    const runsToggleChev = document.createElement("span");
    runsToggleChev.innerHTML = '<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2 4 5 7 8 4"/></svg>';
    runsToggleChev.style.display = "inline-flex";
    runsToggle.append(runsCountLabel, runsToggleChev);
    runsToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      batchManagerRunsCollapsed = !batchManagerRunsCollapsed;
      runs.classList.toggle("collapsed", batchManagerRunsCollapsed);
    });
    runsHeading.append(runsTitle, runsToggle);

    const runsList = document.createElement("div");
    runsList.className = "gm-runs-card";

    runs.append(runsHeading, runsList);

    body.append(progressCard, cooldownCard, detailsCard, actions, runs);
    root.append(header, miniBar, body);
    document.body.appendChild(root);
    applyBatchManagerPosition(root);

    installBatchManagerDocumentMenuHandler();

    const ui = {
      root,
      header,
      title,
      subtitle,
      minimizeBtn,
      closeBtn,
      miniBar,
      body,
      badge,
      percent,
      countsProcessed,
      countsTotal,
      barFill,
      rate,
      etaWrap,
      etaText,
      cooldownCard,
      cooldownTime,
      valueCompleted: completedRow.rowValue,
      skippedRow: skippedRow.row,
      valueSkipped: skippedRow.rowValue,
      valueFailed: failedValue,
      valueElapsed: elapsedRow.rowValue,
      failedRow,
      failedChev,
      failedList,
      primaryBtn,
      primaryLabel,
      primaryIconSlot,
      secondaryBtn,
      menuTrigger: moreBtn,
      menu,
      menuRetry,
      menuExport,
      menuExportLog,
      menuClearHistory,
      runs,
      runsList,
      runsToggle,
      runsCountLabel
    };
    batchProgressIndicator = ui;
    return ui;
  }

  function hideBatchProgressIndicator(status = {}) {
    if (status && typeof status === "object" && (status.jobId || status.controller || status.result)) {
      syncBatchRunRecord({
        ...status,
        final: status.final !== undefined ? Boolean(status.final) : true
      });
    }
    renderBatchProgressIndicator();
  }

  function showBatchProgressIndicator(status = {}) {
    syncBatchRunRecord(status);
    renderBatchProgressIndicator();
  }

  function syncBatchManagerState(controller, overrides = {}) {
    if (!controller || typeof controller !== "object") return;
    showBatchProgressIndicator({
      jobId: controller.jobId,
      label: controller.label,
      mode: controller.mode,
      state: controller.state,
      total: controller.total,
      processed: controller.completed + controller.failed + controller.cancelled,
      completed: controller.completed,
      failed: controller.failed,
      cancelled: controller.cancelled,
      failedItems: Array.isArray(controller.failedItems) ? [...controller.failedItems] : [],
      policy: controller.policy && typeof controller.policy === "object" ? { ...controller.policy } : null,
      timing: controller.timing,
      controller,
      ...overrides
    });
  }

  function ensureCooldownIndicator() {
    if (cooldownIndicator?.root?.isConnected) {
      return cooldownIndicator;
    }
    if (!document.body) {
      return null;
    }

    const root = document.createElement("div");
    root.id = "ig-hd-cooldown-indicator";

    const spinner = document.createElement("div");
    spinner.className = "ig-hd-cooldown-spinner";

    const content = document.createElement("div");
    content.className = "ig-hd-cooldown-content";

    const title = document.createElement("div");
    title.className = "ig-hd-cooldown-title";

    const detail = document.createElement("div");
    detail.className = "ig-hd-cooldown-detail";

    const progress = document.createElement("div");
    progress.className = "ig-hd-cooldown-progress";

    const progressFill = document.createElement("span");
    progress.appendChild(progressFill);

    content.append(title, detail, progress);
    root.append(spinner, content);
    document.body.appendChild(root);

    cooldownIndicator = { root, title, detail, progressFill };
    return cooldownIndicator;
  }

  function hideCooldownIndicator() {
    if (cooldownIndicator) {
      if (cooldownIndicator.root?.remove) {
        cooldownIndicator.root.remove();
      }
      cooldownIndicator = null;
    }
    let needsBatchRender = false;
    for (const record of batchRunRecords.values()) {
      if (Number(record.cooldownSeconds) > 0) {
        record.cooldownSeconds = 0;
        needsBatchRender = true;
      }
    }
    if (needsBatchRender) renderBatchProgressIndicator();
  }

  function updateCooldownIndicator({ label, remainingMs, processed, total }) {
    const ui = ensureCooldownIndicator();
    if (!ui) return;

    const safeProcessed = Math.max(0, Number(processed) || 0);
    const safeTotal = Math.max(0, Number(total) || 0);
    const progressPercent = safeTotal > 0
      ? Math.max(0, Math.min(100, Math.round((safeProcessed / safeTotal) * 100)))
      : 0;

    ui.title.textContent = `${label}: safety pause active`;
    ui.detail.textContent = `Resuming in ${formatDurationShort(remainingMs)} • Progress ${safeProcessed}/${safeTotal || "?"}`;
    ui.progressFill.style.width = `${progressPercent}%`;

    const activeRecord = getActiveBatchRecord(getBatchRecordsSortedNewest());
    if (activeRecord) {
      const seconds = Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000));
      if (activeRecord.cooldownSeconds !== seconds) {
        activeRecord.cooldownSeconds = seconds;
        renderBatchProgressIndicator();
      }
    }
  }

  async function sleepWithCooldownIndicator(label, ms, progressInfo = {}) {
    const totalMs = Math.max(0, Number(ms) || 0);
    if (!totalMs) return;

    try {
      let remainingMs = totalMs;
      while (remainingMs > 0) {
        updateCooldownIndicator({
          label,
          remainingMs,
          processed: progressInfo?.processed,
          total: progressInfo?.total
        });
        const stepMs = Math.min(1000, remainingMs);
        await sleepMs(stepMs);
        remainingMs -= stepMs;
      }
    } finally {
      hideCooldownIndicator();
    }
  }

  function sleepMs(ms) {
    return UTILITIES_CORE.sleepMs(ms);
  }

  function randomIntBetween(minValue, maxValue) {
    return UTILITIES_CORE.randomIntBetween(minValue, maxValue);
  }

  function getPresetPolicy(preset) {
    switch (sanitizeRiskPreset(preset)) {
      case "aggressive":
        return {
          minDelayMs: 0,
          maxDelayMs: 250,
          cooldownEvery: 0,
          cooldownMs: 0,
          retryCount: 0,
          retryBackoffMs: 0
        };
      case "balanced":
        return {
          minDelayMs: 400,
          maxDelayMs: 1200,
          cooldownEvery: 60,
          cooldownMs: 20000,
          retryCount: 1,
          retryBackoffMs: 2000
        };
      case "safe":
      default:
        return {
          minDelayMs: 2200,
          maxDelayMs: 5200,
          cooldownEvery: 30,
          cooldownMs: 120000,
          retryCount: 2,
          retryBackoffMs: 3500
        };
    }
  }

  function getActiveBulkPolicy() {
    const preset = sanitizeRiskPreset(USER_SETTINGS.riskPreset);
    const policy = preset === "custom"
      ? USER_SETTINGS.customPolicy
      : getPresetPolicy(preset);
    return sanitizePolicy(policy);
  }

  // =========================================
  // BATCH JOB CONTROLLER
  // =========================================

  let batchJobIdCounter = 0;

  function generateBatchJobId() {
    batchJobIdCounter += 1;
    return `batch_${Date.now()}_${batchJobIdCounter}`;
  }

  class BatchJobController {
    /**
     * @param {Array<{url:string, filename:string, meta:object|null}>} items
     * @param {object} opts
     * @param {object}  opts.policy      — sanitized pacing policy
     * @param {string}  opts.label       — display label
     * @param {string}  opts.mode        — "download" | "zip"
     * @param {string}  [opts.jobId]     — optional; auto-generated if omitted
     * @param {Function} [opts.onStateChange]  — (newState, oldState) => void
     * @param {Function} [opts.onItemResult]   — ({ index, url, filename, status, error, phase }) => void
     * @param {object}  [opts.zipOptions]      — { zipName } forwarded for ZIP mode
     */
    constructor(items, opts = {}) {
      this.items = Array.isArray(items) ? items : [];
      this.policy = sanitizePolicy(opts.policy);
      this.label = typeof opts.label === "string" && opts.label.trim() ? opts.label.trim() : "Batch download";
      this.mode = opts.mode === "zip" ? "zip" : "download";
      this.jobId = typeof opts.jobId === "string" && opts.jobId.trim() ? opts.jobId.trim() : generateBatchJobId();
      this.zipOptions = opts.zipOptions && typeof opts.zipOptions === "object" ? opts.zipOptions : {};

      // Callbacks
      this._onStateChange = typeof opts.onStateChange === "function" ? opts.onStateChange : null;
      this._onItemResult = typeof opts.onItemResult === "function" ? opts.onItemResult : null;

      // State machine
      this._state = "idle";
      this._pausePromise = null;
      this._pauseResolve = null;

      // Per-item tracking
      this._itemStates = this.items.map(() => "queued");

      // Counters
      this.total = this.items.length;
      this.completed = 0;
      this.failed = 0;
      this.cancelled = 0;
      this.failedItems = [];

      // Timing
      this._startedAt = null;
      this._finishedAt = null;
      this._pausedAt = null;
      this._totalPausedMs = 0;
    }

    get state() {
      return this._state;
    }

    get elapsedMs() {
      if (!this._startedAt) return 0;
      const end = this._finishedAt || Date.now();
      const activePauseMs = this._pausedAt ? Math.max(0, end - this._pausedAt) : 0;
      return Math.max(0, end - this._startedAt - this._totalPausedMs - activePauseMs);
    }

    get timing() {
      return {
        startedAt: this._startedAt ? new Date(this._startedAt).toISOString() : null,
        finishedAt: this._finishedAt ? new Date(this._finishedAt).toISOString() : null,
        elapsedMs: this.elapsedMs
      };
    }

    _setState(nextState) {
      const prev = this._state;
      if (prev === nextState) return;
      this._state = nextState;
      if (this._onStateChange) {
        try { this._onStateChange(nextState, prev); } catch { /* ignore callback errors */ }
      }
      syncBatchManagerState(this);
    }

    _emitItemResult(detail) {
      if (this._onItemResult) {
        try { this._onItemResult(detail); } catch { /* ignore callback errors */ }
      }
    }

    _emitTaskDiagnostic(item) {
      if (!item?.diagnostic) return;
      if (typeof DOWNLOAD_PIPELINE_CORE === "undefined" || typeof DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic !== "function") return;
      DOWNLOAD_PIPELINE_CORE.pushMediaDiagnostic(item.diagnostic);
    }

    pause() {
      if (this._state !== "running") return;
      this._setState("paused");
      this._pausedAt = Date.now();
      this._pausePromise = new Promise((resolve) => {
        this._pauseResolve = resolve;
      });
    }

    resume() {
      if (this._state !== "paused") return;
      if (this._pausedAt) {
        this._totalPausedMs += Date.now() - this._pausedAt;
        this._pausedAt = null;
      }
      this._setState("running");
      if (this._pauseResolve) {
        this._pauseResolve();
        this._pauseResolve = null;
        this._pausePromise = null;
      }
    }

    cancel() {
      if (this._state === "finished" || this._state === "idle") return;
      // If paused, accumulate paused time before moving to cancelling
      if (this._state === "paused" && this._pausedAt) {
        this._totalPausedMs += Date.now() - this._pausedAt;
        this._pausedAt = null;
      }
      this._setState("cancelling");
      // If blocked on pause, unblock the loop so it can exit
      if (this._pauseResolve) {
        this._pauseResolve();
        this._pauseResolve = null;
        this._pausePromise = null;
      }
    }

    /**
     * Creates a NEW controller that processes only the failed items from this job.
     * Callable only after finished.
     */
    retryFailed(overrides = {}) {
      if (this._state !== "finished") return null;
      // Filter out synthetic entries (e.g. zip_create failures that have placeholder URLs)
      const retryableItems = this.failedItems.filter(fi =>
        fi.phase !== "zip_create" && fi.url && fi.url !== "(zip_creation)"
      );
      if (retryableItems.length === 0) return null;
      const retryItems = retryableItems.map(fi => ({
        url: fi.url,
        filename: fi.filename,
        meta: fi.meta || null,
        diagnostic: fi.diagnostic || null
      }));
      return new BatchJobController(retryItems, {
        policy: overrides.policy || this.policy,
        label: overrides.label || `${this.label} (retry)`,
        mode: this.mode,
        jobId: overrides.jobId,
        onStateChange: overrides.onStateChange || this._onStateChange,
        onItemResult: overrides.onItemResult || this._onItemResult,
        zipOptions: this.zipOptions
      });
    }

    /**
     * Creates a NEW controller that re-runs every original item from this job.
     * Callable only after finished (via completion or cancellation).
     */
    runAgain(overrides = {}) {
      if (this._state !== "finished") return null;
      if (!Array.isArray(this.items) || this.items.length === 0) return null;
      const rerunItems = this.items.map(item => ({
        url: item.url,
        filename: item.filename,
        meta: item.meta || null,
        diagnostic: item.diagnostic || null
      }));
      return new BatchJobController(rerunItems, {
        policy: overrides.policy || this.policy,
        label: overrides.label || `${this.label} (run again)`,
        mode: this.mode,
        jobId: overrides.jobId,
        onStateChange: overrides.onStateChange || this._onStateChange,
        onItemResult: overrides.onItemResult || this._onItemResult,
        zipOptions: this.zipOptions
      });
    }

    /**
     * Wait if paused; return false if cancelled (caller should break).
     */
    async _waitIfPausedOrCancelled() {
      while (this._state === "paused") {
        if (this._pausePromise) await this._pausePromise;
      }
      return this._state !== "cancelling";
    }

    /**
     * Sleep that respects pause/cancel. Returns false if cancelled.
     */
    async _interruptibleSleep(ms) {
      const total = Math.max(0, Number(ms) || 0);
      if (!total) return true;
      const stepMs = 200;
      let remaining = total;
      while (remaining > 0) {
        if (this._state === "cancelling") return false;
        if (this._state === "paused") {
          const shouldContinue = await this._waitIfPausedOrCancelled();
          if (!shouldContinue) return false;
        }
        const chunk = Math.min(stepMs, remaining);
        await sleepMs(chunk);
        remaining -= chunk;
      }
      return true;
    }

    /**
     * Cooldown sleep with UI indicator that respects pause/cancel.
     * Returns false if cancelled during the cooldown.
     */
    async _interruptibleCooldownSleep(label, ms, progressInfo = {}) {
      const totalMs = Math.max(0, Number(ms) || 0);
      if (!totalMs) return true;

      try {
        let remainingMs = totalMs;
        while (remainingMs > 0) {
          if (this._state === "cancelling") return false;
          if (this._state === "paused") {
            hideCooldownIndicator();
            const shouldContinue = await this._waitIfPausedOrCancelled();
            if (!shouldContinue) return false;
          }
          updateCooldownIndicator({
            label,
            remainingMs,
            processed: progressInfo?.processed,
            total: progressInfo?.total
          });
          const stepMs = Math.min(1000, remainingMs);
          await sleepMs(stepMs);
          remainingMs -= stepMs;
        }
        return true;
      } finally {
        hideCooldownIndicator();
      }
    }

    _buildResult() {
      const status = this.cancelled > 0
        ? "cancelled"
        : this.failed > 0
          ? (this.completed > 0 ? "partial" : "failed")
          : "completed";
      return {
        status,
        total: this.total,
        completed: this.completed,
        failed: this.failed,
        cancelled: this.cancelled,
        failedItems: [...this.failedItems],
        timing: this.timing,
        jobId: this.jobId
      };
    }

    /**
     * Main entry point. Runs the batch and returns the result.
     */
    async run() {
      if (this._state !== "idle" || this.total === 0) {
        return this._buildResult();
      }

      this._startedAt = Date.now();
      this._setState("running");
      activeBatchJobs.set(this.jobId, this);

      try {
        if (this.mode === "zip") {
          return await this._runZipMode();
        }
        return await this._runDownloadMode();
      } finally {
        this._finishedAt = Date.now();
        if (this._pausedAt) {
          this._totalPausedMs += this._finishedAt - this._pausedAt;
          this._pausedAt = null;
        }
        this._setState("finished");
        activeBatchJobs.delete(this.jobId);
        hideBatchProgressIndicator({
          jobId: this.jobId,
          label: this.label,
          mode: this.mode,
          state: "finished",
          result: this._buildResult(),
          controller: this,
          final: true
        });
      }
    }

    async _runDownloadMode() {
      const { label, policy: safePolicy, total } = this;
      const applySafetyPacing = total >= USER_SETTINGS.safetyThresholdCount;

      syncBatchManagerState(this, {
        phase: "Downloading files",
        processed: 0,
        total,
        failed: 0,
        indeterminate: false
      });

      showBatchToast(`${label}: starting ${total} item(s)...`, 2500);

        for (let index = 0; index < total; index++) {
          // --- Pause/cancel boundary ---
          const shouldContinue = await this._waitIfPausedOrCancelled();
          if (!shouldContinue) {
            this._markRemainingCancelled(index);
            break;
          }

          this._itemStates[index] = "active";
          const item = this.items[index];
          this._emitTaskDiagnostic(item);
          let ok = false;
          let lastError = null;

          for (let attempt = 0; attempt <= safePolicy.retryCount; attempt++) {
            try {
              if (item.videoPlan) {
                ok = await dispatchVideoDownload(item.videoPlan, item.url, item.filename, item.meta, {
                  allowOpenInTabFallback: false,
                  batch: true
                });
              } else {
                ok = await downloadFile(item.url, item.filename, item.meta, {
                  allowOpenInTabFallback: false
                });
              }
              if (ok) break;
              lastError = new Error("downloadFile returned false");
            } catch (err) {
              lastError = err;
              ok = false;
            }
            if (attempt < safePolicy.retryCount && safePolicy.retryBackoffMs > 0) {
              const sleepOk = await this._interruptibleSleep(safePolicy.retryBackoffMs * (attempt + 1));
              if (!sleepOk) {
                this._markRemainingCancelled(index);
                return this._buildResult();
              }
            }
          }

          if (ok) {
            this.completed += 1;
            this._itemStates[index] = "done";
            this._emitItemResult({ index, url: item.url, filename: item.filename, status: "done", error: null, phase: "download" });
          } else {
            this.failed += 1;
            this._itemStates[index] = "failed";
            this.failedItems.push({
              url: item.url,
              filename: item.filename,
              meta: item.meta || null,
              diagnostic: item.diagnostic || null,
              itemIndex: index,
              timestamp: new Date().toISOString(),
              error: lastError?.message || "Download failed",
              phase: "download"
            });
            this._emitItemResult({ index, url: item.url, filename: item.filename, status: "failed", error: lastError?.message || "Download failed", phase: "download" });
          }

          const processed = index + 1;
          syncBatchManagerState(this, {
            phase: "Downloading files",
            processed,
            total,
            failed: this.failed,
            indeterminate: false
          });
          if (processed >= total) continue;

          // Cooldown
          if (applySafetyPacing && safePolicy.cooldownEvery > 0 && processed % safePolicy.cooldownEvery === 0 && safePolicy.cooldownMs > 0) {
            const cooldownSeconds = Math.round(safePolicy.cooldownMs / 1000);
            showBatchToast(`${label}: cooldown (${cooldownSeconds}s)`, 2200);
            syncBatchManagerState(this, {
              phase: `Safety cooldown (${cooldownSeconds}s)`,
              processed,
              total,
              failed: this.failed,
              indeterminate: false
            });
            const cooldownOk = await this._interruptibleCooldownSleep(label, safePolicy.cooldownMs, { processed, total });
            if (!cooldownOk) {
              this._markRemainingCancelled(index + 1);
              break;
            }
            syncBatchManagerState(this, {
              phase: "Downloading files",
              processed,
              total,
              failed: this.failed,
              indeterminate: false
            });
          }

          // Inter-item delay
          if (applySafetyPacing) {
            const delayMs = randomIntBetween(safePolicy.minDelayMs, safePolicy.maxDelayMs);
            if (delayMs > 0) {
              const sleepOk = await this._interruptibleSleep(delayMs);
              if (!sleepOk) {
                this._markRemainingCancelled(index + 1);
                break;
              }
            }
          }
        }

        if (this.cancelled > 0) {
          showBatchToast(`${label}: cancelled (${this.completed}/${total} done, ${this.cancelled} skipped)`, 5000, { important: true });
        } else if (this.failed === 0) {
          showBatchToast(`${label}: completed ${this.completed}/${total}`, 4500, { important: true });
        } else {
          showBatchToast(`${label}: completed ${this.completed}/${total}, failed ${this.failed}`, 6500, { important: true });
        }

      return this._buildResult();
    }

    async _runZipMode() {
      const { label, policy: safePolicy, total } = this;
      const applySafetyPacing = total >= USER_SETTINGS.safetyThresholdCount;
      const archivePaths = new Set();
      const archiveEntries = [];

      syncBatchManagerState(this, {
        phase: "Collecting files for ZIP",
        processed: 0,
        total,
        failed: 0,
        indeterminate: false
      });

      showBatchToast(`${label}: collecting ${total} item(s) for ZIP...`, 2600);

        for (let index = 0; index < total; index++) {
          // --- Pause/cancel boundary ---
          const shouldContinue = await this._waitIfPausedOrCancelled();
          if (!shouldContinue) {
            this._markRemainingCancelled(index);
            break;
          }

          this._itemStates[index] = "active";
          const item = this.items[index];
          this._emitTaskDiagnostic(item);
          // When a videoPlan is present, derive the filename from the plan so the
          // extension matches the actual muxer output (e.g. .mkv when MKV mode is
          // active). The plan's container also determines whether we fetch+mux
          // DASH bytes or just download the progressive URL into the archive.
          const usePlan = item.videoPlan
            && typeof DOWNLOAD_PIPELINE_CORE !== "undefined"
            && typeof DOWNLOAD_PIPELINE_CORE.collectResolvedVideoBytes === "function";
          const effectiveDefault = usePlan
            ? resolveVideoDownloadFilename(item.videoPlan, item.url, item.filename, item.meta)
            : deriveDownloadDefaultFilename(item.url, item.filename, item.meta);
          const resolvedFilename = usePlan
            ? effectiveDefault
            : resolveDownloadFilename(effectiveDefault, item.meta);
          const archivePath = FILE_METADATA_CORE.makeUniqueArchivePath(
            applyTypeSubfolderToArchivePath(resolvedFilename, item.meta),
            archivePaths
          );

          let dataBytes = null;
          let lastError = null;
          for (let attempt = 0; attempt <= safePolicy.retryCount; attempt++) {
            try {
              if (usePlan) {
                const collected = await DOWNLOAD_PIPELINE_CORE.collectResolvedVideoBytes(item.videoPlan);
                dataBytes = collected.bytes;
              } else {
                const blob = await fetchMediaBlob(item.url);
                // Firefox + Tampermonkey hand back cross-realm Blobs whose
                // arrayBuffer() result throws "Accessing TypedArray data over
                // Xrays..." when wrapped in a Uint8Array. Read via FileReader so
                // the bytes land in the userscript realm.
                dataBytes = await readBlobAsBytes(blob);
              }
              break;
            } catch (err) {
              lastError = err;
              if (attempt < safePolicy.retryCount && safePolicy.retryBackoffMs > 0) {
                const sleepOk = await this._interruptibleSleep(safePolicy.retryBackoffMs * (attempt + 1));
                if (!sleepOk) {
                  this._markRemainingCancelled(index);
                  return this._buildResult();
                }
              }
            }
          }

          if (dataBytes && dataBytes.length > 0) {
            archiveEntries.push({ path: archivePath, data: dataBytes, lastModified: new Date() });
            const sidecarEntries = buildMetadataSidecarArchiveEntries(item.url, archivePath, item.meta, archivePaths);
            if (sidecarEntries.length > 0) {
              archiveEntries.push(...sidecarEntries);
            }
            this.completed += 1;
            this._itemStates[index] = "done";
            this._emitItemResult({ index, url: item.url, filename: item.filename, status: "done", error: null, phase: "zip_collect" });
          } else {
            this.failed += 1;
            this._itemStates[index] = "failed";
            this.failedItems.push({
              url: item.url,
              filename: item.filename,
              meta: item.meta || null,
              diagnostic: item.diagnostic || null,
              itemIndex: index,
              timestamp: new Date().toISOString(),
              error: lastError?.message || "Fetch failed",
              phase: "zip_collect"
            });
            this._emitItemResult({ index, url: item.url, filename: item.filename, status: "failed", error: lastError?.message || "Fetch failed", phase: "zip_collect" });
          }

          const processed = index + 1;
          syncBatchManagerState(this, {
            phase: "Collecting files for ZIP",
            processed,
            total,
            failed: this.failed,
            indeterminate: false
          });
          if (processed >= total) continue;

          // Cooldown
          if (applySafetyPacing && safePolicy.cooldownEvery > 0 && processed % safePolicy.cooldownEvery === 0 && safePolicy.cooldownMs > 0) {
            const cooldownSeconds = Math.round(safePolicy.cooldownMs / 1000);
            showBatchToast(`${label}: cooldown (${cooldownSeconds}s)`, 2200);
            syncBatchManagerState(this, {
              phase: `Safety cooldown (${cooldownSeconds}s)`,
              processed,
              total,
              failed: this.failed,
              indeterminate: false
            });
            const cooldownOk = await this._interruptibleCooldownSleep(label, safePolicy.cooldownMs, { processed, total });
            if (!cooldownOk) {
              this._markRemainingCancelled(index + 1);
              break;
            }
            syncBatchManagerState(this, {
              phase: "Collecting files for ZIP",
              processed,
              total,
              failed: this.failed,
              indeterminate: false
            });
          }

          // Inter-item delay
          if (applySafetyPacing) {
            const delayMs = randomIntBetween(safePolicy.minDelayMs, safePolicy.maxDelayMs);
            if (delayMs > 0) {
              const sleepOk = await this._interruptibleSleep(delayMs);
              if (!sleepOk) {
                this._markRemainingCancelled(index + 1);
                break;
              }
            }
          }
        }

        // If cancelled or all failed, skip ZIP creation
        if (archiveEntries.length === 0) {
          if (this.cancelled > 0) {
            showBatchToast(`${label}: cancelled (${this.completed}/${total} collected, ${this.cancelled} skipped)`, 5000, { important: true });
          } else {
            showBatchToast(`${label}: ZIP export failed for all items.`, 6500, { important: true });
          }
          return this._buildResult();
        }

        // ZIP creation phase
        try {
          showBatchToast(`${label}: creating ZIP (${archiveEntries.length} file(s))...`, 3000);
          syncBatchManagerState(this, {
            phase: `Creating ZIP archive (${archiveEntries.length} file(s))`,
            processed: total,
            total,
            failed: this.failed,
            indeterminate: true
          });
          await sleepMs(16);
          const zipBlob = await ZIP_CORE.createStoredZipBlob(archiveEntries);
          const zipName = buildZipDownloadName(this.zipOptions?.zipName || this.label);
          let savedToCustomFolder = false;
          try {
            savedToCustomFolder = await saveBlobToCustomFolder(zipBlob, zipName, { type: "archive" });
          } catch (customSaveErr) {
            debugLog("[Amstragram] ZIP custom folder save failed:", customSaveErr?.message || customSaveErr);
          }
          if (!savedToCustomFolder) {
            triggerBlobBrowserDownload(zipBlob, zipName);
          }
        } catch (zipErr) {
          console.error("[Amstragram] ZIP export failed:", zipErr);
          showBatchToast(`${label}: ZIP export failed (${zipErr?.message || "Unknown error"}).`, 7000, { important: true });
          // ZIP creation failed — all previously-completed items are now effectively failed
          // because the ZIP couldn't be produced. Adjust counters accordingly.
          this.failed += this.completed;
          this.completed = 0;
          // Re-mark all "done" items as "failed" in per-item tracking
          for (let i = 0; i < this.total; i++) {
            if (this._itemStates[i] === "done") {
              this._itemStates[i] = "failed";
              const item = this.items[i];
              this.failedItems.push({
                url: item.url,
                filename: item.filename,
                meta: item.meta || null,
                diagnostic: item.diagnostic || null,
                itemIndex: i,
                timestamp: new Date().toISOString(),
                error: zipErr?.message || "ZIP creation failed",
                phase: "zip_create"
              });
            }
          }
          return this._buildResult();
        }

        if (this.cancelled > 0) {
          showBatchToast(`${label}: ZIP ready (${archiveEntries.length}/${total}), ${this.cancelled} skipped`, 5000, { important: true });
        } else if (this.failed === 0) {
          showBatchToast(`${label}: ZIP ready (${this.completed}/${total})`, 5000, { important: true });
        } else {
          showBatchToast(`${label}: ZIP ready (${this.completed}/${total}), failed ${this.failed}`, 6500, { important: true });
        }

      return this._buildResult();
    }

    _markRemainingCancelled(fromIndex) {
      for (let i = fromIndex; i < this.total; i++) {
        if (this._itemStates[i] === "queued") {
          this._itemStates[i] = "skipped_cancelled";
          this.cancelled += 1;
        }
      }
    }
  }

  async function runBatchZipExportTasks(items, policy, options = {}) {
    const entries = Array.isArray(items) ? items : [];
    if (entries.length === 0) {
      return { total: 0, completed: 0, failed: 0, cancelled: 0, status: "completed", failedItems: [], timing: { startedAt: null, finishedAt: null, elapsedMs: 0 }, jobId: null };
    }

    const label = typeof options?.label === "string" && options.label.trim()
      ? options.label.trim()
      : "Batch download";

    const controller = new BatchJobController(entries, {
      policy,
      label,
      mode: "zip",
      jobId: options.jobId,
      onStateChange: options.onStateChange,
      onItemResult: options.onItemResult,
      zipOptions: { zipName: options.zipName }
    });

    const skippedZip = Math.max(0, Number(options.skipped) || 0);
    if (skippedZip > 0) {
      const rec = ensureBatchRunRecord({ jobId: controller.jobId });
      rec.skipped = (Number(rec.skipped) || 0) + skippedZip;
    }
    return await controller.run();
  }

  async function runBatchDownloadTasks(tasks, policy = getActiveBulkPolicy(), options = {}) {
    const entries = Array.isArray(tasks) ? tasks : [];
    const normalized = [];
    const seen = new Set();

    for (const entry of entries) {
      const url = typeof entry?.url === "string" ? entry.url.trim() : "";
      const filename = typeof entry?.filename === "string" ? entry.filename.trim() : "";
      const meta = entry?.meta && typeof entry.meta === "object" ? entry.meta : null;
      const videoPlan = entry?.videoPlan && typeof entry.videoPlan === "object" ? entry.videoPlan : null;
      const diagnostic = entry?.diagnostic && typeof entry.diagnostic === "object" ? entry.diagnostic : null;
      if (!url || !filename) continue;
      const key = `${url}|${filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({
        url,
        filename,
        meta: meta,
        videoPlan: videoPlan,
        diagnostic: diagnostic,
        historyKey: getDownloadHistoryKeyForTask({ url, filename, meta })
      });
    }

    const skipPreviouslyDownloaded = !!USER_SETTINGS?.downloads?.skipPreviouslyDownloaded;
    let skippedByHistory = 0;
    const queued = [];
    for (const item of normalized) {
      if (skipPreviouslyDownloaded && item.historyKey && hasDownloadedHistoryKey(item.historyKey)) {
        skippedByHistory += 1;
        continue;
      }
      queued.push(item);
    }

    if (normalized.length === 0) {
      showToast("No downloadable media found.");
      return { total: 0, completed: 0, failed: 0, cancelled: 0, status: "completed", failedItems: [], timing: { startedAt: null, finishedAt: null, elapsedMs: 0 }, jobId: null };
    }
    if (skippedByHistory > 0) {
      showToast(`Skipped ${skippedByHistory} previously downloaded item(s).`, 3800);
    }
    if (queued.length === 0) {
      showToast("All queued items were already downloaded.", 4000);
      return { total: 0, completed: 0, failed: 0, cancelled: 0, status: "completed", failedItems: [], timing: { startedAt: null, finishedAt: null, elapsedMs: 0 }, jobId: null };
    }

    const label = typeof options?.label === "string" && options.label.trim()
      ? options.label.trim()
      : "Batch download";
    const safePolicy = sanitizePolicy(policy);
    const completedHistoryKeys = new Set();
    const forwardItemResult = typeof options?.onItemResult === "function" ? options.onItemResult : null;
    const onItemResult = (detail) => {
      if (
        detail &&
        detail.status === "done" &&
        Number.isInteger(detail.index) &&
        detail.index >= 0 &&
        detail.index < queued.length
      ) {
        const completedEntry = queued[detail.index];
        if (completedEntry?.historyKey) {
          completedHistoryKeys.add(completedEntry.historyKey);
        }
      }
      if (forwardItemResult) {
        forwardItemResult(detail);
      }
    };

    if (USER_SETTINGS?.downloads?.bulkAsZip && queued.length > 1) {
      const zipResult = await runBatchZipExportTasks(queued, safePolicy, {
        ...options,
        onItemResult: onItemResult,
        skipped: skippedByHistory
      });
      if (zipResult?.completed > 0 && completedHistoryKeys.size > 0) {
        rememberDownloadedHistoryKeys(Array.from(completedHistoryKeys));
      }
      return zipResult;
    }

    const controller = new BatchJobController(queued, {
      policy: safePolicy,
      label,
      mode: "download",
      jobId: options.jobId,
      onStateChange: options.onStateChange,
      onItemResult: onItemResult
    });

    if (skippedByHistory > 0) {
      const rec = ensureBatchRunRecord({ jobId: controller.jobId });
      rec.skipped = (Number(rec.skipped) || 0) + skippedByHistory;
    }
    const result = await controller.run();
    if (result?.completed > 0 && completedHistoryKeys.size > 0) {
      rememberDownloadedHistoryKeys(Array.from(completedHistoryKeys));
    }
    return result;
  }

  function escapeHtml(value) {
    return UTILITIES_CORE.escapeHtml(value);
  }

  function getCurrentProfileUsername() {
    const path = window.location.pathname || "";
    const parts = path.split("/").filter(Boolean);
    const candidate = (parts[0] || "").trim();
    if (!candidate || PROFILE_RESERVED_PATHS.has(candidate.toLowerCase())) return "";
    return /^[A-Za-z0-9._]+$/.test(candidate) ? candidate : "";
  }

  const profileFullNameCache = new Map();
  const profileFullNameFetchInFlight = new Set();
  let profileFullNameTitleObserverStarted = false;

  function captureProfileFullNameFromText(text) {
    const match = String(text || "").match(/^(.+?)\s*\(@([A-Za-z0-9._]+)\)/);
    if (!match?.[1] || !match[2]) return false;
    const key = match[2].toLowerCase();
    const value = match[1].trim();
    if (!value) return false;
    if (profileFullNameCache.get(key) === value) return false;
    profileFullNameCache.set(key, value);
    try {
      window.dispatchEvent(new CustomEvent("amstragram:profile-fullname-update", { detail: { username: key } }));
    } catch (_err) { /* ignore */ }
    return true;
  }

  function ensureProfileFullNameTitleObserver() {
    if (profileFullNameTitleObserverStarted) return;
    const titleEl = document.querySelector("title");
    if (!titleEl || typeof MutationObserver !== "function") return;
    profileFullNameTitleObserverStarted = true;
    captureProfileFullNameFromText(document.title || "");
    const observer = new MutationObserver(() => {
      captureProfileFullNameFromText(document.title || "");
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  function requestProfileFullNameFromApi(username) {
    const normalized = String(username || "").trim().toLowerCase();
    if (!normalized) return;
    if (profileFullNameCache.has(normalized)) return;
    if (profileFullNameFetchInFlight.has(normalized)) return;
    if (typeof fetchProfileInfoDirect !== "function" || typeof getAppID !== "function") return;
    profileFullNameFetchInFlight.add(normalized);
    Promise.resolve()
      .then(() => fetchProfileInfoDirect(username, getAppID()))
      .then((response) => {
        const fullName = response?.fullName ? String(response.fullName).trim() : "";
        if (!fullName) return;
        profileFullNameCache.set(normalized, fullName);
        try {
          window.dispatchEvent(new CustomEvent("amstragram:profile-fullname-update", { detail: { username: normalized } }));
        } catch (_err) { /* ignore */ }
      })
      .catch((err) => {
        if (typeof debugLog === "function") {
          debugLog("[Amstragram] Full name API fetch failed:", err?.message || err);
        }
      })
      .finally(() => {
        profileFullNameFetchInFlight.delete(normalized);
      });
  }

  function getCurrentProfileFullName() {
    const currentUsername = getCurrentProfileUsername();
    if (!currentUsername) return "";
    ensureProfileFullNameTitleObserver();
    const normalizedCurrent = currentUsername.toLowerCase();

    const cached = profileFullNameCache.get(normalizedCurrent);
    if (cached) return cached;

    captureProfileFullNameFromText(document.title || "");
    captureProfileFullNameFromText(
      document.querySelector('meta[property="og:title"]')?.getAttribute("content") || ""
    );

    const fresh = profileFullNameCache.get(normalizedCurrent);
    if (fresh) return fresh;

    requestProfileFullNameFromApi(currentUsername);
    return "";
  }

  function createSettingsModalAutosaveController({
    debounceMs = 300,
    buildNormalizedSettingsFromModal,
    getCustomFolderEnabled,
    getFolderLabel,
    persistUserSettings,
    setUserSettings,
    showToast,
    supportsDirectoryPicker,
    syncCustomFolderControls,
    setCustomFolderEnabled,
    applyTheme,
    syncSettingsLauncherButton,
    renderBatchProgressIndicator,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout
  } = {}) {
    let autosaveTimerId = null;
    let isDirty = false;

    function clearPendingAutosaveTimer() {
      if (autosaveTimerId !== null) {
        clearTimeoutImpl(autosaveTimerId);
        autosaveTimerId = null;
      }
    }

    function markDirty() {
      isDirty = true;
    }

    function applyCommitSideEffects() {
      applyTheme();
      syncSettingsLauncherButton();
      renderBatchProgressIndicator();
    }

    function commitSettingsFromModal(commitOptions = {}) {
      if (getCustomFolderEnabled() && !supportsDirectoryPicker()) {
        setCustomFolderEnabled(false);
        syncCustomFolderControls();
        showToast("Custom folders need Chromium (Chrome/Edge/Brave).");
      }
      if (getCustomFolderEnabled() && !String(getFolderLabel() || "").trim()) {
        setCustomFolderEnabled(false);
        syncCustomFolderControls();
        showToast("Choose an output folder first.");
      }

      const normalizedSettings = buildNormalizedSettingsFromModal(commitOptions);
      setUserSettings(normalizedSettings);

      const persisted = persistUserSettings();
      applyCommitSideEffects();

      if (!persisted) {
        showToast("Could not save settings.", 5000);
        return false;
      }
      return true;
    }

    async function runCommit(commitOptions = {}) {
      clearPendingAutosaveTimer();
      if (!isDirty) return true;
      const persisted = await Promise.resolve(commitSettingsFromModal(commitOptions));
      if (persisted) {
        isDirty = false;
      }
      return persisted;
    }

    async function commitImmediately(commitOptions = {}) {
      markDirty();
      return await runCommit(commitOptions);
    }

    function scheduleDebouncedAutosave() {
      markDirty();
      clearPendingAutosaveTimer();
      autosaveTimerId = setTimeoutImpl(() => {
        autosaveTimerId = null;
        void runCommit();
      }, debounceMs);
    }

    async function flushPendingAutosave(commitOptions = {}) {
      return await runCommit(commitOptions);
    }

    function hasPendingAutosave() {
      return autosaveTimerId !== null;
    }

    return {
      commitSettingsFromModal,
      commitImmediately,
      scheduleDebouncedAutosave,
      flushPendingAutosave,
      hasPendingAutosave,
      isDirty: () => isDirty
    };
  }

  function removeSettingsModal() {
    settingsModalCloseRequest = null;
    applyTheme(); // Ensure the page theme matches the latest committed settings on dismiss.
    if (typeof settingsTooltipCleanup === "function") {
      settingsTooltipCleanup();
      settingsTooltipCleanup = null;
    }
    if (typeof settingsPreviewFullNameCleanup === "function") {
      settingsPreviewFullNameCleanup();
      settingsPreviewFullNameCleanup = null;
    }
    const existing = document.getElementById("ig-hd-settings-overlay");
    if (existing) existing.remove();
  }

  function removeSettingsLauncherButton() {
    const existing = document.getElementById("ig-hd-settings-launcher");
    if (existing) existing.remove();
    settingsLauncherButton = null;
  }

  function isStoriesPathname(pathname = window.location.pathname || "") {
    return typeof pathname === "string" && pathname.includes("/stories/");
  }

  function isReelsSurfacePathname(pathname = window.location.pathname || "") {
    return /^\/reels?(?:\/|$)/.test(String(pathname || ""));
  }

  function isDirectMessagePathname(pathname = window.location.pathname || "") {
    return /^\/direct(?:\/|$)/.test(String(pathname || ""));
  }

  function shouldSuppressSettingsLauncherForPath(pathname = window.location.pathname || "") {
    return isStoriesPathname(pathname) || isReelsSurfacePathname(pathname) || isDirectMessagePathname(pathname);
  }

  function isLoggedOutInstagramPathname(pathname = window.location.pathname || "") {
    return /^\/accounts\/(?:login|signup|emailsignup|password\/reset|onetap)(?:\/|$)/.test(String(pathname || ""))
      || /^\/challenge(?:\/|$)/.test(String(pathname || ""));
  }

  function hasInstagramSessionCookie() {
    return /(?:^|;\s*)ds_user_id=\d+(?:;|$)/.test(String(document?.cookie || ""));
  }

  function hasAuthenticatedInstagramShell() {
    if (hasInstagramSessionCookie()) return true;
    const selectors = [
      'nav a[href="/direct/inbox/"]',
      'nav a[href^="/direct/"]',
      'nav a[href="/explore/"]',
      'nav a[href="/reels/"]',
      'nav svg[aria-label="Home"]',
      'nav [aria-label="Home"]',
      'header svg[aria-label="Home"]',
      '[aria-label="Messenger"]',
      '[aria-label="New post"]'
    ];
    return selectors.some((selector) => !!document.querySelector?.(selector));
  }

  function shouldSuppressSettingsLauncher(pathname = window.location.pathname || "") {
    return shouldSuppressSettingsLauncherForPath(pathname)
      || isLoggedOutInstagramPathname(pathname)
      || !hasAuthenticatedInstagramShell();
  }

  function parseCssRgbColor(value) {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,\/]+([0-9]*\.?[0-9]+))?\s*\)$/i);
    if (!match) return null;
    return {
      r: Math.max(0, Math.min(255, Number.parseInt(match[1], 10) || 0)),
      g: Math.max(0, Math.min(255, Number.parseInt(match[2], 10) || 0)),
      b: Math.max(0, Math.min(255, Number.parseInt(match[3], 10) || 0)),
      a: Math.max(0, Math.min(1, match[4] == null ? 1 : Number.parseFloat(match[4]) || 0))
    };
  }

  function isDarkRgbColor(color) {
    if (!color) return false;
    const brightness = ((color.r * 299) + (color.g * 587) + (color.b * 114)) / 1000;
    return brightness < 140;
  }

  function resolveTheme(preference) {
    if (preference === "light") return "light";
    if (preference === "dark") return "dark";
    // "auto": detect from Instagram's page
    const candidates = [
      document.querySelector?.("main"),
      document.body,
      document.documentElement
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const computedColor = parseCssRgbColor(window.getComputedStyle?.(candidate)?.backgroundColor);
      if (!computedColor || computedColor.a <= 0) continue;
      return isDarkRgbColor(computedColor) ? "dark" : "light";
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
      ? "dark"
      : "light";
  }

  function getSettingsLauncherColor(resolvedTheme = null) {
    const theme = resolvedTheme || appliedTheme || resolveTheme(USER_SETTINGS?.theme ?? "auto");
    return theme === "dark" ? "#fff" : "rgb(38, 38, 38)";
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference ?? USER_SETTINGS?.theme ?? "auto");
    appliedTheme = resolved;
    const root = document.documentElement;
    if (!root?.classList) return;
    if (resolved === "light") {
      root.classList.add("ig-hd-theme-light");
    } else {
      root.classList.remove("ig-hd-theme-light");
    }
    // Keep the launcher icon color in sync with the resolved theme
    const launcher = settingsLauncherButton?.isConnected
      ? settingsLauncherButton
      : document.getElementById("ig-hd-settings-launcher");
    if (launcher) {
      launcher.style.color = getSettingsLauncherColor(resolved);
    }
  }

  function getNativeInstagramNavMetrics() {
    const selectors = [
      'header svg[aria-label="Instagram"]',
      'header a[href="/"] svg',
      'nav svg[aria-label="Instagram"]',
      'nav a[href="/"] svg',
      'svg[aria-label="Instagram"]',
      'svg[aria-label="Home"]',
      'a[href="/"] svg'
    ];
    const seen = new Set();
    const candidates = [];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      for (const node of nodes) {
        if (!(node instanceof SVGElement) || seen.has(node)) continue;
        seen.add(node);
        const iconRect = node.getBoundingClientRect();
        const iconSize = Math.round(Math.min(iconRect.width || 0, iconRect.height || 0));
        if (iconSize < 16 || iconSize > 64) continue;
        if (iconRect.top > Math.max(220, window.innerHeight * 0.35)) continue;
        if (iconRect.left > Math.max(280, window.innerWidth * 0.3)) continue;

        const anchor = node.closest?.('a,button,[role="button"]') || null;
        const anchorRect = anchor?.getBoundingClientRect?.() || null;
        const paddingSamples = [];
        if (anchorRect && anchorRect.width >= iconRect.width && anchorRect.height >= iconRect.height) {
          paddingSamples.push((anchorRect.width - iconRect.width) / 2);
          paddingSamples.push((anchorRect.height - iconRect.height) / 2);
        }

        const launcherPadding = paddingSamples.length > 0
          ? Math.round(
            Math.max(
              6,
              Math.min(
                12,
                paddingSamples.reduce((sum, value) => sum + value, 0) / paddingSamples.length
              )
            )
          )
          : 12;
        const aspectPenalty = Math.abs(1 - ((iconRect.width || 1) / Math.max(iconRect.height || 1, 1))) * 100;
        const score = (iconRect.top * 10000) + (iconRect.left * 100) + aspectPenalty;

        candidates.push({
          iconRect,
          anchorRect,
          iconSize,
          launcherPadding,
          score
        });
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0];
  }

  function getNativeInstagramNavIconSize() {
    return getNativeInstagramNavMetrics()?.iconSize || 24;
  }

  function getLeftmostActionIcon() {
    const icons = document.querySelectorAll('header svg, nav svg');
    const midX = window.innerWidth * 0.5;
    let best = null;
    for (const node of icons) {
      if (!(node instanceof SVGElement)) continue;
      const rect = node.getBoundingClientRect();
      const size = Math.round(Math.min(rect.width || 0, rect.height || 0));
      if (size < 16 || size > 64) continue;
      if (rect.top > Math.max(220, window.innerHeight * 0.35)) continue;
      if (rect.left < midX) continue;
      if (!best || rect.left < best.iconRect.left) {
        const anchor = node.closest?.('a,button,[role="button"]') || null;
        const anchorRect = anchor?.getBoundingClientRect?.() || null;
        best = { iconRect: rect, anchorRect };
      }
    }
    return best;
  }

  function hasNativeInstagramDialog() {
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    for (const dialog of dialogs) {
      if (dialog.closest("#ig-hd-settings-modal")) continue;
      const rect = dialog.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  function applySettingsLauncherPlacement() {
    const launcher = settingsLauncherButton?.isConnected
      ? settingsLauncherButton
      : document.getElementById("ig-hd-settings-launcher");
    if (!launcher) {
      return;
    }

    if (shouldSuppressSettingsLauncher()) {
      launcher.classList.add("ig-hd-launcher-hidden");
      return;
    }

    if (isStoriesPathname() || hasNativeInstagramDialog()) {
      launcher.classList.add("ig-hd-launcher-hidden");
      return;
    }
    launcher.classList.remove("ig-hd-launcher-hidden");

    const navMetrics = getNativeInstagramNavMetrics();
    const iconSize = navMetrics?.iconSize || getNativeInstagramNavIconSize();
    const launcherPadding = navMetrics?.launcherPadding || 12;
    launcher.style.setProperty("--ig-hd-settings-icon-size", `${iconSize}px`);
    launcher.style.setProperty("--ig-hd-settings-launcher-padding", `${launcherPadding}px`);
    launcher.style.left = "";
    launcher.style.top = "";
    launcher.style.right = "";
    launcher.style.bottom = "";
    launcher.style.width = "";
    launcher.style.height = "";
    launcher.style.color = getSettingsLauncherColor();

    if (navMetrics?.iconRect) {
      const launcherRect = launcher.getBoundingClientRect();
      const launcherWidth = Math.max(32, Math.round(launcherRect.width) || (iconSize + (launcherPadding * 2)));
      const launcherHeight = Math.max(32, Math.round(launcherRect.height) || (iconSize + (launcherPadding * 2)));
      const anchorRectForVertical = navMetrics.anchorRect && navMetrics.anchorRect.height >= 24
        ? navMetrics.anchorRect
        : null;
      const anchorRectForHorizontal = anchorRectForVertical && navMetrics.anchorRect.width <= (navMetrics.anchorRect.height * 1.6)
        ? navMetrics.anchorRect
        : null;
      const verticalSource = anchorRectForVertical || navMetrics.iconRect;
      const targetTop = verticalSource.top + (verticalSource.height / 2) - (launcherHeight / 2);
      const targetRight = anchorRectForHorizontal
        ? anchorRectForHorizontal.left + (anchorRectForHorizontal.width / 2) - (launcherWidth / 2)
        : navMetrics.iconRect.left - ((launcherWidth - iconSize) / 2);
      const clampedRight = Math.min(Math.max(0, targetRight), Math.max(0, window.innerWidth - launcherWidth));
      const clampedTop = Math.min(Math.max(0, targetTop), Math.max(0, window.innerHeight - launcherHeight));

      if (window.innerWidth <= 700) {
        const actionIcon = getLeftmostActionIcon();
        const actionEdge = actionIcon
          ? (actionIcon.anchorRect || actionIcon.iconRect).left
          : null;
        const mobileLeft = actionEdge != null
          ? Math.max(0, actionEdge - launcherWidth - 4)
          : Math.max(0, (navMetrics.anchorRect || navMetrics.iconRect).right + 4);
        launcher.style.left = `${Math.round(mobileLeft)}px`;
      } else {
        launcher.style.right = `${Math.round(clampedRight)}px`;
      }
      launcher.style.top = `${Math.round(clampedTop)}px`;
    }
  }

  function refreshSettingsLauncherThemeObserver() {
    if (!settingsLauncherThemeObserver) {
      return;
    }

    if (shouldSuppressSettingsLauncher()) {
      settingsLauncherThemeObserver.disconnect();
      settingsLauncherObservedMain = null;
      return;
    }

    const currentMain = document.querySelector?.("main") || null;
    if (currentMain === settingsLauncherObservedMain) {
      return;
    }

    settingsLauncherThemeObserver.disconnect();
    settingsLauncherObservedMain = currentMain;

    const observedTargets = [
      document.documentElement,
      document.body,
      currentMain
    ].filter((node, index, list) => node && list.indexOf(node) === index);

    for (const target of observedTargets) {
      settingsLauncherThemeObserver.observe(target, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-color-mode", "data-bloks-theme"]
      });
    }
  }

  function installSettingsLauncherThemeHooks() {
    if (typeof MutationObserver === "function" && !settingsLauncherThemeObserver) {
      settingsLauncherThemeObserver = new MutationObserver(() => {
        if (USER_SETTINGS?.theme === "auto") {
          scheduleSettingsLauncherSync("theme-mutation");
        }
      });
    }

    refreshSettingsLauncherThemeObserver();

    if (
      !settingsLauncherThemeMediaQuery
      && typeof window?.matchMedia === "function"
    ) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleThemeSchemeChange = () => {
        if (USER_SETTINGS?.theme === "auto") {
          scheduleSettingsLauncherSync("theme-media-query");
        }
      };
      if (typeof mediaQuery?.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleThemeSchemeChange);
      } else if (typeof mediaQuery?.addListener === "function") {
        mediaQuery.addListener(handleThemeSchemeChange);
      }
      settingsLauncherThemeMediaQuery = mediaQuery;
    }
  }

  function scheduleSettingsLauncherSync() {
    const THROTTLE_MS = 500;
    const now = Date.now();
    const elapsed = now - settingsLauncherSyncLastRun;

    if (settingsLauncherSyncTimeout) {
      clearTimeout(settingsLauncherSyncTimeout);
      settingsLauncherSyncTimeout = null;
    }

    const runSync = () => {
      settingsLauncherSyncTimeout = null;
      settingsLauncherSyncLastRun = Date.now();
      if (USER_SETTINGS?.theme === "auto") applyTheme();
      syncSettingsLauncherButton();
      syncProfileGridObserver();
    };

    if (elapsed >= THROTTLE_MS) {
      settingsLauncherSyncLastRun = now;
      if (settingsLauncherSyncRaf === null) {
        const schedule = typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (callback) => setTimeout(callback, 0);
        settingsLauncherSyncRaf = schedule(() => {
          settingsLauncherSyncRaf = null;
          runSync();
        });
      }
    } else {
      settingsLauncherSyncTimeout = setTimeout(runSync, THROTTLE_MS - elapsed);
    }
  }

  function installSettingsLauncherRouteHooks() {
    if (settingsLauncherRouteHooksInstalled) return;
    settingsLauncherRouteHooksInstalled = true;

    if (typeof window?.addEventListener === "function") {
      window.addEventListener("popstate", () => scheduleSettingsLauncherSync("popstate"), true);
      window.addEventListener("resize", () => scheduleSettingsLauncherSync("resize"), { passive: true });
    }

    const historyApi = window?.history;
    if (!historyApi || typeof historyApi !== "object") return;

    for (const methodName of ["pushState", "replaceState"]) {
      const original = historyApi[methodName];
      if (typeof original !== "function") continue;
      historyApi[methodName] = function (...args) {
        const previousPathname = String(window?.location?.pathname || "");
        const result = original.apply(this, args);
        const nextPathname = String(window?.location?.pathname || "");
        if (nextPathname !== previousPathname) {
          scheduleSettingsLauncherSync(`history.${methodName}`);
        }
        return result;
      };
    }
  }

  function syncSettingsLauncherButton() {
    refreshSettingsLauncherThemeObserver();
    const shouldShowLauncher = USER_SETTINGS?.showSettingsLauncher !== false;
    if (!shouldShowLauncher || shouldSuppressSettingsLauncher()) {
      removeSettingsLauncherButton();
      return;
    }

    const existing = document.getElementById("ig-hd-settings-launcher");
    if (existing) {
      settingsLauncherButton = existing;
      applySettingsLauncherPlacement();
      return;
    }
    if (!document.body) {
      return;
    }

    const launcher = document.createElement("button");
    launcher.id = "ig-hd-settings-launcher";
    launcher.type = "button";
    launcher.title = "Open Amstragram settings";
    launcher.ariaLabel = "Open Amstragram settings";
    launcher.innerHTML = SETTINGS_LAUNCHER_ICON_SVG;
    launcher.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSettingsModal();
    });
    document.body.appendChild(launcher);
    settingsLauncherButton = launcher;
    applySettingsLauncherPlacement();
  }

  function openSettingsModal() {
    removeMenu();
    removeSettingsModal();

    USER_SETTINGS = readStoredUserSettings();
    const currentSettings = normalizeUserSettings(USER_SETTINGS);
    const defaultUsername = getCurrentProfileUsername();
    const custom = currentSettings.customPolicy;

    // Inline SVG icons for settings panel (currentColor for theme-awareness)
    const ico = (svg) => `<span class="ig-hd-settings-icon">${svg}</span>`;
    const ICONS = {
      reels: ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="currentColor"><path d="M946.109 333.229c-2.496-53.89-12.165-84.877-20.288-105.799a211.6 211.6 0 0 0-50.324-77.268 211.8 211.8 0 0 0-77.269-50.324C777.227 91.675 746.28 82.007 692.35 79.51c-47.47-2.1-61.616-2.575-179.54-2.575s-132.071.475-179.581 2.575c-53.89 2.497-84.877 12.165-105.799 20.288-30.511 11.809-54.326 27.342-77.268 50.324a212.4 212.4 0 0 0-50.324 77.269c-8.163 21.001-17.831 51.948-20.328 105.878-2.1 47.471-2.575 61.617-2.575 179.541s.475 132.07 2.575 179.58c2.497 53.89 12.165 84.877 20.288 105.799 11.769 30.511 27.341 54.366 50.324 77.269 22.982 23.022 46.797 38.595 77.269 50.324 21.001 8.162 51.948 17.831 105.878 20.327 47.47 2.1 61.617 2.576 179.541 2.576s132.07-.476 179.58-2.576c53.89-2.496 84.877-12.165 105.799-20.288a211.2 211.2 0 0 0 77.269-50.324 212.2 212.2 0 0 0 50.323-77.268c8.163-21.002 17.832-51.949 20.328-105.878 2.1-47.471 2.576-61.617 2.576-179.541s-.476-132.07-2.576-179.581m-79.171 355.516c-1.981 42.399-9.034 65.46-15.057 80.835-7.806 20.208-17.198 34.632-32.493 49.848a133.2 133.2 0 0 1-49.848 32.493c-15.335 5.983-38.436 13.076-80.756 15.017-46.044 2.061-59.833 2.497-175.974 2.497s-129.97-.397-175.935-2.497c-42.399-1.981-65.461-9.034-80.835-15.057a132.9 132.9 0 0 1-49.849-32.493 133.2 133.2 0 0 1-32.492-49.848c-5.984-15.335-13.076-38.436-15.018-80.756-2.061-46.004-2.496-59.833-2.496-175.974s.396-129.97 2.496-175.935c1.981-42.399 9.034-65.461 15.057-80.835 7.807-20.209 17.198-34.672 32.493-49.928a133.6 133.6 0 0 1 49.848-32.453c15.335-5.943 38.436-13.036 80.756-14.978 46.005-2.06 59.834-2.496 175.975-2.496s129.97.396 175.935 2.496c42.398 1.981 65.46 9.035 80.835 15.058 20.208 7.806 34.632 17.157 49.848 32.492 15.256 15.137 24.647 29.6 32.492 49.848 5.984 15.335 13.077 38.437 15.018 80.756 2.061 46.005 2.497 59.834 2.497 175.975s-.397 129.97-2.497 175.935m-181.641-270.56L477.266 299.31a107.97 107.97 0 0 0-108.771.396 107.86 107.86 0 0 0-54.286 94.229v237.75c0 39.308 20.288 74.495 54.286 94.268 17.118 9.906 35.901 14.899 54.683 14.899 18.544 0 37.128-4.874 54.088-14.543l208.031-118.875c34.395-19.654 54.881-55.039 54.881-94.624 0-39.586-20.486-74.971-54.881-94.625m-39.347 120.46L437.918 657.52a29.32 29.32 0 0 1-29.639-.119 29.32 29.32 0 0 1-14.82-25.716v-237.75a29.32 29.32 0 0 1 14.82-25.757 29.2 29.2 0 0 1 29.639-.079L645.95 486.974c13.512 7.767 14.978 20.645 14.978 25.836s-1.466 18.069-14.978 25.796z"/></svg>'),
      folder: ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="81.299"><path d="m279.281 611.429 62.473-114.415c6.792-12.778 17.123-23.566 29.888-31.21s27.484-11.858 42.582-12.189h448.143m0 0c12.725-.021 25.287 2.719 36.72 8.012s21.433 12.996 29.235 22.52 13.195 20.613 15.769 32.418a74.9 74.9 0 0 1-.924 35.684l-64.14 236.722c-4.64 17.027-15.152 32.097-29.866 42.819-14.714 10.721-32.787 16.48-51.35 16.361H195.983c-22.092 0-43.28-8.313-58.901-23.111s-24.398-34.868-24.398-55.796V256.346c0-20.927 8.776-40.997 24.398-55.795s36.809-23.112 58.901-23.112h162.431c13.931-.129 27.674 3.053 39.97 9.257 12.297 6.203 22.755 15.229 30.417 26.251l33.735 47.345c7.585 10.91 17.911 19.866 30.05 26.063 12.14 6.197 25.714 9.443 39.504 9.445h246.979c22.092 0 43.279 8.313 58.901 23.111s24.397 34.869 24.397 55.796z"/></svg>'),
      zip: ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none"><path fill="currentColor" d="M857.713 215.466c66.836 0 121.017 54.182 121.017 121.018v350.639c0 66.837-54.181 121.018-121.017 121.018H172.625c-66.836 0-121.017-54.181-121.018-121.018V336.484c0-66.836 54.182-121.018 121.018-121.018zM98.397 345.419v67.906h191.762L94.051 657.781v67.904h292.261v-67.904h-203.17L379.25 413.325v-67.906zm313.358 0v64.646h66.274v250.974h-66.274v64.646h205.887v-64.646h-66.276V410.065h66.276v-64.646zm239.308 0v380.266H724.4V589.332h79.313q63.015 0 99.955-27.705 37.483-28.248 37.483-90.176v-8.149q0-61.929-37.483-89.634-36.94-28.248-99.955-28.249zm154.823 67.906q30.42 0 46.175 11.951 16.296 11.95 16.296 39.112v5.976q0 26.618-16.296 39.113-15.755 12.495-46.175 12.494H724.4V413.325z"/></svg>'),
      metadataTag: ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none"><path stroke="currentColor" stroke-width="74.465" d="M74.195 559.487c-17.803-19.799-18.323-49.68-1.22-70.087l243.844-290.951a33.41 33.41 0 0 1 25.609-11.951h563.446c18.453 0 33.413 14.96 33.413 33.414v587.126c0 18.454-14.96 33.413-33.413 33.413H341.725a33.4 33.4 0 0 1-24.846-11.072z"/><rect width="492.045" height="74.294" x="320.266" y="315.304" fill="currentColor" opacity=".5" rx="37.147"/><rect width="492.045" height="74.294" x="320.266" y="634.402" fill="currentColor" opacity=".5" rx="37.147"/><rect width="492.045" height="74.294" x="320.266" y="474.853" fill="currentColor" opacity=".5" rx="37.147"/></svg>'),
      android: ico('<svg width="24" height="24" viewBox="0 0 2048 2048" fill="currentColor"><path d="M128.873 1797.43C170.19 1797.43 203.684 1763.94 203.684 1722.62V1198.95C203.684 1157.63 170.19 1124.14 128.873 1124.14C87.5563 1124.14 54.0624 1157.63 54.0624 1198.95V1722.62C54.0627 1763.94 87.5565 1797.43 128.873 1797.43Z" stroke="currentColor" stroke-width="70.8734"/><path d="M1910.55 1124.14C1947.52 1124.14 1977.49 1154.11 1977.49 1191.07V1730.5C1977.49 1767.47 1947.52 1797.43 1910.55 1797.43C1873.58 1797.43 1843.62 1767.47 1843.62 1730.5V1191.07C1843.62 1154.11 1873.58 1124.14 1910.55 1124.14Z" stroke="currentColor" stroke-width="70.8734"/><path d="M403.828 1163.51H1649.38H1683.21C1697.86 1163.51 1709.74 1175.39 1709.74 1190.05V1768.93C1709.74 1783.58 1697.86 1795.47 1683.21 1795.47H1649.38H403.828H369.999C355.343 1795.47 343.462 1783.58 343.462 1768.93V1190.05C343.462 1175.39 355.343 1163.51 369.999 1163.51H403.828Z"/><path d="M1649.38 1163.51H403.828M1649.38 1163.51C1682.72 1163.51 1709.74 1175.39 1709.74 1190.05M1649.38 1163.51H1683.21C1697.86 1163.51 1709.74 1175.39 1709.74 1190.05M403.828 1163.51C370.489 1163.51 343.462 1175.39 343.462 1190.05M403.828 1163.51H369.999C355.343 1163.51 343.462 1175.39 343.462 1190.05M343.462 1190.05V1768.93M343.462 1768.93C343.462 1783.58 370.489 1795.47 403.828 1795.47M343.462 1768.93C343.462 1783.58 355.343 1795.47 369.999 1795.47H403.828M403.828 1795.47H1649.38M1649.38 1795.47C1682.72 1795.47 1709.74 1783.58 1709.74 1768.93M1649.38 1795.47H1683.21C1697.86 1795.47 1709.74 1783.58 1709.74 1768.93M1709.74 1768.93V1190.05" fill="none" stroke="currentColor" stroke-width="111.037"/><path d="M1395.76 160.835C1408.09 161.284 1415.74 174.704 1409.88 185.625L1409.59 186.151L1276.66 415.082L1273.12 421.195L1266.07 421.18L1255.91 421.158L1234.46 421.113L1245.27 402.49L1313.66 284.703L1380.79 169.096C1383.77 163.959 1389.24 160.81 1395.15 160.823L1395.76 160.835Z" stroke="currentColor" stroke-width="24.675"/><path d="M627.081 160.458C614.747 160.907 607.098 174.327 612.953 185.248L613.246 185.774L746.172 414.705L749.72 420.818L756.762 420.803L766.926 420.781L788.38 420.736L777.567 402.113L709.175 284.326L642.05 168.719C639.068 163.582 633.6 160.433 627.682 160.446L627.081 160.458Z" stroke="currentColor" stroke-width="24.675"/><path d="M1026.6 381.34C1216.66 381.34 1398.93 447.091 1533.32 564.129C1661.31 675.587 1735.88 824.863 1742.7 981.798C1743.27 994.833 1732.64 1005.42 1719.59 1005.42H333.619C320.572 1005.42 309.941 994.833 310.507 981.798C317.326 824.864 391.901 675.587 519.884 564.129C654.274 447.091 836.547 381.34 1026.6 381.34ZM715.58 676.646C686.206 676.646 662.393 700.988 662.393 731.016C662.393 761.043 686.206 785.385 715.58 785.385C744.955 785.385 768.767 761.043 768.768 731.016C768.768 700.988 744.955 676.646 715.58 676.646ZM1316.04 676.646C1286.66 676.646 1262.85 700.988 1262.85 731.016C1262.85 761.043 1286.66 785.385 1316.04 785.385C1345.41 785.385 1369.22 761.043 1369.22 731.016C1369.22 700.988 1345.41 676.646 1316.04 676.646Z"/></svg>'),
      highlights: ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none"><path fill="currentColor" stroke="currentColor" stroke-width="24" d="M888.935 511.686c0-201.646-167.692-366.621-376.435-366.621S136.065 310.04 136.065 511.686 303.757 878.308 512.5 878.308s376.435-164.976 376.435-366.622Zm74.065 0c0 244.218-202.539 440.687-450.5 440.687S62 755.904 62 511.686 264.539 71 512.5 71 963 267.468 963 511.686Z"/><path fill="currentColor" d="m512.847 143 80.79 254.782h261.444L643.569 555.246l80.79 254.782-211.512-157.464-211.513 157.464 80.791-254.782-211.513-157.464h261.444z"/></svg>'),
    };
    ICONS.unsupported = ico('<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.001 1h-12a5.006 5.006 0 0 0-5 5v9.005a5.006 5.006 0 0 0 5 5h2.514l2.789 2.712a1 1 0 0 0 1.394 0l2.787-2.712h2.516a5.006 5.006 0 0 0 5-5V6a5.006 5.006 0 0 0-5-5Zm3 14.005a3.003 3.003 0 0 1-3 3h-2.936a1 1 0 0 0-.79.387l-2.274 2.212-2.276-2.212a1 1 0 0 0-.79-.387H6a3.003 3.003 0 0 1-3-3V6a3.003 3.003 0 0 1 3-3h12a3.003 3.003 0 0 1 3 3Zm-9-1.66a1.229 1.229 0 1 0 1.228 1.228A1.23 1.23 0 0 0 12 13.344Zm0-8.117a1.274 1.274 0 0 0-.933.396 1.108 1.108 0 0 0-.3.838l.347 4.861a.892.892 0 0 0 1.77 0l.348-4.86a1.106 1.106 0 0 0-.3-.838A1.272 1.272 0 0 0 12 5.228Z"/></svg>');
    ICONS.everything = ico('<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#ig-hd-ico-all)"><path d="M9.574.5l3.852 0 0 8.818c.254-.116.658-.352.914-.491l1.743-.948 5.462-2.969c.586 1.032 1.325 2.177 1.95 3.207-.212.093-.528.279-.743.396l-1.369.745c-1.665.905-3.32 1.84-5.017 2.686-.336.168-.658.367-.998.526L23.5 16.94c-.255.383-.517.836-.758 1.23l-1.2 1.973c-.908-.54-2.029-1.121-2.968-1.637l-5.149-2.828c-.033 2.914-.003 5.904.002 8.821h-3.854l.001-6.056-.001-1.76c0-.28-.014-.752.015-1.015L1.453 20.14c-.155-.3-.473-.788-.657-1.09L-.5 16.933c.278-.127.69-.369.965-.521l1.792-.985 5.373-2.959c-.252-.1-.643-.355-.907-.477a36 36 0 0 1-1.71-.885L1.49 9.188C.837 8.833.161 8.452-.497 8.114c.48-.734.911-1.522 1.384-2.263.186-.291.403-.638.556-.94.929.47 1.95 1.054 2.872 1.554l5.257 2.86L9.574.5z" fill="currentColor"/></g><defs><clipPath id="ig-hd-ico-all"><rect width="24" height="24"/></clipPath></defs></svg>');
    ICONS.profilePicture = ico('<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M15.637 6.559a3.637 3.637 0 1 0-7.273 0 3.637 3.637 0 0 0 7.273 0zm2.908 0a6.545 6.545 0 1 1-13.09 0 6.545 6.545 0 0 1 13.09 0zM12 14.698c5.107 0 9.535 2.901 11.825 7.151a1.455 1.455 0 0 1-2.56 1.388C19.45 19.867 15.971 17.612 12 17.612s-7.45 2.256-9.265 5.625a1.455 1.455 0 1 1-2.56-1.388C2.465 17.6 6.892 14.698 12 14.698z"/></svg>');
    ICONS.posts = ico('<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4.89 0H1.333C.597 0 0 .488 0 1.091v4.364C0 6.057.597 6.545 1.333 6.545H4.89c.736 0 1.333-.488 1.333-1.09V1.09C6.223.489 5.626 0 4.89 0z"/><path d="M22.667 0H19.11c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V1.09C24 .489 23.403 0 22.667 0z"/><path d="M13.781 0h-3.557C9.488 0 8.891.488 8.891 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V1.09c0-.603-.597-1.091-1.333-1.091z"/><path d="M4.89 8.727H1.333C.597 8.727 0 9.215 0 9.818v4.364c0 .602.597 1.09 1.333 1.09H4.89c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M22.667 8.727H19.11c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M13.781 8.727h-3.557c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M4.89 17.455H1.333C.597 17.455 0 17.943 0 18.545v4.364C0 23.512.597 24 1.333 24H4.89c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/><path d="M22.667 17.455H19.11c-.736 0-1.333.488-1.333 1.09v4.364c0 .603.597 1.091 1.333 1.091h3.557c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/><path d="M13.781 17.455h-3.557c-.736 0-1.333.488-1.333 1.09v4.364c0 .603.597 1.091 1.333 1.091h3.557c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/></svg>');
    ICONS.tagged = ico('<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.818 7.434a2.182 2.182 0 0 0-2.182-2.135h-3.323a3.27 3.27 0 0 1-2.5-1.16l-1.849-2.069a1.09 1.09 0 0 0-1.643 0L8.473 4.14a3.27 3.27 0 0 1-2.5 1.16H4.364a2.182 2.182 0 0 0-2.182 2.134V19.73a2.182 2.182 0 0 0 2.182 2.135h15.273a2.182 2.182 0 0 0 2.181-2.135V7.434zM24 19.73a4.364 4.364 0 0 1-4.364 4.27H4.364A4.364 4.364 0 0 1 0 19.73V7.434A4.364 4.364 0 0 1 4.364 3.165h3.323l1.85-2.071A3.27 3.27 0 0 1 12 0a3.27 3.27 0 0 1 2.463 1.094l1.85 2.07h3.323A4.364 4.364 0 0 1 24 7.435V19.73z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M13.768 8.651a2.5 2.5 0 1 1-3.536 3.536 2.5 2.5 0 0 1 3.536-3.536zm1.414 4.95a4.5 4.5 0 1 0-6.364-6.364 4.5 4.5 0 0 0 6.364 6.364z"/><path d="M12 16.003c3.511 0 6.555 1.99 8.13 4.906a.818.818 0 1 1-1.43.77A7.636 7.636 0 0 0 12 18.002a7.636 7.636 0 0 0-6.37 3.858.818.818 0 0 1-1.43-.77c1.575-2.915 4.618-4.906 8.13-4.906z"/></svg>');
    ICONS.zip = ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none"><rect x="2.75168" y="-2.74312" width="131.836" height="107.874" transform="matrix(0.0123957 0.999923 -0.99988 -0.0155121 724.666 224.885)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75446" y="-2.7389" width="131.836" height="107.875" transform="matrix(0.0113721 0.999935 -0.999855 -0.0170364 725.674 731.828)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75168" y="-2.74311" width="131.836" height="107.874" transform="matrix(0.0123956 0.999923 -0.99988 -0.0155136 623.936 349.588)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75168" y="-2.74311" width="131.836" height="107.874" transform="matrix(0.0123956 0.999923 -0.99988 -0.0155136 828.514 352.764)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75168" y="-2.74311" width="131.836" height="107.874" transform="matrix(0.0123956 0.999923 -0.99988 -0.0155136 727.789 477.466)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75168" y="-2.74311" width="131.836" height="107.874" transform="matrix(0.0123956 0.999923 -0.99988 -0.0155136 823.647 605.192)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><rect x="2.75168" y="-2.74311" width="131.836" height="107.874" transform="matrix(0.0123956 0.999923 -0.99988 -0.0155136 627.061 602.139)" fill="currentColor" stroke="currentColor" stroke-width="5.57311"/><path d="M987.754 889.22C995.357 879.921 1000.7 870.952 1000.85 858.74C1001.26 824.424 1000.96 790.408 1000.87 756.122L1001.22 381.483L902.516 381.422L902.352 756.711L902.343 777.003C902.349 793.777 902.66 811.18 902.274 827.937C896.874 830.279 888.234 833.936 882.402 834.103C868.171 834.507 853.474 834.346 839.226 834.346L756.381 834.328L496.997 834.317L272.025 834.311L202.442 834.357C192.241 834.375 173.713 834.917 164.022 834.034C153.479 833.134 143.494 828.906 135.512 821.961C126.471 813.984 120.858 802.557 120.591 790.581C120.286 776.882 120.47 762.824 120.485 749.101L120.491 673.646L120.482 435.422L120.46 257.681L120.454 202.206C120.453 192.211 120.011 181.47 120.774 171.555C122.79 145.354 142.806 130.026 168.071 128.55C177.038 127.227 197.14 128.383 206.971 128.384L274.788 128.348L324.692 128.333C340.132 128.314 363.149 127.055 377.272 131.058C393.129 135.552 401.477 148.858 410.199 161.379L432.701 193.736C438.273 201.752 444.012 210.386 450.3 217.802C472.056 243.736 502.102 261.359 535.356 267.691C552.436 270.946 568.172 270.367 585.396 270.347L630.568 270.339L796.396 270.33L835.742 270.314C855.839 270.312 873.022 269.011 888.741 284.136C894.602 289.793 898.79 296.961 900.837 304.847C903.197 313.834 902.493 327.478 902.464 337.093C902.314 351.869 902.331 366.646 902.516 381.422L1001.22 381.483C1000.96 365.37 1000.88 349.255 1001 333.141C1001 323.265 1001.23 312.173 1000.25 302.421C996.793 268.312 981.236 236.567 956.404 212.926C937.328 194.696 913.718 181.915 888.02 175.919C867.179 171.089 850.612 171.977 829.518 171.988L778.595 172.015L619.205 172.009L582.374 172.056C563.39 172.073 545.255 173.49 530.246 159.377C521.351 151.015 515.577 140.044 508.297 130.343C497.36 115.604 486.496 97.3454 474.883 83.3532C455.519 59.9471 429.359 43.1364 400.023 35.246C375.653 28.6781 354.836 30.1312 329.984 30.1479L275.417 30.1612C238.842 30.1687 201.997 29.9991 165.441 30.156C127.965 30.3175 87.8416 48.1249 61.8911 75.4385C42.2222 96.0268 29.0866 121.976 24.1385 150.017C21.7055 164.402 22.0383 177.36 22.0533 191.818L22.081 231.086L22.0937 369.742L22.0971 649.477L22.0666 740.812C22.0585 757.765 21.8647 774.776 22.1785 791.718C22.9174 831.612 39.7424 866.51 68.5771 893.656C90.1247 913.672 117.225 926.697 146.313 931.017C161.662 933.347 175.111 932.932 190.521 932.932L237.07 932.944L402.549 932.938L720.352 932.915H822.936C879.368 932.961 918.31 937.622 965.604 903.641C973.495 897.97 980.181 898.49 987.754 889.22Z" fill="currentColor"/></svg>');
    ICONS.reels = ico('<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M23.9291 7.056C23.8604 5.57236 23.5942 4.71927 23.3705 4.14327C23.0707 3.34097 22.5976 2.61464 21.9851 2.016C21.3864 1.40355 20.6601 0.930524 19.8578 0.630545C19.2796 0.405818 18.4276 0.139636 16.9429 0.0709092C15.636 0.013091 15.2465 0 12 0C8.75345 0 8.364 0.013091 7.056 0.0709092C5.57236 0.139636 4.71927 0.405818 4.14327 0.629455C3.30327 0.954545 2.64764 1.38218 2.016 2.01491C1.40397 2.61398 0.931004 3.34019 0.630545 4.14218C0.405818 4.72036 0.139636 5.57236 0.0709092 7.05709C0.013091 8.364 0 8.75345 0 12C0 15.2465 0.013091 15.636 0.0709092 16.944C0.139636 18.4276 0.405818 19.2807 0.629455 19.8567C0.953455 20.6967 1.38218 21.3535 2.01491 21.984C2.64764 22.6178 3.30327 23.0465 4.14218 23.3695C4.72036 23.5942 5.57236 23.8604 7.05709 23.9291C8.364 23.9869 8.75345 24 12 24C15.2465 24 15.636 23.9869 16.944 23.9291C18.4276 23.8604 19.2807 23.5942 19.8567 23.3705C20.6592 23.071 21.3856 22.598 21.984 21.9851C22.5961 21.3861 23.0691 20.6599 23.3695 19.8578C23.5942 19.2796 23.8604 18.4276 23.9291 16.9429C23.9869 15.636 24 15.2465 24 12C24 8.75345 23.9869 8.364 23.9291 7.056ZM21.7495 16.8436C21.6949 18.0109 21.5007 18.6458 21.3349 19.0691C21.12 19.6255 20.8615 20.0225 20.4404 20.4415C20.0562 20.8393 19.587 21.1451 19.068 21.336C18.6458 21.5007 18.0098 21.696 16.8447 21.7495C15.5771 21.8062 15.1975 21.8182 12 21.8182C8.80255 21.8182 8.42182 21.8073 7.15636 21.7495C5.98909 21.6949 5.35418 21.5007 4.93091 21.3349C4.41172 21.1443 3.94251 20.8384 3.55855 20.4404C3.16071 20.0562 2.8549 19.587 2.664 19.068C2.49927 18.6458 2.304 18.0098 2.25055 16.8447C2.19382 15.5782 2.18182 15.1975 2.18182 12C2.18182 8.80255 2.19273 8.42182 2.25055 7.15636C2.30509 5.98909 2.49927 5.35418 2.66509 4.93091C2.88 4.37455 3.13855 3.97636 3.55964 3.55636C3.94415 3.15921 4.41322 2.85383 4.932 2.66291C5.35418 2.49927 5.99018 2.304 7.15527 2.25055C8.42182 2.19382 8.80255 2.18182 12 2.18182C15.1975 2.18182 15.5782 2.19273 16.8436 2.25055C18.0109 2.30509 18.6458 2.49927 19.0691 2.66509C19.6255 2.88 20.0225 3.13745 20.4415 3.55964C20.8615 3.97636 21.12 4.37454 21.336 4.932C21.5007 5.35418 21.696 5.99018 21.7495 7.15527C21.8062 8.42182 21.8182 8.80255 21.8182 12C21.8182 15.1975 21.8073 15.5782 21.7495 16.8436ZM16.7487 9.39491L11.0215 6.12218C10.566 5.85885 10.0488 5.72112 9.52271 5.72303C8.99661 5.72495 8.48044 5.86645 8.02691 6.13309C7.57034 6.39436 7.19137 6.77223 6.92877 7.22804C6.66617 7.68385 6.52937 8.20124 6.53236 8.72727V15.2727C6.53236 16.3549 7.09091 17.3236 8.02691 17.868C8.49818 18.1407 9.01527 18.2782 9.53236 18.2782C10.0429 18.2782 10.5545 18.144 11.0215 17.8778L16.7487 14.6051C17.6956 14.064 18.2596 13.0898 18.2596 12C18.2596 10.9102 17.6956 9.936 16.7487 9.39491ZM15.6655 12.7113L9.93818 15.984C9.81414 16.056 9.67316 16.0936 9.52974 16.0931C9.38632 16.0925 9.24564 16.0537 9.12218 15.9807C8.99734 15.9097 8.8937 15.8066 8.82198 15.6822C8.75026 15.5577 8.71305 15.4164 8.71418 15.2727V8.72727C8.71285 8.58345 8.74998 8.44188 8.82171 8.31722C8.89344 8.19255 8.99717 8.08931 9.12218 8.01818C9.24563 7.94504 9.3864 7.90626 9.52988 7.90588C9.67337 7.90549 9.81435 7.94351 9.93818 8.016L15.6655 11.2887C16.0375 11.5025 16.0778 11.8571 16.0778 12C16.0778 12.1429 16.0375 12.4975 15.6655 12.7102V12.7113Z" fill="currentColor"/></svg>');
    ICONS.highlights = ico('<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M987 512.5C987 778.782 773.671 993 512.5 993C251.329 993 38 778.782 38 512.5C38 246.218 251.329 32 512.5 32C773.671 32 987 246.218 987 512.5ZM512.5 112.756C732.364 112.756 908.989 292.637 908.989 512.5C908.989 732.363 732.364 912.244 512.5 912.244C292.636 912.244 116.011 732.363 116.011 512.5C116.011 292.637 292.636 112.756 512.5 112.756Z" fill="currentColor" stroke="currentColor" stroke-width="13"/><path d="M513.499 133L598.366 394.192H872.999L650.816 555.617L735.682 816.808L513.499 655.383L291.317 816.808L376.183 555.617L154 394.192H428.633L513.499 133Z" fill="currentColor"/></svg>');

    const profileRiskAckTooltipText = `Bulk downloading can trigger Instagram's defenses: temporary rate limits, "Try again later" errors, checkpoint prompts, forced logouts, or action blocks on your account or IP.\nThe risk scales with volume, speed, retries, and repeated runs. Smaller batches and slower presets help, but no setting eliminates it entirely.`;

    const overlay = document.createElement("div");
    overlay.id = "ig-hd-settings-overlay";

    const modal = document.createElement("div");
    modal.id = "ig-hd-settings-modal";
    const floatingTooltip = document.createElement("div");
    floatingTooltip.className = "ig-hd-floating-tooltip";
    floatingTooltip.setAttribute("role", "tooltip");
    modal.innerHTML = `
      <div class="ig-hd-settings-header">
        <span class="ig-hd-settings-version">v${typeof GM_info !== "undefined" && GM_info?.script?.version ? GM_info.script.version : ""}</span>
        <span class="ig-hd-settings-title">Amstragram</span>
        <button id="ig-hd-settings-close" class="ig-hd-settings-close" type="button" aria-label="Close settings"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20.6435 3.35742L12.0005 12.0004L3.35352 20.6474" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.6485 20.6485L3.35352 3.35352" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <div class="ig-hd-settings-tabs">
        <button class="ig-hd-settings-tab active" data-tab="preferences" type="button">Preferences</button>
        <button class="ig-hd-settings-tab" data-tab="export" type="button">Export</button>
        <button class="ig-hd-settings-tab" data-tab="downloader" type="button">Downloader</button>
      </div>
      <div class="ig-hd-settings-body">
        <!-- Tab 1: Preferences -->
        <div class="ig-hd-settings-tab-panel active" data-tab-panel="preferences">
          <div class="ig-hd-settings-group">
            <div class="ig-hd-settings-subheading">Interface</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-row">
                  <label class="ig-hd-settings-label" for="ig-hd-hotkey">Settings hotkey</label>
                  <input id="ig-hd-hotkey" class="ig-hd-settings-input" type="text" value="${escapeHtml(currentSettings.hotkey)}" />
                  <span class="ig-hd-token-actions">
                    <button id="ig-hd-hotkey-record" class="ig-hd-settings-btn text-action" type="button">Record</button>
                    <span class="ig-hd-token-actions-sep">|</span>
                    <button id="ig-hd-hotkey-default" class="ig-hd-settings-btn text-action" type="button">Default</button>
                  </span>
                </div>
              </div>
            </div>
            <div class="ig-hd-settings-help">Click <strong>Record</strong> and press any key combination to set it as the hotkey. You can also type it manually.</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-item">
                  <div class="ig-hd-settings-toggle">
                    <input id="ig-hd-show-settings-launcher" type="checkbox"${currentSettings.showSettingsLauncher ? " checked" : ""} />
                    <span>Show floating settings button on the page</span>
                    <label class="ig-hd-toggle-track" for="ig-hd-show-settings-launcher"></label>
                  </div>
                </div>
              </div>
            </div>
            <div class="ig-hd-settings-help">Turn this off if you prefer opening settings with only the hotkey.</div>
          </div>
          <div class="ig-hd-settings-group">
            <div class="ig-hd-settings-subheading">Downloads</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-item">
                  <div class="ig-hd-settings-toggle">
                    <input id="ig-hd-skip-previously-downloaded" type="checkbox"${currentSettings.downloads.skipPreviouslyDownloaded ? " checked" : ""} />
                    <span>Skip previously downloaded <i id="ig-hd-tip-skip-downloaded" class="ig-hd-info-tip" data-tip="">?</i></span>
                    <label class="ig-hd-toggle-track" for="ig-hd-skip-previously-downloaded"></label>
                  </div>
                </div>
              </div>
            </div>
            <div class="ig-hd-settings-help">Remember downloaded files and skip them in future batches to avoid duplicates.</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-row">
                  <label class="ig-hd-settings-label" for="ig-hd-amstramgram-url">Amstramgram URL</label>
                  <input id="ig-hd-amstramgram-url" class="ig-hd-settings-input" type="text" value="${escapeHtml(currentSettings.downloads.amstramgramUrl || "")}" placeholder="http://localhost:8000" spellcheck="false" autocomplete="off" />
                  <span class="ig-hd-token-actions">
                    <button id="ig-hd-amstramgram-sync" class="ig-hd-settings-btn text-action" type="button">Sync now</button>
                  </span>
                </div>
              </div>
            </div>
            <div class="ig-hd-settings-help">Enter your Amstramgram server URL to sync posts already in its database into the skip list.</div>
          </div>
          <div class="ig-hd-settings-group">
            <div class="ig-hd-settings-subheading">Compatibility</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-item">
                  <div class="ig-hd-settings-toggle">
                    <input id="ig-hd-android-compat-mode" type="checkbox"${currentSettings.downloads.androidCompatMode ? " checked" : ""} />
                    <span>Android compatibility mode</span>
                    <label class="ig-hd-toggle-track" for="ig-hd-android-compat-mode"></label>
                  </div>
                </div>
              </div>
            </div>
            <div class="ig-hd-settings-help">Recommended for Android browsers/userscript managers. Disables custom folder, ZIP export, metadata sidecars, and type subfolders.</div>
          </div>
        </div>
        <!-- Tab 2: Export -->
        <div class="ig-hd-settings-tab-panel" data-tab-panel="export">
          <!-- ═══ Section 1: Filename ═══ -->
          <div class="ig-hd-settings-group">
            <h3 class="ig-hd-settings-subheading">Filename</h3>
            <p class="ig-hd-settings-section-desc">Customize how downloaded files are named.</p>
            <!-- Card 1: Naming pattern input -->
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div style="padding:12px 0">
                  <label class="ig-hd-filename-pattern-label" for="ig-hd-filename-template">Naming pattern</label>
                  <div id="ig-hd-pattern-editor-wrap" class="ig-hd-pattern-editor-wrap">
                    <div class="ig-hd-pattern-editor-pencil">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ig-hd-text-tertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </div>
                    <div id="ig-hd-pattern-overlay" class="ig-hd-pattern-editor-overlay"></div>
                    <input id="ig-hd-filename-template" class="ig-hd-pattern-editor-input" type="text" value="${escapeHtml(currentSettings.downloads.filenameTemplate || "")}" spellcheck="false" autocomplete="off" />
                    <div id="ig-hd-pattern-clear" class="ig-hd-pattern-editor-clear" style="display:none">
                      <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="var(--ig-hd-text-tertiary)"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#262626" stroke-width="2" stroke-linecap="round"/></svg>
                    </div>
                    <div id="ig-hd-pattern-autocomplete" class="ig-hd-pattern-autocomplete" style="display:none"></div>
                  </div>
                  <p class="ig-hd-settings-help ig-hd-filename-pattern-help">Type freely to build your pattern. Use <span class="ig-hd-settings-inline-code">{</span> to browse tokens, or click one below.</p>
                </div>
              </div>
            </div>
            <!-- Card 2: Token catalog + separator + preview + actions -->
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <!-- Tokens section -->
                <div style="padding:12px 0">
                  <div class="ig-hd-token-catalog">
                    <div class="ig-hd-filename-group-label">Identity</div>
                    <div class="ig-hd-token-group-row" data-group="identity">
                      <button type="button" class="ig-hd-token-btn" data-token="{source}" data-group="identity">Source</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{username}" data-group="identity">Username</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{full_name}" data-group="identity">Full name</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{shortcode}" data-group="identity">Shortcode</button>
                    </div>
                    <div class="ig-hd-filename-group-label sub">Content</div>
                    <div class="ig-hd-token-group-row" data-group="content">
                      <button type="button" class="ig-hd-token-btn" data-token="{id}" data-group="content">ID</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{type}" data-group="content">Type</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{index}" data-group="content">Index</button>
                    </div>
                    <div class="ig-hd-filename-group-label sub">Downloaded</div>
                    <div class="ig-hd-token-group-row" data-group="download-time">
                      <button type="button" class="ig-hd-token-btn" data-token="{date}" data-group="download-time">Date</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{time}" data-group="download-time">Time</button>
                    </div>
                    <div class="ig-hd-filename-group-label sub">Uploaded</div>
                    <div class="ig-hd-token-group-row" data-group="upload-time">
                      <button type="button" class="ig-hd-token-btn" data-token="{upload_date}" data-group="upload-time">Date uploaded</button>
                      <button type="button" class="ig-hd-token-btn" data-token="{upload_time}" data-group="upload-time">Time uploaded</button>
                    </div>
                  </div>
                  <p class="ig-hd-settings-help ig-hd-token-catalog-help">Click a token to insert it. Right-click to remove it.</p>
                </div>
                <!-- Separator section -->
                <div style="padding:12px 0">
                  <div class="ig-hd-filename-group-label">Separator</div>
                  <div id="ig-hd-separator-grid" class="ig-hd-separator-grid">
                    <button type="button" class="ig-hd-sep-btn${(currentSettings.downloads.filenameSeparator || "_") === "_" ? " active" : ""}" data-sep="_" data-label="Underscore">Underscore</button>
                    <button type="button" class="ig-hd-sep-btn${(currentSettings.downloads.filenameSeparator) === "-" ? " active" : ""}" data-sep="-" data-label="Dash">Dash</button>
                    <button type="button" class="ig-hd-sep-btn${(currentSettings.downloads.filenameSeparator) === "." ? " active" : ""}" data-sep="." data-label="Dot">Dot</button>
                    <button type="button" class="ig-hd-sep-btn${(currentSettings.downloads.filenameSeparator) === " " ? " active" : ""}" data-sep=" " data-label="Space">Space</button>
                  </div>
                  <p class="ig-hd-settings-help ig-hd-separator-help">Click inserts at cursor. Right-click locks or unlocks auto-separator.</p>
                </div>
                <!-- Preview section -->
                <div style="padding:12px 0">
                  <div class="ig-hd-filename-group-label">Preview</div>
                  <div class="ig-hd-export-preview">
                    <div class="ig-hd-export-preview-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" id="ig-hd-preview-doc-fill" fill="var(--ig-hd-text-tertiary)" opacity="0.3"/>
                        <path d="M14 2v6h6" id="ig-hd-preview-doc-fold" stroke="var(--ig-hd-text-tertiary)" stroke-width="1" fill="none" opacity="0.3"/>
                      </svg>
                      <div id="ig-hd-template-preview" class="ig-hd-export-preview-text empty">Original filename will be used</div>
                    </div>
                    <p id="ig-hd-preview-note" class="ig-hd-settings-help ig-hd-preview-note" style="display:none">Leaving the pattern empty downloads files with their original Instagram filename.</p>
                  </div>
                </div>
                <!-- Actions row -->
                <div class="ig-hd-filename-actions">
                  <button id="ig-hd-filename-clear" class="ig-hd-filename-action-link" type="button">Clear</button>
                  <button id="ig-hd-filename-reset" class="ig-hd-filename-action-link accent" type="button">Reset to default</button>
                </div>
              </div>
            </div>
          </div>
          <!-- ═══ Section 2: Video container ═══ -->
          <div class="ig-hd-settings-group" style="margin-top:10px">
            <h3 class="ig-hd-settings-subheading">Video container</h3>
            <p class="ig-hd-settings-section-desc">Pick the file format for video downloads — universal playback (MP4) or better preservation of modern codecs (MKV).</p>
            <div class="ig-hd-settings-choice-list" style="margin-top:6px">
              <label class="ig-hd-settings-choice" for="ig-hd-video-container-mp4">
                <input id="ig-hd-video-container-mp4" type="checkbox" data-video-container="mp4"${currentSettings.downloads.videoContainer === "mp4" ? " checked" : ""} />
                <span class="ig-hd-settings-choice-text">
                  <span class="ig-hd-settings-choice-title">MP4 <i id="ig-hd-tip-video-container-mp4" class="ig-hd-info-tip" data-tip="">?</i></span>
                  <span class="ig-hd-settings-choice-subtitle">Plays anywhere — iPhone Photos, every browser, every player. Best when you'll share files or move them between devices.</span>
                </span>
              </label>
              <label class="ig-hd-settings-choice" for="ig-hd-video-container-mkv">
                <input id="ig-hd-video-container-mkv" type="checkbox" data-video-container="mkv"${currentSettings.downloads.videoContainer === "mkv" ? " checked" : ""} />
                <span class="ig-hd-settings-choice-text">
                  <span class="ig-hd-settings-choice-title">MKV <i id="ig-hd-tip-video-container-mkv" class="ig-hd-info-tip" data-tip="">?</i></span>
                  <span class="ig-hd-settings-choice-subtitle">Better for media collections — Matroska is the native container for modern codecs like VP9 and AV1, with less risk of subtle quality loss. Currently muxes VP9 only; falls back to MP4 when the source isn't VP9.</span>
                </span>
              </label>
            </div>
          </div>
          <!-- ═══ Section 3: Save location ═══ -->
          <div id="ig-hd-save-location-group" class="ig-hd-settings-group" style="margin-top:10px">
            <h3 class="ig-hd-settings-subheading">Save location</h3>
            <div class="ig-hd-settings-card" style="margin-top:18px">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-toggle" style="padding:12px 0">
                  <input id="ig-hd-use-custom-folder" type="checkbox"${currentSettings.downloads.useCustomFolder ? " checked" : ""} />
                  <span>Save downloads to a custom folder</span>
                  <label class="ig-hd-toggle-track" for="ig-hd-use-custom-folder"></label>
                </div>
                <div id="ig-hd-custom-folder-body" style="padding:12px 0;display:${currentSettings.downloads.useCustomFolder ? "block" : "none"}">
                  <div id="ig-hd-folder-wrap" class="ig-hd-export-folder-wrap">
                    <div class="ig-hd-export-folder-icon" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <span class="ig-hd-export-folder-prefix" aria-hidden="true">…/</span>
                    <input id="ig-hd-folder-label" class="ig-hd-export-folder-input" type="text" value="${escapeHtml(currentSettings.downloads.folderLabel || "")}" placeholder="Default download folder" readonly />
                  </div>
                  <div class="ig-hd-filename-actions">
                    <button id="ig-hd-folder-clear" class="ig-hd-filename-action-link" type="button">Clear</button>
                  </div>
                </div>
              </div>
            </div>
            <p id="ig-hd-folder-help" class="ig-hd-settings-help" style="margin-top:8px;padding:0 4px">Chromium only (Chrome, Edge, Brave). Firefox always uses the default download folder.</p>
          </div>
          <!-- ═══ Section 4: File organization ═══ -->
          <div class="ig-hd-settings-group" style="margin-top:10px">
            <h3 class="ig-hd-settings-subheading">File organization</h3>
            <div class="ig-hd-settings-card" style="margin-top:18px">
              <div class="ig-hd-settings-card-inner">
                <div id="ig-hd-bulk-zip-group" class="ig-hd-settings-toggle" style="padding:12px 0">
                  <input id="ig-hd-bulk-zip" type="checkbox"${currentSettings.downloads.bulkAsZip ? " checked" : ""} />
                  <span>Export batches as ZIP</span>
                  <label class="ig-hd-toggle-track" for="ig-hd-bulk-zip"></label>
                </div>
              </div>
            </div>
            <p class="ig-hd-settings-help" style="margin-top:8px;padding:0 4px">Bundle batch downloads into a single ZIP file instead of saving each file individually.</p>
            <div class="ig-hd-settings-card" style="margin-top:18px">
              <div class="ig-hd-settings-card-inner">
                <div id="ig-hd-type-subfolders-group" class="ig-hd-settings-toggle" style="padding:12px 0">
                  <input id="ig-hd-type-subfolders" type="checkbox"${currentSettings.downloads.useTypeSubfolders ? " checked" : ""} />
                  <span>Group files by type into subfolders</span>
                  <label class="ig-hd-toggle-track" for="ig-hd-type-subfolders"></label>
                </div>
              </div>
            </div>
            <p class="ig-hd-settings-help" style="margin-top:8px;padding:0 4px">Subfolders apply to ZIP exports and Chromium custom-folder saves.</p>
          </div>
          <!-- ═══ Section 5: Metadata ═══ -->
          <div class="ig-hd-settings-group" style="margin-top:10px">
            <h3 class="ig-hd-settings-subheading">Metadata</h3>
            <p class="ig-hd-settings-section-desc">Save metadata for each download in formats other apps can read. Options are independent, so pick any combination.</p>
            <div class="ig-hd-settings-card" style="margin-top:12px">
              <div class="ig-hd-settings-card-inner">
                <div id="ig-hd-save-metadata-json-group" class="ig-hd-settings-toggle ig-hd-toggle-with-subtitle">
                  <input id="ig-hd-save-metadata-json" type="checkbox"${currentSettings.downloads.saveMetadataJson ? " checked" : ""} />
                  <span>
                    <span class="ig-hd-toggle-row-title">JSON sidecar <span class="ig-hd-toggle-applies-to">· Pictures and Videos</span></span>
                    <span class="ig-hd-toggle-row-subtitle">A .json file beside each download with the full metadata payload: caption, hashtags, timestamp, author, and post URL. For scripts, archival, or feeding into other tools.</span>
                  </span>
                  <label class="ig-hd-toggle-track" for="ig-hd-save-metadata-json"></label>
                </div>
                <div id="ig-hd-save-metadata-xmp-group" class="ig-hd-settings-toggle ig-hd-toggle-with-subtitle">
                  <input id="ig-hd-save-metadata-xmp" type="checkbox"${currentSettings.downloads.saveMetadataXmp ? " checked" : ""} />
                  <span>
                    <span class="ig-hd-toggle-row-title">XMP sidecar <span class="ig-hd-toggle-applies-to">· Pictures and Videos</span></span>
                    <span class="ig-hd-toggle-row-subtitle">A standalone .xmp file that Lightroom, Bridge, Photo Mechanic, Capture One, and most photo apps read the moment they open the file. Carries the caption, attribution, hashtags, and timestamp.</span>
                  </span>
                  <label class="ig-hd-toggle-track" for="ig-hd-save-metadata-xmp"></label>
                </div>
                <div id="ig-hd-save-metadata-iptc-group" class="ig-hd-settings-toggle ig-hd-toggle-with-subtitle">
                  <input id="ig-hd-save-metadata-iptc" type="checkbox"${currentSettings.downloads.saveMetadataIptc ? " checked" : ""} />
                  <span>
                    <span class="ig-hd-toggle-row-title">IPTC sidecar <span class="ig-hd-toggle-applies-to">· Pictures and Videos</span></span>
                    <span class="ig-hd-toggle-row-subtitle">Adds IPTC Core fields for headline, caption, keywords, credit, and accessibility alt text to the .xmp file. If XMP is also on, both sets of fields share the same .xmp file; if XMP is off, this writes IPTC fields only.</span>
                  </span>
                  <label class="ig-hd-toggle-track" for="ig-hd-save-metadata-iptc"></label>
                </div>
                <div id="ig-hd-save-metadata-exif-group" class="ig-hd-settings-toggle ig-hd-toggle-with-subtitle">
                  <input id="ig-hd-save-metadata-exif" type="checkbox"${currentSettings.downloads.saveMetadataXmpExif ? " checked" : ""} />
                  <span>
                    <span class="ig-hd-toggle-row-title">EXIF sidecar <span class="ig-hd-toggle-applies-to">· Pictures</span></span>
                    <span class="ig-hd-toggle-row-subtitle">Adds photo-only EXIF fields for original capture date, creator, and image description to the .xmp file. Video downloads ignore this toggle.</span>
                  </span>
                  <label class="ig-hd-toggle-track" for="ig-hd-save-metadata-exif"></label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Tab 3: Downloader -->
        <div class="ig-hd-settings-tab-panel" data-tab-panel="downloader">
          <div class="ig-hd-settings-group">
            <div class="ig-hd-settings-subheading">Download source</div>
            <div class="ig-hd-settings-section-desc">Choose whether to download from a profile or from your saved collections.</div>
            <div class="ig-hd-source-seg" id="ig-hd-source-seg">
              <div class="ig-hd-source-seg-thumb${currentSettings.downloadSource === "saved" ? " right" : ""}" id="ig-hd-source-seg-thumb"></div>
              <button class="ig-hd-source-seg-label${currentSettings.downloadSource !== "saved" ? " active" : ""}" data-source="profile">Profile</button>
              <button class="ig-hd-source-seg-label${currentSettings.downloadSource === "saved" ? " active" : ""}" data-source="saved">Saved</button>
            </div>
            <div class="ig-hd-source-content${currentSettings.downloadSource !== "saved" ? " visible" : ""}" id="ig-hd-source-profile">
              <div class="ig-hd-source-content-inner">
                <div class="ig-hd-settings-card">
                  <div class="ig-hd-settings-card-inner">
                    <div class="ig-hd-settings-row two-col">
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-profile-username">Profile username</label>
                        <input id="ig-hd-profile-username" class="ig-hd-settings-input" type="text" value="${escapeHtml(defaultUsername)}" placeholder="username" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-profile-max-items">Max items (0 = unlimited)</label>
                        <input id="ig-hd-profile-max-items" class="ig-hd-settings-input" type="number" min="0" max="20000" value="${currentSettings.profileDownload.maxItems}" />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="ig-hd-settings-list-heading">Select which content types to include when downloading from a profile.</div>
                <div id="ig-hd-download-scope-rows" class="ig-hd-scope-rows">
                  <label class="ig-hd-scope-row">
                    <input id="ig-hd-profile-include-pic" type="checkbox"${currentSettings.profileDownload.includeProfilePicture ? " checked" : ""} />
                    <span class="ig-hd-scope-row-label">${ICONS.profilePicture} Profile picture</span>
                  </label>
                  <label class="ig-hd-scope-row">
                    <input id="ig-hd-profile-include-posts" type="checkbox"${currentSettings.profileDownload.includePosts ? " checked" : ""} />
                    <span class="ig-hd-scope-row-label">${ICONS.posts} Posts</span>
                  </label>
                  <label class="ig-hd-scope-row">
                    <input id="ig-hd-profile-include-reels" type="checkbox"${currentSettings.profileDownload.includeReels ? " checked" : ""} />
                    <span class="ig-hd-scope-row-label">${ICONS.reels} Reels</span>
                  </label>
                  <label class="ig-hd-scope-row" data-scope="tagged">
                    <input id="ig-hd-profile-include-tagged" type="checkbox"${currentSettings.profileDownload.includeTagged ? " checked" : ""} />
                    <span class="ig-hd-scope-row-label">${ICONS.tagged} Tagged posts</span>
                  </label>
                  <div class="ig-hd-carousel-sub-setting${currentSettings.profileDownload.includeTagged ? " visible" : ""}" id="ig-hd-tagged-include-carousel-wrap">
                    <div class="ig-hd-carousel-sub-setting-inner">
                      <label class="ig-hd-carousel-sub-toggle">
                        <input id="ig-hd-tagged-include-carousel" type="checkbox"${currentSettings.profileDownload.taggedIncludeAllCarouselMedia ? " checked" : ""} />
                        <span>Include all carousel slides <i id="ig-hd-tip-tagged-carousel" class="ig-hd-info-tip" data-tip="">?</i></span>
                      </label>
                    </div>
                  </div>
                  <label class="ig-hd-scope-row">
                    <input id="ig-hd-profile-include-highlights" type="checkbox"${currentSettings.profileDownload.includeHighlights ? " checked" : ""} />
                    <span class="ig-hd-scope-row-label">${ICONS.highlights} Highlights</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="ig-hd-source-content${currentSettings.downloadSource === "saved" ? " visible" : ""}" id="ig-hd-source-saved">
              <div class="ig-hd-source-content-inner">
                <div class="ig-hd-settings-section-desc">Pick a saved collection to download. This uses your own bookmarked posts, not the profile you\u2019re viewing.</div>
                <div class="ig-hd-settings-card" style="margin-top:12px">
                  <div class="ig-hd-settings-card-inner">
                    <div class="ig-hd-settings-item">
                      <div class="ig-hd-settings-toggle">
                        <input id="ig-hd-saved-subfolder" type="checkbox"${currentSettings.savedDownload.useCollectionSubfolder ? " checked" : ""} />
                        <span>Use collection name as subfolder</span>
                        <label class="ig-hd-toggle-track" for="ig-hd-saved-subfolder"></label>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="ig-hd-settings-card" style="margin-top:18px">
                  <div class="ig-hd-settings-card-inner">
                    <div id="ig-hd-saved-collections-loading" class="ig-hd-saved-loading" hidden>Refreshing...</div>
                    <div id="ig-hd-saved-collections-list" class="ig-hd-saved-collections-list"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="ig-hd-settings-group" id="ig-hd-date-filter-group">
            <div class="ig-hd-settings-subheading">Date filter</div>
            <div class="ig-hd-settings-section-desc">Restrict bulk downloads to media posted within a specific time window. When disabled, all matching posts are downloaded regardless of date.</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-item">
                  <div class="ig-hd-settings-toggle">
                    <input id="ig-hd-date-filter-enabled" type="checkbox"${currentSettings.profileDownload.dateFilter.enabled ? " checked" : ""} />
                    <span>Enable date filter</span>
                    <label class="ig-hd-toggle-track" for="ig-hd-date-filter-enabled"></label>
                  </div>
                </div>
              </div>
            </div>
            <div class="ig-hd-date-filter-body${currentSettings.profileDownload.dateFilter.enabled ? "" : " collapsed"}">
              <div class="ig-hd-date-filter-body-inner">
                <div class="ig-hd-settings-card">
                  <div class="ig-hd-settings-card-inner">
                    <div class="ig-hd-settings-item">
                      <label class="ig-hd-settings-circle" for="ig-hd-date-filter-mode-after">
                        <span>After a date</span>
                        <input id="ig-hd-date-filter-mode-after" type="checkbox" data-filter-mode="after"${currentSettings.profileDownload.dateFilter.mode === "after" ? " checked" : ""} />
                      </label>
                    </div>
                    <div class="ig-hd-settings-item">
                      <label class="ig-hd-settings-circle" for="ig-hd-date-filter-mode-before">
                        <span>Before a date</span>
                        <input id="ig-hd-date-filter-mode-before" type="checkbox" data-filter-mode="before"${currentSettings.profileDownload.dateFilter.mode === "before" ? " checked" : ""} />
                      </label>
                    </div>
                    <div class="ig-hd-settings-item">
                      <label class="ig-hd-settings-circle" for="ig-hd-date-filter-mode-between">
                        <span>Between two dates</span>
                        <input id="ig-hd-date-filter-mode-between" type="checkbox" data-filter-mode="between"${currentSettings.profileDownload.dateFilter.mode === "between" ? " checked" : ""} />
                      </label>
                    </div>
                  </div>
                </div>
                <div id="ig-hd-date-filter-mode-help" class="ig-hd-settings-help"></div>
                <div class="ig-hd-settings-card">
                  <div class="ig-hd-settings-card-inner">
                    <div class="ig-hd-settings-row two-col ig-hd-date-filter-dates-row">
                      <div class="ig-hd-settings-row ig-hd-date-filter-fields--start">
                        <label class="ig-hd-settings-label" for="ig-hd-date-filter-start">Start date</label>
                        <input id="ig-hd-date-filter-start" class="ig-hd-settings-input" type="date" value="${escapeHtml(currentSettings.profileDownload.dateFilter.startDate)}" />
                      </div>
                      <div class="ig-hd-settings-row ig-hd-date-filter-fields--end">
                        <label class="ig-hd-settings-label" for="ig-hd-date-filter-end">End date</label>
                        <input id="ig-hd-date-filter-end" class="ig-hd-settings-input" type="date" value="${escapeHtml(currentSettings.profileDownload.dateFilter.endDate)}" />
                      </div>
                    </div>
                    <p class="ig-hd-date-filter-warning" hidden>End date is before start date — no items will match.</p>
                  </div>
                </div>
                <div class="ig-hd-settings-help">Dates use your local timezone. Media is filtered by its upload timestamp on Instagram.</div>
              </div>
            </div>
          </div>
          <div class="ig-hd-settings-group" id="ig-hd-skip-history-group"${currentSettings.downloads.skipPreviouslyDownloaded ? "" : " hidden"}>
            <div class="ig-hd-skip-history-note">
              <span class="ig-hd-skip-history-count" id="ig-hd-skip-history-count">—</span>
              <span id="ig-hd-skip-history-desc">items in download history — matching media in this batch will be skipped.</span>
            </div>
          </div>
          <div class="ig-hd-settings-group">
            <div class="ig-hd-settings-subheading">Pacing &amp; limits</div>
            <div class="ig-hd-settings-section-desc">Control download speed to reduce the risk of rate-limiting or account flags. Aggressive settings download faster but carry more risk.</div>
            <div class="ig-hd-settings-card">
              <div class="ig-hd-settings-card-inner">
                <div class="ig-hd-settings-row two-col">
                  <div class="ig-hd-settings-row">
                    <label class="ig-hd-settings-label" for="ig-hd-risk-preset">Preset <i id="ig-hd-tip-risk-preset" class="ig-hd-info-tip" data-tip="">?</i></label>
                    <select id="ig-hd-risk-preset" class="ig-hd-settings-select">
                      <option value="safe"${currentSettings.riskPreset === "safe" ? " selected" : ""}>Cautious</option>
                      <option value="balanced"${currentSettings.riskPreset === "balanced" ? " selected" : ""}>Balanced</option>
                      <option value="aggressive"${currentSettings.riskPreset === "aggressive" ? " selected" : ""}>Aggressive</option>
                      <option value="custom"${currentSettings.riskPreset === "custom" ? " selected" : ""}>Custom</option>
                    </select>
                  </div>
                  <div class="ig-hd-settings-row">
                    <label class="ig-hd-settings-label" for="ig-hd-safety-threshold">Pacing starts at <i id="ig-hd-tip-safety-threshold" class="ig-hd-info-tip" data-tip="">?</i></label>
                    <input id="ig-hd-safety-threshold" class="ig-hd-settings-input" type="number" min="1" max="20000" value="${currentSettings.safetyThresholdCount}" placeholder="20" />
                    <div class="ig-hd-settings-help">Smaller batches run without pacing.</div>
                  </div>
                </div>
                <div id="ig-hd-policy-details" class="ig-hd-preset-ref">
                  <div class="ig-hd-settings-item">
                    <div id="ig-hd-custom-policy" class="ig-hd-settings-row two-col">
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-delay-min">Min delay <i id="ig-hd-tip-delay-min" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-delay-min" class="ig-hd-settings-input" type="number" min="0" max="600000" value="${custom.minDelayMs}" placeholder="2000" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-delay-max">Max delay <i id="ig-hd-tip-delay-max" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-delay-max" class="ig-hd-settings-input" type="number" min="0" max="600000" value="${custom.maxDelayMs}" placeholder="4500" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-cooldown-every">Cooldown every <i id="ig-hd-tip-cooldown-every" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-cooldown-every" class="ig-hd-settings-input" type="number" min="0" max="5000" value="${custom.cooldownEvery}" placeholder="30" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-cooldown-ms">Cooldown length <i id="ig-hd-tip-cooldown-ms" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-cooldown-ms" class="ig-hd-settings-input" type="number" min="0" max="3600000" value="${custom.cooldownMs}" placeholder="120000" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-retry-count">Retries <i id="ig-hd-tip-retry-count" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-retry-count" class="ig-hd-settings-input" type="number" min="0" max="8" value="${custom.retryCount}" placeholder="2" />
                      </div>
                      <div class="ig-hd-settings-row">
                        <label class="ig-hd-settings-label" for="ig-hd-retry-backoff">Retry backoff <i id="ig-hd-tip-retry-backoff" class="ig-hd-info-tip" data-tip="">?</i></label>
                        <input id="ig-hd-retry-backoff" class="ig-hd-settings-input" type="number" min="0" max="600000" value="${custom.retryBackoffMs}" placeholder="3500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="ig-hd-settings-panel-actions">
            <div class="ig-hd-settings-checkbox">
              <input id="ig-hd-risk-ack" type="checkbox"${getRiskAckSessionAcknowledged() ? " checked" : ""} />
              <span>I accept the rate-limit/account risk. <i id="ig-hd-tip-risk-ack" class="ig-hd-info-tip" data-tip="">?</i></span>
            </div>
            <button id="ig-hd-profile-download" class="ig-hd-settings-btn primary ig-hd-download-btn" type="button">Start Download</button>
          </div>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    overlay.appendChild(floatingTooltip);
    document.body.appendChild(overlay);

    // Tab switching
    modal.querySelector(".ig-hd-settings-tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".ig-hd-settings-tab");
      if (!tab) return;
      modal.querySelectorAll(".ig-hd-settings-tab").forEach((t) => t.classList.remove("active"));
      modal.querySelectorAll(".ig-hd-settings-tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      modal.querySelector(`[data-tab-panel="${tab.dataset.tab}"]`).classList.add("active");
      requestAnimationFrame(() => { modal.scrollTop = 0; });
      if (tab.dataset.tab === "downloader") {
        scheduleTaggedCarouselAlignment();
        updateSkipHistoryDisplay();
      }
    });

    // Keep password managers from treating settings fields as login inputs.
    modal.setAttribute("data-bwignore", "true");
    modal.querySelectorAll("input, select, textarea").forEach((field) => {
      field.setAttribute("data-bwignore", "true");
    });

    const presetSelect = modal.querySelector("#ig-hd-risk-preset");
    const customPolicyWrap = modal.querySelector("#ig-hd-custom-policy");
    const hotkeyInput = modal.querySelector("#ig-hd-hotkey");
    const hotkeyRecordButton = modal.querySelector("#ig-hd-hotkey-record");
    const hotkeyDefaultButton = modal.querySelector("#ig-hd-hotkey-default");
    const showSettingsLauncherToggle = modal.querySelector("#ig-hd-show-settings-launcher");
    const androidCompatModeToggle = modal.querySelector("#ig-hd-android-compat-mode");
    const saveLocationGroup = modal.querySelector("#ig-hd-save-location-group");
    const customFolderToggle = modal.querySelector("#ig-hd-use-custom-folder");
    const customFolderBody = modal.querySelector("#ig-hd-custom-folder-body");
    const folderLabelInput = modal.querySelector("#ig-hd-folder-label");
    const folderInputWrap = modal.querySelector("#ig-hd-folder-wrap");
    const folderClearButton = modal.querySelector("#ig-hd-folder-clear");
    const folderHelpText = modal.querySelector("#ig-hd-folder-help");
    function syncFolderInputPathPrefix() {
      folderInputWrap?.classList.toggle("has-value", !!folderLabelInput?.value?.trim());
    }
    syncFolderInputPathPrefix();
    const filenameTemplateInput = modal.querySelector("#ig-hd-filename-template");
    const patternEditorWrap = modal.querySelector("#ig-hd-pattern-editor-wrap");
    const patternOverlay = modal.querySelector("#ig-hd-pattern-overlay");
    const patternClearBtn = modal.querySelector("#ig-hd-pattern-clear");
    const patternResetAction = modal.querySelector("#ig-hd-filename-reset");
    const patternClearAction = modal.querySelector("#ig-hd-filename-clear");
    const patternAutocomplete = modal.querySelector("#ig-hd-pattern-autocomplete");
    const templatePreview = modal.querySelector("#ig-hd-template-preview");
    const templatePreviewNote = modal.querySelector("#ig-hd-preview-note");
    const previewDocFill = modal.querySelector("#ig-hd-preview-doc-fill");
    const previewDocFold = modal.querySelector("#ig-hd-preview-doc-fold");
    const separatorGrid = modal.querySelector("#ig-hd-separator-grid");
    const bulkZipGroup = modal.querySelector("#ig-hd-bulk-zip-group");
    const bulkZipToggle = modal.querySelector("#ig-hd-bulk-zip");
    const typeSubfoldersGroup = modal.querySelector("#ig-hd-type-subfolders-group");
    const typeSubfoldersToggle = modal.querySelector("#ig-hd-type-subfolders");
    const saveMetadataJsonGroup = modal.querySelector("#ig-hd-save-metadata-json-group");
    const saveMetadataJsonToggle = modal.querySelector("#ig-hd-save-metadata-json");
    const saveMetadataXmpGroup = modal.querySelector("#ig-hd-save-metadata-xmp-group");
    const saveMetadataXmpToggle = modal.querySelector("#ig-hd-save-metadata-xmp");
    const saveMetadataIptcGroup = modal.querySelector("#ig-hd-save-metadata-iptc-group");
    const saveMetadataIptcToggle = modal.querySelector("#ig-hd-save-metadata-iptc");
    const saveMetadataExifGroup = modal.querySelector("#ig-hd-save-metadata-exif-group");
    const saveMetadataExifToggle = modal.querySelector("#ig-hd-save-metadata-exif");
    const skipPreviouslyDownloadedToggle = modal.querySelector("#ig-hd-skip-previously-downloaded");
    const amstramgramUrlInput = modal.querySelector("#ig-hd-amstramgram-url");
    const amstramgramSyncButton = modal.querySelector("#ig-hd-amstramgram-sync");
    const delayMinInput = modal.querySelector("#ig-hd-delay-min");
    const delayMaxInput = modal.querySelector("#ig-hd-delay-max");
    const safetyThresholdInput = modal.querySelector("#ig-hd-safety-threshold");
    const cooldownEveryInput = modal.querySelector("#ig-hd-cooldown-every");
    const cooldownMsInput = modal.querySelector("#ig-hd-cooldown-ms");
    const retryCountInput = modal.querySelector("#ig-hd-retry-count");
    const retryBackoffInput = modal.querySelector("#ig-hd-retry-backoff");
    const profileUsernameInput = modal.querySelector("#ig-hd-profile-username");
    const profileMaxItemsInput = modal.querySelector("#ig-hd-profile-max-items");
    const includePostsToggle = modal.querySelector("#ig-hd-profile-include-posts");
    const includeReelsToggle = modal.querySelector("#ig-hd-profile-include-reels");
    const includeHighlightsToggle = modal.querySelector("#ig-hd-profile-include-highlights");
    const includeProfilePictureToggle = modal.querySelector("#ig-hd-profile-include-pic");
    const includeTaggedToggle = modal.querySelector("#ig-hd-profile-include-tagged");
    const taggedIncludeCarouselWrap = modal.querySelector("#ig-hd-tagged-include-carousel-wrap");
    const taggedIncludeCarouselToggle = modal.querySelector("#ig-hd-tagged-include-carousel");
    const dateFilterGroup = modal.querySelector("#ig-hd-date-filter-group");
    const dateFilterEnabledToggle = modal.querySelector("#ig-hd-date-filter-enabled");
    const dateFilterModeAfter = modal.querySelector("#ig-hd-date-filter-mode-after");
    const dateFilterModeBefore = modal.querySelector("#ig-hd-date-filter-mode-before");
    const dateFilterModeBetween = modal.querySelector("#ig-hd-date-filter-mode-between");
    const dateFilterModeCheckboxes = [dateFilterModeAfter, dateFilterModeBefore, dateFilterModeBetween];
    const dateFilterStartInput = modal.querySelector("#ig-hd-date-filter-start");
    const dateFilterEndInput = modal.querySelector("#ig-hd-date-filter-end");
    const dateFilterBody = modal.querySelector(".ig-hd-date-filter-body");
    const dateFilterStartWrap = modal.querySelector(".ig-hd-date-filter-fields--start");
    const dateFilterEndWrap = modal.querySelector(".ig-hd-date-filter-fields--end");
    const dateFilterDatesRow = modal.querySelector(".ig-hd-date-filter-dates-row");
    const dateFilterWarning = modal.querySelector(".ig-hd-date-filter-warning");
    const dateFilterModeHelp = modal.querySelector("#ig-hd-date-filter-mode-help");
    const riskAckInput = modal.querySelector("#ig-hd-risk-ack");
    const sourceSegToggle = modal.querySelector("#ig-hd-source-seg");
    const sourceSegThumb = modal.querySelector("#ig-hd-source-seg-thumb");
    const sourceProfileContent = modal.querySelector("#ig-hd-source-profile");
    const sourceSavedContent = modal.querySelector("#ig-hd-source-saved");
    const savedCollectionsLoading = modal.querySelector("#ig-hd-saved-collections-loading");
    const savedCollectionsList = modal.querySelector("#ig-hd-saved-collections-list");
    const savedSubfolderToggle = modal.querySelector("#ig-hd-saved-subfolder");
    let activeDownloadSource = currentSettings.downloadSource || "profile";
    let savedCollectionsCache = null;
    const speedTipNodes = {
      preset: modal.querySelector("#ig-hd-tip-risk-preset"),
      safetyThreshold: modal.querySelector("#ig-hd-tip-safety-threshold"),
      delayMin: modal.querySelector("#ig-hd-tip-delay-min"),
      delayMax: modal.querySelector("#ig-hd-tip-delay-max"),
      cooldownEvery: modal.querySelector("#ig-hd-tip-cooldown-every"),
      cooldownMs: modal.querySelector("#ig-hd-tip-cooldown-ms"),
      retryCount: modal.querySelector("#ig-hd-tip-retry-count"),
      retryBackoff: modal.querySelector("#ig-hd-tip-retry-backoff"),
      riskAck: modal.querySelector("#ig-hd-tip-risk-ack"),
      skipDownloaded: modal.querySelector("#ig-hd-tip-skip-downloaded"),
      taggedCarousel: modal.querySelector("#ig-hd-tip-tagged-carousel")
    };

    const videoContainerCheckboxes = [
      modal.querySelector("#ig-hd-video-container-mp4"),
      modal.querySelector("#ig-hd-video-container-mkv")
    ];
    const videoContainerTipNodes = {
      mp4: modal.querySelector("#ig-hd-tip-video-container-mp4"),
      mkv: modal.querySelector("#ig-hd-tip-video-container-mkv")
    };
    if (videoContainerTipNodes.mp4) {
      videoContainerTipNodes.mp4.setAttribute("data-tip", "Why pick MP4: universal compatibility. Every device, every app, every browser opens .mp4 without thought — iPhone Photos, Android gallery, Discord, web uploads, ancient TVs. Trade-off: AV1 and VP9 inside MP4 are technically valid but slightly less standard than putting them in MKV. If your goal is sharing or quick viewing, this is the right pick.");
    }
    if (videoContainerTipNodes.mkv) {
      videoContainerTipNodes.mkv.setAttribute("data-tip", "Why pick MKV: better media preservation. Matroska is the container modern codecs (VP9, AV1) were designed for — it's the standard format in Plex, Jellyfin, mpv, and home-media archives. Trade-off: iPhone Photos and some older devices can't open .mkv directly, so it's a worse choice if you'll share or quickly view the files. Pick this if you're building a collection.");
    }

    function getCheckedVideoContainer() {
      const checked = videoContainerCheckboxes.find((cb) => cb && cb.checked);
      const value = checked ? checked.getAttribute("data-video-container") : "";
      return value === "mkv" ? "mkv" : "mp4";
    }

    let activeInfoTip = null;

    function positionActiveInfoTooltip() {
      if (!activeInfoTip || !activeInfoTip.isConnected || !floatingTooltip.textContent) return;
      const position = computeSettingsTooltipPosition(
        activeInfoTip.getBoundingClientRect(),
        floatingTooltip.getBoundingClientRect(),
        window.innerWidth || document.documentElement?.clientWidth || 0,
        window.innerHeight || document.documentElement?.clientHeight || 0
      );
      floatingTooltip.style.left = `${position.left}px`;
      floatingTooltip.style.top = `${position.top}px`;
      floatingTooltip.dataset.placement = position.placement;
    }

    function hideInfoTooltip() {
      if (activeInfoTip) {
        activeInfoTip.removeAttribute("data-ig-hd-tooltip-open");
      }
      activeInfoTip = null;
      floatingTooltip.textContent = "";
      floatingTooltip.classList.remove("visible");
      floatingTooltip.style.left = "";
      floatingTooltip.style.top = "";
      delete floatingTooltip.dataset.placement;
    }

    function showInfoTooltip(node, overrideText) {
      const safeNode = node && node.nodeType === 1 ? node : null;
      const text = overrideText || safeNode?.getAttribute("data-tip") || "";
      if (!safeNode || !text.trim()) {
        hideInfoTooltip();
        return;
      }
      if (activeInfoTip && activeInfoTip !== safeNode) {
        activeInfoTip.removeAttribute("data-ig-hd-tooltip-open");
      }
      activeInfoTip = safeNode;
      activeInfoTip.setAttribute("data-ig-hd-tooltip-open", "true");
      floatingTooltip.textContent = text;
      floatingTooltip.classList.add("visible");
      positionActiveInfoTooltip();
    }

    const handleTooltipViewportChange = () => {
      if (!activeInfoTip) return;
      positionActiveInfoTooltip();
    };

    window.addEventListener("resize", handleTooltipViewportChange);
    window.addEventListener("scroll", handleTooltipViewportChange, true);
    settingsTooltipCleanup = () => {
      hideInfoTooltip();
      window.removeEventListener("resize", handleTooltipViewportChange);
      window.removeEventListener("scroll", handleTooltipViewportChange, true);
    };

    [
      ...Object.values(speedTipNodes),
      ...Object.values(videoContainerTipNodes)
    ].forEach((node) => {
      if (!node) return;
      node.setAttribute("tabindex", "0");
      node.addEventListener("mouseenter", () => showInfoTooltip(node));
      node.addEventListener("mouseleave", hideInfoTooltip);
      node.addEventListener("focus", () => showInfoTooltip(node));
      node.addEventListener("blur", hideInfoTooltip);
    });
    const policyInputs = [
      delayMinInput,
      delayMaxInput,
      cooldownEveryInput,
      cooldownMsInput,
      retryCountInput,
      retryBackoffInput
    ];
    const profileDownloadButton = modal.querySelector("#ig-hd-profile-download");
    syncRiskAckControls(riskAckInput, profileDownloadButton);

    // === Skip history display ===
    const skipHistoryGroup = modal.querySelector("#ig-hd-skip-history-group");
    const skipHistoryCountEl = modal.querySelector("#ig-hd-skip-history-count");
    const skipHistoryDescEl = modal.querySelector("#ig-hd-skip-history-desc");
    let _skipHistoryReqId = 0;

    function buildShortcodeHistorySet() {
      ensureDownloadHistoryLoaded();
      const set = new Set();
      for (const key of downloadHistoryOrder) {
        if (key.startsWith("shortcode:")) {
          const sc = key.split("|")[0].slice("shortcode:".length);
          if (sc) set.add(sc);
        }
      }
      return set;
    }

    function showSkipHistoryFallback() {
      ensureDownloadHistoryLoaded();
      if (skipHistoryCountEl) skipHistoryCountEl.textContent = downloadHistoryOrder.length.toLocaleString();
      if (skipHistoryDescEl) skipHistoryDescEl.textContent = "items in download history — matching media in this batch will be skipped.";
    }

    async function updateSkipHistoryDisplay() {
      const enabled = !!skipPreviouslyDownloadedToggle?.checked;
      if (skipHistoryGroup) skipHistoryGroup.hidden = !enabled;
      if (!enabled || !skipHistoryCountEl) return;

      const amstramgramUrl = sanitizeAmstramgramUrl(
        amstramgramUrlInput?.value?.trim() || USER_SETTINGS?.downloads?.amstramgramUrl || ""
      );
      const isSaved = activeDownloadSource === "saved";
      const rawUsername = (profileUsernameInput?.value || "").trim();
      const username = !isSaved && /^[A-Za-z0-9._]+$/.test(rawUsername) ? rawUsername : "";

      if (!amstramgramUrl || !username) {
        showSkipHistoryFallback();
        return;
      }

      const myId = ++_skipHistoryReqId;
      if (skipHistoryCountEl) skipHistoryCountEl.textContent = "…";
      if (skipHistoryDescEl) skipHistoryDescEl.textContent = `items from @${username} already downloaded — these will be skipped.`;

      try {
        const resp = await GramPlatform.fetchUrl({
          method: "GET",
          url: `${amstramgramUrl}/api/accounts/${encodeURIComponent(username)}/posts`,
          withCredentials: false,
          timeout: 8000
        });
        if (myId !== _skipHistoryReqId) return;
        if (resp.status !== 200) { showSkipHistoryFallback(); return; }
        const data = JSON.parse(resp.responseText);
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        const scSet = buildShortcodeHistorySet();
        let count = 0;
        for (const post of posts) {
          if (post.shortcode && scSet.has(String(post.shortcode).trim())) count++;
        }
        if (myId === _skipHistoryReqId) {
          if (skipHistoryCountEl) skipHistoryCountEl.textContent = count.toLocaleString();
        }
      } catch {
        if (myId === _skipHistoryReqId) showSkipHistoryFallback();
      }
    }

    let _skipHistoryDebounceTimer = null;
    function scheduleSkipHistoryUpdate() {
      clearTimeout(_skipHistoryDebounceTimer);
      _skipHistoryDebounceTimer = setTimeout(updateSkipHistoryDisplay, 600);
    }

    updateSkipHistoryDisplay();
    skipPreviouslyDownloadedToggle?.addEventListener("change", updateSkipHistoryDisplay);
    profileUsernameInput?.addEventListener("input", scheduleSkipHistoryUpdate);
    amstramgramUrlInput?.addEventListener("input", scheduleSkipHistoryUpdate);

    // === Download source helpers ===
    function setDownloadSource(source) {
      activeDownloadSource = source;
      const isSaved = source === "saved";
      // Update segmented toggle
      if (sourceSegThumb) sourceSegThumb.classList.toggle("right", isSaved);
      const labels = sourceSegToggle?.querySelectorAll(".ig-hd-source-seg-label");
      if (labels) {
        labels[0]?.classList.toggle("active", !isSaved);
        labels[1]?.classList.toggle("active", isSaved);
      }
      // Toggle content areas
      if (sourceProfileContent) sourceProfileContent.classList.toggle("visible", !isSaved);
      if (sourceSavedContent) sourceSavedContent.classList.toggle("visible", isSaved);
      // Hide date filter section in saved mode
      if (dateFilterGroup) dateFilterGroup.style.display = isSaved ? "none" : "";
      // Update download button label
      if (profileDownloadButton) {
        profileDownloadButton.textContent = "Start Download";
      }
      updateSkipHistoryDisplay();
    }

    function renderSavedCollections(collections) {
      if (!savedCollectionsList) return;
      const previouslySelected = USER_SETTINGS.savedDownload.selectedCollections || [];
      savedCollectionsList.innerHTML = "";
      savedCollectionsList.className = "ig-hd-scope-rows";
      const defaultToAll = previouslySelected.length === 0;
      for (const col of collections) {
        const isSelected = defaultToAll ? col.id === "ALL_MEDIA_AUTO_COLLECTION" : previouslySelected.includes(col.id);
        const item = document.createElement("label");
        item.className = "ig-hd-scope-row";
        item.dataset.collectionId = col.id;
        item.innerHTML = `<input type="radio" class="ig-hd-scope-checkbox" name="ig-hd-collection" data-collection-id="${escapeHtml(col.id)}"${isSelected ? " checked" : ""} />`
          + `<span>${escapeHtml(col.name)} (${col.mediaCount})</span>`;
        savedCollectionsList.appendChild(item);
      }
      applyAllPostsDimming();
    }

    function applyAllPostsDimming() {
      if (!savedCollectionsList) return;
      const allPostsRadio = savedCollectionsList.querySelector('[data-collection-id="ALL_MEDIA_AUTO_COLLECTION"]');
      if (!allPostsRadio) return;
      const allPostsActive = allPostsRadio.checked;
      const allRadios = savedCollectionsList.querySelectorAll('input[type="radio"]');
      for (const radio of allRadios) {
        if (radio === allPostsRadio) continue;
        const row = radio.closest(".ig-hd-scope-row");
        if (row) row.style.opacity = allPostsActive ? "0.35" : "";
      }
    }

    function readSavedDownloadSettingsFromInputs() {
      return {
        selectedCollections: readSelectedSavedCollections().map(c => c.id),
        useCollectionSubfolder: savedSubfolderToggle?.checked !== false
      };
    }

    function readSelectedSavedCollections() {
      if (!savedCollectionsList) return [];
      const selected = [];
      const radios = savedCollectionsList.querySelectorAll('input[type="radio"]:checked');
      for (const radio of radios) {
        const id = radio.dataset.collectionId;
        if (!id) continue;
        const row = radio.closest(".ig-hd-scope-row");
        const labelEl = row?.querySelector("span");
        const name = labelEl ? labelEl.textContent.replace(/\s*\(\d+\)\s*$/, "").trim() : id;
        selected.push({ id, name });
      }
      return selected;
    }

    async function loadSavedCollections() {
      if (savedCollectionsCache) {
        renderSavedCollections(savedCollectionsCache);
        return;
      }
      if (savedCollectionsLoading) savedCollectionsLoading.hidden = false;
      if (savedCollectionsList) savedCollectionsList.innerHTML = "";
      try {
        const appId = getAppID();
        const collections = await fetchSavedCollections(appId);
        savedCollectionsCache = collections;
        renderSavedCollections(collections);
      } catch (err) {
        console.error("[Amstragram] Failed to load saved collections:", err);
        if (savedCollectionsList) {
          savedCollectionsList.innerHTML = '<div class="ig-hd-saved-loading">Could not load collections. Switch to Profile and back to Saved to retry.</div>';
        }
      } finally {
        if (savedCollectionsLoading) savedCollectionsLoading.hidden = true;
      }
    }

    savedCollectionsList?.addEventListener("change", (e) => {
      if (e.target?.type !== "radio") return;
      applyAllPostsDimming();
      triggerImmediateAutosave();
    });
    savedSubfolderToggle?.addEventListener("change", () => {
      triggerImmediateAutosave();
    });

    // Initialize download source state
    setDownloadSource(activeDownloadSource);
    if (activeDownloadSource === "saved") {
      loadSavedCollections();
    }

    // Segmented toggle click handler
    if (sourceSegToggle) {
      sourceSegToggle.addEventListener("click", (e) => {
        const label = e.target.closest(".ig-hd-source-seg-label");
        if (!label) return;
        const source = label.dataset.source;
        if (!source || source === activeDownloadSource) return;
        setDownloadSource(source);
        if (source === "saved") {
          loadSavedCollections();
        }
        triggerImmediateAutosave();
      });
    }

    function syncCustomPolicyVisibility() {
      customPolicyWrap.style.display = "grid";
    }

    function setToggleGroupDimmed(group, dimmed) {
      if (group) {
        group.style.opacity = dimmed ? "0.6" : "1";
      }
    }

    function isCustomFolderActive() {
      return !!customFolderToggle?.checked && !androidCompatModeToggle?.checked && supportsDirectoryPicker();
    }

    function syncTypeSubfoldersControls() {
      if (!typeSubfoldersToggle || !typeSubfoldersGroup) return;
      const androidCompatEnabled = !!androidCompatModeToggle?.checked;
      const effective = !!bulkZipToggle?.checked || isCustomFolderActive();
      typeSubfoldersToggle.disabled = androidCompatEnabled || !effective;
      setToggleGroupDimmed(typeSubfoldersGroup, typeSubfoldersToggle.disabled);
    }

    function syncCustomFolderControls() {
      const androidCompatEnabled = !!androidCompatModeToggle?.checked;
      const pickerSupported = supportsDirectoryPicker();
      const isFirefox = !pickerSupported && /Firefox\//.test(navigator.userAgent);
      if (androidCompatEnabled) {
        customFolderToggle.checked = false;
      }
      if (!pickerSupported) {
        customFolderToggle.checked = false;
      }
      const enabled = isCustomFolderActive();
      customFolderToggle.disabled = androidCompatEnabled || !pickerSupported;
      folderClearButton.disabled = androidCompatEnabled || !enabled;
      if (customFolderBody) {
        customFolderBody.style.display = customFolderToggle.checked ? "block" : "none";
      }
      if (isFirefox && saveLocationGroup) {
        const originalCard = saveLocationGroup.querySelector(".ig-hd-settings-card:not(.ig-hd-firefox-info-card)");
        if (originalCard) originalCard.style.display = "none";
        if (!saveLocationGroup.querySelector(".ig-hd-firefox-info-card")) {
          const infoCard = document.createElement("div");
          infoCard.className = "ig-hd-settings-card ig-hd-firefox-info-card";
          infoCard.style.marginTop = "18px";
          infoCard.innerHTML = `
            <div class="ig-hd-settings-card-inner">
              <div class="ig-hd-settings-card-heading">Firefox controls the save location</div>
              <p class="ig-hd-firefox-info-body">Custom save folders require a Chromium-based browser (Chrome, Edge, Brave, Arc, Vivaldi, Opera). Firefox doesn't expose the download folder API to userscripts.</p>
            </div>`;
          if (folderHelpText && folderHelpText.parentNode === saveLocationGroup) {
            saveLocationGroup.insertBefore(infoCard, folderHelpText);
          } else {
            saveLocationGroup.appendChild(infoCard);
          }
        }
        if (folderHelpText) {
          folderHelpText.style.display = "";
          folderHelpText.textContent = "Change it in Firefox Settings → General → Downloads.";
        }
      } else {
        if (folderHelpText) {
          folderHelpText.style.display = "";
          if (!pickerSupported && !androidCompatEnabled && navigator.brave) {
            folderHelpText.textContent = "Brave may block this API. Go to brave://flags/#file-system-access-api, set it to Enabled, and restart Brave.";
          } else {
            folderHelpText.textContent = "Chromium only (Chrome, Edge, Brave). Firefox always uses the default download folder.";
          }
        }
      }
      syncTypeSubfoldersControls();
    }

    function syncAndroidCompatibilityControls() {
      const enabled = !!androidCompatModeToggle?.checked;
      const metadataPairs = [
        [saveMetadataJsonToggle, saveMetadataJsonGroup],
        [saveMetadataXmpToggle, saveMetadataXmpGroup],
        [saveMetadataIptcToggle, saveMetadataIptcGroup],
        [saveMetadataExifToggle, saveMetadataExifGroup]
      ];
      if (enabled) {
        customFolderToggle.checked = false;
        bulkZipToggle.checked = false;
        if (typeSubfoldersToggle) typeSubfoldersToggle.checked = false;
        for (const [toggle] of metadataPairs) {
          if (toggle) toggle.checked = false;
        }
      }
      bulkZipToggle.disabled = enabled;
      setToggleGroupDimmed(bulkZipGroup, bulkZipToggle.disabled);
      for (const [toggle, group] of metadataPairs) {
        if (toggle && group) {
          toggle.disabled = enabled;
          setToggleGroupDimmed(group, enabled);
        }
      }
      syncCustomFolderControls();
    }

    function readProfileSelectionFromInputs() {
      return sanitizeProfileDownloadSelection({
        includePosts: !!includePostsToggle?.checked,
        includeReels: !!includeReelsToggle?.checked,
        includeHighlights: !!includeHighlightsToggle?.checked,
        includeTagged: !!includeTaggedToggle?.checked,
        includeProfilePicture: !!includeProfilePictureToggle?.checked,
        taggedIncludeAllCarouselMedia: !!taggedIncludeCarouselToggle?.checked
      });
    }

    function getDateFilterMode() {
      if (dateFilterModeAfter?.checked) return "after";
      if (dateFilterModeBefore?.checked) return "before";
      if (dateFilterModeBetween?.checked) return "between";
      return "after";
    }

    const DATE_FILTER_MODE_HELP = {
      after: "Download only media posted after your chosen date.",
      before: "Download only media posted before your chosen date.",
      between: "Download only media posted within your chosen date range."
    };

    function readDateFilterFromInputs() {
      return normalizeDateFilter({
        enabled: !!dateFilterEnabledToggle?.checked,
        mode: getDateFilterMode(),
        startDate: dateFilterStartInput?.value,
        endDate: dateFilterEndInput?.value
      });
    }

    function syncDateFilterVisibility() {
      const mode = getDateFilterMode();
      const state = computeDateFilterVisibilityState({
        enabled: !!dateFilterEnabledToggle?.checked,
        mode,
        startDate: dateFilterStartInput?.value || "",
        endDate: dateFilterEndInput?.value || ""
      });
      if (dateFilterBody) dateFilterBody.classList.toggle("collapsed", state.bodyHidden);
      if (dateFilterStartWrap) dateFilterStartWrap.hidden = state.startHidden;
      if (dateFilterEndWrap) dateFilterEndWrap.hidden = state.endHidden;
      if (dateFilterDatesRow) {
        dateFilterDatesRow.classList.toggle("ig-hd-date-filter-dates-row--single", state.single);
      }
      if (dateFilterWarning) dateFilterWarning.hidden = state.warningHidden;
      if (dateFilterModeHelp) dateFilterModeHelp.textContent = DATE_FILTER_MODE_HELP[mode] || "";
    }

    function syncProfileDownloadButtonLabel() {
      if (profileDownloadButton) {
        profileDownloadButton.textContent = "Start Download";
      }
    }

    function syncScopePillStates() {
      // No-op: rows use native :checked styling, no class toggle needed.
    }

    function syncTaggedCarouselAlignment() {
      // No-op: vertical rows don't need horizontal offset calculation.
    }

    function scheduleTaggedCarouselAlignment() {
      // No-op: vertical rows don't need horizontal offset calculation.
    }

    function syncTaggedProfileControls() {
      const isTaggedEnabled = !!includeTaggedToggle?.checked;
      if (taggedIncludeCarouselToggle) {
        taggedIncludeCarouselToggle.disabled = !isTaggedEnabled;
      }
      if (taggedIncludeCarouselWrap) {
        taggedIncludeCarouselWrap.classList.toggle("visible", isTaggedEnabled);
        syncTaggedCarouselAlignment();
      }
      syncScopePillStates();
    }

    function syncProfileTargetControls() {
      syncTaggedProfileControls();
      syncProfileDownloadButtonLabel();
    }

    function getProfileDownloadSelectionForSave() {
      const selection = readProfileSelectionFromInputs();
      if (!selection.includeTagged) {
        return {
          ...selection,
          taggedIncludeAllCarouselMedia: false
        };
      }
      return selection;
    }

    function getProfileDownloadSelectionForStart() {
      const selection = readProfileSelectionFromInputs();
      if (!selection.includeTagged) {
        return {
          ...selection,
          taggedIncludeAllCarouselMedia: false
        };
      }
      return selection;
    }

    function readPolicyFromInputs() {
      return sanitizePolicy({
        minDelayMs: delayMinInput.value,
        maxDelayMs: delayMaxInput.value,
        cooldownEvery: cooldownEveryInput.value,
        cooldownMs: cooldownMsInput.value,
        retryCount: retryCountInput.value,
        retryBackoffMs: retryBackoffInput.value
      });
    }

    function formatTooltipDuration(ms) {
      const rounded = Math.max(0, Math.round(Number(ms) || 0));
      if (rounded < 1000) return `${rounded} ms`;
      return formatDurationShort(rounded);
    }

    function getCooldownHitCount(totalFiles, cooldownEvery) {
      const total = Math.max(0, Math.floor(Number(totalFiles) || 0));
      const every = Math.max(0, Math.floor(Number(cooldownEvery) || 0));
      if (total <= 1 || every <= 0) return 0;
      return Math.floor((total - 1) / every);
    }

    function estimatePacingWaitMs(totalFiles, policy) {
      const total = Math.max(0, Math.floor(Number(totalFiles) || 0));
      if (total <= 1) return 0;
      const safePolicy = sanitizePolicy(policy);
      const avgDelayMs = (safePolicy.minDelayMs + safePolicy.maxDelayMs) / 2;
      const delayWaitMs = Math.max(0, total - 1) * avgDelayMs;
      const cooldownWaitMs = getCooldownHitCount(total, safePolicy.cooldownEvery) * safePolicy.cooldownMs;
      return Math.round(delayWaitMs + cooldownWaitMs);
    }

    function setInfoTipText(node, text, control = null) {
      const safeText = String(text || "");
      if (node) node.setAttribute("data-tip", safeText);
      if (control) control.title = safeText;
    }

    function refreshSpeedTooltips() {
      const policy = readPolicyFromInputs();
      const threshold = UTILITIES_CORE.toBoundedPositiveInt(
        safetyThresholdInput?.value,
        currentSettings.safetyThresholdCount,
        1,
        20000
      );
      const presetName = sanitizeRiskPreset(presetSelect.value);
      const avgDelayMs = Math.round((policy.minDelayMs + policy.maxDelayMs) / 2);
      const paced100Wait = estimatePacingWaitMs(100, policy);
      const paced300Wait = estimatePacingWaitMs(300, policy);
      const firstPacedExample = threshold;
      const firstPacedExampleWait = estimatePacingWaitMs(firstPacedExample, policy);
      const cooldowns100 = getCooldownHitCount(100, policy.cooldownEvery);
      const cooldowns300 = getCooldownHitCount(300, policy.cooldownEvery);
      const thresholdMinusOne = Math.max(1, threshold - 1);
      const oneHundredGapsMs = 99 * 100;
      const oneHundredGapsHalfMs = Math.round(99 * 50);
      const currentCooldownSavingsAt300 = getCooldownHitCount(300, policy.cooldownEvery) * policy.cooldownMs;
      const retryWorstCasePerFile = policy.retryCount * policy.retryBackoffMs;

      setInfoTipText(
        speedTipNodes.riskAck,
        profileRiskAckTooltipText
      );

      setInfoTipText(
        speedTipNodes.skipDownloaded,
        `Tracks downloaded files using your browser's local storage.\nFiles are identified by their Instagram shortcode, so re-downloading the same content is skipped automatically.\nClearing your browser data or reinstalling the script will erase this history, and duplicates will no longer be detected.\nUse "Sync now" below to pre-fill the skip list with posts already in your Amstramgram database.`
      );

      setInfoTipText(
        speedTipNodes.taggedCarousel,
        `When someone is tagged in a carousel post (a post with multiple photos or videos), Instagram only marks which specific slide they appear in.\n\nOFF — download only the slide(s) the user is actually tagged in. This is the default and avoids pulling unrelated photos from the same post.\n\nON — download every slide in the carousel, even ones the user isn't tagged in. Useful if you want complete posts, but expect extra files that may have nothing to do with the tagged user.`
      );

      setInfoTipText(
        speedTipNodes.preset,
        `Preset = ${presetName.toUpperCase()}.\n` +
        `Current pacing waits average about ${formatTooltipDuration(avgDelayMs)} between files (before network time).\n` +
        `If pacing is active, a 100-file batch adds roughly ${formatTooltipDuration(paced100Wait)} of waiting; 300 files adds about ${formatTooltipDuration(paced300Wait)}.`,
        presetSelect
      );

      setInfoTipText(
        speedTipNodes.safetyThreshold,
        `Pacing starts only when the batch size is ${threshold} or more.\n` +
        `${thresholdMinusOne} files: no safety delays/cooldowns.\n` +
        `${firstPacedExample} files: pacing is ON (with current settings that adds about ${formatTooltipDuration(firstPacedExampleWait)} of waiting, before download time/failures).`,
        safetyThresholdInput
      );

      setInfoTipText(
        speedTipNodes.delayMin,
        `Lower bound for the random delay between files.\n` +
        `Current range: ${formatTooltipDuration(policy.minDelayMs)} to ${formatTooltipDuration(policy.maxDelayMs)} (average about ${formatTooltipDuration(avgDelayMs)}).\n` +
        `Raising only MIN by +100 ms adds about ${formatTooltipDuration(oneHundredGapsHalfMs)} per 100 paced files (99 gaps).`,
        delayMinInput
      );

      setInfoTipText(
        speedTipNodes.delayMax,
        `Upper bound for the random delay between files.\n` +
        `Current range: ${formatTooltipDuration(policy.minDelayMs)} to ${formatTooltipDuration(policy.maxDelayMs)} (average about ${formatTooltipDuration(avgDelayMs)}).\n` +
        `Raising only MAX by +100 ms also adds about ${formatTooltipDuration(oneHundredGapsHalfMs)} per 100 paced files.\n` +
        `Raising both MIN and MAX by +100 ms adds about ${formatTooltipDuration(oneHundredGapsMs)} per 100 paced files.`,
        delayMaxInput
      );

      setInfoTipText(
        speedTipNodes.cooldownEvery,
        policy.cooldownEvery > 0
          ? `Adds a longer break after every ${policy.cooldownEvery} processed files (not after the last file).\n` +
            `If pacing is active: 100 files -> about ${cooldowns100} cooldown(s); 300 files -> about ${cooldowns300} cooldown(s).\n` +
            `Lowering this number increases cooldown frequency a lot.`
          : `Cooldown frequency is OFF (0).\n` +
            `No periodic safety cooldowns will run; only inter-file delay applies.`,
        cooldownEveryInput
      );

      setInfoTipText(
        speedTipNodes.cooldownMs,
        policy.cooldownEvery > 0 && policy.cooldownMs > 0
          ? `Each cooldown pause lasts ${formatTooltipDuration(policy.cooldownMs)}.\n` +
            `If pacing is active, 300 files at the current "every ${policy.cooldownEvery}" setting adds about ${formatTooltipDuration(currentCooldownSavingsAt300)} from cooldowns alone.\n` +
            `Every +5s here adds about +${cooldowns300 * 5}s to that 300-file paced example.`
          : `Cooldown duration is ${formatTooltipDuration(policy.cooldownMs)}, but cooldowns are effectively disabled unless both "every N files" and duration are above 0.`,
        cooldownMsInput
      );

      setInfoTipText(
        speedTipNodes.retryCount,
        `Max extra tries after the first attempt for a failed file.\n` +
        `Current value ${policy.retryCount} means up to ${policy.retryCount + 1} total attempts per failing file.\n` +
        `Each extra retry can also add one backoff wait (${formatTooltipDuration(policy.retryBackoffMs)} each).`,
        retryCountInput
      );

      setInfoTipText(
        speedTipNodes.retryBackoff,
        `Wait before each retry attempt.\n` +
        `Current value ${formatTooltipDuration(policy.retryBackoffMs)} with ${policy.retryCount} retries can add up to ${formatTooltipDuration(retryWorstCasePerFile)} waiting per file that keeps failing.\n` +
        `This only applies on failures, not successful downloads.`,
        retryBackoffInput
      );

      if (activeInfoTip) {
        showInfoTooltip(activeInfoTip);
      }
    }

    function writePolicyToInputs(policy) {
      const normalized = sanitizePolicy(policy);
      delayMinInput.value = normalized.minDelayMs;
      delayMaxInput.value = normalized.maxDelayMs;
      cooldownEveryInput.value = normalized.cooldownEvery;
      cooldownMsInput.value = normalized.cooldownMs;
      retryCountInput.value = normalized.retryCount;
      retryBackoffInput.value = normalized.retryBackoffMs;
      refreshSpeedTooltips();
    }

    function detectPresetFromInputs() {
      const currentPolicy = readPolicyFromInputs();
      for (const name of ["safe", "balanced", "aggressive"]) {
        const presetPolicy = getPresetPolicy(name);
        if (
          presetPolicy.minDelayMs === currentPolicy.minDelayMs &&
          presetPolicy.maxDelayMs === currentPolicy.maxDelayMs &&
          presetPolicy.cooldownEvery === currentPolicy.cooldownEvery &&
          presetPolicy.cooldownMs === currentPolicy.cooldownMs &&
          presetPolicy.retryCount === currentPolicy.retryCount &&
          presetPolicy.retryBackoffMs === currentPolicy.retryBackoffMs
        ) {
          return name;
        }
      }
      return "custom";
    }

    let customPolicyDraft = sanitizePolicy(currentSettings.customPolicy);
    let activePreset = sanitizeRiskPreset(presetSelect.value);

    function applyPresetSelection(nextPreset) {
      const normalizedNext = sanitizeRiskPreset(nextPreset);
      if (activePreset === "custom") {
        customPolicyDraft = readPolicyFromInputs();
      }

      if (normalizedNext === "custom") {
        writePolicyToInputs(customPolicyDraft);
      } else {
        writePolicyToInputs(getPresetPolicy(normalizedNext));
      }

      activePreset = normalizedNext;
      presetSelect.value = normalizedNext;
      syncCustomPolicyVisibility();
    }

    function handleManualPolicyEdit() {
      const currentPolicy = readPolicyFromInputs();
      const detectedPreset = detectPresetFromInputs();
      if (detectedPreset === "custom") {
        customPolicyDraft = currentPolicy;
      }
      activePreset = detectedPreset;
      presetSelect.value = detectedPreset;
      syncCustomPolicyVisibility();
      refreshSpeedTooltips();
    }

    function getPolicyForSettingsSave() {
      return sanitizeRiskPreset(presetSelect.value) === "custom"
        ? readPolicyFromInputs()
        : customPolicyDraft;
    }

    function buildNormalizedSettingsFromModal({ profileSelection } = {}) {
      const resolvedSelection = profileSelection || getProfileDownloadSelectionForSave();
      return normalizeUserSettings({
        ...USER_SETTINGS,
        hotkey: hotkeyInput.value,
        showSettingsLauncher: !!showSettingsLauncherToggle?.checked,
        theme: "auto",
        riskPreset: presetSelect.value,
        downloadSource: activeDownloadSource,
        safetyThresholdCount: safetyThresholdInput?.value ?? currentSettings.safetyThresholdCount,
        downloads: {
          androidCompatMode: !!androidCompatModeToggle?.checked,
          useCustomFolder: isCustomFolderActive(),
          folderLabel: folderLabelInput.value,
          filenameTemplate: filenameTemplateInput.value,
          bulkAsZip: bulkZipToggle.checked,
          skipPreviouslyDownloaded: !!skipPreviouslyDownloadedToggle?.checked,
          amstramgramUrl: amstramgramUrlInput?.value?.trim() ?? "",
          useTypeSubfolders: typeSubfoldersToggle ? !!typeSubfoldersToggle.checked : (USER_SETTINGS?.downloads?.useTypeSubfolders ?? true),
          saveMetadataJson: !!saveMetadataJsonToggle?.checked,
          saveMetadataXmp: !!saveMetadataXmpToggle?.checked,
          saveMetadataIptc: !!saveMetadataIptcToggle?.checked,
          saveMetadataXmpExif: !!saveMetadataExifToggle?.checked,
          videoContainer: getCheckedVideoContainer(),
          filenameSeparator: activeFilenameSeparator
        },
        customPolicy: getPolicyForSettingsSave(),
        profileDownload: {
          maxItems: profileMaxItemsInput.value,
          requireWarningAck: true,
          ...resolvedSelection,
          dateFilter: readDateFilterFromInputs()
        },
        savedDownload: sanitizeSavedDownloadSettings(readSavedDownloadSettingsFromInputs())
      });
    }

    const modalAutosave = createSettingsModalAutosaveController({
      buildNormalizedSettingsFromModal,
      getCustomFolderEnabled: () => !!customFolderToggle.checked,
      getFolderLabel: () => folderLabelInput.value,
      persistUserSettings,
      setUserSettings: (nextSettings) => {
        USER_SETTINGS = nextSettings;
      },
      showToast,
      supportsDirectoryPicker,
      syncCustomFolderControls,
      setCustomFolderEnabled: (enabled) => {
        customFolderToggle.checked = !!enabled;
      },
      applyTheme,
      syncSettingsLauncherButton,
      renderBatchProgressIndicator
    });

    async function flushPendingAutosave(commitOptions = {}) {
      return await modalAutosave.flushPendingAutosave(commitOptions);
    }

    function scheduleDebouncedAutosave() {
      modalAutosave.scheduleDebouncedAutosave();
    }

    function triggerImmediateAutosave(commitOptions = {}) {
      void modalAutosave.commitImmediately(commitOptions);
    }

    async function closeSettingsModalWithAutosave() {
      const flushed = await flushPendingAutosave();
      if (!flushed) return false;
      removeSettingsModal();
      return true;
    }

    settingsModalCloseRequest = closeSettingsModalWithAutosave;

    /* ── Export tab: token definitions ── */
    const EXPORT_TOKENS = [
      { key: "source", label: "Source", group: "identity", tip: "Original Instagram filename", preview: "592384710_17921038472019384_8273649102847562910_n" },
      { key: "username", label: "Username", group: "identity", tip: "Profile that owns the post", preview: "username" },
      { key: "full_name", label: "Full name", group: "identity", tip: "Profile display name", preview: "Full Name" },
      { key: "shortcode", label: "Shortcode", group: "identity", tip: "Short ID from the post URL", preview: "CxR4kLmN" },
      { key: "id", label: "ID", group: "content", tip: "Unique number Instagram assigns to each media", preview: "3210987654" },
      { key: "type", label: "Type", group: "content", tip: "Media type: post, reel, story, etc.", preview: "post" },
      { key: "index", label: "Index", group: "content", tip: "Position in carousel (1, 2, 3\u2026)", preview: "1" },
      { key: "date", label: "Date", group: "download-time", tip: "Date you downloaded the file", preview: formatDateToken(new Date()) },
      { key: "time", label: "Time", group: "download-time", tip: "Time you downloaded the file", preview: "14-30-00" },
      { key: "upload_date", label: "Date uploaded", group: "upload-time", tip: "Date the post was published", preview: "2026-04-12" },
      { key: "upload_time", label: "Time uploaded", group: "upload-time", tip: "Time the post was published", preview: "09-15-00" },
    ];
    const EXPORT_TOKEN_MAP = Object.fromEntries(EXPORT_TOKENS.map((t) => [t.key, t]));
    const EXPORT_DEFAULT_PATTERN = "{username}_{type}_{id}_{index}";
    const EXPORT_TOKEN_COLORS = {
      "identity": "var(--ig-hd-token-identity)",
      "content": "var(--ig-hd-token-content)",
      "download-time": "var(--ig-hd-token-download-time)",
      "upload-time": "var(--ig-hd-token-upload-time)",
    };

    /* ── Separator state ── */
    let activeFilenameSeparator = currentSettings.downloads.filenameSeparator ?? "_";
    let primedSepClearTimer = null;

    /* ── Pattern overlay rendering ── */
    function renderPatternOverlay() {
      if (!patternOverlay) return;
      const pattern = filenameTemplateInput.value || "";
      if (!pattern) {
        patternOverlay.innerHTML = '<span class="placeholder-text">Type a pattern or use tokens below\u2026</span>';
        return;
      }
      const re = /(\{[^}]*\})/g;
      let html = "";
      let last = 0;
      let m;
      while ((m = re.exec(pattern)) !== null) {
        if (m.index > last) {
          html += `<span class="text-seg">${escapeHtml(pattern.slice(last, m.index))}</span>`;
        }
        const key = m[1].slice(1, -1);
        const tk = EXPORT_TOKEN_MAP[key];
        if (tk) {
          html += `<span class="token-seg">${escapeHtml(m[1])}</span>`;
        } else {
          html += `<span class="token-seg invalid">${escapeHtml(m[1])}</span>`;
        }
        last = re.lastIndex;
      }
      if (last < pattern.length) {
        html += `<span class="text-seg">${escapeHtml(pattern.slice(last))}</span>`;
      }
      patternOverlay.innerHTML = html;
    }

    /* ── Preview update ── */
    const EXPORT_ORIGINAL_EXAMPLE = "592384710_17921038472019384_8273649102847562910_n.jpg";
    function updateTemplatePreview() {
      if (!templatePreview) return;
      const pattern = (filenameTemplateInput.value || "").trim();
      if (!pattern) {
        templatePreview.textContent = EXPORT_ORIGINAL_EXAMPLE;
        templatePreview.className = "ig-hd-export-preview-text empty";
        if (templatePreviewNote) templatePreviewNote.style.display = "block";
        if (previewDocFill) { previewDocFill.setAttribute("fill", "var(--ig-hd-text-tertiary)"); previewDocFill.setAttribute("opacity", "0.3"); }
        if (previewDocFold) { previewDocFold.setAttribute("stroke", "var(--ig-hd-text-tertiary)"); previewDocFold.setAttribute("opacity", "0.3"); }
        return;
      }
      let result = pattern;
      const previewUsername = FILE_METADATA_CORE.sanitizeFilenameToken(
        (profileUsernameInput?.value || defaultUsername || "").trim(),
        "username"
      );
      const previewFullName = FILE_METADATA_CORE.sanitizeFilenameToken(
        getCurrentProfileFullName().trim(),
        "Full Name"
      );
      const sampleValues = {};
      for (const tk of EXPORT_TOKENS) {
        if (tk.key === "username") sampleValues[tk.key] = previewUsername;
        else if (tk.key === "full_name") sampleValues[tk.key] = previewFullName;
        else sampleValues[tk.key] = tk.preview;
      }
      for (const [key, val] of Object.entries(sampleValues)) {
        result = result.replaceAll(`{${key}}`, val);
      }
      const hasUnknown = /\{[^}]+\}/.test(result);
      const state = hasUnknown ? "invalid" : "valid";
      templatePreview.textContent = result + ".jpg";
      templatePreview.className = "ig-hd-export-preview-text " + state;
      if (templatePreviewNote) templatePreviewNote.style.display = "none";
      // Doc icon stays neutral — text color already conveys validation state.
      if (previewDocFill) { previewDocFill.setAttribute("fill", "var(--ig-hd-text-tertiary)"); previewDocFill.setAttribute("opacity", "0.4"); }
      if (previewDocFold) { previewDocFold.setAttribute("stroke", "var(--ig-hd-text-tertiary)"); previewDocFold.setAttribute("opacity", "0.4"); }
    }

    /* ── Re-render preview when full name resolves asynchronously (title update or API fetch) ── */
    if (typeof settingsPreviewFullNameCleanup === "function") {
      settingsPreviewFullNameCleanup();
      settingsPreviewFullNameCleanup = null;
    }
    const fullNameUpdateListener = () => { updateTemplatePreview(); };
    window.addEventListener("amstragram:profile-fullname-update", fullNameUpdateListener);
    settingsPreviewFullNameCleanup = () => {
      window.removeEventListener("amstragram:profile-fullname-update", fullNameUpdateListener);
    };

    /* ── Sync all editor UI elements ── */
    function syncPatternEditorUI() {
      const pattern = filenameTemplateInput.value || "";
      renderPatternOverlay();
      updateTemplatePreview();
      syncTokenPillStates();
      // "Reset to default" action: hidden when pattern is empty or already the default
      if (patternResetAction) {
        patternResetAction.style.display = (pattern !== EXPORT_DEFAULT_PATTERN) ? "inline-block" : "none";
      }
      // Clear X button inside the input: hidden when the pattern is empty
      if (patternClearBtn) {
        patternClearBtn.style.display = pattern ? "flex" : "none";
      }
    }

    /* ── Scroll sync ── */
    function syncEditorScroll() {
      if (patternOverlay && filenameTemplateInput) {
        patternOverlay.scrollLeft = filenameTemplateInput.scrollLeft;
      }
    }

    /* ── Token insertion ── */
    function insertTokenAtCursor(tokenKey) {
      const input = filenameTemplateInput;
      input.focus();
      const value = input.value;
      let pos = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
      const before = value.slice(0, pos);
      const after = value.slice(pos);
      const inserted = `{${tokenKey}}`;

      let prefix = "";
      let suffix = "";
      if (activeFilenameSeparator) {
        if (before.length > 0 && before[before.length - 1] !== activeFilenameSeparator && before[before.length - 1] !== "{") {
          if (before[before.length - 1] === "}") {
            prefix = activeFilenameSeparator;
          } else {
            prefix = activeFilenameSeparator;
          }
        }
        if (after.length > 0 && after[0] !== activeFilenameSeparator && after[0] !== "}") {
          suffix = activeFilenameSeparator;
        }
      }

      input.value = before + prefix + inserted + suffix + after;
      const newPos = pos + prefix.length + inserted.length + suffix.length;
      input.setSelectionRange(newPos, newPos);
      syncPatternEditorUI();
      triggerImmediateAutosave();
    }

    function isFilenameTemplateSeparatorChar(char) {
      return char === "_" || char === "-" || char === "." || char === " ";
    }

    function removeTokenOccurrenceAt(value, token, tokenIndex) {
      const tokenEnd = tokenIndex + token.length;
      const beforeChar = tokenIndex > 0 ? value[tokenIndex - 1] : "";
      const afterChar = tokenEnd < value.length ? value[tokenEnd] : "";
      const beforeIsSeparator = isFilenameTemplateSeparatorChar(beforeChar);
      const afterIsSeparator = isFilenameTemplateSeparatorChar(afterChar);

      if (beforeIsSeparator && afterIsSeparator) {
        return value.slice(0, tokenIndex) + value.slice(tokenEnd + 1);
      }
      if (beforeIsSeparator && tokenEnd === value.length) {
        return value.slice(0, tokenIndex - 1) + value.slice(tokenEnd);
      }
      if (afterIsSeparator && tokenIndex === 0) {
        return value.slice(0, tokenIndex) + value.slice(tokenEnd + 1);
      }
      return value.slice(0, tokenIndex) + value.slice(tokenEnd);
    }

    function removeLastTokenOccurrence(token) {
      if (!token) return false;
      const input = filenameTemplateInput;
      const value = input.value || "";
      const tokenIndex = value.lastIndexOf(token);
      if (tokenIndex === -1) return false;

      input.value = removeTokenOccurrenceAt(value, token, tokenIndex);
      const nextCursorPos = Math.min(tokenIndex, input.value.length);
      input.setSelectionRange(nextCursorPos, nextCursorPos);
      input.focus();
      syncPatternEditorUI();
      triggerImmediateAutosave();
      return true;
    }

    function syncTokenPillStates() {
      const tpl = filenameTemplateInput.value || "";
      modal.querySelectorAll(".ig-hd-token-btn").forEach((btn) => {
        const token = btn.getAttribute("data-token");
        btn.classList.toggle("active", token && tpl.includes(token));
      });
    }

    syncCustomPolicyVisibility();
    syncAndroidCompatibilityControls();
    syncProfileTargetControls();
    applyPresetSelection(activePreset);

    /* ── Autocomplete ── */
    let acAnchorPos = -1;
    let acHighlight = 0;

    function openAutocomplete(anchorPos) {
      acAnchorPos = anchorPos;
      acHighlight = 0;
      updateAutocompleteList();
    }

    function closeAutocomplete() {
      acAnchorPos = -1;
      if (patternAutocomplete) patternAutocomplete.style.display = "none";
    }

    function updateAutocompleteList() {
      if (!patternAutocomplete) return;
      const value = filenameTemplateInput.value || "";
      const partial = value.slice(acAnchorPos + 1, filenameTemplateInput.selectionStart || value.length).toLowerCase();
      const filtered = EXPORT_TOKENS.filter((tk) =>
        tk.key.startsWith(partial) || tk.label.toLowerCase().startsWith(partial)
      );
      if (filtered.length === 0) { closeAutocomplete(); return; }
      if (acHighlight >= filtered.length) acHighlight = filtered.length - 1;

      const charWidth = 8.4;
      const leftPx = Math.max(0, Math.min(300, (acAnchorPos * charWidth) - (filenameTemplateInput.scrollLeft || 0) + 34));
      patternAutocomplete.style.cssText = `display:block;top:48px;left:${leftPx}px`;

      let html = "";
      filtered.forEach((tk, i) => {
        const hl = i === acHighlight ? " highlighted" : "";
        html += `<button type="button" class="ig-hd-pattern-ac-item${hl}" data-ac-key="${tk.key}">` +
          `<span class="ig-hd-pattern-ac-dot" style="background:${EXPORT_TOKEN_COLORS[tk.group]}"></span>` +
          `<span style="flex:1">${escapeHtml(tk.label)}</span>` +
          `<span class="ig-hd-pattern-ac-key">{${tk.key}}</span>` +
          `</button>`;
      });
      patternAutocomplete.innerHTML = html;

      patternAutocomplete.querySelectorAll(".ig-hd-pattern-ac-item").forEach((item, i) => {
        item.addEventListener("mouseenter", () => {
          acHighlight = i;
          patternAutocomplete.querySelectorAll(".ig-hd-pattern-ac-item").forEach((el, j) =>
            el.classList.toggle("highlighted", j === i)
          );
        });
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          insertAutocompleteToken(item.dataset.acKey);
        });
      });
    }

    function insertAutocompleteToken(tokenKey) {
      const value = filenameTemplateInput.value || "";
      const before = value.slice(0, acAnchorPos);
      const afterAnchor = value.slice(acAnchorPos);
      const partialMatch = afterAnchor.match(/^\{[a-z_]*/);
      const partialLen = partialMatch ? partialMatch[0].length : 1;
      const after = value.slice(acAnchorPos + partialLen);
      const inserted = `{${tokenKey}}`;

      let suffix = "";
      if (activeFilenameSeparator && after.length > 0 && after[0] !== activeFilenameSeparator && after[0] !== "{") {
        suffix = activeFilenameSeparator;
      }

      filenameTemplateInput.value = before + inserted + suffix + after;
      const newPos = before.length + inserted.length + suffix.length;
      filenameTemplateInput.setSelectionRange(newPos, newPos);
      closeAutocomplete();
      filenameTemplateInput.focus();
      syncPatternEditorUI();
      triggerImmediateAutosave();
    }

    /* ── Pattern editor event handlers ── */
    filenameTemplateInput.addEventListener("input", () => {
      syncPatternEditorUI();
      // Check for autocomplete trigger
      const pos = filenameTemplateInput.selectionStart || 0;
      const before = (filenameTemplateInput.value || "").slice(0, pos);
      const braceMatch = before.match(/\{([a-z_]*)$/);
      if (braceMatch) {
        openAutocomplete(before.lastIndexOf("{"));
      } else {
        closeAutocomplete();
      }
    });

    filenameTemplateInput.addEventListener("keydown", (e) => {
      if (acAnchorPos < 0) {
        if (e.key === "Enter") e.preventDefault();
        return;
      }
      const value = filenameTemplateInput.value || "";
      const partial = value.slice(acAnchorPos + 1, filenameTemplateInput.selectionStart || value.length).toLowerCase();
      const filtered = EXPORT_TOKENS.filter((tk) =>
        tk.key.startsWith(partial) || tk.label.toLowerCase().startsWith(partial)
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        acHighlight = Math.min(acHighlight + 1, filtered.length - 1);
        updateAutocompleteList();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        acHighlight = Math.max(acHighlight - 1, 0);
        updateAutocompleteList();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[acHighlight]) insertAutocompleteToken(filtered[acHighlight].key);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeAutocomplete();
      }
    });

    filenameTemplateInput.addEventListener("focus", () => {
      if (patternEditorWrap) patternEditorWrap.classList.add("focused");
    });

    filenameTemplateInput.addEventListener("blur", () => {
      if (patternEditorWrap) patternEditorWrap.classList.remove("focused");
      setTimeout(() => closeAutocomplete(), 150);
    });

    filenameTemplateInput.addEventListener("scroll", syncEditorScroll);
    filenameTemplateInput.addEventListener("select", syncEditorScroll);

    /* ── Pattern clear & reset buttons ── */
    function clearFilenamePattern() {
      filenameTemplateInput.value = "";
      syncPatternEditorUI();
      filenameTemplateInput.focus();
      triggerImmediateAutosave();
    }
    function resetFilenamePattern() {
      filenameTemplateInput.value = EXPORT_DEFAULT_PATTERN;
      syncPatternEditorUI();
      filenameTemplateInput.focus();
      triggerImmediateAutosave();
    }
    patternClearBtn?.addEventListener("click", clearFilenamePattern);
    patternClearAction?.addEventListener("click", clearFilenamePattern);
    patternResetAction?.addEventListener("click", resetFilenamePattern);

    /* ── Separator button handlers (click inserts, right-click locks) ── */
    modal.querySelectorAll(".ig-hd-sep-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sepKey = btn.dataset.sep;
        if (primedSepClearTimer !== null) {
          clearTimeout(primedSepClearTimer);
          primedSepClearTimer = null;
        }
        // Left click inserts at cursor only; locking is handled by right-click.
        const input = filenameTemplateInput;
        const pos = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
        const before = input.value.slice(0, pos);
        const after = input.value.slice(pos);
        input.value = before + sepKey + after;
        input.setSelectionRange(pos + sepKey.length, pos + sepKey.length);
        input.focus();
        modal.querySelectorAll(".ig-hd-sep-btn").forEach((b) => b.classList.remove("primed"));
        btn.classList.add("primed");
        btn.classList.remove("flash");
        void btn.offsetWidth;
        btn.classList.add("flash");
        setTimeout(() => btn.classList.remove("flash"), 400);
        primedSepClearTimer = setTimeout(() => {
          btn.classList.remove("primed");
          primedSepClearTimer = null;
        }, 2000);
        syncPatternEditorUI();
        triggerImmediateAutosave();
      });
      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sepKey = btn.dataset.sep;
        if (primedSepClearTimer !== null) {
          clearTimeout(primedSepClearTimer);
          primedSepClearTimer = null;
        }
        if (btn.classList.contains("active")) {
          modal.querySelectorAll(".ig-hd-sep-btn").forEach((b) => b.classList.remove("active", "primed"));
          activeFilenameSeparator = null;
          triggerImmediateAutosave();
          return;
        }
        modal.querySelectorAll(".ig-hd-sep-btn").forEach((b) => b.classList.remove("active", "primed"));
        btn.classList.add("active");
        activeFilenameSeparator = sepKey;
        triggerImmediateAutosave();
      });
    });

    /* ── Token pill handlers ── */
    let tokenTooltipTimer = null;
    modal.querySelectorAll(".ig-hd-token-btn").forEach((btn) => {
      const token = btn.getAttribute("data-token");
      const tokenKey = token ? token.slice(1, -1) : "";
      const meta = EXPORT_TOKEN_MAP[tokenKey];
      if (meta?.tip) btn.setAttribute("data-tip", meta.tip);

      btn.addEventListener("mouseenter", () => {
        clearTimeout(tokenTooltipTimer);
        tokenTooltipTimer = setTimeout(() => showInfoTooltip(btn), 300);
      });
      btn.addEventListener("mouseleave", () => {
        clearTimeout(tokenTooltipTimer);
        tokenTooltipTimer = null;
        hideInfoTooltip();
      });
      btn.addEventListener("click", () => {
        clearTimeout(tokenTooltipTimer);
        tokenTooltipTimer = null;
        hideInfoTooltip();
        if (!token) return;
        insertTokenAtCursor(tokenKey);
      });
      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimeout(tokenTooltipTimer);
        tokenTooltipTimer = null;
        hideInfoTooltip();
        if (!token) return;
        removeLastTokenOccurrence(token);
      });
    });

    /* ── Initialize export tab UI ── */
    syncPatternEditorUI();

    presetSelect.addEventListener("change", () => {
      applyPresetSelection(presetSelect.value);
      triggerImmediateAutosave();
    });

    showSettingsLauncherToggle?.addEventListener("change", () => {
      if (!showSettingsLauncherToggle.checked && window.innerWidth <= 700) {
        const confirmed = confirm(
          "Hide the settings button?\n\nYou can reopen settings by long-pressing anywhere on the page."
        );
        if (!confirmed) {
          showSettingsLauncherToggle.checked = true;
          return;
        }
      }
      triggerImmediateAutosave();
    });

    [
      {
        input: androidCompatModeToggle,
        onChange: syncAndroidCompatibilityControls
      },
      {
        input: bulkZipToggle,
        onChange: syncTypeSubfoldersControls
      },
      {
        input: typeSubfoldersToggle
      },
      {
        input: saveMetadataJsonToggle
      },
      {
        input: saveMetadataXmpToggle
      },
      {
        input: saveMetadataIptcToggle
      },
      {
        input: saveMetadataExifToggle
      },
      {
        input: skipPreviouslyDownloadedToggle
      }
    ].forEach(({ input, onChange }) => {
      input?.addEventListener("change", () => {
        onChange?.();
        triggerImmediateAutosave();
      });
    });
    videoContainerCheckboxes.forEach((cb) => {
      cb?.addEventListener("change", () => {
        if (cb.checked) {
          videoContainerCheckboxes.forEach((other) => { if (other && other !== cb) other.checked = false; });
        } else {
          // Radio group — keep one selected.
          cb.checked = true;
        }
        triggerImmediateAutosave();
      });
    });
    customFolderToggle?.addEventListener("change", async () => {
      syncCustomFolderControls();
      if (customFolderToggle.checked && !folderLabelInput.value.trim()) {
        try {
          await openFolderPickerAndUpdate();
        } catch (err) {
          customFolderToggle.checked = false;
          syncCustomFolderControls();
          if (err?.name !== "AbortError") {
            console.error("[Amstragram] Failed to choose output folder:", err);
            showToast(`Could not choose folder: ${err?.message || "Unknown error"}`, 5000);
          }
        }
      } else {
        triggerImmediateAutosave();
      }
    });
    riskAckInput?.addEventListener("change", () => {
      setRiskAckSessionAcknowledged(!!riskAckInput.checked);
      syncRiskAckControls(riskAckInput, profileDownloadButton);
    });

    amstramgramSyncButton?.addEventListener("click", async () => {
      const baseUrl = sanitizeAmstramgramUrl(amstramgramUrlInput?.value ?? "");
      if (!baseUrl) {
        showToast("Enter a valid Amstramgram URL first.", 4000);
        return;
      }
      amstramgramSyncButton.disabled = true;
      amstramgramSyncButton.textContent = "Syncing…";
      try {
        const { added, total } = await syncAmstramgramShortcodes(baseUrl);
        showToast(`Synced ${added} new shortcode${added !== 1 ? "s" : ""} from Amstramgram (${total} total in DB).`, 5000);
        triggerImmediateAutosave();
      } catch (err) {
        showToast(`Amstramgram sync failed: ${err?.message || "Unknown error"}`, 6000);
      } finally {
        amstramgramSyncButton.disabled = false;
        amstramgramSyncButton.textContent = "Sync now";
      }
    });

    amstramgramUrlInput?.addEventListener("input", scheduleDebouncedAutosave);

    [
      hotkeyInput,
      filenameTemplateInput,
      profileMaxItemsInput,
      safetyThresholdInput,
      ...policyInputs
    ].forEach((input) => {
      input?.addEventListener("blur", () => {
        void flushPendingAutosave();
      });
    });

    hotkeyInput?.addEventListener("input", scheduleDebouncedAutosave);

    // --- Hotkey recording ---
    if (hotkeyInput && hotkeyRecordButton) {
      let hotkeyRecording = false;
      let hotkeyValueBeforeRecord = "";

      function stopRecording(restore) {
        hotkeyRecording = false;
        hotkeyInput.classList.remove("ig-hd-hotkey-recording");
        hotkeyInput.placeholder = "";
        hotkeyInput.readOnly = false;
        hotkeyRecordButton.textContent = "Record";
        if (restore) {
          hotkeyInput.value = hotkeyValueBeforeRecord;
        }
      }

      function startRecording() {
        hotkeyRecording = true;
        hotkeyValueBeforeRecord = hotkeyInput.value;
        hotkeyInput.value = "";
        hotkeyInput.placeholder = "Press keys\u2026";
        hotkeyInput.readOnly = true;
        hotkeyInput.classList.add("ig-hd-hotkey-recording");
        hotkeyRecordButton.textContent = "Cancel";
        hotkeyInput.focus();
      }

      hotkeyRecordButton.addEventListener("click", () => {
        if (hotkeyRecording) {
          stopRecording(true);
        } else {
          startRecording();
        }
      });

      hotkeyInput.addEventListener("keydown", (e) => {
        if (!hotkeyRecording) return;
        e.preventDefault();
        e.stopPropagation();

        const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);
        const parts = [];
        if (e.ctrlKey) parts.push("Ctrl");
        if (e.altKey) parts.push("Alt");
        if (e.shiftKey) parts.push("Shift");
        if (e.metaKey) parts.push("Meta");

        if (MODIFIER_KEYS.has(e.key)) {
          // Still holding modifiers — show live preview
          hotkeyInput.value = parts.length > 0 ? parts.join("+") + "+\u2026" : "";
          return;
        }

        if (e.key === "Escape" && parts.length === 0) {
          stopRecording(true);
          return;
        }

        parts.push(e.key);
        const raw = parts.join("+");
        const normalized = sanitizeHotkey(raw);
        hotkeyInput.value = normalized;
        stopRecording(false);
        scheduleDebouncedAutosave();
      });

      hotkeyInput.addEventListener("blur", () => {
        if (hotkeyRecording) stopRecording(true);
      });
    }

    hotkeyDefaultButton?.addEventListener("click", () => {
      hotkeyInput.value = DEFAULT_USER_SETTINGS.hotkey;
      scheduleDebouncedAutosave();
    });

    safetyThresholdInput?.addEventListener("input", () => {
      refreshSpeedTooltips();
      scheduleDebouncedAutosave();
    });
    [
      includePostsToggle,
      includeReelsToggle,
      includeHighlightsToggle,
      includeProfilePictureToggle,
      includeTaggedToggle,
      taggedIncludeCarouselToggle
    ].forEach((input) => {
      input?.addEventListener("change", () => {
        syncProfileTargetControls();
        triggerImmediateAutosave();
      });
    });
    dateFilterEnabledToggle?.addEventListener("change", () => {
      syncDateFilterVisibility();
      triggerImmediateAutosave();
    });
    dateFilterModeCheckboxes.forEach((cb) => {
      cb?.addEventListener("change", () => {
        if (cb.checked) {
          dateFilterModeCheckboxes.forEach((other) => { if (other && other !== cb) other.checked = false; });
        } else {
          cb.checked = true;
        }
        syncDateFilterVisibility();
        triggerImmediateAutosave();
      });
    });
    [dateFilterStartInput, dateFilterEndInput].forEach((input) => {
      input?.addEventListener("input", () => {
        syncDateFilterVisibility();
        scheduleDebouncedAutosave();
      });
      input?.addEventListener("change", () => {
        syncDateFilterVisibility();
        triggerImmediateAutosave();
      });
      input?.addEventListener("blur", () => {
        void flushPendingAutosave();
      });
    });
    filenameTemplateInput.addEventListener("input", () => {
      scheduleDebouncedAutosave();
    });
    profileUsernameInput?.addEventListener("input", updateTemplatePreview);
    for (const input of policyInputs) {
      input.addEventListener("input", () => {
        handleManualPolicyEdit();
        scheduleDebouncedAutosave();
      });
    }
    syncDateFilterVisibility();

    void (async () => {
      const storedHandle = await getStoredOutputDirectoryHandle();
      if (storedHandle?.name) {
        folderLabelInput.value = sanitizeOutputFolderLabel(storedHandle.name);
        syncFolderInputPathPrefix();
      }
    })();

    async function openFolderPickerAndUpdate() {
      const selectedHandle = await pickAndStoreOutputDirectoryHandle();
      folderLabelInput.value = sanitizeOutputFolderLabel(selectedHandle?.name || "");
      syncFolderInputPathPrefix();
      customFolderToggle.checked = true;
      syncCustomFolderControls();
      await modalAutosave.commitImmediately();
    }

    folderLabelInput?.addEventListener("click", async () => {
      try {
        await openFolderPickerAndUpdate();
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("[Amstragram] Failed to choose output folder:", err);
        showToast(`Could not choose folder: ${err?.message || "Unknown error"}`, 5000);
      }
    });

    folderClearButton.addEventListener("click", async () => {
      await clearOutputDirectorySelection();
      folderLabelInput.value = "";
      syncFolderInputPathPrefix();
      customFolderToggle.checked = false;
      syncCustomFolderControls();
      await modalAutosave.commitImmediately();
    });

    modal.querySelector("#ig-hd-settings-close").addEventListener("click", () => {
      void closeSettingsModalWithAutosave();
    });
    profileDownloadButton.addEventListener("click", async () => {
      const acknowledged = !!riskAckInput.checked;
      if (!acknowledged) {
        syncRiskAckControls(riskAckInput, profileDownloadButton);
        showToast("Confirm the risk checkbox before starting.");
        return;
      }

      if (customFolderToggle.checked && !supportsDirectoryPicker()) {
        showToast("Custom folders need Chromium (Chrome/Edge/Brave). Firefox uses the default download folder.");
        return;
      }
      if (customFolderToggle.checked && !folderLabelInput.value.trim()) {
        showToast("Choose an output folder or disable custom folder.");
        return;
      }
      const profileSelectionForStart = getProfileDownloadSelectionForStart();
      const persisted = await modalAutosave.commitImmediately({
        profileSelection: profileSelectionForStart
      });
      if (!persisted) return;

      // === SAVED MODE BRANCH ===
      if (activeDownloadSource === "saved") {
        const selectedCollections = readSelectedSavedCollections();
        if (selectedCollections.length === 0) {
          showToast("Select at least one saved collection.", 5500);
          return;
        }
        const collectionNames = selectedCollections.map(c => c.name).join(", ");
        const confirmed = window.confirm(
          `Start saved collections download?\n\n` +
          `Collections: ${collectionNames}\n` +
          `Preset: ${USER_SETTINGS.riskPreset.toUpperCase()}\n` +
          `This can trigger Instagram rate limits/checkpoints.`
        );
        if (!confirmed) return;

        if (typeof startSavedBulkDownload !== "function") {
          showToast("Saved bulk downloader is unavailable in this build.");
          return;
        }

        profileDownloadButton.disabled = true;
        profileDownloadButton.textContent = "Starting...";
        removeSettingsModal();
        try {
          await startSavedBulkDownload({
            collections: selectedCollections,
            policy: getActiveBulkPolicy(),
            maxItems: USER_SETTINGS.profileDownload.maxItems,
            useCollectionSubfolder: savedSubfolderToggle?.checked !== false
          });
        } catch (err) {
          console.error("[Amstragram] Saved bulk download start failed:", err);
          showToast(`Saved bulk download failed: ${err?.message || "Unknown error"}`, 6000);
        }
        return;
      }
      // === END SAVED MODE BRANCH ===

      const rawUsername = (profileUsernameInput.value || "").trim();
      const username = /^[A-Za-z0-9._]+$/.test(rawUsername) ? rawUsername : "";
      if (!username) {
        showToast("Enter a valid Instagram username first.");
        profileUsernameInput.focus();
        return;
      }

      const selection = sanitizeProfileDownloadSelection(USER_SETTINGS.profileDownload);
      const hasAnyTarget = selection.includePosts
        || selection.includeReels
        || selection.includeHighlights
        || selection.includeTagged
        || selection.includeProfilePicture;
      if (!hasAnyTarget) {
        showToast("Select at least one bulk target first.");
        return;
      }
      const selectionLabel = getProfileDownloadSelectionLabel(selection);
      const confirmed = window.confirm(
        `Start profile bulk download for @${username}?\n\n` +
        `Targets: ${selectionLabel}\n` +
        `Preset: ${USER_SETTINGS.riskPreset.toUpperCase()}\n` +
        `This can trigger Instagram rate limits/checkpoints.`
      );
      if (!confirmed) return;

      if (typeof startProfileBulkDownload !== "function") {
        showToast("Profile bulk downloader is unavailable in this build.");
        return;
      }

      profileDownloadButton.disabled = true;
      profileDownloadButton.textContent = "Starting...";
      removeSettingsModal();
      try {
        await startProfileBulkDownload(username, {
          policy: getActiveBulkPolicy(),
          maxItems: USER_SETTINGS.profileDownload.maxItems,
          includePosts: USER_SETTINGS.profileDownload.includePosts,
          includeReels: USER_SETTINGS.profileDownload.includeReels,
          includeHighlights: USER_SETTINGS.profileDownload.includeHighlights,
          includeTagged: USER_SETTINGS.profileDownload.includeTagged,
          includeProfilePicture: USER_SETTINGS.profileDownload.includeProfilePicture,
          taggedIncludeAllCarouselMedia: USER_SETTINGS.profileDownload.taggedIncludeAllCarouselMedia
        });
      } catch (err) {
        console.error("[Amstragram] Profile bulk download start failed:", err);
        showToast(`Profile bulk download failed: ${err?.message || "Unknown error"}`, 6000);
      }
    });

    const settingsModal = document.getElementById("ig-hd-settings-modal");
    if (settingsModal) settingsModal.scrollTop = 0;
  }

  async function syncAmstramgramShortcodes(baseUrl) {
    const response = await GramPlatform.fetchUrl({
      method: "GET",
      url: `${baseUrl}/api/shortcodes`,
      withCredentials: false,
      timeout: 15000
    });
    if (response.status !== 200) throw new Error(`Server returned ${response.status}`);
    const shortcodes = JSON.parse(response.responseText);
    if (!Array.isArray(shortcodes)) throw new Error("Unexpected response format");
    const keys = shortcodes.filter(Boolean).map((s) => `shortcode:${s}`);
    const added = rememberDownloadedHistoryKeys(keys);
    return { added, total: shortcodes.length };
  }

  function isEditableTarget(target) {
    return HOTKEY_CORE.isEditableTarget(target);
  }

  function normalizeHotkeyToken(token) {
    return HOTKEY_CORE.normalizeHotkeyToken(token);
  }

  function parseHotkey(hotkey) {
    return HOTKEY_CORE.parseHotkey(hotkey);
  }

  function hotkeyMatchesEvent(event, hotkey) {
    return HOTKEY_CORE.hotkeyMatchesEvent(event, hotkey);
  }

  function handleGlobalHotkeys(event) {
    const isSettingsOpen = !!document.getElementById("ig-hd-settings-overlay");
    const editableTarget = isEditableTarget(event.target);
    if (event.key === "Escape" && isSettingsOpen) {
      if (editableTarget) return;
      event.preventDefault();
      event.stopPropagation();
      const requestClose = typeof settingsModalCloseRequest === "function"
        ? settingsModalCloseRequest
        : removeSettingsModal;
      void requestClose();
      return;
    }
    if (editableTarget) return;

    if (hotkeyMatchesEvent(event, USER_SETTINGS.hotkey)) {
      event.preventDefault();
      event.stopPropagation();
      openSettingsModal();
    }
  }

  // Long-press to open settings (fallback when launcher is hidden on mobile)
  let longPressTimer = null;
  document.addEventListener("touchstart", (e) => {
    if (USER_SETTINGS?.showSettingsLauncher !== false) return;
    if (e.touches.length !== 1) return;
    const tag = e.target?.tagName;
    if (tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "IMG" || tag === "VIDEO") return;
    if (e.target?.closest?.('a,button,[role="button"],input,textarea,img,video,#ig-hd-settings-overlay')) return;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openSettingsModal();
    }, 700);
  }, { passive: true });
  document.addEventListener("touchend", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }, { passive: true });
  document.addEventListener("touchmove", () => {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }, { passive: true });

  document.addEventListener("keydown", handleGlobalHotkeys, true);
  GramPlatform.registerMenuCommand("Amstragram: Settings", openSettingsModal);

  // Dev hook: __amstragramDev.showBatchPanel("running" | "paused" | "cancelling" | "completed" | "partial" | "failed" | "cancelled", { total, processed, failed, label, ... })
  if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
    const DEV_FAKE_JOB_ID = "__amstragram_dev_fake__";
    const FINISHED_SUBSTATES = new Set(["completed", "partial", "failed", "cancelled"]);
    const LIVE_STATES = new Set(["running", "paused", "cancelling", "finished", "idle"]);
    unsafeWindow.__amstragramDev = {
      openSettings: openSettingsModal,
      showBatchPanel(state = "running", overrides = {}) {
        const now = Date.now();
        const total = Math.max(1, Math.floor(Number(overrides.total) || 250));
        const processed = Math.min(total, Math.max(0, Math.floor(Number(overrides.processed ?? Math.round(total * 0.4)))));
        const failed = Math.max(0, Math.floor(Number(overrides.failed) || 0));
        const completed = Math.max(0, Math.floor(Number(overrides.completed ?? Math.max(0, processed - failed))));
        const cancelled = Math.max(0, Math.floor(Number(overrides.cancelled) || 0));
        const finishedStatus = FINISHED_SUBSTATES.has(state) ? state : null;
        const normalizedState = finishedStatus
          ? "finished"
          : (LIVE_STATES.has(state) ? state : "running");
        const elapsedMs = Math.max(0, Number(overrides.elapsedMs ?? 45000));
        const etaMs = finishedStatus ? 0 : Number(overrides.etaMs ?? 90000);
        const record = {
          jobId: DEV_FAKE_JOB_ID,
          label: overrides.label || "Dev fake batch",
          mode: overrides.mode === "zip" ? "zip" : "download",
          state: normalizedState,
          status: finishedStatus,
          phase: overrides.phase || "",
          total,
          processed,
          completed,
          failed,
          cancelled,
          indeterminate: false,
          forceVisible: true,
          elapsedMs,
          etaMs,
          startedAt: overrides.startedAt ?? (now - elapsedMs),
          finishedAt: finishedStatus ? now : null,
          failedItems: Array.isArray(overrides.failedItems) ? overrides.failedItems : [],
          policySnapshot: null,
          controller: null,
          retryInFlight: false,
          lastUpdateAt: now
        };
        batchRunRecords.set(DEV_FAKE_JOB_ID, record);
        batchManagerSelectedJobId = DEV_FAKE_JOB_ID;
        batchManagerHiddenByUser = false;
        batchManagerDismissedJobId = "";
        renderBatchProgressIndicator();
        return record;
      },
      hideBatchPanel() {
        batchRunRecords.delete(DEV_FAKE_JOB_ID);
        batchManagerHiddenByUser = true;
        renderBatchProgressIndicator();
      },
      listBatchRecords: () => Array.from(batchRunRecords.values())
    };
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

  function createNamedBinaryFile(blob, filename) {
    if (!(blob instanceof Blob)) return null;
    if (typeof File !== "function") return blob;
    try {
      return new File(
        [blob],
        FILE_METADATA_CORE.sanitizeOutputFilename(filename || "instagram_media", "instagram_media"),
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

  function shouldUseAndroidCompatibilityDownloadPath() {
    return !!USER_SETTINGS?.downloads?.androidCompatMode && isAndroidUserAgent();
  }

  function isDownloadTimeoutError(err) {
    return !!err && (err.code === "GM_DOWNLOAD_TIMEOUT" || String(err?.message || "").toLowerCase().includes("timed out"));
  }

  async function downloadFile(url, filename, metaOrOptions = null, maybeOptions = null) {
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

    if (shouldUseAndroidCompatibilityDownloadPath()) {
      const androidAllowsTabFallback = options?.allowOpenInTabFallback !== false;
      let initialDownloadErr = null;
      try {
        await gmDownloadFile(url, resolvedFilename, {
          saveAs: true,
          timeoutMs: androidAllowsTabFallback ? 12000 : 7000
        });
        return true;
      } catch (androidGmDownloadErr) {
        initialDownloadErr = androidGmDownloadErr;
        debugLog("[Amstragram] Android mode GM_download(saveAs) URL mode failed:", androidGmDownloadErr?.message || androidGmDownloadErr);
      }

      if (isDownloadTimeoutError(initialDownloadErr)) {
        debugLog("[Amstragram] Android mode timeout treated as submitted request; skipping extra fallback attempts to avoid duplicate downloads.");
        if (androidAllowsTabFallback) {
          showToast("Android mode: download request sent. If no file appears, use Open in new tab once.");
        }
        return true;
      }

      if (!androidAllowsTabFallback) {
        // Batch mode disallows tab fallback; fail fast so the queue can continue.
        return false;
      }

      let androidBlob = null;
      try {
        androidBlob = await fetchMediaBlob(url);
      } catch (androidBlobErr) {
        debugLog("[Amstragram] Android mode media fetch failed:", androidBlobErr?.message || androidBlobErr);
      }

      const namedBinary = createNamedBinaryFile(androidBlob, resolvedFilename);
      if (namedBinary instanceof Blob) {
        try {
          await gmDownloadFile(namedBinary, resolvedFilename, { saveAs: true, timeoutMs: 7000 });
          return true;
        } catch (binaryDirectErr) {
          debugLog("[Amstragram] Android mode GM_download(File/Blob) failed:", binaryDirectErr?.message || binaryDirectErr);
          if (isDownloadTimeoutError(binaryDirectErr)) {
            return true;
          }
        }

        let localBlobUrl = null;
        try {
          localBlobUrl = URL.createObjectURL(namedBinary);
          await gmDownloadFile(localBlobUrl, resolvedFilename, { saveAs: true, timeoutMs: 7000 });
          return true;
        } catch (blobUrlErr) {
          debugLog("[Amstragram] Android mode GM_download(blob URL) failed:", blobUrlErr?.message || blobUrlErr);
          if (isDownloadTimeoutError(blobUrlErr)) {
            return true;
          }
        } finally {
          if (localBlobUrl) {
            try {
              URL.revokeObjectURL(localBlobUrl);
            } catch {
              // ignore revoke failures
            }
          }
        }

        try {
          const dataUrl = await blobToDataUrl(namedBinary);
          await gmDownloadFile(dataUrl, resolvedFilename, { saveAs: true, timeoutMs: 7000 });
          return true;
        } catch (dataUrlErr) {
          debugLog("[Amstragram] Android mode GM_download(data URL) failed:", dataUrlErr?.message || dataUrlErr);
          if (isDownloadTimeoutError(dataUrlErr)) {
            return true;
          }
        }
      }

      if (androidAllowsTabFallback) {
        openInNewTab(url);
        showToast("Android mode: opened media in a new tab. Use the browser download option there.");
        return true;
      }
      return false;
    }

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
    const wantsCustomFolder = !!USER_SETTINGS?.downloads?.useCustomFolder;
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
              const mimeType = collected.container === "mkv" ? "video/x-matroska" : "video/mp4";
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
  function removeMenu() {
    return CONTEXT_MENU_CORE.removeMenu();
  }

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
      const { ["User-Agent"]: _userAgent, ...fetchHeaders } = headers;
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
      const settings = (typeof USER_SETTINGS !== "undefined" && USER_SETTINGS && USER_SETTINGS.downloads) || {};
      return {
        container: settings.videoContainer === "mkv" ? "mkv" : "mp4"
      };
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

    const reservedPaths = (typeof PROFILE_RESERVED_PATHS !== "undefined" && PROFILE_RESERVED_PATHS?.has)
      ? PROFILE_RESERVED_PATHS
      : new Set(["stories", "highlights", "explore", "reels", "direct", "accounts", "p", "reel", "tv"]);

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
      } catch (err) {}
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
    const isProfileGridTarget = !!gridPostLink && !article;
    const preferVideoForReel = isReelShortcode(target, gridPostLink);

    let contextType = null;
    if (dialog) {
      contextType = "modal";
    } else if (isProfileGridTarget) {
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
    const isProfileGridTarget = resolvedClick.contextType === "profile-grid";
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
        const linkMatch = nearbyLink.href.match(/instagram\.com\/([^\/\?]+)/);
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

      if (response?.success && isValidHdProfilePicUrl(apiUrl)) {
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
    const settings = (typeof USER_SETTINGS !== "undefined" && USER_SETTINGS && USER_SETTINGS.downloads) || {};
    const container = settings.videoContainer === "mkv" ? "mkv" : "mp4";
    const selectedMedia = MEDIA_SELECTION_CORE.selectBestMedia({
      type: "story",
      mediaKindIntent: storyItemHasVideo(item) ? "video" : "unknown",
      identity: { storyId: item?.pk || item?.id || "" },
      item: item
    }, {
      videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
      videoResolverOptions: { container }
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
      const script = document.createElement("script");
      script.textContent = hookSource;
      root.appendChild(script);
      if (script.parentNode) script.parentNode.removeChild(script);
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

  function pickHighestVideoVersion(versions) {
    if (!Array.isArray(versions) || versions.length === 0) return null;
    let best = versions[0];
    let bestArea = (Number(best?.width) || 0) * (Number(best?.height) || 0);
    for (let i = 1; i < versions.length; i++) {
      const v = versions[i];
      const area = (Number(v?.width) || 0) * (Number(v?.height) || 0);
      if (area > bestArea) {
        best = v;
        bestArea = area;
      }
    }
    return best;
  }

  function parseDirectThreadIdFromPath(pathname) {
    if (pathname === undefined && typeof window !== "undefined") {
      pathname = window.location?.pathname;
    }
    const str = String(pathname || "");
    const match = str.match(/^\/direct\/t\/([^\/?#]+)(?:\/|$)/);
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
    const settings = (typeof USER_SETTINGS !== "undefined" && USER_SETTINGS && USER_SETTINGS.downloads) || {};
    const container = settings.videoContainer === "mkv" ? "mkv" : "mp4";
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
      videoResolverOptions: { container }
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
    let cookieText = "";
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

      let responseText = "";
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }

      if (response.ok) {
        let json = null;
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
      let responseText = "";
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }
      if (!response.ok) {
        throw new Error(`Saved collections GraphQL HTTP ${response.status}`);
      }

      let responseJson = null;
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
    let rawItems = [];
    let moreAvailable = false;
    let nextMaxId = null;

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
   * @param {object} options - { onProgressText, useCollectionSubfolder, dateFilter }
   * @returns {{ tasks, dateFilterCounters, dateFilterTerminatedEarly, deltaSyncSkippedCount, deltaSyncTerminatedEarly }}
   */
  async function collectSavedDownloadTasks(collectionId, collectionName, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = options?.dateFilter || (USER_SETTINGS?.profileDownload?.dateFilter) || { enabled: false };
    const useCollectionSubfolder = options?.useCollectionSubfolder === true;
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    const deltaSyncEnabled = !!USER_SETTINGS?.downloads?.skipPreviouslyDownloaded;
    let deltaSyncConsecutiveHits = 0;
    let deltaSyncSkippedCount = 0;
    let deltaSyncTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly,
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
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(mediaItem?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          if (dateCheck.belowLowerBound && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
            dateFilterTerminatedEarly = true;
            break;
          }
          continue;
        }
        dateFilterCounters.matched += 1;

        // Saved items come from many users — use each item's owner username
        const itemUsername = mediaItem?.user?.username || "unknown";
        const isReel = mediaItem?.product_type === "clips";
        const hydratedMediaItem = await hydrateMediaItemForDesktopDash(mediaItem);
        const itemTasks = buildProfileItemDownloadTasks(hydratedMediaItem, itemUsername, { isReel });

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

      if (dateFilterTerminatedEarly || deltaSyncTerminatedEarly) break;

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

    const amstramgramBaseUrl = sanitizeAmstramgramUrl(USER_SETTINGS?.downloads?.amstramgramUrl ?? "");
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
    const maxItems = UTILITIES_CORE.toBoundedPositiveInt(options?.maxItems, USER_SETTINGS.profileDownload.maxItems, 0, 20000);
    const useCollectionSubfolder = options?.useCollectionSubfolder !== false;
    const dateFilter = USER_SETTINGS?.profileDownload?.dateFilter || { enabled: false };
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
        mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
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
        mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
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

      const combinedDateFilterCounters = { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
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
            dateFilter,
            onProgressText: (text) => {
              updateSavedBulkSetupProgress({
                phase: text,
                collected: scopedTasks.length
              });
            }
          }
        );

        addUniqueScopedTasks(result.tasks);

        // Merge counters
        const counters = result.dateFilterCounters;
        if (counters) {
          combinedDateFilterCounters.scanned += Number(counters.scanned) || 0;
          combinedDateFilterCounters.matched += Number(counters.matched) || 0;
          combinedDateFilterCounters.outOfRange += Number(counters.outOfRange) || 0;
          combinedDateFilterCounters.noDateSkipped += Number(counters.noDateSkipped) || 0;
        }
        combinedDeltaSyncSkippedCount += Number(result.deltaSyncSkippedCount) || 0;
      }

      if (scopedTasks.length === 0) {
        finishSavedBulkSetupProgress("completed", "no downloadable content found");
        let noContentMsg = "Saved: no downloadable content found.";
        if (combinedDateFilterCounters.outOfRange > 0) {
          noContentMsg += ` (${combinedDateFilterCounters.outOfRange} filtered by date)`;
        }
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
          mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
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

      const itemTasks = buildProfileItemDownloadTasks(item, username, {
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

      let pathname = "";
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
          const itemTasks = buildProfileItemDownloadTasks(mediaItem, username, {
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

  // =========================================
  // PROFILE BULK DOWNLOAD ORCHESTRATION
  // =========================================

  function selectProfileItemMediaForDownload(item, options = {}) {
    const hasCarousel = Array.isArray(item?.carousel_media) && item.carousel_media.length > 0;
    if (!hasCarousel) return [item];

    if (options?.includeAllCarouselMedia !== false) {
      return item.carousel_media;
    }

    const taggedMatches = item.carousel_media.filter((media) =>
      mediaContainsTaggedProfile(media, options?.taggedUserId, options?.taggedUsername)
    );
    if (taggedMatches.length > 0) return taggedMatches;

    // Some payloads only retain the sidecar-level tag signal.
    if (mediaContainsTaggedProfile(item, options?.taggedUserId, options?.taggedUsername)) {
      return [item.carousel_media[0]];
    }

    // Fallback to the slide represented by the tagged grid tile (first sidecar item).
    return [item.carousel_media[0]];
  }

  function selectProfileMediaCandidateForDownload(media, context = {}) {
    const settings = (typeof USER_SETTINGS !== "undefined" && USER_SETTINGS && USER_SETTINGS.downloads) || {};
    const container = settings.videoContainer === "mkv" ? "mkv" : "mp4";
    const mediaType = context?.mediaType || (media?.product_type === "clips" ? "reel" : "post");
    const shortcode = context?.shortcode || media?.code || media?.shortcode || media?.id || media?.pk || "";
    const hasVideoVersions = Array.isArray(media?.video_versions) && media.video_versions.length > 0;
    const mediaKindIntent = (media?.media_type === 2 || media?.is_video === true || hasVideoVersions || typeof media?.video_url === "string")
      ? "video"
      : "unknown";
    const selectedMedia = MEDIA_SELECTION_CORE.selectBestMedia({
      type: mediaType,
      mediaKindIntent: mediaKindIntent,
      identity: { shortcode: shortcode, index: context?.index || 1 },
      item: media
    }, {
      videoResolver: typeof VIDEO_RESOLVER_CORE !== "undefined" ? VIDEO_RESOLVER_CORE : null,
      videoResolverOptions: { container }
    });

    let url = selectedMedia.selected?.url || "";
    if (selectedMedia.mediaKind === "video" && selectedMedia.selected?.source === "dash") {
      const videos = Array.isArray(media?.video_versions)
        ? [...media.video_versions].filter((candidate) => typeof candidate?.url === "string" && candidate.url.trim())
        : [];
      videos.sort((a, b) => {
        const areaA = (Number(a?.width) || 0) * (Number(a?.height) || 0);
        const areaB = (Number(b?.width) || 0) * (Number(b?.height) || 0);
        if (areaA !== areaB) return areaB - areaA;
        return (Number(b?.bandwidth) || 0) - (Number(a?.bandwidth) || 0);
      });
      url = videos[0]?.url || url;
    }

    return {
      isVideo: selectedMedia.mediaKind === "video",
      url: url,
      ext: selectedMedia.selected?.ext || (selectedMedia.mediaKind === "video" ? "mp4" : "jpg"),
      videoPlan: selectedMedia.selected?.videoPlan || null,
      fallback: selectedMedia.fallback || null,
      selectedSource: selectedMedia.selected?.source || ""
    };
  }

  async function hydrateMediaItemForDesktopDash(item) {
    const isVideo = Array.isArray(item?.video_versions) && item.video_versions.length > 0;
    if (!isVideo || typeof item?.video_dash_manifest === "string") return item;

    const shortcode = item?.code || item?.shortcode || "";
    if (!isLikelyInstagramShortcode(shortcode)) return item;
    if (typeof fetchPostInfoWithFallback !== "function") return item;

    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 10000));
    try {
      const hydrated = await Promise.race([fetchPostInfoWithFallback(shortcode), timeoutPromise]);
      return hydrated || item;
    } catch (err) {
      if (typeof debugLog === "function") {
        debugLog("[Amstragram] desktop DASH hydration failed for", shortcode, ":", err?.message || err);
      }
      return item;
    }
  }

  function buildProfilePictureDownloadTask(username, profilePicUrl, userId = "") {
    const normalizedUrl = normalizeProfilePicUrl(profilePicUrl);
    if (!isValidHdProfilePicUrl(normalizedUrl)) return null;
    const ext = FILE_METADATA_CORE.extractFileExtension(normalizedUrl) || "jpg";
    return {
      url: normalizedUrl,
      filename: `${username}_profile.${ext}`,
      meta: {
        type: "profile_pic",
        username: username,
        shortcode: "",
        id: userId || username,
        index: 1,
        ext: ext,
        caption: "",
        altText: "",
        hashtags: [],
        takenAt: null,
        authorId: userId || "",
        authorUsername: username,
        permalink: `https://www.instagram.com/${username}/`,
        mediaKind: "image",
        carouselTotal: 1
      }
    };
  }

  function buildProfileItemDownloadTasks(item, username, options = {}) {
    const mediaItems = selectProfileItemMediaForDownload(item, options);
    const shortcode = item?.code || item?.id || item?.pk || "post";
    const isReel = options?.isReel === true || item?.product_type === "clips";
    const mediaType = isReel ? "reel" : "post";
    const permalinkBase = isReel ? "reel" : "p";
    const postPermalink = shortcode ? `https://www.instagram.com/${permalinkBase}/${shortcode}/` : "";
    const sharedMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, {
      username: username,
      permalink: postPermalink
    });
    const tasks = [];

    for (let i = 0; i < mediaItems.length; i++) {
      const media = mediaItems[i] || {};
      const selected = selectProfileMediaCandidateForDownload(media, {
        mediaType: mediaType,
        shortcode: shortcode,
        index: i + 1
      });
      const url = selected.url || "";

      if (!url) continue;
      const suffix = mediaItems.length > 1 ? `_${i + 1}` : "";
      const mediaId = media?.pk || media?.id || `${i + 1}`;
      const mediaMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(media, sharedMetadata);
      tasks.push({
        url: url,
        videoPlan: selected.isVideo ? (selected.videoPlan || null) : null,
        filename: `${username}_${shortcode}${suffix}.${selected.ext}`,
        meta: {
          type: mediaType,
          username: username,
          shortcode: shortcode,
          id: mediaId,
          index: i + 1,
          ext: selected.ext,
          caption: mediaMetadata.caption || sharedMetadata.caption || "",
          altText: mediaMetadata.altText || sharedMetadata.altText || "",
          hashtags: mediaMetadata.hashtags || sharedMetadata.hashtags || [],
          takenAt: mediaMetadata.takenAt ?? sharedMetadata.takenAt ?? null,
          authorId: mediaMetadata.authorId || sharedMetadata.authorId || "",
          authorUsername: mediaMetadata.authorUsername || sharedMetadata.authorUsername || username,
          permalink: mediaMetadata.permalink || sharedMetadata.permalink || postPermalink,
          mediaKind: selected.isVideo ? "video" : "image",
          carouselTotal: mediaItems.length
        },
        diagnostic: selected.fallback ? {
          level: "fallback",
          surface: "bulk",
          type: mediaType,
          mediaKind: selected.isVideo ? "video" : "image",
          identity: { shortcode: shortcode },
          attempted: selected.fallback.attempted || [],
          selected: { source: selected.selectedSource || "", container: selected.ext },
          bestUnavailableReason: selected.fallback.reason || "fallback"
        } : null
      });
    }

    return tasks;
  }

  async function resolveProfileUserId(username, appId) {
    const profileUrl = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    const profileData = await gmFetch(profileUrl, {
      headers: { "X-IG-App-ID": appId },
      useMobileUA: true
    });
    const userId = profileData?.data?.user?.id;
    if (!userId) throw new Error("Could not get profile user ID");
    return userId;
  }

  function normalizeHighlightTrayId(value) {
    if (value === null || value === undefined) return "";
    const raw = String(value).trim();
    if (!raw) return "";
    return raw.replace(/^highlight:/i, "");
  }

  function extractHighlightTrayEntries(trayData) {
    const candidates = [];
    if (Array.isArray(trayData?.tray)) candidates.push(...trayData.tray);
    if (Array.isArray(trayData?.items)) candidates.push(...trayData.items);
    if (Array.isArray(trayData?.highlight_reels)) candidates.push(...trayData.highlight_reels);

    if (trayData?.reels && typeof trayData.reels === "object") {
      for (const reel of Object.values(trayData.reels)) {
        if (reel && typeof reel === "object") {
          candidates.push(reel);
        }
      }
    }

    const normalized = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      const rawId = candidate.id || candidate.pk || candidate.reel_id || candidate.reel?.id || "";
      const highlightId = normalizeHighlightTrayId(rawId);
      if (!highlightId) continue;
      if (seen.has(highlightId)) continue;
      seen.add(highlightId);
      normalized.push({
        id: highlightId,
        title: candidate.title || candidate.name || "",
        source: candidate
      });
    }
    return normalized;
  }

  function buildProfileHighlightDownloadTasks(items, username, highlightId, highlightTitle = "") {
    if (!Array.isArray(items)) return [];
    const tasks = [];
    const normalizedHighlightId = normalizeHighlightTrayId(highlightId) || "highlight";
    const safeTitle = FILE_METADATA_CORE.sanitizeFilenameToken(highlightTitle, "");
    const highlightLabel = safeTitle || normalizedHighlightId;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const media = getBestStoryItemMedia(item);
      if (!media.url) continue;
      const itemId = item?.pk || item?.id || `${i + 1}`;
      const itemMetadata = FILE_METADATA_CORE.buildMetadataHintFromMediaItem(item, { username: username });
      tasks.push({
        url: media.url,
        videoPlan: media.isVideo ? (media.videoPlan || null) : null,
        filename: `${username}_highlight_${highlightLabel}_${itemId}.${media.ext}`,
        meta: {
          type: "highlight",
          username: username,
          shortcode: normalizedHighlightId,
          id: itemId,
          index: i + 1,
          ext: media.ext,
          caption: itemMetadata.caption || "",
          altText: itemMetadata.altText || "",
          hashtags: itemMetadata.hashtags || [],
          takenAt: itemMetadata.takenAt ?? null,
          authorId: itemMetadata.authorId || "",
          authorUsername: itemMetadata.authorUsername || username,
          permalink: itemMetadata.permalink || "",
          mediaKind: media.isVideo ? "video" : "image",
          carouselTotal: 1
        }
      });
    }
    return tasks;
  }

  async function collectProfileHighlightDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (USER_SETTINGS?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      // Highlights never early-terminate (items are not guaranteed to be
      // time-ordered), but include the flag for caller shape consistency.
      dateFilterTerminatedEarly: false
    });

    const trayUrl = `https://i.instagram.com/api/v1/highlights/${userId}/highlights_tray/`;
    const trayData = await gmFetch(trayUrl, {
      headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
      useMobileUA: true
    });

    const highlights = extractHighlightTrayEntries(trayData);
    if (highlights.length === 0) return buildResult();

    for (let i = 0; i < highlights.length; i++) {
      const highlight = highlights[i];
      const response = await fetchHighlightInfoDirect(highlight.id, null, appId);
      if (!response?.success) {
        debugLog("[Amstragram] Highlight fetch failed for", highlight.id, ":", response?.error || "Unknown error");
        continue;
      }

      const highlightItems = Array.isArray(response?.allItemsData)
        ? response.allItemsData
        : (Array.isArray(response?.data?.items) ? response.data.items : []);

      // Per-item filter gate: highlights items are NOT guaranteed to be
      // time-ordered, so we skip out-of-range items individually and never
      // terminate early. Filtered items are dropped before task construction
      // so they don't consume the maxItems budget.
      const filteredHighlightItems = [];
      for (const highlightItem of highlightItems) {
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(highlightItem?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          continue; // skip this item, NEVER break
        }
        dateFilterCounters.matched += 1;
        filteredHighlightItems.push(highlightItem);
      }

      const highlightTasks = buildProfileHighlightDownloadTasks(filteredHighlightItems, username, highlight.id, highlight.title);

      for (const task of highlightTasks) {
        const key = `${task.url}|${task.filename}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(task);
        if (limit > 0 && collected.length >= limit) {
          return buildResult();
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering highlights... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (collected.length >= USER_SETTINGS.safetyThresholdCount && i < highlights.length - 1) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    return buildResult();
  }

  async function collectProfileDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (USER_SETTINGS?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    const deltaSyncEnabled = POSTS_FEED_SUPPORTS_DELTA_SYNC
      && !!USER_SETTINGS?.downloads?.skipPreviouslyDownloaded;
    let deltaSyncConsecutiveHits = 0;
    let deltaSyncSkippedCount = 0;
    let deltaSyncTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly,
      deltaSyncTerminatedEarly,
      deltaSyncSkippedCount
    });

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Profile feed pagination guard triggered at 800 pages.");
        break;
      }
      const url = maxId
        ? `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(maxId)}`
        : `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33`;
      const page = await gmFetch(url, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useMobileUA: true
      });

      const items = Array.isArray(page?.items) ? page.items : [];
      if (items.length === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 3) {
          debugLog("[Amstragram] Profile feed: stopping after 3 consecutive empty pages (more_available was:", page?.more_available, ")");
          break;
        }
      } else {
        emptyPageStreak = 0;
      }
      for (const item of items) {
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          // Early termination: the posts feed is newest-first for non-pinned items.
          // Pinned posts (up to 3) sit at the top regardless of age and must not
          // trigger termination — otherwise an old pinned post kills pagination
          // before we ever see recent uploads.
          if (dateCheck.belowLowerBound
              && !isPinnedPost(item)
              && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
            dateFilterTerminatedEarly = true;
            break;
          }
          continue;
        }
        dateFilterCounters.matched += 1;

        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username);
        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (deltaSyncEnabled) {
            const historyKey = getDownloadHistoryKeyForTask(task);
            if (historyKey && hasDownloadedHistoryKey(historyKey)) {
              deltaSyncConsecutiveHits += 1;
              deltaSyncSkippedCount += 1;
              continue;
            } else {
              deltaSyncConsecutiveHits = 0;
            }
          }
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering posts... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (deltaSyncEnabled
          && deltaSyncConsecutiveHits >= DELTA_SYNC_CONSECUTIVE_HIT_THRESHOLD) {
        deltaSyncTerminatedEarly = true;
      }

      if (deltaSyncEnabled && deltaSyncSkippedCount > 0 && onProgressText) {
        onProgressText(
          `Collecting posts... ${collected.length} new, ${deltaSyncSkippedCount} already downloaded`
          + (deltaSyncTerminatedEarly ? " (stopping early)" : "")
        );
      }

      if (deltaSyncTerminatedEarly) break;

      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      // Keep small jobs snappy: only pace list-pagination once we cross the same threshold.
      if (collected.length >= USER_SETTINGS.safetyThresholdCount && pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    // Per-collector summary log removed — the consolidated summary for all
    // four content types is emitted by startProfileBulkDownload after all
    // collectors have run (Task 5 Step 5.7).
    return buildResult();
  }

  // Early termination on these endpoints is pending empirical verification.
  // Until we confirm reels and tagged return items in strictly descending
  // taken_at order via cursor pagination, filtering is applied per-item
  // but termination is disabled — the full pagination runs to its usual cap.
  const REELS_FEED_SUPPORTS_EARLY_TERMINATION = false;
  const TAGGED_FEED_SUPPORTS_EARLY_TERMINATION = false;
  const DELTA_SYNC_CONSECUTIVE_HIT_THRESHOLD = 66;
  const POSTS_FEED_SUPPORTS_DELTA_SYNC = true;

  // Instagram pins up to 3 posts at the top of the profile feed regardless of age.
  // Pinned posts break the newest-first ordering the date filter's early-termination
  // relies on, so they must be skipped when deciding whether to stop pagination.
  function isPinnedPost(item) {
    const pinnedIds = item?.timeline_pinned_user_ids;
    if (Array.isArray(pinnedIds) && pinnedIds.length > 0) return true;
    return item?.is_pinned === true || item?.is_pinned_for_account === true;
  }

  async function collectProfileReelDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const onProgressText = typeof options?.onProgressText === "function" ? options.onProgressText : null;
    const dateFilter = (USER_SETTINGS?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    let maxId = null;
    let pageCount = 0;
    let emptyPageStreak = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly
    });

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Reels feed pagination guard triggered at 800 pages.");
        break;
      }
      const url = maxId
        ? `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33&max_id=${encodeURIComponent(maxId)}`
        : `https://i.instagram.com/api/v1/feed/user/${userId}/?count=33`;
      const page = await gmFetch(url, {
        headers: { "X-IG-App-ID": appId, "Accept": "*/*" },
        useMobileUA: true
      });

      const items = Array.isArray(page?.items) ? page.items : [];
      if (items.length === 0) {
        emptyPageStreak += 1;
        if (emptyPageStreak >= 3) {
          debugLog("[Amstragram] Reels feed: stopping after 3 consecutive empty pages (more_available was:", page?.more_available, ")");
          break;
        }
      } else {
        emptyPageStreak = 0;
      }
      for (const item of items) {
        if (item?.product_type !== "clips") continue;
        const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
        dateFilterCounters.scanned += 1;
        if (!dateCheck.pass) {
          if (dateCheck.reason === "no-date") {
            dateFilterCounters.noDateSkipped += 1;
          } else if (dateCheck.reason === "out-of-range") {
            dateFilterCounters.outOfRange += 1;
          }
          // Early termination only fires when the feature flag is on AND the item
          // is below the lower bound. The reels endpoint is not yet empirically
          // confirmed to return items in strict descending taken_at order via
          // cursor pagination, so the flag stays false until verified.
          if (REELS_FEED_SUPPORTS_EARLY_TERMINATION
              && dateCheck.belowLowerBound
              && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
            dateFilterTerminatedEarly = true;
            break;
          }
          continue;
        }
        dateFilterCounters.matched += 1;

        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username);
        for (const task of itemTasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(task);
          if (limit > 0 && collected.length >= limit) {
            return buildResult();
          }
        }
      }

      if (dateFilter && dateFilter.enabled === true && onProgressText) {
        onProgressText(`Filtering reels... ${dateFilterCounters.matched} matched / ${dateFilterCounters.scanned} scanned`);
      }

      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      if (collected.length >= USER_SETTINGS.safetyThresholdCount && pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    return buildResult();
  }

  async function collectTaggedProfileDownloadTasks(username, userId, appId, policy, maxItems = 0, options = {}) {
    function createDateFilterCounters() {
      return { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
    }

    const collected = [];
    const seen = new Set();
    const limit = Number(maxItems) > 0 ? Number(maxItems) : 0;
    const includeAllCarouselMedia = options?.includeAllCarouselMedia === true;
    const onProgress = typeof options?.onProgress === "function" ? options.onProgress : null;
    const dateFilter = (USER_SETTINGS?.profileDownload?.dateFilter) || { enabled: false };
    const dateFilterCounters = createDateFilterCounters();
    let dateFilterTerminatedEarly = false;
    const retryCount = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryCount, 0, 0, 8);
    const retryBackoffMs = UTILITIES_CORE.toBoundedPositiveInt(policy?.retryBackoffMs, 0, 0, 600000);
    const traceSampleLimit = 5;
    let maxId = null;
    let taggedGraphQlCursor = null;
    let shouldTryTaggedGraphQl = true;
    const seenTaggedGraphQlCursors = new Set();
    const attemptedTaggedGraphQlShortcodes = new Set();
    let pageCount = 0;
    let showedBlockedByClientNotice = false;
    let lastProgressEmitAt = 0;

    const buildResult = () => ({
      tasks: collected,
      dateFilterCounters,
      dateFilterTerminatedEarly
    });
    // Shared gate used before building tasks from any tagged item. Returns true
    // if the item passes the filter. Updates counters and, when the feature
    // flag is enabled, flips dateFilterTerminatedEarly when we see an item
    // below the lower bound. Caller must check dateFilterTerminatedEarly to
    // break out of the surrounding loops.
    const passesTaggedDateFilter = (item) => {
      const dateCheck = DATE_FILTER_CORE.itemPassesDateFilter(item?.taken_at, dateFilter);
      dateFilterCounters.scanned += 1;
      if (!dateCheck.pass) {
        if (dateCheck.reason === "no-date") {
          dateFilterCounters.noDateSkipped += 1;
        } else if (dateCheck.reason === "out-of-range") {
          dateFilterCounters.outOfRange += 1;
        }
        if (TAGGED_FEED_SUPPORTS_EARLY_TERMINATION
            && dateCheck.belowLowerBound
            && DATE_FILTER_CORE.canEarlyTerminate(dateFilter)) {
          dateFilterTerminatedEarly = true;
        }
        return false;
      }
      dateFilterCounters.matched += 1;
      return true;
    };
    const addUniqueCollectedTask = (task) => {
      const key = `${task.url}|${task.filename}`;
      if (seen.has(key)) return false;
      seen.add(key);
      collected.push(task);
      return true;
    };
    const emitTaggedCollectionProgress = (overrides = {}, force = false) => {
      if (!onProgress) return;
      const now = Date.now();
      if (!force && now - lastProgressEmitAt < 250) return;
      lastProgressEmitAt = now;
      try {
        onProgress({
          stage: "collect",
          source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
          pageCount,
          collected: collected.length,
          limit,
          ...overrides
        });
      } catch (progressErr) {
        debugLog("[Amstragram] Tagged progress callback failed:", progressErr?.message || progressErr);
      }
    };

    TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector start", {
      username: String(username || ""),
      userId: String(userId || ""),
      appId: String(appId || ""),
      limit,
      includeAllCarouselMedia,
      retryCount,
      retryBackoffMs
    });
    emitTaggedCollectionProgress({ stage: "start", source: "tagged", message: "Starting tagged post scan..." }, true);

    while (true) {
      pageCount += 1;
      if (pageCount > 800) {
        debugLog("[Amstragram] Tagged feed pagination guard triggered at 800 pages.");
        emitTaggedCollectionProgress({ stage: "guard-stop", source: "tagged", message: "Stopped after 800 pages (safety guard)." }, true);
        break;
      }

      TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector loop", {
        pageCount,
        collected: collected.length,
        shouldTryTaggedGraphQl,
        taggedGraphQlCursor,
        maxId
      });
      emitTaggedCollectionProgress({
        stage: "page-request",
        source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
        message: shouldTryTaggedGraphQl
          ? `Requesting tagged page ${pageCount} (GraphQL)...`
          : `Requesting tagged page ${pageCount} (legacy API)...`
      });

      if (shouldTryTaggedGraphQl) {
        try {
          const graphQlPage = await tryGraphQLTaggedFeed(userId, appId, taggedGraphQlCursor);
          let graphQlPageAddedTasks = 0;
          const graphQlItems = extractTaggedFeedMediaItems(graphQlPage);
          const graphQlDirectShortcodes = new Set();
          const graphQlItemsWithoutShortcodes = [];
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL page extracted", {
            pageCount,
            graphQlItems: graphQlItems.length,
            itemSample: graphQlItems.slice(0, traceSampleLimit).map((item) =>
              summarizeTaggedItemForTrace(item, userId, username)
            )
          });
          emitTaggedCollectionProgress({
            stage: "graphql-page",
            source: "graphql",
            message: `GraphQL page ${pageCount}: ${graphQlItems.length} item(s) found`
          }, true);

          for (const item of graphQlItems) {
            const itemShortcode = item?.code || item?.shortcode || "";
            if (isLikelyInstagramShortcode(itemShortcode)) {
              graphQlDirectShortcodes.add(itemShortcode);
              continue;
            }

            graphQlItemsWithoutShortcodes.push(item);
          }

          // Tagged Relay feed nodes often contain grid-sized media URLs.
          // Prefer shortcode resolution (post fetch path) whenever a shortcode is available.
          for (const item of graphQlItemsWithoutShortcodes) {
            if (!passesTaggedDateFilter(item)) {
              if (dateFilterTerminatedEarly) break;
              continue;
            }
            const hydratedItem = await hydrateMediaItemForDesktopDash(item);
            const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username, {
              includeAllCarouselMedia: includeAllCarouselMedia,
              taggedUserId: userId,
              taggedUsername: username
            });
            for (const task of itemTasks) {
              if (!addUniqueCollectedTask(task)) continue;
              graphQlPageAddedTasks += 1;
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }
          }
          if (dateFilterTerminatedEarly) break;

          const graphQlShortcodes = Array.from(new Set([
            ...graphQlDirectShortcodes,
            ...extractTaggedShortcodesFromPayloadDeep(graphQlPage)
          ]));
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode extraction", {
            pageCount,
            shortcodeCount: graphQlShortcodes.length,
            shortcodeSample: graphQlShortcodes.slice(0, 12),
            directShortcodeCount: graphQlDirectShortcodes.size
          });
          emitTaggedCollectionProgress({
            stage: "graphql-resolve",
            source: "graphql",
            subProcessed: 0,
            subTotal: graphQlShortcodes.length,
            message: graphQlShortcodes.length > 0
              ? `Resolving tagged posts to media (0/${graphQlShortcodes.length})...`
              : `GraphQL page ${pageCount}: no shortcodes to resolve`
          }, true);
          for (let i = 0; i < graphQlShortcodes.length; i++) {
            const shortcode = graphQlShortcodes[i];
            if (!isLikelyInstagramShortcode(shortcode)) continue;
            if (attemptedTaggedGraphQlShortcodes.has(shortcode)) continue;
            attemptedTaggedGraphQlShortcodes.add(shortcode);
            emitTaggedCollectionProgress({
              stage: "graphql-resolve",
              source: "graphql",
              subProcessed: i + 1,
              subTotal: graphQlShortcodes.length,
              message: `Resolving tagged posts to media (${i + 1}/${graphQlShortcodes.length})...`
            });

            let mediaItem = null;
            for (let attempt = 0; attempt <= retryCount; attempt++) {
              try {
                mediaItem = await fetchPostInfoWithFallback(shortcode);
                if (!mediaItem) {
                  mediaItem = await fetchPostInfoFromHtml(shortcode);
                }
                break;
              } catch (err) {
                const statusCode = extractHttpStatusCodeFromError(err);
                const shouldRetry = isRetryableTaggedRequestStatus(statusCode) && attempt < retryCount;
                if (!shouldRetry) {
                  TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode resolve failed", {
                    shortcode,
                    attempt,
                    statusCode,
                    error: String(err?.message || err)
                  });
                  debugLog("[Amstragram] GraphQL tagged shortcode fetch failed:", shortcode, err?.message || err);
                  emitTaggedCollectionProgress({
                    stage: "graphql-resolve",
                    source: "graphql",
                    subProcessed: i + 1,
                    subTotal: graphQlShortcodes.length,
                    message: `Tagged post lookup failed (${i + 1}/${graphQlShortcodes.length}); continuing...`
                  });
                  break;
                }
                const backoffMs = retryBackoffMs * (attempt + 1);
                if (backoffMs > 0) await sleepMs(backoffMs);
              }
            }

            if (!mediaItem) continue;

            TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL shortcode resolved", {
              shortcode,
              itemSummary: summarizeTaggedItemForTrace(mediaItem, userId, username)
            });

            if (!passesTaggedDateFilter(mediaItem)) {
              if (dateFilterTerminatedEarly) break;
              continue;
            }

            const itemTasks = buildProfileItemDownloadTasks(mediaItem, username, {
              includeAllCarouselMedia: includeAllCarouselMedia,
              taggedUserId: userId,
              taggedUsername: username
            });
            for (const task of itemTasks) {
              if (!addUniqueCollectedTask(task)) continue;
              graphQlPageAddedTasks += 1;
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }

            if (i < graphQlShortcodes.length - 1) {
              const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
              if (delayMs > 0) await sleepMs(delayMs);
            }
          }
          if (dateFilterTerminatedEarly) break;
          emitTaggedCollectionProgress({
            stage: "graphql-page-done",
            source: "graphql",
            message: `Finished GraphQL page ${pageCount} • queued ${collected.length} file(s)`
          }, true);

          const graphQlPageInfo = extractTaggedGraphQLPageInfo(graphQlPage);
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL page_info", {
            pageCount,
            pageInfo: graphQlPageInfo,
            pageAddedTasks: graphQlPageAddedTasks,
            totalCollected: collected.length
          });
          if (!graphQlPageInfo) {
            debugLog("[Amstragram] Tagged GraphQL returned data without usable page_info; falling back to legacy tagged API pagination.");
            shouldTryTaggedGraphQl = false;
            emitTaggedCollectionProgress({
              stage: "legacy-fallback",
              source: "legacy",
              message: "GraphQL pagination metadata missing; switching to legacy API..."
            }, true);
          } else if (graphQlPageInfo.hasNextPage) {
            const nextCursor = graphQlPageInfo.endCursor;
            if (!nextCursor) {
              debugLog("[Amstragram] Tagged GraphQL page_info indicated more pages but no end_cursor; falling back to legacy tagged API pagination.");
              shouldTryTaggedGraphQl = false;
              emitTaggedCollectionProgress({
                stage: "legacy-fallback",
                source: "legacy",
                message: "GraphQL cursor missing; switching to legacy API..."
              }, true);
            } else {
              const normalizedCursor = String(nextCursor);
              if (seenTaggedGraphQlCursors.has(normalizedCursor)) {
                debugLog("[Amstragram] Tagged GraphQL pagination cursor repeated; stopping to avoid a loop.");
                break;
              }
              seenTaggedGraphQlCursors.add(normalizedCursor);
              taggedGraphQlCursor = normalizedCursor;

              if (pageCount > 0) {
                const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
                if (delayMs > 0) await sleepMs(delayMs);
              }
              continue;
            }
          } else {
            debugLog("[Amstragram] Tagged GraphQL pagination reached final page.");
            emitTaggedCollectionProgress({
              stage: "complete",
              source: "graphql",
              message: `Tagged GraphQL scan complete • queued ${collected.length} file(s)`
            }, true);
            break;
          }

          if (graphQlItems.length === 0 && graphQlShortcodes.length === 0 && graphQlPageAddedTasks === 0) {
            debugLog("[Amstragram] Tagged GraphQL returned no usable items; continuing with legacy tagged API fallback.");
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL no usable data", { pageCount });
            shouldTryTaggedGraphQl = false;
            emitTaggedCollectionProgress({
              stage: "legacy-fallback",
              source: "legacy",
              message: "GraphQL returned no usable tagged items; trying legacy API..."
            }, true);
          }
        } catch (graphQlErr) {
          TAGGED_TRACE_ENABLED && taggedTrace("Tagged GraphQL branch error", {
            pageCount,
            error: String(graphQlErr?.message || graphQlErr)
          });
          debugLog("[Amstragram] Tagged GraphQL fetch failed; falling back to legacy tagged API pagination:", graphQlErr?.message || graphQlErr);
          shouldTryTaggedGraphQl = false;
          emitTaggedCollectionProgress({
            stage: "legacy-fallback",
            source: "legacy",
            message: "GraphQL request failed; switching to legacy API..."
          }, true);
        }
      }

      const querySuffix = maxId
        ? `count=33&max_id=${encodeURIComponent(maxId)}`
        : "count=33";
      const requestHeaders = {
        "X-IG-App-ID": appId,
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest"
      };
      const requestCandidates = [
        `https://i.instagram.com/api/v1/usertags/${userId}/feed/?${querySuffix}`,
        `https://i.instagram.com/api/v1/feed/usertag/${userId}/?${querySuffix}`,
        `https://i.instagram.com/api/v1/feed/tagged/${userId}/?${querySuffix}`,
        `https://www.instagram.com/api/v1/usertags/${userId}/feed/?${querySuffix}`,
        `https://www.instagram.com/api/v1/feed/usertag/${userId}/?${querySuffix}`,
        `https://www.instagram.com/api/v1/feed/tagged/${userId}/?${querySuffix}`
      ];
      let page = null;
      let lastError = null;

      for (const taggedFeedUrl of requestCandidates) {
        for (let attempt = 0; attempt <= retryCount; attempt++) {
          try {
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API request", {
              pageCount,
              attempt,
              url: taggedFeedUrl
            });
            emitTaggedCollectionProgress({
              stage: "legacy-request",
              source: "legacy",
              message: `Trying tagged legacy API (${attempt + 1}/${retryCount + 1})...`
            });
            page = await gmFetch(taggedFeedUrl, {
              headers: requestHeaders,
              useMobileUA: taggedFeedUrl.startsWith("https://i.instagram.com/")
            });
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API success", {
              pageCount,
              attempt,
              url: taggedFeedUrl,
              topLevelKeys: Object.keys(page || {}),
              nestedDataKeys: Object.keys(page?.data || {})
            });
            if (page && typeof page === "object") break;
          } catch (err) {
            lastError = err;
            const statusCode = extractHttpStatusCodeFromError(err);
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy API error", {
              pageCount,
              attempt,
              url: taggedFeedUrl,
              statusCode,
              error: String(err?.message || err)
            });
            const shouldRetry = isRetryableTaggedRequestStatus(statusCode) && attempt < retryCount;
            if (!shouldRetry) break;
            const backoffMs = retryBackoffMs * (attempt + 1);
            if (backoffMs > 0) await sleepMs(backoffMs);
          }
        }
        if (page && typeof page === "object") break;
      }

      if (!page || typeof page !== "object") {
        const errText = String(lastError?.message || lastError || "");
        const blockedByClient = /ERR_BLOCKED_BY_CLIENT|blocked by client/i.test(errText);
        if (blockedByClient && !showedBlockedByClientNotice) {
          showedBlockedByClientNotice = true;
          showToast("Tagged bulk requests were blocked by a browser extension. Trying same-origin fallback...", 5200);
        }

        const sameOriginCandidates = requestCandidates.filter((url) => url.startsWith("https://www.instagram.com/"));
        emitTaggedCollectionProgress({
          stage: "legacy-same-origin",
          source: "legacy",
          message: "Legacy API blocked/unavailable; trying same-origin requests..."
        }, true);
        for (const taggedFeedUrl of sameOriginCandidates) {
          try {
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin request", { pageCount, url: taggedFeedUrl });
            const response = await fetch(taggedFeedUrl, {
              method: "GET",
              credentials: "include",
              headers: requestHeaders
            });
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin response", {
              pageCount,
              url: taggedFeedUrl,
              status: response.status,
              ok: response.ok
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            page = await response.json();
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin JSON parsed", {
              pageCount,
              url: taggedFeedUrl,
              topLevelKeys: Object.keys(page || {}),
              nestedDataKeys: Object.keys(page?.data || {})
            });
            if (page && typeof page === "object") break;
          } catch (err) {
            lastError = err;
            TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy same-origin error", {
              pageCount,
              url: taggedFeedUrl,
              error: String(err?.message || err)
            });
          }
        }
      }

      if (!page || typeof page !== "object") {
        debugLog("[Amstragram] Tagged API feed unavailable; trying tagged page fallback:", lastError?.message || lastError);
        if (!showedBlockedByClientNotice) {
          showToast("Tagged API feed unavailable; trying tagged page fallback...", 4200);
        }
        if (collected.length > 0) {
          emitTaggedCollectionProgress({
            stage: "fallback-stop",
            source: "fallback",
            message: `Tagged API unavailable after partial results • queued ${collected.length} file(s)`
          }, true);
          return buildResult();
        }
        const remainingLimit = limit > 0 ? Math.max(0, limit - collected.length) : 0;
        if (limit === 0 || remainingLimit > 0) {
          try {
            emitTaggedCollectionProgress({
              stage: "fallback-page",
              source: "fallback",
              message: "Tagged API unavailable; scanning the tagged page directly..."
            }, true);
            const fallbackTasks = await collectTaggedTasksFromProfilePageFallback(
              username,
              userId,
              policy,
              remainingLimit,
              { includeAllCarouselMedia: includeAllCarouselMedia }
            );
            // Fallback tasks are pre-built from the profile page and do not
            // carry raw taken_at data, so the date filter cannot be applied
            // here. This path is a best-effort last resort when both the
            // legacy API and GraphQL are unavailable.
            for (const task of fallbackTasks) {
              addUniqueCollectedTask(task);
              if (limit > 0 && collected.length >= limit) {
                return buildResult();
              }
            }
            emitTaggedCollectionProgress({
              stage: "fallback-page-done",
              source: "fallback",
              message: `Tagged page fallback complete • queued ${collected.length} file(s)`
            }, true);
          } catch (fallbackErr) {
            debugLog("[Amstragram] Tagged page fallback failed after API errors:", fallbackErr?.message || fallbackErr);
            emitTaggedCollectionProgress({
              stage: "fallback-error",
              source: "fallback",
              message: "Tagged page fallback failed."
            }, true);
          }
        }
        return buildResult();
      }

      const items = extractTaggedFeedMediaItems(page);
      TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy page extracted", {
        pageCount,
        itemCount: items.length,
        itemSample: items.slice(0, traceSampleLimit).map((item) =>
          summarizeTaggedItemForTrace(item, userId, username)
        )
      });
      emitTaggedCollectionProgress({
        stage: "legacy-page",
        source: "legacy",
        message: `Legacy tagged page ${pageCount}: ${items.length} item(s) found`
      }, true);
      for (const item of items) {
        if (!passesTaggedDateFilter(item)) {
          if (dateFilterTerminatedEarly) break;
          continue;
        }
        const hydratedItem = await hydrateMediaItemForDesktopDash(item);
        const itemTasks = buildProfileItemDownloadTasks(hydratedItem, username, {
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
            return buildResult();
          }
        }
      }
      if (dateFilterTerminatedEarly) break;

      const hasMore = !!page?.more_available;
      const nextMaxId = page?.next_max_id;
      TAGGED_TRACE_ENABLED && taggedTrace("Tagged legacy pagination", {
        pageCount,
        hasMore,
        nextMaxId: nextMaxId ? String(nextMaxId) : null,
        totalCollected: collected.length
      });
      if (!hasMore || !nextMaxId) break;
      maxId = String(nextMaxId);

      if (pageCount > 0) {
        const delayMs = randomIntBetween(policy.minDelayMs, policy.maxDelayMs);
        if (delayMs > 0) await sleepMs(delayMs);
      }
    }

    TAGGED_TRACE_ENABLED && taggedTrace("Tagged collector complete", {
      totalTasks: collected.length,
      usedGraphQl: !shouldTryTaggedGraphQl || seenTaggedGraphQlCursors.size > 0 || attemptedTaggedGraphQlShortcodes.size > 0,
      graphQlCursorCount: seenTaggedGraphQlCursors.size,
      graphQlResolvedShortcodes: attemptedTaggedGraphQlShortcodes.size
    });
    emitTaggedCollectionProgress({
      stage: "complete",
      source: shouldTryTaggedGraphQl ? "graphql" : "legacy",
      message: `Tagged collection complete • queued ${collected.length} file(s)`
    }, true);

    return buildResult();
  }

  async function startProfileBulkDownload(username, options = {}) {
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    if (!/^[A-Za-z0-9._]+$/.test(normalizedUsername)) {
      throw new Error("Invalid username");
    }

    const amstramgramBaseUrl = sanitizeAmstramgramUrl(USER_SETTINGS?.downloads?.amstramgramUrl ?? "");
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
    const maxItems = UTILITIES_CORE.toBoundedPositiveInt(options?.maxItems, USER_SETTINGS.profileDownload.maxItems, 0, 20000);
    const selection = sanitizeProfileDownloadSelection({
      includePosts: (typeof options?.includePosts === "boolean")
        ? options.includePosts
        : USER_SETTINGS.profileDownload.includePosts,
      includeReels: (typeof options?.includeReels === "boolean")
        ? options.includeReels
        : USER_SETTINGS.profileDownload.includeReels,
      includeHighlights: (typeof options?.includeHighlights === "boolean")
        ? options.includeHighlights
        : USER_SETTINGS.profileDownload.includeHighlights,
      includeTagged: (typeof options?.includeTagged === "boolean")
        ? options.includeTagged
        : USER_SETTINGS.profileDownload.includeTagged,
      includeProfilePicture: (typeof options?.includeProfilePicture === "boolean")
        ? options.includeProfilePicture
        : USER_SETTINGS.profileDownload.includeProfilePicture,
      taggedIncludeAllCarouselMedia: (typeof options?.taggedIncludeAllCarouselMedia === "boolean")
        ? options.taggedIncludeAllCarouselMedia
        : USER_SETTINGS.profileDownload.taggedIncludeAllCarouselMedia
    });
    const includePosts = selection.includePosts;
    const includeReels = selection.includeReels;
    const includeHighlights = selection.includeHighlights;
    const includeTagged = selection.includeTagged;
    const includeProfilePicture = selection.includeProfilePicture;
    const taggedIncludeAllCarouselMedia = includeTagged && selection.taggedIncludeAllCarouselMedia;
    const hasAnyTarget = includePosts || includeReels || includeHighlights || includeTagged || includeProfilePicture;
    if (!hasAnyTarget) {
      showToast(`Profile @${normalizedUsername}: no download targets selected.`, 5500);
      return { total: 0, completed: 0, failed: 0 };
    }
    const selectionLabel = getProfileDownloadSelectionLabel({
      includePosts,
      includeReels,
      includeHighlights,
      includeTagged,
      includeProfilePicture,
      taggedIncludeAllCarouselMedia
    });
    const profileBatchLabel = `Profile @${normalizedUsername} (${selectionLabel})`;
    const appId = getAppID();
    const profileBulkJobId = generateBatchJobId();
    const profileBulkSetupStartedAt = Date.now();
    let profileBulkSetupVisible = false;
    let profileBulkSetupLastUiUpdateAt = 0;

    function updateProfileBulkSetupProgress(progress = {}, force = false) {
      const now = Date.now();
      if (!force && now - profileBulkSetupLastUiUpdateAt < 150) return;
      profileBulkSetupLastUiUpdateAt = now;
      const stage = typeof progress?.stage === "string" ? progress.stage : "collect";
      const source = typeof progress?.source === "string" ? progress.source : "tagged";
      const page = Math.max(0, Number(progress?.pageCount) || 0);
      const collectedCount = Math.max(0, Number(progress?.collected) || 0);
      const subProcessed = Math.max(0, Number(progress?.subProcessed) || 0);
      const subTotal = Math.max(0, Number(progress?.subTotal) || 0);
      const rawPhase = typeof progress?.phase === "string" ? progress.phase.trim() : "";
      const rawMessage = typeof progress?.message === "string" ? progress.message.trim() : "";
      let phase = rawPhase || rawMessage;
      if (!phase) {
        if (stage === "graphql-resolve" && subTotal > 0) {
          phase = `collecting tagged posts • resolving posts ${subProcessed}/${subTotal}`;
        } else if (page > 0) {
          phase = `collecting tagged posts • ${source.toUpperCase()} page ${page}`;
        } else {
          phase = "collecting tagged posts";
        }
      }
      if (page > 0 && stage !== "graphql-resolve" && !/page\s+\d+/i.test(phase)) {
        phase = `${phase} • page ${page}`;
      }

      showBatchProgressIndicator({
        jobId: profileBulkJobId,
        label: profileBatchLabel,
        mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
        state: "running",
        phase: phase,
        total: 0,
        processed: collectedCount,
        completed: 0,
        failed: 0,
        cancelled: 0,
        indeterminate: true,
        elapsedMs: Math.max(0, now - profileBulkSetupStartedAt),
        forceVisible: true
      });
      profileBulkSetupVisible = true;
    }

    function finishProfileBulkSetupProgress(status = "completed", phase = "") {
      if (!profileBulkSetupVisible) return;
      showBatchProgressIndicator({
        jobId: profileBulkJobId,
        label: profileBatchLabel,
        mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
        state: "finished",
        status: status,
        phase: phase || "batch preparation finished",
        total: 0,
        processed: 0,
        completed: 0,
        failed: status === "failed" ? 1 : 0,
        cancelled: 0,
        indeterminate: false,
        elapsedMs: Math.max(0, Date.now() - profileBulkSetupStartedAt),
        forceVisible: false,
        final: true
      });
      profileBulkSetupVisible = false;
    }

    showToast(`Profile @${normalizedUsername}: collecting ${selectionLabel.toLowerCase()}...`, 3200);

    try {
      updateProfileBulkSetupProgress({
        stage: "prepare",
        phase: "preparing batch",
        collected: 0
      }, true);
      let userId = "";
      let profilePicTask = null;
      if (includeProfilePicture) {
        updateProfileBulkSetupProgress({
          stage: "resolve-profile",
          phase: "resolving profile info",
          collected: 0
        }, true);
        const profileInfo = await fetchProfileInfoDirect(normalizedUsername, appId);
        if (profileInfo?.userId) {
          userId = String(profileInfo.userId);
        }
        if (profileInfo?.success && profileInfo?.hdUrl) {
          profilePicTask = buildProfilePictureDownloadTask(normalizedUsername, profileInfo.hdUrl, userId);
          if (!profilePicTask) {
            showToast(`Profile @${normalizedUsername}: profile picture URL was invalid, skipping it.`, 5000);
          }
        } else if (profileInfo?.error) {
          showToast(`Profile @${normalizedUsername}: profile picture unavailable (${profileInfo.error}).`, 5000);
        }
      }

      const needsFeedCollections = includePosts || includeReels || includeHighlights || includeTagged;
      if (!userId && needsFeedCollections) {
        updateProfileBulkSetupProgress({
          stage: "resolve-profile",
          phase: "resolving profile info",
          collected: 0
        }, true);
        userId = await resolveProfileUserId(normalizedUsername, appId);
      }

      const scopedTasks = [];
      const seen = new Set();
      const addUniqueScopedTasks = (tasks) => {
        for (const task of tasks) {
          const key = `${task.url}|${task.filename}`;
          if (seen.has(key)) continue;
          seen.add(key);
          scopedTasks.push(task);
          if (maxItems > 0 && scopedTasks.length >= maxItems) break;
        }
      };
      const addUniqueExtraTask = (task) => {
        if (!task || !task.url || !task.filename) return;
        const key = `${task.url}|${task.filename}`;
        if (seen.has(key)) return;
        seen.add(key);
        scopedTasks.push(task);
      };

      // Shared counters merged from all four collectors in this bulk run.
      // Step 5.6: a single object reflects the combined totals used for
      // the consolidated summary log at the end.
      const combinedDateFilterCounters = { scanned: 0, matched: 0, outOfRange: 0, noDateSkipped: 0 };
      let combinedDateFilterTerminatedEarly = false;
      const mergeDateFilterCounters = (result) => {
        const counters = result && result.dateFilterCounters;
        if (counters) {
          combinedDateFilterCounters.scanned += Number(counters.scanned) || 0;
          combinedDateFilterCounters.matched += Number(counters.matched) || 0;
          combinedDateFilterCounters.outOfRange += Number(counters.outOfRange) || 0;
          combinedDateFilterCounters.noDateSkipped += Number(counters.noDateSkipped) || 0;
        }
        if (result && result.dateFilterTerminatedEarly === true) {
          combinedDateFilterTerminatedEarly = true;
        }
      };
      let combinedDeltaSyncSkippedCount = 0;
      let combinedDeltaSyncTerminatedEarly = false;
      const mergeDeltaSyncCounters = (result) => {
        combinedDeltaSyncSkippedCount += Number(result?.deltaSyncSkippedCount) || 0;
        if (result?.deltaSyncTerminatedEarly === true) {
          combinedDeltaSyncTerminatedEarly = true;
        }
      };

      if (includePosts) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "posts",
            phase: "collecting posts",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting posts...`, 2600);
          const postResult = await collectProfileDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "posts",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(postResult.tasks);
          mergeDateFilterCounters(postResult);
          mergeDeltaSyncCounters(postResult);
        }
      }

      if (includeReels && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "reels",
            phase: "collecting reels",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting reels...`, 2600);
          const reelResult = await collectProfileReelDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "reels",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(reelResult.tasks);
          mergeDateFilterCounters(reelResult);
        }
      }

      if (includeHighlights && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "highlights",
            phase: "collecting highlights",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting highlights...`, 2600);
          const highlightResult = await collectProfileHighlightDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              onProgressText: (text) => {
                updateProfileBulkSetupProgress({
                  stage: "highlights",
                  phase: text,
                  collected: scopedTasks.length
                });
              }
            }
          );
          addUniqueScopedTasks(highlightResult.tasks);
          mergeDateFilterCounters(highlightResult);
        }
      }

      if (includeTagged && (maxItems === 0 || scopedTasks.length < maxItems)) {
        const remainingLimit = maxItems > 0 ? Math.max(0, maxItems - scopedTasks.length) : 0;
        if (maxItems === 0 || remainingLimit > 0) {
          updateProfileBulkSetupProgress({
            stage: "tagged",
            phase: "collecting tagged posts",
            collected: scopedTasks.length
          }, true);
          showToast(`Profile @${normalizedUsername}: collecting tagged posts...`, 2600);
          updateProfileBulkSetupProgress({
            stage: "start",
            source: "tagged",
            pageCount: 0,
            collected: scopedTasks.length,
            phase: "collecting tagged posts"
          }, true);
          const taggedResult = await collectTaggedProfileDownloadTasks(
            normalizedUsername,
            userId,
            appId,
            policy,
            remainingLimit,
            {
              includeAllCarouselMedia: taggedIncludeAllCarouselMedia,
              onProgress: (progress) => {
                updateProfileBulkSetupProgress({
                  ...progress,
                  collected: scopedTasks.length + Math.max(0, Number(progress?.collected) || 0)
                });
              }
            }
          );
          addUniqueScopedTasks(taggedResult.tasks);
          mergeDateFilterCounters(taggedResult);
        }
      }

      // Consolidated date-filter summary (Step 5.7). Emitted once per bulk run,
      // after every collector has completed, reflecting combined totals across
      // posts + reels + highlights + tagged.
      const activeDateFilter = USER_SETTINGS?.profileDownload?.dateFilter;
      if (activeDateFilter && activeDateFilter.enabled === true) {
        let summary = `[Amstragram] Date filter: collected ${combinedDateFilterCounters.matched} items across all content types`
          + ` (${combinedDateFilterCounters.matched} of ${combinedDateFilterCounters.scanned} scanned`;
        if (combinedDateFilterCounters.noDateSkipped > 0) {
          summary += `; ${combinedDateFilterCounters.noDateSkipped} skipped: no date`;
        }
        summary += `)`;
        if (combinedDateFilterTerminatedEarly) {
          summary += ` — one or more feeds stopped early (remaining items are older than start date)`;
        }
        debugLog(summary);
      }
      if (combinedDeltaSyncSkippedCount > 0) {
        debugLog(`[Amstragram] Delta sync: skipped ${combinedDeltaSyncSkippedCount} already-downloaded item(s)${combinedDeltaSyncTerminatedEarly ? " (terminated early)" : ""}.`);
      }

      if (profilePicTask) {
        addUniqueExtraTask(profilePicTask);
      }

      if (scopedTasks.length === 0) {
        finishProfileBulkSetupProgress("completed", "no downloadable content found");
        showToast(`Profile @${normalizedUsername}: no downloadable content found for selected targets.`, 5500);
        return { total: 0, completed: 0, failed: 0 };
      }

      const labelSuffix = selectionLabel;
      showToast(`Profile @${normalizedUsername}: ${scopedTasks.length} file(s) queued (${labelSuffix}).`, 3200);
      if (combinedDeltaSyncSkippedCount > 0) {
        ensureBatchRunRecord({ jobId: profileBulkJobId }).skipped = combinedDeltaSyncSkippedCount;
      }
      if (profileBulkSetupVisible) {
        showBatchProgressIndicator({
          jobId: profileBulkJobId,
          label: profileBatchLabel,
          mode: USER_SETTINGS?.downloads?.bulkAsZip ? "zip" : "download",
          state: "running",
          phase: "queued, starting downloads",
          total: Math.max(1, scopedTasks.length),
          processed: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          skipped: combinedDeltaSyncSkippedCount,
          indeterminate: false,
          elapsedMs: Math.max(0, Date.now() - profileBulkSetupStartedAt),
          forceVisible: false
        });
        profileBulkSetupVisible = false;
      }
      return await runBatchDownloadTasks(scopedTasks, policy, {
        label: `Profile @${normalizedUsername} (${labelSuffix})`,
        jobId: profileBulkJobId
      });
    } catch (err) {
      finishProfileBulkSetupProgress("failed", "batch preparation failed");
      const message = err?.message || "Unknown error";
      if (message.includes("429")) {
        showToast(`Profile @${normalizedUsername}: rate-limited (HTTP 429).`, 7000);
      } else {
        showToast(`Profile @${normalizedUsername}: ${message}`, 7000);
      }
      throw err;
    }
  }

  // =========================================
  // INIT WIRING AND GLOBAL RIGHT-CLICK LISTENER
  // =========================================
  document.addEventListener("contextmenu", async (e) => {
    // Bypass: Shift + Ctrl/Cmd + right-click hands the event to the
    // browser's native context menu (e.g. for "Open link in new tab").
    if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
      return;
    }

    // Check for stories first
    if (window.location.pathname.includes("/stories/")) {
      await handleStoryRightClick(e);
      return;
    }

    if (typeof handleStoryBubbleRightClick === "function") {
      const handledStoryBubble = await handleStoryBubbleRightClick(e);
      if (handledStoryBubble) {
        return;
      }
    }

    // Check for highlight bubbles on profile pages
    if (typeof handleHighlightBubbleRightClick === "function") {
      const handledHighlightBubble = await handleHighlightBubbleRightClick(e);
      if (handledHighlightBubble) {
        return;
      }
    }

    // Check for profile picture
    const target = e.target;
    if (target.tagName === "IMG" && (
      target.alt?.toLowerCase().includes("profile picture") ||
      target.getAttribute('data-testid') === 'user-avatar' ||
      target.closest('header')?.contains(target)
    )) {
      await handleProfilePicRightClick(e);
      return;
    }

    // Handle direct message threads (must run before post handler to
    // prevent "Could not find post ID" fallthrough on /direct/ URLs)
    if (typeof handleDirectMessageRightClick === "function") {
      const handledDm = await handleDirectMessageRightClick(e);
      if (handledDm) return;
    }

    // Handle posts
    await handlePostRightClick(e);
  }, true);

  if (typeof window !== "undefined") {
    window.__amstragram_media_diagnostics = function getAmstragramMediaDiagnostics() {
      if (typeof DOWNLOAD_PIPELINE_CORE === "undefined" || typeof DOWNLOAD_PIPELINE_CORE.getMediaDiagnosticLog !== "function") {
        return [];
      }
      return DOWNLOAD_PIPELINE_CORE.getMediaDiagnosticLog();
    };

    window.__amstragram_video_diagnostics = function getAmstragramVideoDiagnostics() {
      if (typeof DOWNLOAD_PIPELINE_CORE === "undefined" || typeof DOWNLOAD_PIPELINE_CORE.getDiagnosticLog !== "function") {
        return [];
      }
      return DOWNLOAD_PIPELINE_CORE.getDiagnosticLog();
    };
  }
})();

