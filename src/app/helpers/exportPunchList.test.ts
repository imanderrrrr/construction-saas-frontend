// exportPunchList: the CSV bytes and the rows handed to autoTable must carry
// the filtered list verbatim — number first, close note as resolution, fields
// escaped. jspdf / file-saver are mocked (jsdom has no real downloads).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveAsMock = vi.hoisted(() => vi.fn());
vi.mock('file-saver', () => ({ saveAs: saveAsMock }));

const autoTableMock = vi.hoisted(() => vi.fn());
vi.mock('jspdf-autotable', () => ({ default: autoTableMock }));

const pdfSaveMock = vi.hoisted(() => vi.fn());
vi.mock('jspdf', () => ({
  default: class FakeJsPdf {
    internal = { pageSize: { getWidth: () => 297, getHeight: () => 210 } };
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    rect() {}
    line() {}
    text() {}
    setPage() {}
    getNumberOfPages() { return 1; }
    save = pdfSaveMock;
  },
}));

import { exportPunchListCsv, exportPunchListPdf, type PunchListExportLabels } from './exportPunchList';
import type { PunchItem } from '../services/punchItems';

// dateTime.getBusinessTz() reads localStorage, which jsdom does not back here.
// Stub it so fmtDate/fmtDateTime/todayStamp fall through to the default TZ.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
});

const LABELS: PunchListExportLabels = {
  docTitle: 'Punch list',
  filterLine: 'Casa Roble · Todos · 2 ítems',
  columns: {
    number: 'N.º', title: 'Título', status: 'Estado', origin: 'Origen',
    assignee: 'Asignado', location: 'Ubicación', createdAt: 'Creado',
    readyAt: 'Listo', closedAt: 'Cerrado', resolution: 'Nota de resolución',
  },
  status: {
    OPEN: 'Reportado', IN_PROGRESS: 'En curso', READY_FOR_REVIEW: 'Listo para revisar',
    REOPENED: 'Rebotado', CLOSED: 'Cerrado',
  },
  origin: { CLIENT: 'Del cliente', INTERNAL: 'Interno' },
};

function item(overrides: Partial<PunchItem> = {}): PunchItem {
  return {
    id: 1,
    itemNumber: 1,
    displayNumber: '#001',
    origin: 'CLIENT',
    title: 'Fuga en el lavamanos',
    description: null,
    location: 'Baño principal',
    status: 'OPEN',
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    createdByName: null,
    createdByClient: true,
    readyAt: null,
    readyNote: null,
    closedAt: null,
    closedByName: null,
    closedByClient: false,
    closeNote: null,
    reopenCount: 0,
    closableInternally: false,
    photos: [],
    events: [],
    comments: [],
    commentCount: 0,
    createdAt: '2026-07-08T12:00:00Z',
    updatedAt: '2026-07-08T12:00:00Z',
    ...overrides,
  };
}

async function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe('exportPunchListCsv', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes header + one row per item, number first, resolution last', async () => {
    exportPunchListCsv({
      items: [
        item(),
        item({
          id: 2, itemNumber: 2, displayNumber: '#002', origin: 'INTERNAL',
          title: 'Resane, con coma', status: 'CLOSED', assigneeName: 'Obrero Uno',
          closedAt: '2026-07-10T12:00:00Z', closeNote: 'Nota "citada"',
        }),
      ],
      projectName: 'Casa Roble',
      labels: LABELS,
    });

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [blob, filename] = saveAsMock.mock.calls[0] as [Blob, string];
    expect(filename).toMatch(/^Punch_List_Casa_Roble_\d{4}-\d{2}-\d{2}\.csv$/);

    const text = await blobText(blob);
    const lines = text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toBe('N.º,Título,Estado,Origen,Asignado,Ubicación,Creado,Listo,Cerrado,Nota de resolución');
    expect(lines[1].startsWith('#001,Fuga en el lavamanos,Reportado,Del cliente,—,Baño principal,')).toBe(true);
    // Commas and quotes survive escaped.
    expect(lines[2]).toContain('"Resane, con coma"');
    expect(lines[2]).toContain('"Nota ""citada"""');
    expect(lines[2]).toContain('Obrero Uno');
    expect(lines[2].startsWith('#002,')).toBe(true);
  });
});

describe('exportPunchListPdf', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hands autoTable the same rows and saves the file', () => {
    exportPunchListPdf({
      items: [item({ itemNumber: 3, displayNumber: '#003', closeNote: 'Quedó resuelto' })],
      projectName: 'Casa Roble',
      labels: LABELS,
    });

    expect(autoTableMock).toHaveBeenCalledTimes(1);
    const options = autoTableMock.mock.calls[0][1] as { head: string[][]; body: string[][] };
    expect(options.head[0][0]).toBe('N.º');
    expect(options.body[0][0]).toBe('#003');
    expect(options.body[0][9]).toBe('Quedó resuelto');
    expect(pdfSaveMock).toHaveBeenCalledWith(expect.stringMatching(/^Punch_List_Casa_Roble_.*\.pdf$/));
  });
});
