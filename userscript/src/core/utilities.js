const UTILITIES_CORE = (() => {
  function normalizeNumericIdentifier(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return String(Math.trunc(value));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^[0-9]+$/.test(trimmed)) return trimmed;
    }
    return fallback;
  }

  function toBoundedPositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    if (normalized < min || normalized > max) return fallback;
    return normalized;
  }

  function clampNumber(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sleepMs(ms) {
    const timeout = Math.max(0, Number(ms) || 0);
    if (!timeout) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, timeout));
  }

  function randomIntBetween(minValue, maxValue) {
    const min = Math.max(0, Number(minValue) || 0);
    const max = Math.max(min, Number(maxValue) || 0);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function createDebugLogger(enabledFlag) {
    let enabled = !!enabledFlag;

    function debugLog(...args) {
      if (!enabled) return;
      console.log(...args);
    }

    debugLog.setEnabled = (flag) => {
      enabled = !!flag;
    };
    debugLog.isEnabled = () => enabled;
    return debugLog;
  }

  function getPageWindow() {
    try {
      if (typeof unsafeWindow !== "undefined") return unsafeWindow;
      return window.wrappedJSObject || window;
    } catch {
      return window;
    }
  }

  function isAndroidUserAgent() {
    try {
      return /android/i.test(String(navigator?.userAgent || ""));
    } catch {
      return false;
    }
  }

  function computeSettingsTooltipPosition(anchorRect, tooltipRect, viewportWidth, viewportHeight) {
    const safeAnchorRect = anchorRect && typeof anchorRect === "object" ? anchorRect : {};
    const safeTooltipRect = tooltipRect && typeof tooltipRect === "object" ? tooltipRect : {};
    const tooltipWidth = Math.max(0, Number(safeTooltipRect.width) || 0);
    const tooltipHeight = Math.max(0, Number(safeTooltipRect.height) || 0);
    const anchorLeft = Number(safeAnchorRect.left) || 0;
    const anchorRight = Number(safeAnchorRect.right) || anchorLeft;
    const anchorTop = Number(safeAnchorRect.top) || 0;
    const anchorBottom = Number(safeAnchorRect.bottom) || anchorTop;
    const safeViewportWidth = Math.max(0, Number(viewportWidth) || 0);
    const safeViewportHeight = Math.max(0, Number(viewportHeight) || 0);
    const viewportMargin = 12;
    const tooltipGap = 8;
    const anchorCenterX = anchorLeft + ((anchorRight - anchorLeft) / 2);
    const maxLeft = Math.max(viewportMargin, safeViewportWidth - tooltipWidth - viewportMargin);
    const maxTop = Math.max(viewportMargin, safeViewportHeight - tooltipHeight - viewportMargin);
    const preferredLeft = anchorCenterX - (tooltipWidth / 2);
    const preferredTop = anchorTop - tooltipHeight - tooltipGap;
    const preferredBottom = anchorBottom + tooltipGap;
    const spaceAbove = anchorTop - viewportMargin - tooltipGap;
    const spaceBelow = safeViewportHeight - anchorBottom - viewportMargin - tooltipGap;
    const placeBelow = spaceAbove < tooltipHeight && spaceBelow > spaceAbove;

    return {
      left: Math.round(clampNumber(preferredLeft, viewportMargin, maxLeft)),
      top: Math.round(clampNumber(placeBelow ? preferredBottom : preferredTop, viewportMargin, maxTop)),
      placement: placeBelow ? "bottom" : "top"
    };
  }

  return {
    normalizeNumericIdentifier,
    toBoundedPositiveInt,
    clampNumber,
    escapeHtml,
    sleepMs,
    randomIntBetween,
    createDebugLogger,
    getPageWindow,
    isAndroidUserAgent,
    computeSettingsTooltipPosition
  };
})();
// =========================================
// ZIP CORE
// =========================================
