// Minimal ESLint baseline (first linter in this repo — added 2026-07).
//
// Philosophy: `npm run lint` must be a CI gate TODAY, on a 75k-LOC codebase
// that grew without one. So: real, low-noise correctness rules are ERRORS
// (they pass today and stop regressions); rules with a large legacy backlog
// are WARNINGS — visible in the editor and in CI logs, not build-breaking —
// each with its measured count at adoption time. Tighten one at a time by
// fixing the backlog and flipping the level.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      // Dead scaffolding, already excluded from tsconfig (see its comment).
      'src/imports/**',
      'src/app/components/projects/CreateProjectModal.tsx',
      // Generated/vendored shadcn primitives — not hand-maintained style.
      'src/app/components/ui/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // ── Errors: clean today, gate from now on ────────────────────────────
      'react-hooks/rules-of-hooks': 'error',

      // ── Warnings: legacy backlog, do not add to it ────────────────────────
      // React Compiler-era rules (plugin v6): valuable signal, but 148 legacy
      // hits at adoption (121 set-state-in-effect alone). Per-rule counts:
      'react-hooks/set-state-in-effect': 'warn',      // 121
      'react-hooks/refs': 'warn',                     //  11
      'react-hooks/static-components': 'warn',        //   8
      'react-hooks/purity': 'warn',                   //   3
      'react-hooks/preserve-manual-memoization': 'warn', // 3
      'react-hooks/immutability': 'warn',             //   2
      // 32 uses at adoption — mostly `catch (err: any)`; prefer `unknown` +
      // the ApiError narrowing the api layer already provides.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Deps analysis over 200+ effects; fix per-component, not in bulk.
      'react-hooks/exhaustive-deps': 'warn',
      // tsconfig has noUnusedLocals off; surface them without breaking CI.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Legacy `{}`/`Function`-style types and empty blocks exist in old code.
      '@typescript-eslint/no-empty-object-type': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    // Tests and e2e run in Node/Vitest contexts — looser by nature.
    files: ['**/*.test.{ts,tsx}', 'e2e/**', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
