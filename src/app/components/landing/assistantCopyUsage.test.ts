// Guard: every `t('assistant.…')` the landing assistant calls exists in both
// landing.json files. With `t` mocked to echo the key, the component tests
// would pass with a typo, and i18next would show the raw key to a visitor.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import en from '../../../i18n/locales/en/landing.json';
import es from '../../../i18n/locales/es/landing.json';

const here = dirname(fileURLToPath(import.meta.url));
const assistantDir = join(here, 'assistant');

const files = [
  join(here, 'AssistantLauncher.tsx'),
  join(here, 'AssistantPanel.tsx'),
  ...readdirSync(assistantDir)
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(assistantDir, f)),
];

/** Every key named as a literal: `t('assistant.x')` calls and the `'assistant.x'` strings of copy tables. */
const keys = [
  ...new Set(files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/['"`](assistant\.[\w.]+)['"`]/g)].map((m) => m[1]))),
];

describe('landing assistant copy', () => {
  it('finds the keys the assistant uses (scan still matches)', () => {
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  it.each(keys.map((key) => [key]))('%s exists in the English and Spanish landing.json', (key) => {
    expect(en).toHaveProperty([key]);
    expect(es).toHaveProperty([key]);
  });
});
