// =========================================
// DATE FILTER CORE
// =========================================
//
// Pure helpers for the bulk-download date filter.
//
// Contract:
//   itemPassesDateFilter(takenAtSeconds, config)
//     -> { pass: boolean, reason: string, belowLowerBound: boolean }
//
//   canEarlyTerminate(config)
//     -> boolean
//
// config shape (see DEFAULT_USER_SETTINGS.profileDownload.dateFilter in bootstrap):
//   { enabled: boolean, mode: "before"|"after"|"between", startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
//
// IMPORTANT: This module cannot import from other core modules per CLAUDE.md's
// src/core/ constraint. Any shared coercion logic is duplicated inline.
//
const DATE_FILTER_CORE = (() => {
  // Duplicated (deliberately) from filename-metadata-core.js normalizeMetadataTimestamp.
  // Accepts a Unix seconds number, Unix milliseconds number, ISO string, or null/garbage.
  // Returns the Unix seconds integer, or null if the value can't be interpreted.
  function coerceTakenAtToUnixSeconds(value) {
    if (value === null || value === undefined || value === "") return null;

    let numeric = null;
    if (typeof value === "number" && Number.isFinite(value)) {
      numeric = value;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        numeric = Number(trimmed);
      } else {
        const parsedMs = Date.parse(trimmed);
        if (!Number.isFinite(parsedMs)) return null;
        const unixFromIso = Math.floor(parsedMs / 1000);
        return unixFromIso > 0 ? unixFromIso : null;
      }
    } else {
      return null;
    }

    if (!Number.isFinite(numeric)) return null;
    const asSeconds = Math.abs(numeric) > 1000000000000 ? numeric / 1000 : numeric;
    const unix = Math.floor(asSeconds);
    return Number.isFinite(unix) && unix > 0 ? unix : null;
  }

  // Parses "YYYY-MM-DD" into the local-midnight Unix MS of that day, or null if invalid.
  function parseDateStringToLocalMidnightMs(dateString) {
    if (typeof dateString !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const ms = new Date(`${dateString}T00:00:00`).getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  // Returns the local-midnight Unix MS of the day AFTER the given "YYYY-MM-DD", or null.
  // Used to convert an inclusive "endDate" into an exclusive upper-bound boundary.
  function parseEndDateToNextDayMidnightMs(dateString) {
    const ms = parseDateStringToLocalMidnightMs(dateString);
    if (ms === null) return null;
    return ms + 24 * 60 * 60 * 1000;
  }

  function itemPassesDateFilter(takenAtSeconds, config) {
    // Treat a missing or malformed config as "disabled" — forgiving default.
    if (!config || config.enabled !== true) {
      return { pass: true, reason: "disabled", belowLowerBound: false };
    }

    const unixSeconds = coerceTakenAtToUnixSeconds(takenAtSeconds);
    if (unixSeconds === null) {
      return { pass: false, reason: "no-date", belowLowerBound: false };
    }

    const takenAtMs = unixSeconds * 1000;
    const mode = config.mode;

    // Compute boundaries based on mode. Blank date strings on either side are
    // treated as "unbounded" on that side (forgiving partial config).
    let startBoundaryMs = null;
    let endBoundaryMs = null;

    if (mode === "after") {
      startBoundaryMs = parseDateStringToLocalMidnightMs(config.startDate);
    } else if (mode === "before") {
      endBoundaryMs = parseEndDateToNextDayMidnightMs(config.endDate);
    } else if (mode === "between") {
      startBoundaryMs = parseDateStringToLocalMidnightMs(config.startDate);
      endBoundaryMs = parseEndDateToNextDayMidnightMs(config.endDate);
    } else {
      // Unknown mode — treat as disabled to be forgiving.
      return { pass: true, reason: "disabled", belowLowerBound: false };
    }

    // If the active side for a mode ended up null (blank date), treat it as unbounded.
    const belowStart = startBoundaryMs !== null && takenAtMs < startBoundaryMs;
    const aboveEnd = endBoundaryMs !== null && takenAtMs >= endBoundaryMs;

    if (belowStart || aboveEnd) {
      return {
        pass: false,
        reason: "out-of-range",
        belowLowerBound: belowStart
      };
    }

    return { pass: true, reason: "ok", belowLowerBound: false };
  }

  function canEarlyTerminate(config) {
    if (!config || config.enabled !== true) return false;
    if (config.mode === "after") {
      return parseDateStringToLocalMidnightMs(config.startDate) !== null;
    }
    if (config.mode === "between") {
      return parseDateStringToLocalMidnightMs(config.startDate) !== null;
    }
    return false;
  }

  return {
    coerceTakenAtToUnixSeconds,
    itemPassesDateFilter,
    canEarlyTerminate
  };
})();
