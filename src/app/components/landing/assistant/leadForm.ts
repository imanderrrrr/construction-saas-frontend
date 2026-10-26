// The landing assistant's contact form, without the screen: what counts as a
// valid contact and how the single "email or phone" field becomes the request.
//
// The rules mirror the backend's `LeadService` (and its `FieldLimits`), so a
// visitor is told what to fix before anything is sent; the server checks again.

import { FIELD_LIMITS } from '../../../../shared/fieldLimits';
import {
  assistantLocale,
  type LeadInterest,
  type LeadPayload,
  type LeadSource,
} from '../../../services/landingAssistant';

/** The consent text version the form shows; the server refuses any other. */
export const CONSENT_VERSION = 'landing-lead-v1';

export type LeadFormValues = {
  name: string;
  company: string;
  /** One field for both: an email when it contains "@", a phone otherwise. */
  contact: string;
  interest: LeadInterest;
  consent: boolean;
};

/** Each value is the suffix of its message key, `assistant.form.error.<suffix>`. */
export type LeadFieldErrors = {
  name?: 'name';
  company?: 'company';
  contact?: 'contact' | 'email' | 'phone';
};

const MIN_TEXT = 2;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS = /^\+?\d{7,15}$/;

function normalizedEmail(contact: string): string {
  return contact.trim().toLowerCase();
}

/** Spaces, hyphens and parentheses go; a leading "+" stays. */
function normalizedPhone(contact: string): string {
  return contact.trim().replace(/[\s\-()]/g, '');
}

/** The contact as the request carries it: exactly one of `email` or `phone`. */
export function splitContact(contact: string): { email?: string; phone?: string } {
  return contact.includes('@')
    ? { email: normalizedEmail(contact) }
    : { phone: normalizedPhone(contact) };
}

export function validateLead(values: LeadFormValues): LeadFieldErrors {
  const errors: LeadFieldErrors = {};

  const name = values.name.trim();
  if (name.length < MIN_TEXT || name.length > FIELD_LIMITS.PERSON_NAME) errors.name = 'name';

  const company = values.company.trim();
  if (company.length < MIN_TEXT || company.length > FIELD_LIMITS.COMPANY_NAME) errors.company = 'company';

  const contact = values.contact.trim();
  if (!contact) {
    errors.contact = 'contact';
  } else {
    const { email, phone } = splitContact(contact);
    if (email !== undefined) {
      if (!EMAIL_PATTERN.test(email) || email.length > FIELD_LIMITS.EMAIL) errors.contact = 'email';
    } else if (!PHONE_DIGITS.test(phone ?? '')) {
      errors.contact = 'phone';
    }
  }

  return errors;
}

/** The request for a form that passed [validateLead]. */
export function buildLeadPayload(
  values: LeadFormValues,
  ctx: { language: string; source: LeadSource; turnstileToken: string },
): LeadPayload {
  return {
    name: values.name.trim(),
    company: values.company.trim(),
    ...splitContact(values.contact),
    interest: values.interest,
    locale: assistantLocale(ctx.language),
    source: ctx.source,
    consent: true,
    consentVersion: CONSENT_VERSION,
    turnstileToken: ctx.turnstileToken,
  };
}
