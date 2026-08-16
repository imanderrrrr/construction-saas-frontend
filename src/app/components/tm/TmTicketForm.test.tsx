// BuildTrack — capturing a T&M on site.
//
// The running total is the point of these tests. It is what the encargado reads
// out loud before the client's superintendent signs, so it has to equal what
// the server will store — not "about that", exactly that.

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const svc = vi.hoisted(() => ({
  createTmTicket: vi.fn(),
  updateTmTicket: vi.fn(),
}));

vi.mock('../../services/tm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/tm')>();
  return { ...actual, createTmTicket: svc.createTmTicket, updateTmTicket: svc.updateTmTicket };
});

import { TmTicketForm } from './TmTicketForm';
import i18n from '../../../i18n';
import type { TmTicket } from '../../services/tm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROJECTS = [{ id: 7, name: 'Torre Norte' }, { id: 8, name: 'Casa Sur' }];

let container: HTMLDivElement;
let root: Root;
let onSaved: Mock<(ticket: TmTicket) => void>;
let onCancel: Mock<() => void>;

async function render() {
  onSaved = vi.fn<(ticket: TmTicket) => void>();
  onCancel = vi.fn<() => void>();
  await act(async () => {
    root.render(
      <TmTicketForm projects={PROJECTS} onSaved={onSaved} onCancel={onCancel} />,
    );
  });
}

function totalText(): string {
  return container.querySelector('[data-testid="tm-total-value"]')?.textContent?.trim() ?? '';
}

function inputFor(labelKey: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label'))
    .find(l => l.textContent?.includes(i18n.t(labelKey)));
  if (!label) throw new Error(`no label for ${labelKey}`);
  const el = label.querySelector('input, select, textarea');
  if (!el) throw new Error(`no field under ${labelKey}`);
  return el as HTMLInputElement;
}

function setValue(el: HTMLElement, value: string) {
  const proto = el instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

async function fill(fields: Record<string, string>) {
  for (const [key, value] of Object.entries(fields)) {
    await act(async () => { setValue(inputFor(key), value); });
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
  svc.createTmTicket.mockReset().mockResolvedValue({ id: 1 });
  svc.updateTmTicket.mockReset().mockResolvedValue({ id: 1 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
});

describe('the running total', () => {
  it('is people × hours × rate, plus material', async () => {
    await render();
    await fill({
      'tm:form.workerCount': '3',
      'tm:form.hours': '7.5',
      'tm:form.hourlyRate': '20.00',
      'tm:form.material': '125.50',
    });

    // 3 × 7.5 × 20.00 = 450.00 labour, + 125.50 material = 575.50
    expect(totalText()).toBe('$575.50');
  });

  it('keeps the cent that a float round-trip loses', async () => {
    await render();
    await fill({
      'tm:form.workerCount': '1',
      'tm:form.hours': '1',
      'tm:form.hourlyRate': '0.29',
      'tm:form.material': '0',
    });

    // parseFloat('0.29') * 100 truncates to 28 — the total must still be 0.29.
    expect(totalText()).toBe('$0.29');
  });

  it('rounds the whole product once, the way the server does', async () => {
    await render();
    await fill({
      'tm:form.workerCount': '7',
      'tm:form.hours': '0.33',
      'tm:form.hourlyRate': '10.01',
      'tm:form.material': '0',
    });

    // 7 × 0.33 × 10.01 = 23.1231 → $23.12. Rounding per person gives $23.10.
    expect(totalText()).toBe('$23.12');
  });

  it('shows a dash rather than a total the server would reject', async () => {
    await render();
    await fill({
      'tm:form.workerCount': '3',
      'tm:form.hours': '7.5',
      'tm:form.hourlyRate': '20.001',
    });

    expect(totalText()).toBe('—');
  });

  it('treats an empty material box as zero, not as invalid', async () => {
    await render();
    await fill({
      'tm:form.workerCount': '2',
      'tm:form.hours': '4',
      'tm:form.hourlyRate': '15.00',
    });

    expect(totalText()).toBe('$120.00');
  });
});

describe('saving', () => {
  it('stays disabled until the ticket is complete', async () => {
    await render();
    const save = () => Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === i18n.t('tm:form.save')) as HTMLButtonElement;

    expect(save().disabled).toBe(true);

    await fill({
      'tm:form.workerCount': '3',
      'tm:form.hours': '7.5',
      'tm:form.hourlyRate': '20.00',
    });
    // Still missing the project and the description.
    expect(save().disabled).toBe(true);

    await fill({ 'tm:form.project': '7', 'tm:form.description': 'Madera podrida' });
    expect(save().disabled).toBe(false);
  });

  it('sends money as decimal strings and the work date as given', async () => {
    await render();
    await fill({
      'tm:form.project': '7',
      'tm:form.description': 'Madera podrida',
      'tm:form.workDate': '2026-08-10',
      'tm:form.workerCount': '3',
      'tm:form.hours': '7.5',
      'tm:form.hourlyRate': '20.00',
      'tm:form.material': '125.50',
    });

    const save = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === i18n.t('tm:form.save'))!;
    await act(async () => { save.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(svc.createTmTicket).toHaveBeenCalledWith({
      projectId: 7,
      description: 'Madera podrida',
      notes: null,
      workDate: '2026-08-10',
      workerCount: 3,
      hours: '7.5',
      hourlyRate: '20.00',
      material: '125.50',
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('normalises a comma typed on a Spanish keyboard', async () => {
    await render();
    await fill({
      'tm:form.project': '7',
      'tm:form.description': 'x',
      'tm:form.workerCount': '1',
      'tm:form.hours': '2',
      'tm:form.hourlyRate': '20,50',
    });

    const save = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === i18n.t('tm:form.save'))!;
    await act(async () => { save.click(); });
    await act(async () => { await Promise.resolve(); });

    expect(svc.createTmTicket).toHaveBeenCalledWith(
      expect.objectContaining({ hourlyRate: '20.50' }),
    );
  });
});

describe('the work date', () => {
  it('says out loud that it is not necessarily today', async () => {
    await render();
    // "El martes se suele cargar lo del lunes" — the single most common data
    // error this module can have is a ticket dated the day it was typed.
    expect(container.textContent).toContain(i18n.t('tm:form.workDateHint'));
  });
});

describe('the budget', () => {
  it('is never consulted, warned about, or used to block a save', async () => {
    await render();
    await fill({
      'tm:form.project': '7',
      'tm:form.description': 'Trabajo caro',
      'tm:form.workerCount': '999',
      'tm:form.hours': '99999.99',
      'tm:form.hourlyRate': '1000000.00',
    });

    // An absurd but arithmetically valid ticket saves without a murmur: the
    // budget is a gauge, not a gate, so nothing here clamps or refuses.
    const save = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === i18n.t('tm:form.save')) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(totalText()).not.toBe('—');
  });
});
