const STYLES_CORE = (() => {
  // =========================================
  // STYLES
  // =========================================
  const style = document.createElement("style");
  style.textContent = `
    :root {
      /* Core UI */
      --ig-hd-bg-primary: #0c1014;
      --ig-hd-bg-secondary: #111518;
      --ig-hd-bg-tertiary: #0a0e12;
      --ig-hd-text-primary: #f5f5f5;
      --ig-hd-text-secondary: #a8a8a8;
      --ig-hd-text-tertiary: #6a7480;
      --ig-hd-text-tertiary-hover: #a8b4c0;
      --ig-hd-border-primary: #1e2328;
      --ig-hd-border-secondary: #2e343a;
      --ig-hd-border-tertiary: #222830;
      --ig-hd-card-border: #262626;
      --ig-hd-accent: #4A5DF9;
      --ig-hd-accent-hover: #5D6FFA;
      --ig-hd-accent-cta: #4A5DF9;
      --ig-hd-hover-item: #1a2028;
      --ig-hd-hover-overlay: rgba(255, 255, 255, 0.1);
      --ig-hd-shadow: rgba(0, 0, 0, 0.7);
      --ig-hd-shadow-soft: rgba(0, 0, 0, 0.5);
      --ig-hd-overlay-backdrop: rgba(0, 0, 0, 0.75);
      --ig-hd-modal-shadow: rgba(0, 0, 0, 0.8);
      /* Close button */
      --ig-hd-close-bg: rgba(12, 16, 20, 0.94);
      --ig-hd-close-text: #cfd7df;
      --ig-hd-close-hover-bg: #11181f;
      --ig-hd-close-hover-text: #fff;
      /* Batch manager / cooldown */
      --ig-hd-batch-bg: #10151a;
      --ig-hd-batch-border: #2a3640;
      --ig-hd-batch-spinner-track: #2c3944;
      --ig-hd-batch-spinner-active: #3fa6ff;
      --ig-hd-batch-detail-text: #b7c3ce;
      --ig-hd-batch-progress-track: #28333c;
      --ig-hd-batch-progress-fill-start: #2e93e7;
      --ig-hd-batch-progress-fill-end: #44b1ff;
      --ig-hd-batch-badge-border: #30404f;
      --ig-hd-batch-badge-text: #c6d7e7;
      --ig-hd-batch-badge-bg: #17212a;
      --ig-hd-batch-control-text: #d5dee7;
      --ig-hd-batch-metric-border: #22303a;
      --ig-hd-batch-metric-bg: #0f161c;
      --ig-hd-batch-metric-label: #8fa4b6;
      --ig-hd-batch-disabled-bg: #0b0f13;
      --ig-hd-batch-run-border: #26323b;
      --ig-hd-batch-run-text: #d3dde6;
      --ig-hd-batch-run-active-border: #2d6fa0;
      --ig-hd-batch-run-active-bg: #132331;
      --ig-hd-batch-run-live-border: #2f5b7b;
      --ig-hd-batch-run-hover: #18242d;
      --ig-hd-batch-run-meta: #9fb0bd;
      /* Badge status variants */
      --ig-hd-badge-running-border: #20557b;
      --ig-hd-badge-running-text: #95d5ff;
      --ig-hd-badge-running-bg: #142737;
      --ig-hd-badge-paused-border: #6f5a1e;
      --ig-hd-badge-paused-text: #ffd77d;
      --ig-hd-badge-paused-bg: #2a2211;
      --ig-hd-badge-cancelling-border: #6a3d1f;
      --ig-hd-badge-cancelling-text: #ffb48a;
      --ig-hd-badge-cancelling-bg: #2f1c11;
      --ig-hd-badge-completed-border: #2d6a42;
      --ig-hd-badge-completed-text: #9ce8bb;
      --ig-hd-badge-completed-bg: #13251a;
      --ig-hd-badge-partial-border: #7a6022;
      --ig-hd-badge-partial-text: #ffe29a;
      --ig-hd-badge-partial-bg: #2f2512;
      --ig-hd-badge-failed-border: #6a2525;
      --ig-hd-badge-failed-text: #ff9a9a;
      --ig-hd-badge-failed-bg: #2a1414;
      --ig-hd-badge-cancelled-border: #734732;
      --ig-hd-badge-cancelled-text: #ffbf9f;
      --ig-hd-badge-cancelled-bg: #2d1c15;
      /* Misc UI */
      --ig-hd-info-tip-border: #3a4248;
      --ig-hd-tooltip-text: #e0e0e0;
      /* Secondary button */
      --ig-hd-btn-secondary-bg: #2C2F34;
      --ig-hd-btn-secondary-text: #ffffff;
      --ig-hd-btn-secondary-border: none;
      /* Token pill groups */
      --ig-hd-token-identity: #4A5DF9;
      --ig-hd-token-content: #843DE0;
      --ig-hd-token-download-time: #D62C7A;
      --ig-hd-token-upload-time: #D97706;
      /* Danger tab / section */
      --ig-hd-danger-tab-inactive: #8a5a5a;
      --ig-hd-danger-tab-hover: #ff9b9b;
      --ig-hd-danger-accent: #e8453a;
      --ig-hd-danger-text: #ff7b7b;
      --ig-hd-danger-btn-hover-bg: #301414;
      --ig-hd-danger-close-hover-bg: #3a1c1c;
      --ig-hd-danger-close-hover-border: #7b3a3a;
      --ig-hd-danger-close-hover-text: #ffd5d5;
      /* Semantic tints */
      --ig-hd-danger-bg: #200e0e;
      --ig-hd-danger-bg-hover: #2a1414;
      --ig-hd-danger-border: #4a1c1c;
      --ig-hd-danger-border-hover: #5a2020;
      --ig-hd-danger-border-active: #6a2222;
      --ig-hd-warning-bg: #1a1508;
      --ig-hd-warning-border: #3d3215;
      --ig-hd-warning-text: #f0d58c;
      --ig-hd-warning-text-strong: #ffc107;
      --ig-hd-warning-alert-text: #ffb8b8;
      --ig-hd-warning-alert-strong: #ff8a8a;
      --ig-hd-success-bg: #13251a;
      --ig-hd-success-text: #9ce8bb;
      --ig-hd-success-border: #2d6a42;
      /* Template preview states */
      --ig-hd-template-empty: #666;
      --ig-hd-template-valid: #a8d8a8;
      --ig-hd-template-invalid: #ff8888;
      /* Toggle switch */
      --ig-hd-toggle-track: #2b3036;
      --ig-hd-toggle-track-active: #ffffff;
      --ig-hd-toggle-knob: #0c1014;
      --ig-hd-toggle-knob-active: #0c1014;
      /* Segmented toggle */
      --ig-hd-seg-track: #1a1e22;
      --ig-hd-seg-thumb: #4A5DF9;
      --ig-hd-seg-text-active: #ffffff;
      --ig-hd-seg-text-inactive: #6a7480;
    }
    :root.ig-hd-theme-light {
      /* Core UI — Instagram-native light palette */
      --ig-hd-bg-primary: #ffffff;
      --ig-hd-bg-secondary: #fafafa;
      --ig-hd-bg-tertiary: #fafafa;
      --ig-hd-text-primary: #0c1014;
      --ig-hd-text-secondary: #737373;
      --ig-hd-text-tertiary: #6a717a;
      --ig-hd-text-tertiary-hover: #0c1014;
      --ig-hd-border-primary: #dbdbdb;
      --ig-hd-border-secondary: #dbdbdb;
      --ig-hd-border-tertiary: #dbdbdb;
      --ig-hd-card-border: #dbdbdb;
      --ig-hd-accent-cta: #4A5DF9;
      --ig-hd-hover-item: #f2f2f2;
      --ig-hd-hover-overlay: rgba(0, 0, 0, 0.05);
      --ig-hd-shadow: rgba(0, 0, 0, 0.15);
      --ig-hd-shadow-soft: rgba(0, 0, 0, 0.1);
      --ig-hd-overlay-backdrop: rgba(0, 0, 0, 0.5);
      --ig-hd-modal-shadow: rgba(0, 0, 0, 0.15);
      /* Close button */
      --ig-hd-close-bg: rgba(255, 255, 255, 0.94);
      --ig-hd-close-text: #737373;
      --ig-hd-close-hover-bg: #f2f2f2;
      --ig-hd-close-hover-text: #0c1014;
      /* Batch manager / cooldown */
      --ig-hd-batch-bg: #ffffff;
      --ig-hd-batch-border: #dbdbdb;
      --ig-hd-batch-spinner-track: #dbdbdb;
      --ig-hd-batch-spinner-active: #0095f6;
      --ig-hd-batch-detail-text: #737373;
      --ig-hd-batch-progress-track: #dbdbdb;
      --ig-hd-batch-badge-border: #dbdbdb;
      --ig-hd-batch-badge-text: #0c1014;
      --ig-hd-batch-badge-bg: #f2f2f2;
      --ig-hd-batch-control-text: #0c1014;
      --ig-hd-batch-metric-border: #dbdbdb;
      --ig-hd-batch-metric-bg: #fafafa;
      --ig-hd-batch-metric-label: #737373;
      --ig-hd-batch-disabled-bg: #efefef;
      --ig-hd-batch-run-border: #dbdbdb;
      --ig-hd-batch-run-text: #0c1014;
      --ig-hd-batch-run-active-border: #0095f6;
      --ig-hd-batch-run-active-bg: #e8f0fe;
      --ig-hd-batch-run-live-border: #0095f6;
      --ig-hd-batch-run-hover: #f2f2f2;
      --ig-hd-batch-run-meta: #a8a8a8;
      /* Badge status variants */
      --ig-hd-badge-running-border: #a0d0f0;
      --ig-hd-badge-running-text: #0a5a94;
      --ig-hd-badge-running-bg: #e8f4fd;
      --ig-hd-badge-paused-border: #f0d58c;
      --ig-hd-badge-paused-text: #7a5a00;
      --ig-hd-badge-paused-bg: #fff8e1;
      --ig-hd-badge-cancelling-border: #f0c8a0;
      --ig-hd-badge-cancelling-text: #8a4a10;
      --ig-hd-badge-cancelling-bg: #fff3e8;
      --ig-hd-badge-completed-border: #a5d6a7;
      --ig-hd-badge-completed-text: #1b5e2e;
      --ig-hd-badge-completed-bg: #e8f5e9;
      --ig-hd-badge-partial-border: #f0d58c;
      --ig-hd-badge-partial-text: #6a4e00;
      --ig-hd-badge-partial-bg: #fff8e1;
      --ig-hd-badge-failed-border: #f5b5b5;
      --ig-hd-badge-failed-text: #c62828;
      --ig-hd-badge-failed-bg: #fde8e8;
      --ig-hd-badge-cancelled-border: #f0c8a0;
      --ig-hd-badge-cancelled-text: #8a4a10;
      --ig-hd-badge-cancelled-bg: #fff3e8;
      /* Misc UI */
      --ig-hd-info-tip-border: #dbdbdb;
      --ig-hd-tooltip-text: #0c1014;
      /* Secondary button */
      --ig-hd-btn-secondary-bg: #ffffff;
      --ig-hd-btn-secondary-text: #0C1014;
      --ig-hd-btn-secondary-border: 1px solid #2C2F34;
      /* Token pill groups */
      --ig-hd-token-identity: #4A5DF9;
      --ig-hd-token-content: #843DE0;
      --ig-hd-token-download-time: #D62C7A;
      --ig-hd-token-upload-time: #D97706;
      /* Danger tab / section */
      --ig-hd-danger-tab-inactive: #c44040;
      --ig-hd-danger-tab-hover: #e8453a;
      --ig-hd-danger-text: #d32f2f;
      --ig-hd-danger-btn-hover-bg: #fde8e8;
      --ig-hd-danger-close-hover-bg: #fde8e8;
      --ig-hd-danger-close-hover-border: #f5b5b5;
      --ig-hd-danger-close-hover-text: #e8453a;
      /* Semantic tints */
      --ig-hd-danger-bg: #fde8e8;
      --ig-hd-danger-bg-hover: #fcd4d4;
      --ig-hd-danger-border: #f5b5b5;
      --ig-hd-danger-border-hover: #f09a9a;
      --ig-hd-danger-border-active: #e87070;
      --ig-hd-warning-bg: #fff8e1;
      --ig-hd-warning-border: #ffe082;
      --ig-hd-warning-text: #8b6914;
      --ig-hd-warning-text-strong: #e6a800;
      --ig-hd-warning-alert-text: #d32f2f;
      --ig-hd-warning-alert-strong: #c62828;
      --ig-hd-success-bg: #e8f5e9;
      --ig-hd-success-text: #2d6a42;
      --ig-hd-success-border: #a5d6a7;
      /* Template preview states */
      --ig-hd-template-empty: #a8a8a8;
      --ig-hd-template-valid: #2d6a42;
      --ig-hd-template-invalid: #d32f2f;
      /* Toggle switch */
      --ig-hd-toggle-track: #6a717a;
      --ig-hd-toggle-track-active: #1c1c1e;
      --ig-hd-toggle-knob: #ffffff;
      --ig-hd-toggle-knob-active: #ffffff;
      /* Segmented toggle */
      --ig-hd-seg-track: #efefef;
      --ig-hd-seg-thumb: #4A5DF9;
      --ig-hd-seg-text-active: #ffffff;
      --ig-hd-seg-text-inactive: #6a717a;
    }
    #ig-hd-context-menu {
      position: fixed;
      z-index: 999999;
      background: #212328;
      border-radius: 8px;
      padding: 8px 0;
      min-width: 220px;
      box-shadow: 0 4px 24px var(--ig-hd-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      border: 1px solid var(--ig-hd-border-primary);
      animation: ig-menu-fade 0.15s ease;
    }
    @keyframes ig-menu-fade {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .ig-hd-menu-item {
      padding: 11px 16px;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.25;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background 0.15s, color 0.15s;
    }
    .ig-hd-menu-item:hover { background: var(--ig-hd-hover-item); }
    .ig-hd-menu-item svg { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.92; }
    .ig-hd-menu-divider { height: 1px; background: #383b42; margin: 8px 0; }
    :root.ig-hd-theme-light .ig-hd-menu-divider { background: var(--ig-hd-border-primary); }
    .ig-hd-menu-header {
      padding: 16px 16px 5px;
      color: var(--ig-hd-text-secondary);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      line-height: 1.2;
      text-transform: uppercase;
      user-select: none;
    }
    .ig-hd-menu-header:first-child { padding-top: 10px; }
    .ig-hd-menu-divider + .ig-hd-menu-header { padding-top: 18px; }
    .ig-hd-menu-message {
      padding: 12px 16px;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
    }
    .ig-hd-menu-message + .ig-hd-menu-message {
      padding-top: 4px;
      margin-top: -8px;
      color: var(--ig-hd-text-secondary);
      font-size: 13px;
      font-weight: 500;
    }
    .ig-hd-menu-footer-hint {
      border-top: 1px solid rgba(255,255,255,0.08);
      margin-top: 4px;
      padding: 9px 16px 7px;
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      font-style: italic;
      line-height: 1.5;
      user-select: none;
    }
    .ig-hd-menu-footer-hint kbd {
      display: inline-block;
      padding: 1px 5px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 3px;
      font-style: normal;
      font-family: inherit;
      font-size: 10px;
      color: rgba(255,255,255,0.7);
      margin: 0 2px;
    }
    .ig-hd-menu-footer-hint kbd:first-child { margin-left: 0; margin-right: 2px; }
    .ig-hd-menu-footer-hint .plus { font-style: normal; }
    .ig-hd-menu-footer-hint .line2 { opacity: 0.85; font-style: italic; }
    .ig-hd-menu-footer-hint.is-mac kbd {
      font-size: 11px;
      color: rgba(255,255,255,0.75);
    }
    :root.ig-hd-theme-light .ig-hd-menu-footer-hint {
      border-top-color: var(--ig-hd-border-primary);
      color: var(--ig-hd-text-secondary);
    }
    :root.ig-hd-theme-light .ig-hd-menu-footer-hint kbd {
      background: rgba(0,0,0,0.05);
      border-color: rgba(0,0,0,0.12);
      color: var(--ig-hd-text-primary);
    }
    :root.ig-hd-theme-light #ig-hd-context-menu { background: #ffffff; }
    #ig-hd-settings-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000000;
      background: var(--ig-hd-overlay-backdrop);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    #ig-hd-settings-modal {
      width: min(847px, 100%);
      max-height: min(88vh, 920px);
      overflow: auto;
      position: relative;
      background: var(--ig-hd-bg-primary);
      border-radius: 12px;
      box-shadow: 0 8px 32px var(--ig-hd-modal-shadow);
      color: var(--ig-hd-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      border: 1px solid var(--ig-hd-border-tertiary);
    }
    .ig-hd-settings-header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      padding: 20px 24px 14px;
      border-bottom: none;
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--ig-hd-bg-primary);
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-settings-version {
      font-size: 12px;
      color: var(--ig-hd-text-tertiary);
      justify-self: start;
      align-self: center;
      opacity: 0.5;
      user-select: text;
    }
    .ig-hd-settings-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: normal;
      justify-self: center;
    }
    .ig-hd-settings-close {
      justify-self: end;
      flex: 0 0 auto;
      padding: 4px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--ig-hd-close-text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s;
    }
    .ig-hd-settings-close svg {
      pointer-events: none;
    }
    .ig-hd-settings-close:hover {
      color: var(--ig-hd-close-hover-text);
    }
    .ig-hd-settings-close:focus-visible {
      outline: 2px solid var(--ig-hd-accent);
      outline-offset: 2px;
    }
    .ig-hd-settings-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--ig-hd-border-primary);
      padding: 0 24px;
      background: var(--ig-hd-bg-primary);
      position: sticky;
      top: 49px;
      z-index: 10;
    }
    .ig-hd-settings-tab {
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: normal;
      color: var(--ig-hd-text-tertiary);
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .ig-hd-settings-tab:hover {
      color: var(--ig-hd-text-tertiary-hover);
    }
    .ig-hd-settings-tab.active {
      color: var(--ig-hd-text-primary);
      border-bottom-color: var(--ig-hd-accent);
    }
    .ig-hd-settings-tab.danger {
      color: var(--ig-hd-danger-tab-inactive);
    }
    .ig-hd-settings-tab.danger:hover {
      color: var(--ig-hd-danger-tab-hover);
    }
    .ig-hd-settings-tab.danger.active {
      color: var(--ig-hd-danger-text);
      border-bottom-color: var(--ig-hd-danger-accent);
    }
    .ig-hd-settings-tab-panel {
      display: none;
    }
    .ig-hd-settings-tab-panel.active {
      display: grid;
      gap: 18px;
    }
    .ig-hd-settings-body {
      padding: 20px 24px 24px;
    }
    .ig-hd-info-tip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1.5px solid var(--ig-hd-info-tip-border);
      color: var(--ig-hd-text-tertiary);
      font-size: 10.5px;
      font-weight: 700;
      font-style: normal;
      cursor: help;
      margin-left: 5px;
      vertical-align: middle;
      transition: all 0.15s;
      flex-shrink: 0;
      line-height: 1;
    }
    .ig-hd-info-tip:hover {
      border-color: var(--ig-hd-accent);
      color: var(--ig-hd-accent);
    }
    .ig-hd-info-tip[data-ig-hd-tooltip-open="true"] {
      border-color: var(--ig-hd-accent);
      color: var(--ig-hd-accent);
    }
    .ig-hd-floating-tooltip {
      position: fixed;
      left: 0;
      top: 0;
      background: var(--ig-hd-hover-item);
      color: var(--ig-hd-tooltip-text);
      border: 1px solid var(--ig-hd-border-secondary);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.45;
      font-style: normal;
      white-space: pre-line;
      width: max-content;
      max-width: min(340px, calc(100vw - 24px));
      box-shadow: 0 4px 16px var(--ig-hd-shadow-soft);
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s;
      z-index: 1000001;
    }
    .ig-hd-floating-tooltip.visible {
      opacity: 1;
      visibility: visible;
    }
    .ig-hd-preset-ref {
      margin-top: 4px;
      padding: 16px;
      border: 1px solid var(--ig-hd-border-primary);
      border-radius: 8px;
      background: var(--ig-hd-bg-secondary);
    }
    .ig-hd-settings-help {
      color: var(--ig-hd-text-secondary);
      font-size: 12px;
      font-weight: 400;
      line-height: 16px;
    }
    .ig-hd-settings-inline-code {
      color: var(--ig-hd-text-primary);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-weight: 500;
    }
    .ig-hd-settings-toggle-group {
      display: grid;
      gap: 0;
    }
    .ig-hd-settings-item {
      display: grid;
      gap: 8px;
    }
    .ig-hd-settings-item.ig-hd-toggle-with-help {
      position: relative;
      padding-right: 50px;
    }
    .ig-hd-toggle-with-help .ig-hd-toggle-track {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
    }
    .ig-hd-settings-nested {
      display: grid;
      gap: 8px;
      padding-left: 24px;
    }
    .ig-hd-settings-inline-checks {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .ig-hd-settings-row {
      display: grid;
      gap: 8px;
    }
    .ig-hd-settings-row.two-col {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
    }
    .ig-hd-settings-label {
      font-size: 14px;
      line-height: 18px;
      color: var(--ig-hd-text-primary);
      font-weight: 400;
    }
    .ig-hd-settings-input,
    .ig-hd-settings-select {
      width: 100%;
      height: 40px;
      box-sizing: border-box;
      border: 1px solid var(--ig-hd-border-secondary);
      border-radius: 6px;
      background: var(--ig-hd-bg-tertiary);
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 600;
      padding: 10px 12px;
      outline: none;
    }
    #ig-hd-settings-modal select.ig-hd-settings-select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      height: 40px;
      min-height: 40px;
      line-height: 1;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
      cursor: pointer;
    }
    .ig-hd-settings-input:focus,
    .ig-hd-settings-select:focus {
      border-color: var(--ig-hd-accent);
    }
    .ig-hd-settings-input.ig-hd-hotkey-recording {
      border-color: var(--ig-hd-accent);
      animation: ig-hd-recording-pulse 1.5s ease-in-out infinite;
    }
    @keyframes ig-hd-recording-pulse {
      0%, 100% { border-color: var(--ig-hd-accent); }
      50% { border-color: var(--ig-hd-border-secondary); }
    }
    .ig-hd-settings-icon {
      display: inline-flex;
      vertical-align: -3px;
      margin-left: 5px;
      flex-shrink: 0;
    }
    .ig-hd-input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
    }
    .ig-hd-input-with-icon .ig-hd-settings-input {
      padding-left: 42px;
    }
    .ig-hd-input-icon-btn {
      position: absolute;
      left: 8px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      color: var(--ig-hd-text-secondary);
    }
    .ig-hd-input-icon-btn:hover {
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-settings-checkbox {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
    }
    .ig-hd-settings-checkbox input {
      margin: 0;
      width: 24px;
      height: 24px;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid rgb(219, 223, 228);
      border-radius: 50%;
      background: transparent;
      box-sizing: border-box;
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }
    .ig-hd-settings-checkbox input:checked {
      border-color: rgb(248, 249, 249);
    }
    .ig-hd-settings-checkbox input::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: rgb(248, 249, 249);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .ig-hd-settings-checkbox input:checked::after {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .ig-hd-settings-checkbox input:focus-visible {
      outline: 2px solid rgba(255,255,255,0.45);
      outline-offset: 2px;
    }
    .ig-hd-settings-checkbox input:disabled {
      cursor: default;
      opacity: 0.45;
    }
    .ig-hd-settings-toggle {
      display: flex;
      align-items: center;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
      user-select: none;
    }
    .ig-hd-settings-toggle input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      pointer-events: none;
    }
    .ig-hd-settings-toggle > span {
      min-height: 24px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .ig-hd-toggle-track {
      position: relative;
      width: 40px;
      height: 24px;
      flex-shrink: 0;
      cursor: pointer;
    }
    .ig-hd-toggle-track::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 16px;
      background: var(--ig-hd-toggle-track);
      transition: background 0.2s ease;
    }
    .ig-hd-toggle-track::after {
      content: '';
      position: absolute;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--ig-hd-toggle-knob);
      transition: left 0.2s ease, background 0.15s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .ig-hd-settings-toggle input:checked ~ .ig-hd-toggle-track::before {
      background: var(--ig-hd-toggle-track-active);
    }
    .ig-hd-settings-toggle input:checked ~ .ig-hd-toggle-track::after {
      left: 18px;
      background: var(--ig-hd-toggle-knob-active);
    }
    /* Recipe 5 — independent toggles in a card with per-row subtitles, mirrors
       Instagram's "Hidden Words" pattern. Title and subtitle stack vertically
       on the left; toggle stays right-aligned with a 24px gap so long-wrapping
       subtitles never butt up against the track. */
    .ig-hd-settings-toggle.ig-hd-toggle-with-subtitle {
      gap: 24px;
      align-items: center;
    }
    .ig-hd-settings-toggle.ig-hd-toggle-with-subtitle > span {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-height: 0;
      padding: 1px 0;
    }
    .ig-hd-toggle-row-title {
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-toggle-applies-to {
      color: var(--ig-hd-text-tertiary);
      font-weight: 400;
    }
    .ig-hd-toggle-row-subtitle {
      font-size: 12px;
      font-weight: 400;
      line-height: 16px;
      color: var(--ig-hd-text-secondary);
      display: block;
    }
    /* Right-aligned circle checkbox (replaces toggle for selection-type settings) */
    .ig-hd-settings-circle {
      display: flex;
      align-items: center;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
      user-select: none;
    }
    .ig-hd-settings-circle > span {
      min-height: 24px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
    }
    .ig-hd-settings-circle input[type="checkbox"] {
      margin: 0;
      width: 18px;
      height: 18px;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid rgb(219, 223, 228);
      border-radius: 50%;
      background: transparent;
      box-sizing: border-box;
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }
    .ig-hd-settings-circle input[type="checkbox"]:checked {
      border-color: rgb(248, 249, 249);
    }
    .ig-hd-settings-circle input[type="checkbox"]::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgb(248, 249, 249);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .ig-hd-settings-circle input[type="checkbox"]:checked::after {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .ig-hd-settings-circle input[type="checkbox"]:focus-visible {
      outline: 2px solid rgba(255,255,255,0.45);
      outline-offset: 2px;
    }
    .ig-hd-settings-circle input[type="checkbox"]:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    /* Left-aligned radio choice list with per-item subtitles
       (mirrors Instagram's "Allow comments from" pattern: naked rows under
       the subheading, no card border, each option carries its own description
       inside the row). Use this when multiple options each need an
       explanation. Use .ig-hd-settings-circle inside a card when the options
       don't need per-item descriptions. */
    .ig-hd-settings-choice-list {
      display: flex;
      flex-direction: column;
    }
    .ig-hd-settings-choice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      cursor: pointer;
      user-select: none;
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-settings-choice input[type="checkbox"] {
      margin: 0;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      margin-top: 1px;
      appearance: none;
      -webkit-appearance: none;
      border: 1.5px solid rgb(168, 168, 168);
      border-radius: 50%;
      background: transparent;
      box-sizing: border-box;
      position: relative;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }
    .ig-hd-settings-choice input[type="checkbox"]:checked {
      border-color: var(--ig-hd-text-primary);
    }
    .ig-hd-settings-choice input[type="checkbox"]::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--ig-hd-text-primary);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .ig-hd-settings-choice input[type="checkbox"]:checked::after {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .ig-hd-settings-choice input[type="checkbox"]:focus-visible {
      outline: 2px solid rgba(255,255,255,0.45);
      outline-offset: 2px;
    }
    .ig-hd-settings-choice-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    .ig-hd-settings-choice-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
    }
    .ig-hd-settings-choice-subtitle {
      color: var(--ig-hd-text-secondary);
      font-size: 12px;
      font-weight: 400;
      line-height: 16px;
    }
    /* Scope rows -------------------------------------------------- */
    .ig-hd-scope-rows {
      display: flex;
      flex-direction: column;
    }
    .ig-hd-scope-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      cursor: pointer;
      user-select: none;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 400;
      line-height: 18px;
    }
    .ig-hd-scope-row-label {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ig-hd-scope-row-label .ig-hd-settings-icon {
      margin-left: 0;
      vertical-align: 0;
    }
    .ig-hd-scope-row-label .ig-hd-settings-icon svg {
      width: 18px;
      height: 18px;
    }
    .ig-hd-scope-row input[type="checkbox"],
    .ig-hd-scope-row input[type="radio"] {
      margin: 0;
      width: 24px;
      height: 24px;
      appearance: none;
      -webkit-appearance: none;
      border: 1px solid rgb(219, 223, 228);
      border-radius: 50%;
      background: transparent;
      box-sizing: border-box;
      position: relative;
      flex-shrink: 0;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }
    .ig-hd-scope-row input[type="checkbox"]:checked,
    .ig-hd-scope-row input[type="radio"]:checked {
      border-color: rgb(248, 249, 249);
    }
    .ig-hd-scope-row input[type="checkbox"]::after,
    .ig-hd-scope-row input[type="radio"]::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: rgb(248, 249, 249);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .ig-hd-scope-row input[type="checkbox"]:checked::after,
    .ig-hd-scope-row input[type="radio"]:checked::after {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    .ig-hd-settings-card-inner .ig-hd-scope-row:first-child {
      padding-top: 0;
    }
    .ig-hd-settings-card-inner .ig-hd-scope-row:last-child {
      padding-bottom: 0;
    }
    .ig-hd-scope-row input[type="checkbox"]:focus-visible,
    .ig-hd-scope-row input[type="radio"]:focus-visible {
      outline: 2px solid rgba(255,255,255,0.45);
      outline-offset: 2px;
    }

    /* Carousel sub-setting (below scope pills) */
    .ig-hd-carousel-sub-setting {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.2s ease, margin 0.2s ease, opacity 0.2s ease;
      opacity: 0;
      margin-top: 0;
      overflow: hidden;
    }
    .ig-hd-carousel-sub-setting.visible {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 8px;
    }
    .ig-hd-carousel-sub-setting-inner {
      min-height: 0;
      border-left: 2px solid #00875A;
      padding-left: 10px;
    }
    .ig-hd-carousel-sub-toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 12px;
      font-weight: 500;
      color: var(--ig-hd-text-secondary);
      cursor: pointer;
      user-select: none;
      transition: color 0.18s ease;
    }
    .ig-hd-carousel-sub-toggle:has(input:checked) {
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-carousel-sub-toggle input[type="checkbox"] {
      position: relative;
      opacity: 1;
      width: 28px;
      height: 16px;
      appearance: none;
      -webkit-appearance: none;
      background: var(--ig-hd-toggle-track);
      border-radius: 8px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.18s ease;
      pointer-events: auto;
    }
    .ig-hd-carousel-sub-toggle input[type="checkbox"]::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--ig-hd-toggle-knob);
      transition: left 0.15s ease, background 0.15s ease;
    }
    .ig-hd-carousel-sub-toggle input[type="checkbox"]:checked {
      background: var(--ig-hd-toggle-track-active);
    }
    .ig-hd-carousel-sub-toggle input[type="checkbox"]:checked::after {
      left: 14px;
      background: var(--ig-hd-toggle-knob-active);
    }

    /* Light-theme scope row overrides */
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="checkbox"],
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="radio"] {
      border-color: rgba(0,0,0,0.3);
    }
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="checkbox"]:checked,
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="radio"]:checked {
      border-color: #1c1c1e;
    }
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="checkbox"]::after,
    :root.ig-hd-theme-light .ig-hd-scope-row input[type="radio"]::after {
      background: #1c1c1e;
    }
    /* Saved collections download UI */
    .ig-hd-saved-loading {
      padding: 12px 0;
      font-size: 13px;
      color: var(--ig-hd-text-secondary, #8e8e8e);
    }

    /* Segmented toggle (Download source) */
    .ig-hd-source-seg {
      display: flex;
      position: relative;
      height: 36px;
      border-radius: 10px;
      background: var(--ig-hd-seg-track);
      padding: 3px;
      cursor: pointer;
      user-select: none;
    }
    .ig-hd-source-seg-thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: calc(50% - 3px);
      height: calc(100% - 6px);
      border-radius: 8px;
      background: var(--ig-hd-seg-thumb);
      transition: left 0.2s ease;
      z-index: 0;
    }
    .ig-hd-source-seg-thumb.right {
      left: calc(50%);
    }
    .ig-hd-source-seg-label {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
      color: var(--ig-hd-seg-text-inactive);
      position: relative;
      z-index: 1;
      transition: color 0.2s ease;
      border: none;
      background: none;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
    }
    .ig-hd-source-seg-label.active {
      color: var(--ig-hd-seg-text-active);
    }

    /* Segmented toggle spacing */
    .ig-hd-settings-section-desc + .ig-hd-source-seg {
      margin-top: 12px;
    }
    .ig-hd-source-seg + .ig-hd-settings-help {
      margin-top: 8px;
    }

    /* Source content areas (Profile / Saved) */
    .ig-hd-source-content {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.2s ease, margin-top 0.2s ease, opacity 0.2s ease;
      opacity: 0;
      overflow: hidden;
      margin-top: 0;
    }
    .ig-hd-source-content.visible {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-top: 18px;
    }
    .ig-hd-source-content-inner {
      min-height: 0;
    }

    /* Light-theme right-aligned circle overrides */
    :root.ig-hd-theme-light .ig-hd-settings-circle input[type="checkbox"] {
      border-color: rgba(0,0,0,0.3);
    }
    :root.ig-hd-theme-light .ig-hd-settings-circle input[type="checkbox"]:checked {
      border-color: #1c1c1e;
    }
    :root.ig-hd-theme-light .ig-hd-settings-circle input[type="checkbox"]::after {
      background: #1c1c1e;
    }
    /* Light-theme left-aligned checkbox overrides (risk ack) */
    :root.ig-hd-theme-light .ig-hd-settings-checkbox input {
      border-color: rgba(0,0,0,0.3);
    }
    :root.ig-hd-theme-light .ig-hd-settings-checkbox input:checked {
      border-color: #1c1c1e;
    }
    :root.ig-hd-theme-light .ig-hd-settings-checkbox input::after {
      background: #1c1c1e;
    }

    .ig-hd-settings-notice {
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.45;
    }
    .ig-hd-settings-notice.amber {
      background: var(--ig-hd-warning-bg);
      border: 1px solid var(--ig-hd-warning-border);
      color: var(--ig-hd-warning-text);
    }
    .ig-hd-settings-notice.amber strong {
      color: var(--ig-hd-warning-text-strong);
    }
    .ig-hd-settings-warning {
      background: var(--ig-hd-danger-bg);
      border: 1px solid var(--ig-hd-danger-border-hover);
      color: var(--ig-hd-warning-alert-text);
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.45;
    }
    .ig-hd-settings-warning strong {
      color: var(--ig-hd-warning-alert-strong);
    }
    .ig-hd-firefox-info-body {
      margin: 0;
      font-size: 12px;
      line-height: 16px;
      font-weight: 400;
      color: var(--ig-hd-text-secondary);
    }
    .ig-hd-settings-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-top: 16px;
      border-top: 1px solid var(--ig-hd-border-secondary);
    }
    .ig-hd-settings-inline-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ig-hd-settings-panel-actions {
      display: grid;
      gap: 12px;
      padding-top: 4px;
    }
    .ig-hd-settings-btn {
      background: var(--ig-hd-btn-secondary-bg);
      color: var(--ig-hd-btn-secondary-text);
      border: var(--ig-hd-btn-secondary-border);
      border-radius: 12px;
      padding: 9px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s;
    }
    .ig-hd-settings-btn:hover {
      opacity: 0.8;
    }
    .ig-hd-token-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: 4px;
    }
    .ig-hd-token-actions-sep {
      color: var(--ig-hd-text-secondary);
      opacity: 0.4;
      font-size: 12px;
      user-select: none;
    }
    .ig-hd-settings-btn.text-action {
      background: none;
      border: none;
      color: var(--ig-hd-text-secondary);
      padding: 0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      height: 32px;
      display: inline-flex;
      align-items: center;
      transition: opacity 0.15s;
    }
    .ig-hd-settings-btn.text-action:hover {
      opacity: 0.7;
    }
    .ig-hd-settings-btn.primary {
      background: #4A5DF9;
      color: #ffffff;
      border: none;
    }
    .ig-hd-settings-btn.primary:hover {
      opacity: 0.85;
    }
    .ig-hd-settings-btn.danger {
      border: 1px solid var(--ig-hd-danger-border-active);
      background: var(--ig-hd-danger-bg);
      color: var(--ig-hd-danger-text);
    }
    .ig-hd-settings-btn.danger:hover {
      background: var(--ig-hd-danger-btn-hover-bg);
      opacity: 1;
    }
    #ig-hd-settings-launcher {
      position: fixed;
      right: 12px;
      top: 12px;
      z-index: 999998;
      display: inline-flex;
      padding: var(--ig-hd-settings-launcher-padding, 12px);
      margin: 0;
      border: 0;
      border-radius: var(--nav-list-cell-corner-radius, 8px);
      background: transparent;
      color: currentColor;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: none;
      appearance: none;
      -webkit-appearance: none;
      transition: background-color 0.2s ease, transform 50ms linear;
    }
    #ig-hd-settings-launcher.ig-hd-launcher-hidden {
      display: none;
    }
    #ig-hd-settings-launcher:hover {
      background: var(--hover-overlay, var(--ig-hd-hover-overlay));
    }
    #ig-hd-settings-launcher:active {
      transform: none;
    }
    #ig-hd-settings-launcher:focus-visible {
      outline: 2px solid var(--ig-hd-accent);
      outline-offset: 2px;
    }
    #ig-hd-settings-launcher svg {
      width: var(--ig-hd-settings-icon-size, 24px);
      height: var(--ig-hd-settings-icon-size, 24px);
      display: block;
      flex-shrink: 0;
      pointer-events: none;
    }
    #ig-hd-toast {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 1000001;
      background: var(--ig-hd-bg-primary);
      color: var(--ig-hd-text-primary);
      border: 1px solid var(--ig-hd-border-tertiary);
      border-radius: 8px;
      box-shadow: 0 4px 24px var(--ig-hd-shadow);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.45;
      padding: 10px 12px;
      max-width: min(320px, calc(100vw - 24px));
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: ig-menu-fade 0.15s ease;
    }
    #ig-hd-cooldown-indicator {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 1000001;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--ig-hd-batch-border);
      background: var(--ig-hd-batch-bg);
      color: var(--ig-hd-text-primary);
      box-shadow: 0 4px 24px var(--ig-hd-shadow);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: min(360px, calc(100vw - 24px));
      box-sizing: border-box;
      animation: ig-menu-fade 0.15s ease;
      pointer-events: none;
    }
    .ig-hd-cooldown-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid var(--ig-hd-batch-spinner-track);
      border-top-color: var(--ig-hd-batch-spinner-active);
      border-radius: 50%;
      animation: ig-hd-cooldown-spin 1s linear infinite;
      flex-shrink: 0;
    }
    @keyframes ig-hd-cooldown-spin {
      to { transform: rotate(360deg); }
    }
    .ig-hd-cooldown-content {
      display: grid;
      gap: 4px;
      width: 100%;
      min-width: 0;
    }
    .ig-hd-cooldown-title {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--ig-hd-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ig-hd-cooldown-detail {
      font-size: 11px;
      line-height: 1.35;
      color: var(--ig-hd-batch-detail-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ig-hd-cooldown-progress {
      width: 100%;
      height: 4px;
      border-radius: 999px;
      background: var(--ig-hd-batch-progress-track);
      overflow: hidden;
    }
    .ig-hd-cooldown-progress > span {
      display: block;
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--ig-hd-batch-progress-fill-start), var(--ig-hd-batch-progress-fill-end));
      transition: width 0.2s ease;
    }
    #ig-hd-batch-progress {
      position: fixed;
      left: 12px;
      top: 12px;
      z-index: 1000001;
      width: 390px;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
      box-sizing: border-box;
      background: var(--ig-hd-bg-primary);
      border: 1px solid var(--ig-hd-border-tertiary);
      border-radius: 16px;
      box-shadow: 0 8px 32px var(--ig-hd-modal-shadow);
      color: var(--ig-hd-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      user-select: none;
      animation: ig-menu-fade 0.15s ease;
      pointer-events: auto;
    }
    #ig-hd-batch-progress.dragging { user-select: none; }
    #ig-hd-batch-progress.minimized { width: 340px; }
    .gm-header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 14px 16px 12px;
      cursor: move;
      user-select: none;
      touch-action: none;
    }
    #ig-hd-batch-progress.minimized .gm-header { padding-bottom: 0; }
    .gm-header-main { display: grid; gap: 2px; min-width: 0; }
    .gm-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--ig-hd-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gm-subtitle {
      font-size: 13px;
      font-weight: 400;
      line-height: 1.25;
      color: var(--ig-hd-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .gm-controls {
      display: flex;
      gap: 2px;
      flex-shrink: 0;
      align-self: start;
      margin-top: 2px;
    }
    .gm-ctrl {
      appearance: none;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: transparent;
      color: var(--ig-hd-text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s;
    }
    .gm-ctrl:hover { background: var(--ig-hd-hover-item); }
    .gm-ctrl svg { width: 18px; height: 18px; stroke-width: 2; }
    .gm-chev { transition: transform 0.2s ease; }
    #ig-hd-batch-progress.minimized .gm-chev { transform: rotate(-90deg); }
    .gm-body {
      padding: 0 12px 14px;
      display: grid;
      gap: 10px;
      transition: max-height 0.22s ease, padding 0.2s ease, opacity 0.15s ease;
      max-height: 1200px;
      overflow: hidden;
    }
    #ig-hd-batch-progress.minimized .gm-body {
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      opacity: 0;
      pointer-events: none;
    }
    .gm-progress-card {
      border: 1px solid var(--ig-hd-card-border);
      border-radius: 16px;
      padding: 14px 14px 12px;
    }
    .gm-progress-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    .gm-percent {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--ig-hd-text-primary);
    }
    .gm-badge {
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.95);
      display: inline-flex;
      align-items: center;
      line-height: 1;
      padding: 6px 12px;
      border-radius: 12px;
      background: var(--ig-hd-accent);
      letter-spacing: 0.1px;
    }
    #ig-hd-batch-progress[data-state="running"] .gm-badge { background: #4A5DF9; }
    #ig-hd-batch-progress[data-state="paused"] .gm-badge,
    #ig-hd-batch-progress[data-state="cooldown"] .gm-badge,
    #ig-hd-batch-progress[data-state="partial"] .gm-badge { background: #B78A2E; }
    #ig-hd-batch-progress[data-state="cancelling"] .gm-badge,
    #ig-hd-batch-progress[data-state="cancelled"] .gm-badge,
    #ig-hd-batch-progress[data-state="failed"] .gm-badge { background: #DD3A4B; }
    #ig-hd-batch-progress[data-state="completed"] .gm-badge { background: #00875A; }
    .gm-progress-counts {
      font-size: 13px;
      color: var(--ig-hd-text-secondary);
      font-variant-numeric: tabular-nums;
      margin-bottom: 14px;
      line-height: 1.4;
    }
    .gm-progress-counts strong {
      color: var(--ig-hd-text-primary);
      font-weight: 600;
    }
    .gm-bar {
      position: relative;
      width: 100%;
      height: 6px;
      background: var(--ig-hd-border-primary);
      border-radius: 999px;
      overflow: hidden;
    }
    .gm-bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: 0%;
      background: var(--ig-hd-accent);
      border-radius: inherit;
      transition: width 0.25s ease, background 0.15s ease;
    }
    #ig-hd-batch-progress[data-state="paused"] .gm-bar-fill,
    #ig-hd-batch-progress[data-state="cooldown"] .gm-bar-fill,
    #ig-hd-batch-progress[data-state="partial"] .gm-bar-fill { background: #B78A2E; }
    #ig-hd-batch-progress[data-state="completed"] .gm-bar-fill { background: #00875A; }
    #ig-hd-batch-progress[data-state="cancelling"] .gm-bar-fill,
    #ig-hd-batch-progress[data-state="failed"] .gm-bar-fill,
    #ig-hd-batch-progress[data-state="cancelled"] .gm-bar-fill { background: #DD3A4B; }
    .gm-bar-fill.indeterminate {
      width: 38% !important;
      animation: gm-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes gm-shimmer {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(320%); }
    }
    .gm-progress-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 10px;
      font-size: 12px;
      color: var(--ig-hd-text-secondary);
      line-height: 1.4;
    }
    .gm-rate { font-variant-numeric: tabular-nums; }
    .gm-eta {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-variant-numeric: tabular-nums;
    }
    .gm-eta svg { width: 11px; height: 11px; opacity: 0.8; }
    .gm-cooldown-card {
      border: 1px solid var(--ig-hd-warning-border);
      background: var(--ig-hd-warning-bg);
      border-radius: 16px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .gm-cooldown-card[hidden] { display: none; }
    .gm-cooldown-spinner {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.12);
      border-top-color: var(--ig-hd-warning-text-strong);
      animation: gm-spin 1s linear infinite;
      flex-shrink: 0;
    }
    @keyframes gm-spin { to { transform: rotate(360deg); } }
    .gm-cooldown-text {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 13px;
      color: var(--ig-hd-warning-text);
      line-height: 1.4;
    }
    .gm-cooldown-text strong {
      color: var(--ig-hd-warning-text-strong);
      font-weight: 700;
    }
    .gm-details-card {
      border: 1px solid var(--ig-hd-card-border);
      border-radius: 16px;
      padding: 4px 14px;
    }
    .gm-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      font-size: 14px;
      min-height: 24px;
    }
    .gm-row-label {
      color: var(--ig-hd-text-primary);
      font-weight: 400;
      line-height: 1.4;
    }
    .gm-row-value {
      font-size: 13px;
      font-weight: 600;
      color: var(--ig-hd-text-primary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }
    .gm-row-value.secondary {
      color: var(--ig-hd-text-secondary);
      font-weight: 500;
    }
    .gm-row-value.fail { color: #DD3A4B; }
    .gm-row-value-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .gm-row.linkish {
      cursor: pointer;
      padding: 12px 0;
    }
    .gm-row.linkish:hover .gm-row-label { color: var(--ig-hd-accent); }
    .gm-row-chev {
      color: var(--ig-hd-text-secondary);
      display: flex;
      align-items: center;
    }
    .gm-row-chev svg { width: 12px; height: 12px; transition: transform 150ms ease; }
    .gm-row.expanded .gm-row-chev svg { transform: rotate(90deg); }
    .gm-failed-list {
      display: flex;
      flex-direction: column;
      max-height: 240px;
      overflow-y: auto;
      padding: 4px 0 8px;
      border-top: 1px solid var(--ig-hd-border-tertiary);
      margin-top: -1px;
    }
    .gm-failed-list[hidden] { display: none; }
    .gm-failed-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 2px;
      font-size: 13px;
      line-height: 1.35;
      border-bottom: 1px solid var(--ig-hd-border-tertiary);
    }
    .gm-failed-item:last-child { border-bottom: none; }
    .gm-failed-item-name {
      color: var(--ig-hd-text-primary);
      font-weight: 500;
      word-break: break-all;
    }
    .gm-failed-item-reason {
      color: var(--ig-hd-text-secondary);
      font-size: 12px;
      word-break: break-word;
    }
    .gm-failed-list-empty {
      color: var(--ig-hd-text-secondary);
      font-size: 12px;
      padding: 8px 2px;
    }
    .gm-failed-list-footer {
      padding: 6px 2px 0;
      font-size: 12px;
      color: var(--ig-hd-text-secondary);
    }
    .gm-actions {
      display: flex;
      gap: 8px;
      padding: 2px 0 0;
      position: relative;
    }
    .gm-btn {
      appearance: none;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      height: 40px;
      padding: 0 18px;
      border-radius: 12px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: opacity 0.15s, background 0.15s, border-color 0.15s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      line-height: 1;
      color: inherit;
    }
    .gm-btn:disabled {
      opacity: 0.4;
      cursor: default;
      pointer-events: none;
    }
    .gm-btn-icon-slot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .gm-btn-icon-slot svg { width: 12px; height: 12px; }
    .gm-btn-primary {
      background: var(--ig-hd-accent);
      color: #fff;
      flex: 1 1 auto;
    }
    .gm-btn-primary:hover {
      background: var(--ig-hd-accent-hover);
      opacity: 0.95;
    }
    .gm-btn-secondary {
      background: transparent;
      border-color: var(--ig-hd-border-secondary);
      color: var(--ig-hd-text-primary);
    }
    .gm-btn-secondary:hover { background: var(--ig-hd-hover-item); }
    .gm-btn-icon {
      width: 40px;
      padding: 0;
      background: transparent;
      border-color: var(--ig-hd-border-secondary);
      color: var(--ig-hd-text-secondary);
      flex: 0 0 auto;
    }
    .gm-btn-icon:hover {
      background: var(--ig-hd-hover-item);
      color: var(--ig-hd-text-primary);
    }
    .gm-btn-icon svg { width: 14px; height: 14px; }
    .gm-menu {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      background: #212328;
      border: 1px solid var(--ig-hd-border-primary);
      border-radius: 10px;
      box-shadow: 0 4px 24px var(--ig-hd-shadow);
      padding: 8px 0;
      min-width: 200px;
      z-index: 5;
      display: none;
      animation: ig-menu-fade 0.15s ease;
    }
    :root.ig-hd-theme-light .gm-menu { background: #ffffff; }
    .gm-menu.open { display: grid; }
    .gm-menu-item {
      appearance: none;
      font: inherit;
      background: transparent;
      border: none;
      font-size: 14px;
      font-weight: 600;
      color: var(--ig-hd-text-primary);
      text-align: left;
      padding: 11px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      line-height: 1.25;
    }
    .gm-menu-item[hidden] { display: none; }
    .gm-menu-item:hover { background: var(--ig-hd-hover-item); }
    .gm-menu-item:disabled {
      color: var(--ig-hd-text-tertiary);
      cursor: default;
      pointer-events: none;
    }
    .gm-menu-item svg {
      width: 16px;
      height: 16px;
      opacity: 0.92;
      color: var(--ig-hd-text-secondary);
      flex-shrink: 0;
    }
    .gm-menu-item.danger { color: var(--ig-hd-danger-text); }
    .gm-menu-item.danger svg {
      color: var(--ig-hd-danger-text);
      opacity: 1;
    }
    .gm-menu-divider {
      height: 1px;
      background: #383b42;
      margin: 8px 0;
    }
    :root.ig-hd-theme-light .gm-menu-divider { background: var(--ig-hd-border-primary); }
    .gm-runs-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
      margin: 4px 0 -4px;
    }
    .gm-runs-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--ig-hd-text-primary);
    }
    .gm-runs-toggle {
      appearance: none;
      font: inherit;
      background: none;
      border: none;
      color: var(--ig-hd-text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .gm-runs-toggle:hover {
      background: var(--ig-hd-hover-item);
      color: var(--ig-hd-text-primary);
    }
    .gm-runs-toggle svg {
      width: 10px;
      height: 10px;
      transition: transform 0.18s ease;
    }
    .gm-runs.collapsed .gm-runs-toggle svg { transform: rotate(-90deg); }
    .gm-runs-card {
      border: 1px solid var(--ig-hd-card-border);
      border-radius: 16px;
      padding: 0 14px;
      max-height: 250px;
      overflow-y: auto;
      transition: max-height 0.22s ease, padding 0.2s ease, border-color 0.2s ease;
    }
    .gm-runs.collapsed .gm-runs-card {
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      border-color: transparent;
    }
    .gm-runs-card::-webkit-scrollbar { width: 6px; }
    .gm-runs-card::-webkit-scrollbar-thumb {
      background: var(--ig-hd-border-secondary);
      border-radius: 3px;
    }
    .gm-run {
      appearance: none;
      font: inherit;
      background: transparent;
      border: none;
      text-align: left;
      padding: 12px 0;
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      column-gap: 12px;
      row-gap: 3px;
      align-items: center;
      color: var(--ig-hd-text-primary);
      cursor: pointer;
      width: 100%;
      position: relative;
    }
    .gm-run:hover .gm-run-label { color: var(--ig-hd-accent); }
    .gm-run.active .gm-run-label { color: var(--ig-hd-accent); }
    .gm-run.active::before {
      content: "";
      position: absolute;
      left: -14px;
      top: 10px;
      bottom: 10px;
      width: 3px;
      background: var(--ig-hd-accent);
      border-radius: 0 3px 3px 0;
    }
    .gm-run-label {
      grid-column: 1;
      grid-row: 1;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      transition: color 0.15s;
    }
    .gm-run-meta {
      grid-column: 1;
      grid-row: 2;
      font-size: 12px;
      font-weight: 400;
      color: var(--ig-hd-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .gm-run-state {
      grid-column: 2;
      grid-row: 1 / 3;
      justify-self: end;
      align-self: center;
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
      padding: 4px 10px;
      border-radius: 10px;
      font-variant-numeric: tabular-nums;
      background: var(--ig-hd-accent);
      opacity: 0.85;
      letter-spacing: 0.1px;
    }
    .gm-run:hover .gm-run-state { opacity: 1; }
    .gm-run.active .gm-run-state { opacity: 1; }
    .gm-run[data-state="running"] .gm-run-state { background: #4A5DF9; }
    .gm-run[data-state="paused"] .gm-run-state,
    .gm-run[data-state="cooldown"] .gm-run-state,
    .gm-run[data-state="partial"] .gm-run-state { background: #B78A2E; }
    .gm-run[data-state="completed"] .gm-run-state { background: #00875A; }
    .gm-run[data-state="failed"] .gm-run-state,
    .gm-run[data-state="cancelled"] .gm-run-state,
    .gm-run[data-state="cancelling"] .gm-run-state { background: #DD3A4B; }
    .gm-mini-bar {
      display: none;
      height: 3px;
      background: var(--ig-hd-accent);
      width: 0%;
      transition: width 0.25s ease, background 0.15s ease;
    }
    #ig-hd-batch-progress.minimized .gm-mini-bar { display: block; }
    #ig-hd-batch-progress[data-state="paused"].minimized .gm-mini-bar,
    #ig-hd-batch-progress[data-state="cooldown"].minimized .gm-mini-bar,
    #ig-hd-batch-progress[data-state="partial"].minimized .gm-mini-bar { background: #B78A2E; }
    #ig-hd-batch-progress[data-state="completed"].minimized .gm-mini-bar {
      background: #00875A;
      width: 100% !important;
    }
    #ig-hd-batch-progress[data-state="cancelling"].minimized .gm-mini-bar,
    #ig-hd-batch-progress[data-state="failed"].minimized .gm-mini-bar,
    #ig-hd-batch-progress[data-state="cancelled"].minimized .gm-mini-bar { background: #DD3A4B; }
    .gm-btn:focus-visible,
    .gm-ctrl:focus-visible,
    .gm-run:focus-visible,
    .gm-runs-toggle:focus-visible,
    .gm-menu-item:focus-visible {
      outline: 2px solid var(--ig-hd-accent);
      outline-offset: 2px;
    }
    .ig-hd-token-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 0;
    }
    .ig-hd-token-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 32px;
      width: auto;
      min-width: 0;
      border: none;
      border-radius: 12px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      cursor: pointer;
      transition: opacity 0.15s ease;
      color: rgba(255, 255, 255, 0.8);
      opacity: 0.5;
      flex: 0 0 auto;
    }
    .ig-hd-token-btn:hover {
      opacity: 0.7;
    }
    .ig-hd-token-btn:active {
      transform: scale(0.95);
    }
    .ig-hd-token-btn.active {
      opacity: 1;
      color: #ffffff;
    }
    .ig-hd-token-btn.active:hover {
      opacity: 0.85;
    }
    /* Token pill group backgrounds */
    .ig-hd-token-btn[data-group="identity"] { background: var(--ig-hd-token-identity); }
    .ig-hd-token-btn[data-group="content"] { background: var(--ig-hd-token-content); }
    .ig-hd-token-btn[data-group="download-time"] { background: var(--ig-hd-token-download-time); }
    .ig-hd-token-btn[data-group="upload-time"] { background: var(--ig-hd-token-upload-time); }
    .ig-hd-template-preview-group {
      display: grid;
      gap: 4px;
      padding-top: 4px;
    }
    .ig-hd-template-preview {
      font-size: 11px;
      color: var(--ig-hd-text-secondary);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-weight: 600;
      padding: 6px 8px;
      background: var(--ig-hd-bg-tertiary);
      border-radius: 4px;
      border: 1px solid var(--ig-hd-border-primary);
      min-height: 16px;
      word-break: break-all;
      margin-top: 0;
    }
    .ig-hd-template-preview-label {
      font-size: 11px;
      color: var(--ig-hd-text-secondary);
      font-weight: 600;
      margin-top: 0;
    }
    .ig-hd-template-preview.empty {
      color: var(--ig-hd-template-empty);
    }
    .ig-hd-template-preview.valid {
      color: var(--ig-hd-template-valid);
    }
    .ig-hd-template-preview.invalid {
      color: var(--ig-hd-template-invalid);
    }
    /* ── Export tab: pattern editor (three-layer) ── */
    .ig-hd-pattern-editor-wrap {
      position: relative;
      border-radius: 10px;
      /* No overflow:hidden here — the autocomplete popup is an absolute child
         that must escape the wrap's bounds. The overlay child clips itself. */
      background: var(--ig-hd-bg-tertiary);
      border: 1px solid var(--ig-hd-border-secondary);
      transition: border-color 0.15s ease;
    }
    .ig-hd-pattern-editor-wrap.focused {
      border-color: var(--ig-hd-accent);
    }
    .ig-hd-pattern-editor-pencil {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 3;
      pointer-events: none;
      opacity: 0.6;
      transition: opacity 0.15s ease;
      display: flex;
      align-items: center;
    }
    .ig-hd-pattern-editor-wrap.focused .ig-hd-pattern-editor-pencil {
      opacity: 0.3;
    }
    .ig-hd-pattern-editor-overlay {
      position: absolute;
      inset: 0;
      overflow: hidden;
      box-sizing: border-box;
      padding: 10px 12px;
      padding-left: 34px;
      padding-right: 36px;
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 24px;
      letter-spacing: normal;
      white-space: pre;
      z-index: 1;
      pointer-events: none;
    }
    .ig-hd-pattern-editor-overlay .token-seg {
      font-weight: 600;
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-pattern-editor-overlay .token-seg.invalid {
      color: var(--ig-hd-template-invalid);
    }
    .ig-hd-pattern-editor-overlay .text-seg {
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-pattern-editor-overlay .placeholder-text {
      color: var(--ig-hd-text-tertiary);
      font-weight: 400;
    }
    .ig-hd-pattern-editor-input {
      position: relative;
      width: 100%;
      box-sizing: border-box;
      height: 44px;
      padding: 10px 12px;
      padding-left: 34px;
      padding-right: 36px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: transparent;
      caret-color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 24px;
      letter-spacing: normal;
      outline: none;
      z-index: 2;
    }
    .ig-hd-pattern-editor-clear {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 3;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 2px;
      opacity: 0.5;
      transition: opacity 0.15s ease;
    }
    .ig-hd-pattern-editor-clear:hover {
      opacity: 0.8;
    }
    .ig-hd-pattern-editor-clear svg path {
      stroke: var(--ig-hd-bg-tertiary);
    }
    /* ── Export tab: naming pattern label ── */
    .ig-hd-filename-pattern-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      line-height: 18px;
      color: var(--ig-hd-text-primary);
      margin: 0 0 10px;
    }
    /* ── Export tab: autocomplete dropdown ── */
    .ig-hd-pattern-autocomplete {
      position: absolute;
      z-index: 100;
      background: var(--ig-hd-bg-secondary);
      border: 1px solid var(--ig-hd-border-secondary);
      border-radius: 8px;
      box-shadow: 0 4px 16px var(--ig-hd-shadow-soft);
      padding: 4px 0;
      min-width: 220px;
      max-height: 240px;
      overflow-y: auto;
    }
    .ig-hd-pattern-ac-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      color: var(--ig-hd-text-primary);
      text-align: left;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    }
    .ig-hd-pattern-ac-item.highlighted {
      background: var(--ig-hd-hover-item);
    }
    .ig-hd-pattern-ac-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .ig-hd-pattern-ac-key {
      font-size: 11px;
      color: var(--ig-hd-text-tertiary);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    /* ── Export tab: token catalog (stacked groups with labels) ── */
    .ig-hd-filename-group-label {
      font-size: 14px;
      font-weight: 600;
      line-height: 18px;
      color: var(--ig-hd-text-primary);
      margin: 0 0 8px;
    }
    .ig-hd-filename-group-label.sub {
      margin-top: 14px;
    }
    .ig-hd-token-catalog {
      display: block;
    }
    .ig-hd-filename-pattern-help,
    .ig-hd-token-catalog-help,
    .ig-hd-separator-help,
    .ig-hd-preview-note {
      margin: 8px 0 0;
    }
    .ig-hd-filename-pattern-help {
      margin-top: 6px;
    }
    .ig-hd-token-group-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    /* ── Export tab: separator (horizontal 4-button segmented group) ── */
    .ig-hd-separator-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border: 1px solid var(--ig-hd-border-secondary);
      border-radius: 10px;
      overflow: hidden;
      background: var(--ig-hd-bg-tertiary);
    }
    .ig-hd-sep-btn {
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      border: none;
      border-right: 1px solid var(--ig-hd-border-secondary);
      background: transparent;
      color: var(--ig-hd-text-tertiary);
      padding: 0;
    }
    .ig-hd-sep-btn:last-child {
      border-right: none;
    }
    .ig-hd-sep-btn:hover {
      background: var(--ig-hd-hover-item);
      color: var(--ig-hd-text-secondary);
    }
    .ig-hd-sep-btn.primed {
      background: rgba(65, 80, 247, 0.12);
      color: var(--ig-hd-accent);
    }
    .ig-hd-sep-btn.active {
      background: var(--ig-hd-accent);
      color: #fff;
      border-right-color: var(--ig-hd-accent);
    }
    .ig-hd-sep-btn.flash {
      animation: ig-hd-sep-flash 0.35s ease;
    }
    @keyframes ig-hd-sep-flash {
      0% { background: rgba(65, 80, 247, 0.4); }
      100% { background: rgba(65, 80, 247, 0.12); }
    }
    /* ── Export tab: live preview (box with row + optional note) ── */
    .ig-hd-export-preview {
      padding: 12px;
      background: var(--ig-hd-bg-tertiary);
      border: 1px solid var(--ig-hd-border-primary);
      border-radius: 8px;
    }
    .ig-hd-export-preview-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ig-hd-export-preview-text {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      line-height: 16px;
      min-height: 16px;
      word-break: break-all;
    }
    .ig-hd-export-preview-text.empty {
      color: var(--ig-hd-template-empty);
      font-style: italic;
      font-weight: 500;
    }
    .ig-hd-export-preview-text.valid {
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-export-preview-text.invalid {
      color: var(--ig-hd-template-invalid);
    }
    /* ── Export tab: filename actions row (Clear | Reset to default) ── */
    .ig-hd-filename-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 4px;
    }
    .ig-hd-filename-action-link {
      font-size: 12px;
      font-weight: 500;
      color: var(--ig-hd-text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      transition: color 0.15s ease;
    }
    .ig-hd-filename-action-link:hover {
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-filename-action-link.accent {
      color: var(--ig-hd-accent);
    }
    .ig-hd-filename-action-link.accent:hover {
      opacity: 0.85;
      color: var(--ig-hd-accent);
    }
    /* ── Export tab: folder input wrap (mirrors the naming-pattern editor:
       wrap holds the bg + border, icon and prefix sit absolutely-styled
       inside on the left, the input is transparent and fills the rest) ── */
    .ig-hd-export-folder-wrap {
      position: relative;
      display: flex;
      align-items: center;
      height: 44px;
      padding: 0 12px;
      border-radius: 10px;
      background: var(--ig-hd-bg-tertiary);
      border: 1px solid var(--ig-hd-border-secondary);
      transition: border-color 0.15s ease;
    }
    .ig-hd-export-folder-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ig-hd-text-tertiary);
      opacity: 0.6;
      flex-shrink: 0;
      margin-right: 10px;
    }
    .ig-hd-export-folder-prefix {
      display: none;
      color: var(--ig-hd-text-tertiary);
      font-size: 14px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin-right: 2px;
      flex-shrink: 0;
      letter-spacing: 0.5px;
    }
    .ig-hd-export-folder-wrap.has-value .ig-hd-export-folder-prefix {
      display: inline-block;
    }
    .ig-hd-export-folder-input {
      flex: 1;
      min-width: 0;
      height: 100%;
      border: none;
      background: transparent;
      color: var(--ig-hd-text-primary);
      font-size: 14px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 0;
      outline: none;
    }
    .ig-hd-export-folder-input::placeholder {
      color: var(--ig-hd-text-tertiary);
      font-weight: 400;
    }
    :root.ig-hd-theme-light .ig-hd-token-btn {
      opacity: 0.8;
    }
    :root.ig-hd-theme-light .ig-hd-token-btn[data-group="identity"] { background: #4A5DF918; color: #4A5DF9; }
    :root.ig-hd-theme-light .ig-hd-token-btn[data-group="content"] { background: #843DE018; color: #843DE0; }
    :root.ig-hd-theme-light .ig-hd-token-btn[data-group="download-time"] { background: #D62C7A18; color: #D62C7A; }
    :root.ig-hd-theme-light .ig-hd-token-btn[data-group="upload-time"] { background: #D9770618; color: #D97706; }
    :root.ig-hd-theme-light .ig-hd-token-btn:hover {
      opacity: 1;
    }
    :root.ig-hd-theme-light .ig-hd-token-btn.active[data-group="identity"] { background: var(--ig-hd-token-identity); color: #fff; opacity: 1; }
    :root.ig-hd-theme-light .ig-hd-token-btn.active[data-group="content"] { background: var(--ig-hd-token-content); color: #fff; opacity: 1; }
    :root.ig-hd-theme-light .ig-hd-token-btn.active[data-group="download-time"] { background: var(--ig-hd-token-download-time); color: #fff; opacity: 1; }
    :root.ig-hd-theme-light .ig-hd-token-btn.active[data-group="upload-time"] { background: var(--ig-hd-token-upload-time); color: #fff; opacity: 1; }
    .ig-hd-settings-group {
      margin-bottom: 0;
      display: grid;
      gap: 0;
    }
    .ig-hd-settings-group > * + * {
      margin-top: 18px;
    }
    .ig-hd-settings-group + .ig-hd-settings-group {
      border-top: none;
      margin-top: 28px;
    }
    .ig-hd-settings-card + .ig-hd-settings-card {
      margin-top: 18px;
    }
    .ig-hd-settings-subheading {
      font-size: 20px;
      font-weight: 700;
      line-height: 25px;
      color: var(--ig-hd-text-primary);
      margin: 0;
    }
    .ig-hd-settings-section-desc {
      font-size: 12px;
      line-height: 16px;
      font-weight: 400;
      color: var(--ig-hd-text-secondary);
    }
    .ig-hd-settings-list-heading {
      margin-top: 16px;
      margin-bottom: 8px;
      font-weight: 600;
      padding: unset;
      transform: translateY(calc(0.185714em));
      line-height: 1.67143;
      font-size: 14px;
      color: var(--ig-hd-text-primary);
      white-space: pre-wrap;
      overflow-wrap: break-word;
      max-width: 100%;
    }
    .ig-hd-settings-card {
      border: 1px solid var(--ig-hd-card-border);
      border-radius: 20px;
      padding: 0 16px;
      background: transparent;
    }
    .ig-hd-settings-card-inner {
      padding: 10px 0;
    }
    .ig-hd-settings-card-inner > * {
      padding: 12px 0;
    }
    .ig-hd-settings-card-heading {
      font-size: 14px;
      font-weight: 600;
      color: var(--ig-hd-text-primary);
      line-height: 18px;
    }
    .ig-hd-folder-compact .ig-hd-settings-input {
      min-width: 120px;
    }
    .ig-hd-settings-subheading + .ig-hd-settings-card {
      margin-top: 18px;
    }
    .ig-hd-settings-subheading + .ig-hd-settings-section-desc {
      margin-top: 6px;
    }
    .ig-hd-settings-section-desc + .ig-hd-settings-card {
      margin-top: 12px;
    }
    .ig-hd-settings-card + .ig-hd-settings-help {
      margin-top: 8px;
    }
    .ig-hd-settings-help + .ig-hd-settings-card {
      margin-top: 22px;
    }
    .ig-hd-skip-history-note {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 10px 14px;
      border-radius: 10px;
      background: var(--ig-hd-bg-secondary);
      border: 1px solid var(--ig-hd-border-primary);
      font-size: 12px;
      color: var(--ig-hd-text-secondary);
      line-height: 16px;
    }
    .ig-hd-skip-history-count {
      font-size: 13px;
      font-weight: 600;
      color: var(--ig-hd-text-primary);
    }
    .ig-hd-date-filter-body {
      display: grid;
      grid-template-rows: 1fr;
      transition: grid-template-rows 0.2s ease, opacity 0.2s ease;
      opacity: 1;
      overflow: hidden;
    }
    .ig-hd-date-filter-body.collapsed {
      grid-template-rows: 0fr;
      opacity: 0;
    }
    .ig-hd-date-filter-body-inner {
      min-height: 0;
      display: grid;
      gap: 0;
    }
    .ig-hd-date-filter-dates-row.ig-hd-date-filter-dates-row--single {
      grid-template-columns: 1fr;
    }
    .ig-hd-date-filter-fields--start[hidden],
    .ig-hd-date-filter-fields--end[hidden] {
      display: none;
    }
    .ig-hd-date-filter-warning {
      color: var(--ig-hd-warning-fg, #c43);
      font-size: 12px;
      margin: 4px 0 0;
    }
    .ig-hd-download-btn {
      width: 100%;
      text-align: center;
    }
    .ig-hd-download-btn:disabled {
      background: #18208b;
      color: #ffffff;
      opacity: 1;
      cursor: not-allowed;
    }
    /* Profile grid — downloaded post markers */
    a[data-ig-hd-downloaded] { position: relative; }
    .ig-hd-grid-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      pointer-events: none;
      z-index: 1;
    }
    .ig-hd-grid-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 2;
    }
    .ig-hd-grid-badge svg {
      width: 12px;
      height: 12px;
      stroke: #fff;
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    [data-ig-hd-theme="light"] .ig-hd-grid-overlay { background: rgba(0, 0, 0, 0.25); }
    [data-ig-hd-theme="light"] .ig-hd-grid-badge { background: rgba(255, 255, 255, 0.7); }
    [data-ig-hd-theme="light"] .ig-hd-grid-badge svg { stroke: #333; }
    @media (max-width: 700px) {
      .ig-hd-settings-row.two-col {
        grid-template-columns: 1fr;
      }
      #ig-hd-batch-progress {
        width: calc(100vw - 16px);
        left: 8px;
        top: 8px;
      }
      #ig-hd-batch-progress.minimized {
        width: calc(100vw - 16px);
      }
      #ig-hd-settings-launcher {
        right: auto;
        left: 8px;
        top: 8px;
        padding: var(--ig-hd-settings-launcher-padding, 12px);
        margin: 0;
      }
    }
  `;
  function appendAmstragramStyle() {
    if (style.parentNode) return true;
    const root = document.head || document.documentElement;
    if (!root) return false;
    root.appendChild(style);
    return true;
  }
  if (!appendAmstragramStyle()) {
    document.addEventListener("DOMContentLoaded", appendAmstragramStyle, { once: true });
  }

  // =========================================
  // ICONS
  // =========================================
  const icons = {
    copy: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    external: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    layers: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
    download: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    settings: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.07V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.07-.4H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.07V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.07.4H21a2 2 0 1 1 0 4h-.1A1.7 1.7 0 0 0 19.4 15z"/></svg>`,
    profilePicture: () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.637 6.559a3.637 3.637 0 1 0-7.273 0 3.637 3.637 0 0 0 7.273 0zm2.908 0a6.545 6.545 0 1 1-13.09 0 6.545 6.545 0 0 1 13.09 0zM12 14.698c5.107 0 9.535 2.901 11.825 7.151a1.455 1.455 0 0 1-2.56 1.388C19.45 19.867 15.971 17.612 12 17.612s-7.45 2.256-9.265 5.625a1.455 1.455 0 1 1-2.56-1.388C2.465 17.6 6.892 14.698 12 14.698z"/></svg>`,
    post: () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.89 0H1.333C.597 0 0 .488 0 1.091v4.364C0 6.057.597 6.545 1.333 6.545H4.89c.736 0 1.333-.488 1.333-1.09V1.09C6.223.489 5.626 0 4.89 0z"/><path d="M22.667 0H19.11c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V1.09C24 .489 23.403 0 22.667 0z"/><path d="M13.781 0h-3.557C9.488 0 8.891.488 8.891 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V1.09c0-.603-.597-1.091-1.333-1.091z"/><path d="M4.89 8.727H1.333C.597 8.727 0 9.215 0 9.818v4.364c0 .602.597 1.09 1.333 1.09H4.89c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M22.667 8.727H19.11c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M13.781 8.727h-3.557c-.736 0-1.333.488-1.333 1.091v4.364c0 .602.597 1.09 1.333 1.09h3.557c.736 0 1.333-.488 1.333-1.09V9.818c0-.603-.597-1.091-1.333-1.091z"/><path d="M4.89 17.455H1.333C.597 17.455 0 17.943 0 18.545v4.364C0 23.512.597 24 1.333 24H4.89c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/><path d="M22.667 17.455H19.11c-.736 0-1.333.488-1.333 1.09v4.364c0 .603.597 1.091 1.333 1.091h3.557c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/><path d="M13.781 17.455h-3.557c-.736 0-1.333.488-1.333 1.09v4.364c0 .603.597 1.091 1.333 1.091h3.557c.736 0 1.333-.488 1.333-1.091v-4.364c0-.602-.597-1.09-1.333-1.09z"/></svg>`,
    reel: () => `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.929 7.056C23.86 5.572 23.594 4.719 23.37 4.143a5.88 5.88 0 0 0-1.386-2.127 5.88 5.88 0 0 0-2.127-1.386C19.28.406 18.428.14 16.943.071 15.636.013 15.247 0 12 0S8.364.013 7.056.071C5.572.14 4.719.406 4.143.63A5.88 5.88 0 0 0 2.016 2.015 5.9 5.9 0 0 0 .63 4.142C.406 4.72.14 5.572.071 7.057.013 8.364 0 8.753 0 12s.013 3.636.071 4.944c.069 1.485.335 2.338.559 2.913a5.88 5.88 0 0 0 1.386 2.127 5.88 5.88 0 0 0 2.127 1.386c.578.224 1.43.49 2.914.559C8.364 23.987 8.753 24 12 24s3.636-.013 4.944-.071c1.485-.069 2.338-.335 2.913-.559a5.88 5.88 0 0 0 2.127-1.385 5.88 5.88 0 0 0 1.386-2.127c.224-.578.49-1.43.559-2.914.058-1.308.071-1.697.071-4.944s-.013-3.636-.071-4.944zM16.749 9.395l-5.727-3.273a2.2 2.2 0 0 0-2.195.016 2.2 2.2 0 0 0-1.095 1.907v6.546c0 .76.393 1.458 1.05 1.867a2.2 2.2 0 0 0 2.196-.017l5.727-3.272c.67-.383.954-.89.954-1.585s-.284-1.201-.954-1.585l-.001-.003.046-.001z"/></svg>`,
    story: () => `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="2.2"/><polygon points="10,7.5 17,12 10,16.5" fill="currentColor"/></svg>`,
    highlight: () => `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="2.2"/><path d="m12 5.5 1.8 5.5h5.8l-4.7 3.4 1.8 5.5L12 16.5l-4.7 3.4 1.8-5.5-4.7-3.4h5.8z" fill="currentColor"/></svg>`
  };

  const SETTINGS_LAUNCHER_ICON_SVG = `
    <svg aria-hidden="true" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M839.24 45.176C892.93 45.176 935.056 91.7761 935.056 147.469V919.907C935.056 952.352 908.753 978.654 876.309 978.654H246.744C158.195 978.654 87.8105 901.629 87.8105 808.404V265.846C87.8105 144.776 179.161 45.1761 293.573 45.176H839.24ZM293.573 95.214C207.264 95.2142 135.897 170.807 135.897 265.846V808.404C135.897 875.053 185.499 927.772 245.287 928.606L246.744 928.615H886.968V147.469C886.968 117.808 864.827 95.2141 839.24 95.214H293.573Z" fill="currentColor" stroke="currentColor" stroke-width="22.6363"/>
      <path d="M516.531 126.337C540.538 126.262 564.542 126.371 588.546 126.663H588.583C601.221 126.892 613.163 126.84 626.258 127.96C641.518 128.839 657.277 131.13 672.165 135.131C680.548 137.384 692.057 142.692 699.339 146.056H699.338C707.105 149.642 717.744 157.635 723.628 162.752C737.874 175.138 750.961 190.981 758.525 208.759C761.788 216.408 765.542 225.172 767.753 233.876L768.21 235.722C772.815 254.772 773.772 273.698 774.247 292.528L774.353 295.939C774.585 303.889 774.718 311.841 774.755 319.792L775.326 383.15L775.327 383.167V383.185C775.37 395.285 774.794 409.772 775.388 420.894L775.405 421.21L775.391 421.527C774.75 435.724 774.413 449.934 774.388 464.142V464.203C774.325 469.713 774.351 483.437 773.7 489.079L773.68 489.258L773.648 489.436C773.579 489.84 773.484 490.945 773.379 492.582C773.29 493.969 773.193 495.702 773.099 496.782L773.1 496.783C772.633 502.303 771.965 507.807 771.098 513.284L771.097 513.293C767.712 534.441 759.436 556.204 746.734 573.829C739.117 585.087 729.407 594.915 718.68 603.094H718.679C690.51 624.567 657.62 632.357 623.569 634.119L621.947 634.199C578.868 636.188 536.022 635.778 493.182 635.688V635.687C470.799 635.696 448.417 635.439 426.042 634.915L426.022 634.914H426.002C407.965 634.381 388.948 633.946 370.433 630.115V630.114C345.798 625.019 321.636 614.766 302.379 597.953C271.545 571.034 258.547 538.457 254.333 499.779C253.178 489.185 252.954 478.148 252.38 468.048C251.852 458.764 251.905 449.392 251.809 440.435V440.381L251.677 384.366V384.327L251.892 327.117V327.111C251.904 324.414 251.732 320.138 251.843 316.815V316.805C252.885 287.031 252.547 254.464 261.673 224.187L261.87 223.558C262.926 220.294 265.019 215.324 267.088 210.752C269.314 205.833 271.783 200.779 273.371 198.057C282.971 181.605 296.381 166.869 312.269 155.895C321.388 149.596 329.854 144.233 341.058 140.249C364.243 130.482 388.785 128.347 412.642 127.13C427.449 126.375 443.059 126.569 457.814 126.534V126.533L516.53 126.337H516.531ZM616.979 184.577C552.294 182.578 487.466 182.469 422.749 184.257C411.395 184.571 398.981 185.063 387.006 186.946C375.003 188.832 363.879 192.056 354.965 197.563L354.532 197.83L354.062 198.027C349.412 199.968 346.727 202.188 342.154 206.085C317.758 226.879 313.436 251.288 311.837 284.301L311.826 284.523L311.8 284.743C311.035 291.228 310.927 297.462 310.912 303.859C310.897 310.085 310.972 316.612 310.522 323.235L310.654 405.109V405.167C310.555 418.264 310.549 431.36 310.638 444.453C310.871 452.412 310.867 459.817 311.364 467.349C311.421 468.211 311.485 469.748 311.544 470.85C311.577 471.466 311.613 472.031 311.651 472.508C311.671 472.745 311.69 472.941 311.707 473.097C311.716 473.174 311.723 473.234 311.729 473.279C311.736 473.324 311.739 473.345 311.739 473.345L311.889 474.203L311.804 475.071C311.772 475.399 311.779 476.261 311.86 477.678C311.908 478.502 311.991 479.663 312.046 480.612L312.089 481.469V481.471C312.83 500.947 315.329 521.14 325.688 536.017L325.691 536.021C326.219 536.78 326.626 537.557 326.915 538.148C327.205 538.741 327.488 539.38 327.688 539.824C327.917 540.329 328.074 540.665 328.21 540.923C328.251 541 328.281 541.052 328.3 541.084C336.511 550.909 345.646 559.856 356.468 564.914L357.524 565.393L357.531 565.397C359.087 566.082 360.664 567.027 361.713 567.632C362.952 568.347 363.741 568.766 364.37 568.998L365.511 569.412C389.5 577.958 416.272 577.337 443.271 577.704H443.27C469.504 577.925 495.739 577.98 521.973 577.866H521.982L582.475 577.685C597.499 577.566 613.212 577.746 628.568 576.169C643.895 574.596 658.315 571.31 670.598 564.56C671.644 563.985 672.75 563.412 673.774 562.877C674.828 562.328 675.827 561.804 676.79 561.265C678.758 560.164 680.277 559.164 681.354 558.176V558.175C689.97 550.278 697.663 543.549 701.483 534.733L701.488 534.722L701.492 534.711C702.26 532.955 703.379 531.195 704.163 529.944C705.073 528.491 705.7 527.472 706.108 526.581C711.784 513.976 714.256 499.062 715.058 484.653V484.645L715.059 484.638C717.355 445.036 716.493 405.615 716.718 365.534L716.743 359.847C716.831 331.428 716.361 303.179 715.111 274.795L715.074 274.06C714.644 266.332 712.689 254.609 710.699 247.138L710.695 247.122C707.184 233.812 700.377 221.523 690.851 211.331L690.843 211.323L690.835 211.315C684.593 204.589 674.092 197.449 665.406 193.675C651.046 187.807 633.114 185.085 616.979 184.577V184.577Z" fill="currentColor" stroke="currentColor" stroke-width="12.8582"/>
      <path d="M372.714 363.607C378.74 286.929 443.302 228.598 519.17 231.672C595.031 234.747 654.808 298.108 654.808 375.023C654.804 451.336 595.954 514.305 520.938 518.284L519.162 518.367C443.294 521.435 378.735 463.102 372.714 386.424C372.118 378.831 372.117 371.2 372.714 363.607ZM594.655 372.711C593.557 327.167 556.414 291.303 511.847 292.326C467.155 293.353 431.593 331.083 432.693 376.753C433.794 422.42 471.126 458.328 515.81 457.129C560.378 455.933 595.753 418.258 594.655 372.711Z" fill="currentColor" stroke="currentColor" stroke-width="12.8582"/>
      <path d="M648.425 196.369C650.359 196.448 652.254 197.119 653.815 198.336C655.484 199.637 656.685 201.5 657.115 203.646L661.111 223.479V223.48C661.165 223.745 661.311 224.039 661.594 224.305C661.845 224.54 662.189 224.737 662.602 224.841L662.783 224.879V224.88L683.916 228.63H683.915C685.824 228.967 687.619 229.89 688.999 231.318L689.271 231.611L689.529 231.918C690.791 233.479 691.515 235.437 691.515 237.501C691.515 239.703 690.692 241.784 689.271 243.391C687.858 244.987 685.952 246.012 683.915 246.371L683.916 246.372L662.783 250.123C662.29 250.211 661.881 250.428 661.594 250.697C661.311 250.963 661.165 251.258 661.111 251.522V251.523L657.117 271.343L657.118 271.344C656.69 273.495 655.487 275.364 653.815 276.667C652.15 277.965 650.105 278.642 648.038 278.642C645.971 278.642 643.925 277.965 642.26 276.667C640.591 275.366 639.39 273.502 638.96 271.355V271.356L634.964 251.523V251.522C634.911 251.258 634.764 250.963 634.481 250.697C634.195 250.428 633.786 250.211 633.293 250.123H633.292L612.16 246.372V246.371C610.124 246.012 608.218 244.986 606.806 243.391C605.384 241.784 604.561 239.703 604.561 237.501C604.561 235.299 605.384 233.218 606.806 231.611C608.218 230.015 610.123 228.989 612.16 228.63L633.292 224.88L633.293 224.879C633.786 224.791 634.195 224.574 634.481 224.305C634.764 224.039 634.911 223.745 634.964 223.48V223.479L638.96 203.646C639.39 201.5 640.591 199.637 642.26 198.336C643.925 197.038 645.971 196.361 648.038 196.361L648.425 196.369Z" fill="currentColor" stroke="currentColor" stroke-width="10.8947" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="222.948" y="701.959" width="591.724" height="72.5031" rx="36.2516" fill="currentColor" stroke="currentColor" stroke-width="11.534"/>
      <rect x="222.948" y="817.997" width="591.724" height="72.5031" rx="36.2516" fill="currentColor" stroke="currentColor" stroke-width="11.534"/>
    </svg>
  `.trim();
  return { icons, SETTINGS_LAUNCHER_ICON_SVG };
})();
