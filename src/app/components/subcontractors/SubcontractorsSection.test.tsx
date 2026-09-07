// The section: three tabs where there were two, figures that come from the
// server or say nothing, and the hand-off from a person to their jobs.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getSubcontractorsSummary: vi.fn(),
  listDirectory: vi.fn(),
  listJobs: vi.fn(),
  listInvoices: vi.fn(),
}));
vi.mock('../../services/subcontractors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/subcontractors')>()),
  getSubcontractorsSummary: svc.getSubcontractorsSummary,
  listDirectory: svc.listDirectory,
  listJobs: svc.listJobs,
  listInvoices: svc.listInvoices,
}));
vi.mock('../../services/users', () => ({ listUsers: vi.fn().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }) }));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  api: vi.fn().mockResolvedValue({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }),
}));
// The ficha has its own screens; here it is a landmark that talks back.
vi.mock('./JobFicha', () => ({
  JobFicha: (p: { job: { title: string }; onBack: () => void }) => (
    <div data-testid="job-ficha">{p.job.title}<button onClick={p.onBack}>stub-back</button></div>
  ),
}));

import i18n from '../../../i18n';
import { SubcontractorsSection } from './SubcontractorsSection';
import { buttonByText, click, flush, job, page, RUANO, SUMMARY, XELAJU } from './testing';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubcontractorsSection', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onNavigate = vi.fn();

  beforeAll(() => i18n.changeLanguage('es'));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onNavigate.mockReset();
    svc.getSubcontractorsSummary.mockReset().mockResolvedValue(SUMMARY);
    svc.listDirectory.mockReset().mockResolvedValue(page([XELAJU, RUANO]));
    svc.listJobs.mockReset().mockResolvedValue(page([job({ id: 418, title: 'Herrería de balcones' })], 143));
    svc.listInvoices.mockReset().mockResolvedValue(page([]));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = async () => {
    await act(async () => root.render(<SubcontractorsSection onNavigate={onNavigate} />));
    await flush();
  };

  it('opens on the directory — the tab the section was named after and never had', async () => {
    await render();
    const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map(el => el.textContent?.trim());
    expect(tabs).toHaveLength(3);
    expect(container.querySelector('[data-testid="directory-list"]')).toBeTruthy();
    expect(container.textContent).toContain('Herrería y Estructuras Xelajú');
  });

  it('shows the figures over the whole tenant, not the two rows on screen', async () => {
    await render();
    const strip = container.querySelector('[data-testid="directory-figures"]')!;
    expect(strip.textContent).toContain('12');
    expect(strip.textContent).toContain('14');
    expect(strip.textContent).toContain('$28,550');
  });

  it('writes an em dash and stops offering the filter when the summary fails', async () => {
    svc.getSubcontractorsSummary.mockRejectedValue(new Error('boom'));
    await render();
    const strip = container.querySelector('[data-testid="directory-figures"]')!;
    expect(strip.textContent).toContain('—');
    expect(strip.querySelectorAll('button:not([disabled])')).toHaveLength(0);
    // The list still loads: the figures failing is not the list failing.
    expect(container.textContent).toContain('Herrería y Estructuras Xelajú');
  });

  it('a directory row lands on Trabajos already filtered by that person', async () => {
    await render();
    click(container.querySelector(`[data-testid="directory-row-${XELAJU.subcontractorId}"]`));
    await flush();
    expect(container.querySelector('[data-testid="jobs-list"]')).toBeTruthy();
    expect(svc.listJobs).toHaveBeenLastCalledWith(expect.objectContaining({ subcontractorId: XELAJU.subcontractorId }));
  });

  it('keeps a deactivated subcontractor listed — their open work does not leave with the account', async () => {
    await render();
    const row = container.querySelector(`[data-testid="directory-row-${RUANO.subcontractorId}"]`)!;
    expect(row.textContent).toContain('Usuario desactivado');
    expect(row.className).toContain('opacity-[0.72]');
  });

  it('sends you to Usuarios, because nobody is created here', async () => {
    await render();
    click(buttonByText(container, /Ir a Usuarios/));
    expect(onNavigate).toHaveBeenCalledWith('users');
  });

  it('opens a job as its own page', async () => {
    await render();
    click(Array.from(container.querySelectorAll('[role="tab"]')).find(el => el.textContent?.includes('Trabajos')));
    await flush();
    click(container.querySelector('[data-testid="job-row-418"]'));
    await flush();
    expect(container.querySelector('[data-testid="job-ficha"]')).toBeTruthy();
  });

  it('offers no way to delete a job or an invoice', async () => {
    await render();
    for (const tab of ['Trabajos', 'Facturas']) {
      click(Array.from(container.querySelectorAll('[role="tab"]')).find(el => el.textContent?.includes(tab)));
      await flush();
      expect(container.textContent).not.toMatch(/eliminar|borrar/i);
    }
  });
});
