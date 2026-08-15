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
 * The largest money amount, in units, that a request may carry on a field that
 * is **multiplied** before it is stored.
 *
 * Kept outside `FIELD_LIMITS` on purpose: everything in there is a string
 * length destined for a `maxLength` attribute, and this is a *value* bound.
 * Mixing it in would let it reach a `maxLength={...}` by autocomplete and cap
 * an input at a million characters.
 *
 * Mirrors `FieldLimits.MONEY_AMOUNT` / `MONEY_INTEGER_DIGITS` in the backend —
 * the two files must be edited together. Nothing consumes this yet: the T&M
 * screens do not exist. It is here so the mirror stays whole, and so the number
 * is already in place when the form that needs it is written.
 *
 * ### Where the number comes from
 *
 * A T&M ticket's labour is `workerCount × hours × hourlyRate`, capped at 999
 * workers and 99999.99 hours — a multiplier of up to ~1e8 before the result
 * lands in a 64-bit integer of cents. The hard arithmetic ceiling is therefore
 * `Long.MAX_VALUE / 1e8 ≈ 9.2e10` cents, about $923,000,000 per hour;
 * 1,000,000 sits ~920× under it and far past any real value.
 *
 * It is a sanity bound, **not** a budget guard: it does not look at what a
 * project can afford, it does not warn, and it does not clamp. The budget is a
 * gauge, not a gate.
 */
export const MONEY_AMOUNT = 1_000_000;

/** Integer digits implied by {@link MONEY_AMOUNT} — `1000000.00` has 7. */
export const MONEY_INTEGER_DIGITS = 7;

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
