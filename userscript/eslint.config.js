import js from "@eslint/js";
import globals from "globals";

// Cross-file globals: each *_CORE variable is defined in one file and consumed
// after concatenation in others. Declaring them here lets no-undef pass for
// consumer files; builtinGlobals:false prevents no-redeclare from firing in the
// defining file.
const CORE_GLOBALS = {
  GramPlatform: "readonly",
  UTILITIES_CORE: "readonly",
  ZIP_CORE: "readonly",
  HOTKEY_CORE: "readonly",
  TOAST_CORE: "readonly",
  CONTEXT_MENU_CORE: "readonly",
  DASH_MANIFEST_CORE: "readonly",
  MP4_REMUX_CORE: "readonly",
  MKV_MUX_CORE: "readonly",
  VIDEO_RESOLVER_CORE: "readonly",
  MEDIA_SELECTION_CORE: "readonly",
  DM_LIGHTSPEED_CORE: "readonly",
  DOWNLOAD_PIPELINE_CORE: "readonly",
  FILE_METADATA_CORE: "readonly",
  DATE_FILTER_CORE: "readonly",
  STORY_MATCHING_CORE: "readonly",
  SETTINGS_SCHEMA_CORE: "readonly",
  STYLES_CORE: "readonly",
  PAGE_HANDLERS_CORE: "readonly",
  PROFILE_BULK_DOWNLOAD_CORE: "readonly",
  APP_CORE: "readonly",
};

const GM_GLOBALS = {
  GM_download: "readonly",
  GM_openInTab: "readonly",
  GM_registerMenuCommand: "readonly",
  GM_xmlhttpRequest: "readonly",
  GM_getValue: "readonly",
  GM_setValue: "readonly",
  GM_info: "readonly",
  unsafeWindow: "readonly",
};

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...CORE_GLOBALS,
        ...GM_GLOBALS,
      },
    },
    rules: {
      // Each file declares its own *_CORE const — don't flag it as a redeclaration
      // of the same-named global defined above.
      "no-redeclare": ["error", { builtinGlobals: false }],
      // *_CORE exports are consumed by other files after concatenation, not within
      // the defining file. Unused args and catch bindings are also common here.
      "no-unused-vars": ["error", {
        varsIgnorePattern: "^(GramPlatform|[A-Z0-9_]+_CORE)$",
        args: "none",
        caughtErrors: "none",
        ignoreRestSiblings: true,
      }],
      // Control chars in regexes are intentional in settings-schema.js (filename sanitization).
      "no-control-regex": "off",
    },
  },
  {
    // Chrome Extension platform file — uses chrome.* APIs instead of GM_*.
    files: ["src/platform/extension.js"],
    languageOptions: {
      globals: { chrome: "readonly" },
    },
  },
  {
    ignores: ["node_modules/", "amstragram.js"],
  },
];
