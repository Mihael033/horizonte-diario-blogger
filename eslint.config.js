// ESLint (configuración plana): JS del navegador en src/js; Node en tools/ y tests/.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'preview/**', 'dist/**', 'theme/**'] },
  js.configs.recommended,
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, __HD_SECTIONS__: 'readonly', __HD_THEME_COLORS__: 'readonly' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'off',
    },
  },
  {
    files: ['src/js/head.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }], eqeqeq: ['error', 'always', { null: 'ignore' }], 'prefer-const': 'error' },
  },
];
