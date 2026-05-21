import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
  {
    ignores: ['build/', '.svelte-kit/', 'node_modules/'],
  },
];
