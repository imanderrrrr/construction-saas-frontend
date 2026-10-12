// AUD-055 — the note appears only when a catalog walk stopped at its bound.

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeAll, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { CatalogNote } from './CatalogNote';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CatalogNote', () => {
  beforeAll(async () => { await i18n.changeLanguage('es'); });

  it('says nothing for a complete catalog and the real count for a cut one', () => {
    const el = document.createElement('div');
    const root = createRoot(el);
    act(() => root.render(<CatalogNote shown={230} total={230} truncated={false} />));
    expect(el.textContent).toBe('');
    act(() => root.render(<CatalogNote shown={5000} total={5230} truncated />));
    expect(el.querySelector('[role="status"]')?.textContent).toBe(i18n.t('common:catalog.truncated', { shown: 5000, total: 5230 }));
    expect(el.textContent).toContain('5230');
    act(() => root.unmount());
  });
});
