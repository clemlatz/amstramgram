const CONTEXT_MENU_CORE = (() => {
  let currentMenu = null;

  function removeMenu() {
    if (currentMenu) {
      currentMenu.remove();
      currentMenu = null;
    }
  }

  function createMenu(x, y, items, options = {}) {
    removeMenu();
    const menuId = options.menuId || "ig-hd-context-menu";
    const classPrefix = options.classPrefix || "ig-hd-menu";
    const menu = document.createElement("div");
    menu.id = menuId;

    items.forEach((item) => {
      if (item.divider) {
        const divider = document.createElement("div");
        divider.className = `${classPrefix}-divider`;
        menu.appendChild(divider);
      } else if (item.header) {
        const header = document.createElement("div");
        const isSectionHeader = Boolean(item.section);
        header.className = isSectionHeader
          ? `${classPrefix}-header`
          : `${classPrefix}-message`;
        header.textContent = item.header;
        menu.appendChild(header);
      } else {
        const menuItem = document.createElement("div");
        menuItem.className = `${classPrefix}-item`;
        menuItem.innerHTML = `${item.icon || ""}<span>${item.label}</span>`;
        menuItem.onclick = (e) => {
          e.stopPropagation();
          removeMenu();
          item.action();
        };
        menu.appendChild(menuItem);
      }
    });

    const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(
      (typeof navigator !== "undefined" && (navigator.platform || navigator.userAgent)) || ""
    );
    const footer = document.createElement("div");
    footer.className = `${classPrefix}-footer-hint${isMacPlatform ? " is-mac" : ""}`;
    const modifierSeparatorText = " + ";
    const nativeMenuHintText = "right-click opens the native context menu";
    const modKbd = document.createElement("kbd");
    modKbd.textContent = isMacPlatform ? "⌘" : "Ctrl";
    const plusSpan = document.createElement("span");
    plusSpan.className = "plus";
    plusSpan.textContent = modifierSeparatorText;
    const shiftKbd = document.createElement("kbd");
    shiftKbd.textContent = isMacPlatform ? "⇧" : "Shift";
    const plusSpan2 = document.createElement("span");
    plusSpan2.className = "plus";
    plusSpan2.textContent = modifierSeparatorText;
    const trailingSpan = document.createElement("span");
    trailingSpan.className = "trail";
    trailingSpan.textContent = nativeMenuHintText;
    footer.appendChild(modKbd);
    footer.appendChild(plusSpan);
    footer.appendChild(shiftKbd);
    footer.appendChild(plusSpan2);
    footer.appendChild(trailingSpan);
    menu.appendChild(footer);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
    currentMenu = menu;

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
  }

  function getCurrentMenu() {
    return currentMenu;
  }

  return {
    createMenu,
    removeMenu,
    getCurrentMenu
  };
})();
// =========================================
// DASH MANIFEST CORE
// =========================================
// Parses Instagram DASH Media Presentation Description (MPD) XML into
// structured AdaptationSets + Representations. Regex-driven so this module
// has no DOM or XML-library dependency; it runs in Node (tests) and in the
// userscript sandbox identically.
