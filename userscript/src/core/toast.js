const TOAST_CORE = (() => {
  let currentToast = null;

  function showToast(message, durationMs = 3500, options = {}) {
    if (!message) return;
    if (currentToast) {
      currentToast.remove();
      currentToast = null;
    }

    const elementId = options.elementId || "ig-hd-toast";
    const toast = document.createElement("div");
    toast.id = elementId;
    toast.textContent = String(message);
    document.body.appendChild(toast);
    currentToast = toast;

    const timeout = Math.max(800, Number(durationMs) || 0);
    setTimeout(() => {
      if (currentToast === toast) {
        toast.remove();
        currentToast = null;
      }
    }, timeout);
  }

  function getCurrentToast() {
    return currentToast;
  }

  return {
    showToast,
    getCurrentToast
  };
})();
// =========================================
// CONTEXT MENU CORE
// =========================================
