import { describe, expect, it } from 'vitest';

import {
  buildLeadPayload,
  CONSENT_VERSION,
  splitContact,
  validateLead,
  type LeadFormValues,
} from './leadForm';

const valid: LeadFormValues = {
  name: 'Ana Prueba',
  company: 'Constructora Ejemplo',
  contact: 'ana@ejemplo.test',
  interest: 'DEMO',
  consent: true,
};

describe('splitContact', () => {
  it.each([
    ['+502 5555-5555', { phone: '+50255555555' }],
    ['(502) 5555 5555', { phone: '50255555555' }],
    ['ANA+obra@Ejemplo.COM ', { email: 'ana+obra@ejemplo.com' }],
    ['  5555-5555  ', { phone: '55555555' }],
  ])('%j → %j', (contact, expected) => {
    expect(splitContact(contact)).toEqual(expected);
  });
});

describe('validateLead', () => {
  it('accepts a complete form', () => {
    expect(validateLead(valid)).toEqual({});
  });

  it.each([
    '+502 5555-5555',
    '(502) 5555 5555',
    'ANA+obra@Ejemplo.COM ',
  ])('accepts the contact %j', (contact) => {
    expect(validateLead({ ...valid, contact })).toEqual({});
  });

  it('trims the name before checking it', () => {
    expect(validateLead({ ...valid, name: ' Ana ' })).toEqual({});
  });

  it.each([
    ['a one-letter name', { name: 'A' }, { name: 'name' }],
    ['a blank name', { name: '   ' }, { name: 'name' }],
    ['an 81-character name', { name: 'a'.repeat(81) }, { name: 'name' }],
    ['an empty company', { company: '' }, { company: 'company' }],
    ['a 61-character company', { company: 'c'.repeat(61) }, { company: 'company' }],
    ['an empty contact', { contact: '  ' }, { contact: 'contact' }],
    ['ana@', { contact: 'ana@' }, { contact: 'email' }],
    ['ana@x', { contact: 'ana@x' }, { contact: 'email' }],
    ['a b@c.com', { contact: 'a b@c.com' }, { contact: 'email' }],
    ['a 151-character email', { contact: `${'a'.repeat(138)}@ejemplo.test` }, { contact: 'email' }],
    ['5555', { contact: '5555' }, { contact: 'phone' }],
    ['502-ABCD-5555', { contact: '502-ABCD-5555' }, { contact: 'phone' }],
    ['16 digits', { contact: '1234567890123456' }, { contact: 'phone' }],
  ])('rejects %s', (_label, change, expected) => {
    expect(validateLead({ ...valid, ...change })).toEqual(expected);
  });

  it('reports every invalid field at once', () => {
    expect(validateLead({ ...valid, name: '', company: '', contact: '' })).toEqual({
      name: 'name',
      company: 'company',
      contact: 'contact',
    });
  });

  it('the 151-character email case really is 151 characters', () => {
    expect(`${'a'.repeat(138)}@ejemplo.test`).toHaveLength(151);
  });
});

describe('buildLeadPayload', () => {
  it('builds the request with consent, the consent version, locale, source and token, and an email', () => {
    const payload = buildLeadPayload(
      { ...valid, name: ' Ana Prueba ', company: ' Constructora Ejemplo ' },
      { language: 'en-US', source: 'CHAT', turnstileToken: 't-1' },
    );

    expect(payload).toEqual({
      name: 'Ana Prueba',
      company: 'Constructora Ejemplo',
      email: 'ana@ejemplo.test',
      interest: 'DEMO',
      locale: 'en',
      source: 'CHAT',
      consent: true,
      consentVersion: 'landing-lead-v1',
      turnstileToken: 't-1',
    });
    expect(CONSENT_VERSION).toBe('landing-lead-v1');
  });

  it('sends exactly one of email or phone', () => {
    const payload = buildLeadPayload(
      { ...valid, contact: '+502 5555-5555', interest: 'BETA' },
      { language: 'es', source: 'FORM', turnstileToken: 't-2' },
    );

    expect(payload.phone).toBe('+50255555555');
    expect('email' in payload).toBe(false);
    expect(payload).toMatchObject({ interest: 'BETA', locale: 'es', source: 'FORM' });
  });
});
