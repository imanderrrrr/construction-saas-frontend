/**
 * Maximum lengths for user-supplied text, by semantic type.
 *
 * Mirrors `FieldLimits.kt` in the backend one-for-one. The backend is the
 * barrier that actually protects storage; this file is what stops the user
 * reaching it — a limit enforced only on the server means someone types 300
 * characters and only finds out when the save fails. Both files must be
 * edited together, and the numbers must match.
 *
 * Shared by `src/app` (the tenant-facing product, es/en via i18next) and
 * `src/platform` (the staff console, English-only).
 *
 * Two rules carried over from the backend, worth knowing before changing a
 * number here:
 *
 * 1. A limit may never exceed its database column width. Several of these are
 *    column widths, not preferences — `NOTE` is 500 because the columns behind
 *    it are `VARCHAR(500)`.
 * 2. Creation may be stricter than lookup. `WORKSPACE_SLUG` is 20 for creating
 *    a workspace but `LEGACY_WORKSPACE_SLUG` (60) on the login and
 *    forgot-password forms, because workspaces created before this change have
 *    slugs longer than 20 and must still be able to sign in.
 */
export const FIELD_LIMITS = {
  // ── Identity: workspace and login ─────────────────────────────
  /** Workspace slug, on the create-a-workspace path. */
  WORKSPACE_SLUG: 20,
  /** Login username, on the create-a-user path. */
  USERNAME: 30,
  /** Company / tenant display name. */
  COMPANY_NAME: 60,
  /** A human being's full name. */
  PERSON_NAME: 80,
  /** A person's name on paths that already accepted 150 and can be re-saved. */
  LEGACY_PERSON_NAME: 150,
  /**
   * A customer's email address. RFC 5321 allows 254, but `users.email` is
   * `VARCHAR(150)` — a limit above its column is the bug this file prevents.
   */
  EMAIL: 150,
  /** A platform staff email. `platform_users.email` is `VARCHAR(255)`. */
  PLATFORM_EMAIL: 254,
  /** A client contact's email. `clients.email` is `VARCHAR(200)`. */
  CLIENT_EMAIL: 200,

  // ── Legacy widths: lookup and authentication forms ONLY ───────
  /** Slug on login / forgot-password, where old workspaces must still match. */
  LEGACY_WORKSPACE_SLUG: 60,
  /** Username on the login form, where old accounts must still match. */
  LEGACY_USERNAME: 50,

  // ── Names, codes and identifiers ──────────────────────────────
  /** The name of a thing: project, client, vendor, tool, consumable. */
  SHORT_NAME: 200,
  /** A task or job title. `kanban_tasks.title` is `VARCHAR(255)`. */
  TITLE: 255,
  /** A short human-assigned code: tool code, consumable code, tax id. */
  CODE: 20,
  /** A document number: bill, invoice, change order, cost code. */
  IDENTIFIER: 50,
  /** A document number on modules that already allowed a wider one. */
  DOCUMENT_NUMBER: 100,
  /** An invoice line-item description. */
  LINE_ITEM: 300,
  /** A payment reference or external system's identifier. */
  REFERENCE: 200,
  /** A phone number, with room for country code and separators. */
  PHONE: 30,
  /** A free-typed category / method / status that is parsed to an enum. */
  ENUM_TOKEN: 40,
  /** A postal address. */
  ADDRESS: 300,

  // ── Free text ─────────────────────────────────────────────────
  /** Free text bounded by a `VARCHAR(500)` column. */
  NOTE: 500,
  /** Free text bounded by a `VARCHAR(1000)` column: payable/receivable notes. */
  EXTENDED_NOTE: 1000,
  /** Free text on a `TEXT` column: descriptions, reasons, comments. */
  LONG_TEXT: 2000,
  /** Genuinely long-form text: the site-log narrative. */
  EXTENDED_TEXT: 5000,
  /** An RFI question, which quotes drawings and specs at length. */
  RFI_QUESTION: 10000,

  // ── Technical ─────────────────────────────────────────────────
  /** A search or filter box. */
  SEARCH: 100,
  /** A 6-digit numeric PIN. */
  PIN: 6,
} as const;

export type FieldLimitKey = keyof typeof FIELD_LIMITS;

/**
 * Deliberately absent: a limit for password inputs.
 *
 * The backend caps passwords at 100 characters, but putting `maxLength` on a
 * password box is actively harmful — a longer password pasted from a manager
 * is silently truncated, the account is created with the truncated value, and
 * the next paste of the real password fails. Password fields validate on
 * submit and show the error instead.
 */
export const NO_MAXLENGTH_ON_PASSWORDS = true;
