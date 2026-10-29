// BuildTrack — «Notas del día» admits 200 characters; nothing else moves.
//
// The 25/50 policy caps every free-text box at 50, and the site log's daily
// notes were one of them until Anderson raised that single field to 200 on
// 2026-10-29. The server took it in `FieldLimits.SITE_LOG_NOTES` and the app
// in `TextLimits.siteLogNotes`; the panel has to let the supervisor write as
// much as both accept. The rest of the log keeps its own limits, so these
// tests pin the neighbours too: a widened constant must not drag them along.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
  getSiteLogByDate: vi.fn(),
  getSiteLogSuggestion: vi.fn(),
  getSiteLogHistory: vi.fn(),
  saveSiteLog: vi.fn(),
  uploadSiteLogPhoto: vi.fn(),
  deleteSiteLogPhoto: vi.fn(),
}));

vi.mock('../../services/siteLog', () => svc);
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import i18n from '../../../i18n';
import { SiteLog } from './SiteLog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROJECTS = [{ id: 7, name: 'Casa Roble' }];

const LOG = {
  id: 1,
  projectId: 7,
  projectName: 'Casa Roble',
  partida: null,
  workDate: '2026-10-29',
  authorId: 3,
  authorName: 'Ana Supervisora',
  status: 'DRAFT',
  weather: 'SOLEADO',
  temperatureC: 24,
  notes: null,
  attendance: [],
  tasksDone: [],
  photos: [],
  createdAt: '2026-10-29T12:00:00Z',
  updatedAt: '2026-10-29T12:00:00Z',
};

/** The editable field whose placeholder is `placeholder`. */
function field(container: HTMLElement, placeholder: string): HTMLInputElement | HTMLTextAreaElement {
  const el = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[placeholder="${placeholder}"]`);
  expect(el, `no field with placeholder "${placeholder}"`).toBeTruthy();
  return el!;
}

describe('SiteLog — text limits', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await i18n.changeLanguage('es');
    svc.getSiteLogByDate.mockResolvedValue(LOG);
    svc.getSiteLogSuggestion.mockResolvedValue(null);
    svc.getSiteLogHistory.mockResolvedValue({ content: [], page: 0, size: 30, totalElements: 0, totalPages: 0 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(<SiteLog projects={PROJECTS} canEdit />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('lets the notes of the day take 200 characters and stops at the 201st', () => {
    const notes = field(container, 'Incidentes, entregas, visitas, bloqueos…');

    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.maxLength).toBe(200);
  });

  it('keeps a free task at 50 characters', () => {
    expect(field(container, 'Describe una tarea completada').maxLength).toBe(50);
  });

  it('keeps an attendee name at 25 characters', () => {
    const placeholder = i18n.t('siteLog:attendance.namePlaceholder');

    expect(field(container, placeholder).maxLength).toBe(25);
  });
});
