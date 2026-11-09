/** Admission limits: names/titles 25, descriptions/notes/reasons 50
 * (the site log's daily notes: 200, SITE_LOG_NOTES).
 * Mirrors backend FieldLimits. Historical storage and auth/lookup stay wider.
 * Contact formats, references and technical tokens retain their own bounds.
 */
export const FIELD_LIMITS = {
  // ── Identity: workspace and login ─────────────────────────────
  WORKSPACE_SLUG: 20,
  USERNAME: 30,
  COMPANY_NAME: 25,
  PERSON_NAME: 25,
  LEGACY_PERSON_NAME: 25,
  EMAIL: 150,
  PLATFORM_EMAIL: 254,
  CLIENT_EMAIL: 200,

  // ── Legacy widths: lookup and authentication forms ONLY ───────
  LEGACY_WORKSPACE_SLUG: 60,
  LEGACY_USERNAME: 30,

  // ── Names, codes and identifiers ──────────────────────────────
  SHORT_NAME: 25,
  WAREHOUSE_NAME: 25,
  TITLE: 25,
  CODE: 20,
  IDENTIFIER: 50,
  DOCUMENT_NUMBER: 100,
  LINE_ITEM: 50,
  REFERENCE: 200,
  PHONE: 30,
  ENUM_TOKEN: 40,
  ADDRESS: 300,

  // ── Free text ─────────────────────────────────────────────────
  NOTE: 50,
  EXTENDED_NOTE: 50,
  LONG_TEXT: 50,
  /** «Notas del día» of the site log: the one note the 25/50 policy leaves at 200. */
  SITE_LOG_NOTES: 200,
  RFI_QUESTION: 50,

  // ── Technical ─────────────────────────────────────────────────
  SEARCH: 100,
  PIN: 6,

  // ── Value bounds (not lengths) ────────────────────────────────
  MONEY_AMOUNT: '1000000.00',
  MONEY_INTEGER_DIGITS: 7,
} as const;

export type FieldLimitKey = keyof typeof FIELD_LIMITS;

export const NO_MAXLENGTH_ON_PASSWORDS = true;
