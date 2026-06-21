(function () {
  "use strict";
  // Built from modular sources via scripts/build-userscript.mjs.

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
      await PAGE_HANDLERS_CORE.handleStoryRightClick(e);
      return;
    }

    if (typeof PAGE_HANDLERS_CORE.handleStoryBubbleRightClick === "function") {
      const handledStoryBubble = await PAGE_HANDLERS_CORE.handleStoryBubbleRightClick(e);
      if (handledStoryBubble) {
        return;
      }
    }

    // Check for highlight bubbles on profile pages
    if (typeof PAGE_HANDLERS_CORE.handleHighlightBubbleRightClick === "function") {
      const handledHighlightBubble = await PAGE_HANDLERS_CORE.handleHighlightBubbleRightClick(e);
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
      await PAGE_HANDLERS_CORE.handleProfilePicRightClick(e);
      return;
    }

    // Handle direct message threads (must run before post handler to
    // prevent "Could not find post ID" fallthrough on /direct/ URLs)
    if (typeof PAGE_HANDLERS_CORE.handleDirectMessageRightClick === "function") {
      const handledDm = await PAGE_HANDLERS_CORE.handleDirectMessageRightClick(e);
      if (handledDm) return;
    }

    // Handle posts
    await PAGE_HANDLERS_CORE.handlePostRightClick(e);
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
