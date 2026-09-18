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
import i18next from 'eslint-plugin-i18next';
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
    // ── Texto visible sin traducir ───────────────────────────────────────
    //
    // El panel se vende en español y en inglés, y la paridad de claves da
    // 26/26 namespaces idénticos. Ese chequeo es correcto y no puede ver
    // esta clase de fallo: verifica que las claves QUE EXISTEN estén en los
    // dos idiomas, no puede ver un texto que nunca pasó por i18n. Así se
    // publicó `SupervisorProjects` — una pantalla entera en inglés, sin una
    // sola llamada a `t()`, visible todos los días para cada supervisor.
    //
    // La regla mira SOLO texto escrito directamente en JSX, que es donde el
    // falso positivo es raro: una cadena que se pinta y no viene de `t()`
    // casi siempre es un descuido. No mira atributos ni objetos, para no
    // pelearse con `className`, rutas de API y claves de test.
    files: ['src/**/*.tsx'],
    ignores: [
      '**/*.test.tsx',
      // Consola interna de plataforma: un solo idioma a propósito.
      'src/platform/**',
      // Legales y soporte: bilingües EN LA MISMA PÁGINA, a propósito —
      // dicen «Soporte · Support» y traen las dos versiones del texto.
      'src/app/pages/PrivacyPolicy.tsx',
      'src/app/pages/TermsOfService.tsx',
      'src/app/pages/Support.tsx',
      // Páginas de desarrollo, no se sirven al cliente.
      'src/app/components/DesignSystem.tsx',
      'src/app/components/ImplementationNotes.tsx',
    ],
    plugins: { i18next },
    rules: {
      // 146 al adoptarla, sobre 70 archivos. Warning por el backlog, igual
      // que las de React Compiler de arriba: visible en el editor y en CI,
      // sin romper la construcción. Los peores al medir: SupervisorProjects
      // (20), HoursReport (16), AccessDenied (13). El PR #158 baja el conteo.
      // Excluye las cadenas sin letras (símbolos, guiones, separadores).
      'i18next/no-literal-string': ['warn', {
        mode: 'jsx-text-only',
        words: { exclude: ['^[^A-Za-zÀ-ÿ]+$'] },
      }],
    },
  },
  {
    // Tests and e2e run in Node/Vitest contexts — looser by nature.
    files: ['**/*.test.{ts,tsx}', 'e2e/**', 'vitest.setup.ts', 'tools/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'i18next/no-literal-string': 'off',
    },
  },
);
