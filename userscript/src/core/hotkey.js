const HOTKEY_CORE = (() => {
  function isEditableTarget(target) {
    if (!target) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  function normalizeHotkeyToken(token) {
    if (!token) return "";
    const lowered = String(token).trim().toLowerCase();
    if (!lowered) return "";
    if (lowered === " ") return "space";
    if (lowered === "esc") return "escape";
    return lowered;
  }

  function parseHotkey(hotkey) {
    const tokens = String(hotkey || "")
      .split("+")
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) return null;

    const parsed = {
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      key: ""
    };

    for (const rawToken of tokens) {
      const token = normalizeHotkeyToken(rawToken);
      if (!token) continue;

      if (token === "ctrl" || token === "control") {
        parsed.ctrlKey = true;
        continue;
      }
      if (token === "alt" || token === "option") {
        parsed.altKey = true;
        continue;
      }
      if (token === "shift") {
        parsed.shiftKey = true;
        continue;
      }
      if (token === "meta" || token === "cmd" || token === "command") {
        parsed.metaKey = true;
        continue;
      }
      parsed.key = token;
    }

    if (!parsed.key) return null;
    return parsed;
  }

  function hotkeyMatchesEvent(event, hotkey) {
    const parsed = parseHotkey(hotkey);
    if (!parsed) return false;

    if (!!event.ctrlKey !== parsed.ctrlKey) return false;
    if (!!event.altKey !== parsed.altKey) return false;
    if (!!event.shiftKey !== parsed.shiftKey) return false;
    if (!!event.metaKey !== parsed.metaKey) return false;

    const eventKey = normalizeHotkeyToken(event.key);
    if (eventKey === parsed.key) return true;

    const code = normalizeHotkeyToken(event.code);
    if (parsed.key.length === 1 && code === `key${parsed.key}`) return true;
    return false;
  }

  return {
    isEditableTarget,
    normalizeHotkeyToken,
    parseHotkey,
    hotkeyMatchesEvent
  };
})();
// =========================================
// TOAST CORE
// =========================================
