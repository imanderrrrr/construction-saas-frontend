// The hand-off between sections is one slot per section, read at the target's
// first render and cleared once it is mounted — never re-applied on a later
// visit by hand.

import { beforeEach, describe, expect, it } from 'vitest';
import { clearSectionIntent, consumeSectionIntent, peekSectionIntent, resetSectionIntents, setSectionIntent } from './sectionIntent';

describe('sectionIntent', () => {
  beforeEach(() => resetSectionIntents());

  it('is empty until somebody asks for something', () => {
    expect(peekSectionIntent('projects')).toBeNull();
    expect(consumeSectionIntent('projects')).toBeNull();
  });

  it('peek reads without clearing, so a double state initializer sees the same value', () => {
    setSectionIntent('projects', { clientId: 7, clientName: 'Inmobiliaria Andes' });
    expect(peekSectionIntent('projects')).toEqual({ clientId: 7, clientName: 'Inmobiliaria Andes' });
    expect(peekSectionIntent('projects')).toEqual({ clientId: 7, clientName: 'Inmobiliaria Andes' });
    clearSectionIntent('projects');
    expect(peekSectionIntent('projects')).toBeNull();
  });

  it('consume is one-shot', () => {
    setSectionIntent('projects', { clientId: 7, clientName: 'Inmobiliaria Andes', openProjectId: 12 });
    expect(consumeSectionIntent('projects')).toEqual({ clientId: 7, clientName: 'Inmobiliaria Andes', openProjectId: 12 });
    expect(consumeSectionIntent('projects')).toBeNull();
  });

  it('each section keeps its own slot — the document Cobrar opens does not touch the client Proyectos narrows to', () => {
    setSectionIntent('projects', { clientId: 7, clientName: 'Inmobiliaria Andes' });
    setSectionIntent('accounts-receivable', { openReceivableId: 42 });
    expect(peekSectionIntent('accounts-receivable')).toEqual({ openReceivableId: 42 });
    expect(peekSectionIntent('projects')?.clientId).toBe(7);
    clearSectionIntent('accounts-receivable');
    expect(peekSectionIntent('accounts-receivable')).toBeNull();
    expect(peekSectionIntent('projects')?.clientId).toBe(7);
  });

  it('a later intent replaces the earlier one', () => {
    setSectionIntent('projects', { clientId: 7, clientName: 'Inmobiliaria Andes' });
    setSectionIntent('projects', { clientId: 9, clientName: 'Grupo Eucalipto' });
    expect(peekSectionIntent('projects')?.clientId).toBe(9);
  });
});
