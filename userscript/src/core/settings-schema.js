const SETTINGS_SCHEMA_CORE = (() => {
  const SETTINGS_SCHEMA_VERSION = 2;

  const PROFILE_RESERVED_PATHS = new Set([
    "stories",
    "highlights",
    "explore",
    "reels",
    "direct",
    "accounts",
    "settings",
    "language",
    "create",
    "notifications",
    "nametag",
    "directory",
    "ar",
    "legal",
    "terms",
    "about",
    "emails",
    "session",
    "challenge",
    "lite",
    "p",
    "reel",
    "tv"
  ]);

  const DEFAULT_USER_SETTINGS = {
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    hotkey: "Alt+Shift+I",
    showSettingsLauncher: true,
    theme: "auto",
    riskPreset: "balanced",
    safetyThresholdCount: 40,
    customPolicy: {
      minDelayMs: 400,
      maxDelayMs: 1200,
      cooldownEvery: 60,
      cooldownMs: 20000,
      retryCount: 1,
      retryBackoffMs: 2000
    },
    profileDownload: {
      maxItems: 300,
      requireWarningAck: true,
      includePosts: true,
      includeReels: false,
      includeHighlights: false,
      includeTagged: false,
      includeProfilePicture: false,
      taggedIncludeAllCarouselMedia: false,
      dateFilter: {
        enabled: false,
        mode: "after",
        startDate: "",
        endDate: ""
      }
    },
    downloads: {
      androidCompatMode: false,
      useCustomFolder: false,
      folderLabel: "",
      filenameTemplate: "",
      filenameSeparator: "_",
      bulkAsZip: false,
      skipPreviouslyDownloaded: false,
      amstramgramUrl: "",
      useTypeSubfolders: true,
      saveMetadataJson: false,
      saveMetadataXmp: false,
      saveMetadataIptc: false,
      saveMetadataXmpExif: false,
      videoContainer: "mp4"
    },
    downloadSource: "profile",
    savedDownload: {
      selectedCollections: [],
      useCollectionSubfolder: true
    }
  };

  function sanitizeRiskPreset(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return ["safe", "balanced", "aggressive", "custom"].includes(normalized)
      ? normalized
      : DEFAULT_USER_SETTINGS.riskPreset;
  }

  function sanitizeHotkey(value) {
    if (typeof value !== "string") return DEFAULT_USER_SETTINGS.hotkey;
    const trimmed = value.trim().replace(/\s+/g, "");
    if (!trimmed || trimmed.length > 40) return DEFAULT_USER_SETTINGS.hotkey;

    const tokens = trimmed.split("+").map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) return DEFAULT_USER_SETTINGS.hotkey;

    const aliases = {
      control: "Ctrl",
      ctrl: "Ctrl",
      alt: "Alt",
      option: "Alt",
      shift: "Shift",
      meta: "Meta",
      cmd: "Meta",
      command: "Meta"
    };

    const orderedModifiers = ["Ctrl", "Alt", "Shift", "Meta"];
    const modifiers = new Set();
    let keyToken = null;

    for (const token of tokens) {
      const lowered = token.toLowerCase();
      const mappedModifier = aliases[lowered];
      if (mappedModifier && orderedModifiers.includes(mappedModifier)) {
        modifiers.add(mappedModifier);
        continue;
      }
      if (keyToken) return DEFAULT_USER_SETTINGS.hotkey;
      keyToken = token;
    }

    if (!keyToken) return DEFAULT_USER_SETTINGS.hotkey;

    const formattedKey = keyToken.length === 1
      ? keyToken.toUpperCase()
      : keyToken[0].toUpperCase() + keyToken.slice(1);
    const sortedMods = orderedModifiers.filter((mod) => modifiers.has(mod));
    return sortedMods.length > 0
      ? `${sortedMods.join("+")}+${formattedKey}`
      : formattedKey;
  }

  function sanitizeShowSettingsLauncher(value) {
    return (typeof value === "boolean")
      ? value
      : DEFAULT_USER_SETTINGS.showSettingsLauncher;
  }

  function sanitizeTheme(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return ["dark", "light", "auto"].includes(normalized)
      ? normalized
      : DEFAULT_USER_SETTINGS.theme;
  }

  function sanitizeProfileDownloadScope(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
    return ["posts", "highlights", "profile", "tagged"].includes(normalized) ? normalized : "posts";
  }

  function getLegacyProfileDownloadTargetsFromScope(scope) {
    const normalizedScope = sanitizeProfileDownloadScope(scope);
    return {
      includePosts: normalizedScope === "posts" || normalizedScope === "profile",
      includeHighlights: normalizedScope === "highlights" || normalizedScope === "profile",
      includeTagged: normalizedScope === "tagged"
    };
  }

  function sanitizeProfileDownloadSelection(value) {
    const source = value && typeof value === "object" ? value : {};
    const legacyTargets = getLegacyProfileDownloadTargetsFromScope(source.scope);
    return {
      includePosts: (typeof source.includePosts === "boolean")
        ? source.includePosts
        : legacyTargets.includePosts,
      includeReels: (typeof source.includeReels === "boolean")
        ? source.includeReels
        : DEFAULT_USER_SETTINGS.profileDownload.includeReels,
      includeHighlights: (typeof source.includeHighlights === "boolean")
        ? source.includeHighlights
        : legacyTargets.includeHighlights,
      includeTagged: (typeof source.includeTagged === "boolean")
        ? source.includeTagged
        : legacyTargets.includeTagged,
      includeProfilePicture: (typeof source.includeProfilePicture === "boolean")
        ? source.includeProfilePicture
        : DEFAULT_USER_SETTINGS.profileDownload.includeProfilePicture,
      taggedIncludeAllCarouselMedia: (typeof source.taggedIncludeAllCarouselMedia === "boolean")
        ? source.taggedIncludeAllCarouselMedia
        : DEFAULT_USER_SETTINGS.profileDownload.taggedIncludeAllCarouselMedia
    };
  }

  function areAllProfileDownloadTargetsEnabled(selection) {
    const normalized = sanitizeProfileDownloadSelection(selection);
    return normalized.includePosts
      && normalized.includeReels
      && normalized.includeHighlights
      && normalized.includeTagged
      && normalized.includeProfilePicture
      && normalized.taggedIncludeAllCarouselMedia;
  }

  function getProfileDownloadSelectionLabel(selection) {
    const normalized = sanitizeProfileDownloadSelection(selection);
    if (areAllProfileDownloadTargetsEnabled(normalized)) {
      return "Entire profile (all content types)";
    }

    const parts = [];
    if (normalized.includePosts) parts.push("posts");
    if (normalized.includeReels) parts.push("reels");
    if (normalized.includeHighlights) parts.push("highlights");
    if (normalized.includeTagged) {
      parts.push(
        normalized.taggedIncludeAllCarouselMedia
          ? "tagged posts (all carousel slides)"
          : "tagged posts (tagged slides only)"
      );
    }
    if (normalized.includeProfilePicture) parts.push("profile picture");
    if (parts.length === 0) return "nothing selected";
    return parts.join(", ");
  }

  function sanitizeOutputFolderLabel(value) {
    if (typeof value !== "string") return "";
    const cleaned = value
      .replace(/[\u0000-\u001F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.slice(0, 180);
  }

  function sanitizeFilenameTemplate(value) {
    if (typeof value !== "string") return "";
    const cleaned = value
      .replace(/[\u0000-\u001F]/g, "")
      .trim();
    return cleaned.slice(0, 240);
  }

  function sanitizeAmstramgramUrl(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return trimmed.slice(0, 200);
    } catch {
      return "";
    }
  }

  function sanitizeDownloadSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const androidCompatMode = (typeof source.androidCompatMode === "boolean")
      ? source.androidCompatMode
      : DEFAULT_USER_SETTINGS.downloads.androidCompatMode;
    return {
      androidCompatMode,
      useCustomFolder: androidCompatMode ? false : !!source.useCustomFolder,
      folderLabel: sanitizeOutputFolderLabel(source.folderLabel),
      filenameTemplate: sanitizeFilenameTemplate(source.filenameTemplate),
      filenameSeparator: (typeof source.filenameSeparator === "string" && source.filenameSeparator.length <= 1)
        ? source.filenameSeparator
        : (source.filenameSeparator === null ? null : DEFAULT_USER_SETTINGS.downloads.filenameSeparator),
      bulkAsZip: androidCompatMode ? false : !!source.bulkAsZip,
      skipPreviouslyDownloaded: (typeof source.skipPreviouslyDownloaded === "boolean")
        ? source.skipPreviouslyDownloaded
        : DEFAULT_USER_SETTINGS.downloads.skipPreviouslyDownloaded,
      amstramgramUrl: sanitizeAmstramgramUrl(source.amstramgramUrl),
      useTypeSubfolders: androidCompatMode
        ? false
        : (typeof source.useTypeSubfolders === "boolean")
          ? source.useTypeSubfolders
          : DEFAULT_USER_SETTINGS.downloads.useTypeSubfolders,
      saveMetadataJson: androidCompatMode
        ? false
        : (typeof source.saveMetadataJson === "boolean")
          ? source.saveMetadataJson
          : DEFAULT_USER_SETTINGS.downloads.saveMetadataJson,
      saveMetadataXmp: androidCompatMode
        ? false
        : (typeof source.saveMetadataXmp === "boolean")
          ? source.saveMetadataXmp
          : DEFAULT_USER_SETTINGS.downloads.saveMetadataXmp,
      saveMetadataIptc: androidCompatMode
        ? false
        : (typeof source.saveMetadataIptc === "boolean")
          ? source.saveMetadataIptc
          : DEFAULT_USER_SETTINGS.downloads.saveMetadataIptc,
      saveMetadataXmpExif: androidCompatMode
        ? false
        : (typeof source.saveMetadataXmpExif === "boolean")
          ? source.saveMetadataXmpExif
          : DEFAULT_USER_SETTINGS.downloads.saveMetadataXmpExif,
      videoContainer: (source.videoContainer === "mp4" || source.videoContainer === "mkv")
        ? source.videoContainer
        : DEFAULT_USER_SETTINGS.downloads.videoContainer
    };
  }

  function sanitizeSavedDownloadSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const selectedRaw = Array.isArray(source.selectedCollections)
      ? source.selectedCollections.filter(v => typeof v === "string" && v.trim())
      : [];
    return {
      selectedCollections: selectedRaw,
      useCollectionSubfolder: (typeof source.useCollectionSubfolder === "boolean")
        ? source.useCollectionSubfolder
        : DEFAULT_USER_SETTINGS.savedDownload.useCollectionSubfolder
    };
  }

  function sanitizeDownloadSource(value, legacySavedEnabled) {
    if (value === "profile" || value === "saved") return value;
    // Migration: if old savedDownload.enabled was true, default to "saved"
    if (legacySavedEnabled === true) return "saved";
    return DEFAULT_USER_SETTINGS.downloadSource;
  }

  function sanitizePolicy(policy) {
    const source = policy && typeof policy === "object" ? policy : {};
    const minDelayMs = UTILITIES_CORE.toBoundedPositiveInt(source.minDelayMs, DEFAULT_USER_SETTINGS.customPolicy.minDelayMs, 0, 600000);
    const maxDelayMs = UTILITIES_CORE.toBoundedPositiveInt(source.maxDelayMs, DEFAULT_USER_SETTINGS.customPolicy.maxDelayMs, 0, 600000);
    const normalizedMin = Math.min(minDelayMs, maxDelayMs);
    const normalizedMax = Math.max(minDelayMs, maxDelayMs);
    return {
      minDelayMs: normalizedMin,
      maxDelayMs: normalizedMax,
      cooldownEvery: UTILITIES_CORE.toBoundedPositiveInt(source.cooldownEvery, DEFAULT_USER_SETTINGS.customPolicy.cooldownEvery, 0, 5000),
      cooldownMs: UTILITIES_CORE.toBoundedPositiveInt(source.cooldownMs, DEFAULT_USER_SETTINGS.customPolicy.cooldownMs, 0, 3600000),
      retryCount: UTILITIES_CORE.toBoundedPositiveInt(source.retryCount, DEFAULT_USER_SETTINGS.customPolicy.retryCount, 0, 8),
      retryBackoffMs: UTILITIES_CORE.toBoundedPositiveInt(source.retryBackoffMs, DEFAULT_USER_SETTINGS.customPolicy.retryBackoffMs, 0, 600000)
    };
  }

  function normalizeDateFilter(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const validModes = ["before", "after", "between"];
    const modeIsValid = validModes.includes(source.mode);
    // Unknown or legacy mode (e.g. "off") → force enabled false and fall back to "after".
    const mode = modeIsValid ? source.mode : DEFAULT_USER_SETTINGS.profileDownload.dateFilter.mode;
    const enabled = modeIsValid ? (source.enabled === true) : false;

    const dateStringPattern = /^\d{4}-\d{2}-\d{2}$/;
    const startDate = (typeof source.startDate === "string" && dateStringPattern.test(source.startDate))
      ? source.startDate
      : DEFAULT_USER_SETTINGS.profileDownload.dateFilter.startDate;
    const endDate = (typeof source.endDate === "string" && dateStringPattern.test(source.endDate))
      ? source.endDate
      : DEFAULT_USER_SETTINGS.profileDownload.dateFilter.endDate;

    return { enabled, mode, startDate, endDate };
  }

  // Pure — given a dateFilter-shaped input, returns which visual elements of
  // the settings card should be hidden and whether the two-date grid should
  // collapse to a single column. Kept free of DOM access so it is unit-testable
  // without a real modal.
  function computeDateFilterVisibilityState({ enabled, mode, startDate, endDate }) {
    const bodyHidden = !enabled;
    const showStart = mode === "after" || mode === "between";
    const showEnd = mode === "before" || mode === "between";
    const single = (showStart && !showEnd) || (showEnd && !showStart);
    const hasStart = typeof startDate === "string" && startDate.length > 0;
    const hasEnd = typeof endDate === "string" && endDate.length > 0;
    const reversed = enabled
      && mode === "between"
      && hasStart && hasEnd
      && endDate < startDate;
    return {
      bodyHidden,
      startHidden: !showStart,
      endHidden: !showEnd,
      single,
      warningHidden: !reversed
    };
  }

  function normalizeUserSettings(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const profileSettings = source.profileDownload && typeof source.profileDownload === "object"
      ? source.profileDownload
      : {};
    const normalizedProfileSelection = sanitizeProfileDownloadSelection(profileSettings);
    const downloadSettings = source.downloads && typeof source.downloads === "object"
      ? source.downloads
      : {};
    const savedDownloadSettings = source.savedDownload && typeof source.savedDownload === "object"
      ? source.savedDownload
      : {};
    // Extract legacy savedDownload.enabled for migration to downloadSource
    const legacySavedEnabled = savedDownloadSettings.enabled;
    return {
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
      hotkey: sanitizeHotkey(source.hotkey),
      showSettingsLauncher: sanitizeShowSettingsLauncher(source.showSettingsLauncher),
      theme: sanitizeTheme(source.theme),
      downloadSource: sanitizeDownloadSource(source.downloadSource, legacySavedEnabled),
      riskPreset: sanitizeRiskPreset(source.riskPreset),
      safetyThresholdCount: UTILITIES_CORE.toBoundedPositiveInt(source.safetyThresholdCount, DEFAULT_USER_SETTINGS.safetyThresholdCount, 1, 20000),
      customPolicy: sanitizePolicy(source.customPolicy),
      profileDownload: {
        maxItems: UTILITIES_CORE.toBoundedPositiveInt(profileSettings.maxItems, DEFAULT_USER_SETTINGS.profileDownload.maxItems, 0, 20000),
        requireWarningAck: DEFAULT_USER_SETTINGS.profileDownload.requireWarningAck,
        includePosts: normalizedProfileSelection.includePosts,
        includeReels: normalizedProfileSelection.includeReels,
        includeHighlights: normalizedProfileSelection.includeHighlights,
        includeTagged: normalizedProfileSelection.includeTagged,
        includeProfilePicture: normalizedProfileSelection.includeProfilePicture,
        taggedIncludeAllCarouselMedia: normalizedProfileSelection.taggedIncludeAllCarouselMedia,
        dateFilter: normalizeDateFilter(profileSettings.dateFilter)
      },
      downloads: sanitizeDownloadSettings(downloadSettings),
      savedDownload: sanitizeSavedDownloadSettings(savedDownloadSettings)
    };
  }

  function migrateLegacyMetadataSettings(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { settings: raw, migrated: false, removedTxtSidecar: false };
    }

    const currentVersion = Number(raw.settingsSchemaVersion);
    if (Number.isFinite(currentVersion) && currentVersion >= SETTINGS_SCHEMA_VERSION) {
      return { settings: raw, migrated: false, removedTxtSidecar: false };
    }

    const downloads = raw.downloads && typeof raw.downloads === "object" && !Array.isArray(raw.downloads)
      ? raw.downloads
      : {};
    const legacyKeys = [
      "saveMetadataExif",
      "saveMetadataTxt",
      "saveMetadataExifXmp",
      "saveMetadataExifExif",
      "saveMetadataExifIptc"
    ];
    const hasLegacyMetadataKeys = legacyKeys.some((key) => Object.prototype.hasOwnProperty.call(downloads, key));
    const migratedDownloads = { ...downloads };

    if (downloads.saveMetadataExif === true) {
      migratedDownloads.saveMetadataJson = true;
    }
    if (downloads.saveMetadataExifXmp === true) {
      migratedDownloads.saveMetadataXmp = true;
    }
    if (downloads.saveMetadataExifIptc === true) {
      migratedDownloads.saveMetadataIptc = true;
    }
    if (downloads.saveMetadataExifExif === true) {
      migratedDownloads.saveMetadataXmpExif = true;
    }

    for (const key of legacyKeys) {
      delete migratedDownloads[key];
    }

    return {
      settings: {
        ...raw,
        settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
        downloads: migratedDownloads
      },
      migrated: hasLegacyMetadataKeys || !Number.isFinite(currentVersion) || currentVersion < SETTINGS_SCHEMA_VERSION,
      removedTxtSidecar: downloads.saveMetadataTxt === true
    };
  }


  return {
    PROFILE_RESERVED_PATHS,
    DEFAULT_USER_SETTINGS,
    sanitizeRiskPreset,
    sanitizeHotkey,
    sanitizeTheme,
    sanitizeProfileDownloadSelection,
    getProfileDownloadSelectionLabel,
    sanitizeOutputFolderLabel,
    sanitizeAmstramgramUrl,
    sanitizeSavedDownloadSettings,
    sanitizePolicy,
    normalizeDateFilter,
    computeDateFilterVisibilityState,
    normalizeUserSettings,
    migrateLegacyMetadataSettings
  };
})();
