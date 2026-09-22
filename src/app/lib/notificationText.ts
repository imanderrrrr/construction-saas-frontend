// OFJR Construction — Notification text resolver
import type { NotificationResponse } from '../services/notifications';
import { fmtDate } from '../helpers/dateTime';
import { formatCents } from '../helpers/tmMoney';

/**
 * A notification's text, composed in the language the panel is in right now.
 *
 * Mirror of the mobile app's resolver (mobile-buildtrack,
 * lib/features/notifications/presentation/notification_text.dart): same
 * rules, same catalogue keys, same param names. The server cannot localize
 * this content — notifications are written asynchronously (a scheduler at
 * midnight, an approval on someone else's screen), so there is no request
 * language at write time, and its `title`/`message` are English. Each row
 * carries a stable key pair plus RAW params instead (backend V95: ISO dates,
 * enum names, integer minutes, integer cents) and the sentence is composed
 * here, so it follows the language toggle like everything else on screen.
 *
 * Three rules, in this order, kept identical to Dart:
 *   1. `type` wins over the key pair (today only PASSWORD_SETUP_SUGGESTED).
 *   2. Otherwise `titleKey` / `bodyKey` are resolved against the catalogue.
 *   3. If EITHER is missing or unrecognised, BOTH fall back to the server's
 *      `title`/`message`. All or nothing: a Spanish title over an English
 *      body reads worse than either language on its own.
 */

/** Any i18next `t` will do — every key is fully qualified in here. */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface NotificationText {
  title: string;
  body: string;
}

/** What the resolver reads off a notification row. */
export type NotificationLike = Pick<NotificationResponse, 'type' | 'title' | 'message' | 'i18n'>;

type Params = Record<string, unknown>;

const NS = 'notifications:';

export function notificationText(n: NotificationLike, t: Translate, lang: string): NotificationText {
  const byType = resolveByType(n.type, t);
  if (byType) return byType;

  const titleKey = n.i18n?.titleKey;
  const bodyKey = n.i18n?.bodyKey;
  if (!titleKey || !bodyKey) return { title: n.title, body: n.message };

  const title = resolveTitle(titleKey, t);
  const body = resolveBody(bodyKey, asParams(n.i18n?.params), t, lang);
  if (title === null || body === null) return { title: n.title, body: n.message };
  return { title, body };
}

/**
 * Notifications localized from their `type` alone — no params to interpolate,
 * so the type is enough to compose the sentence. Kept ahead of the key lookup
 * (as on mobile) so it still wins if the backend later grows a key pair for
 * the same notification.
 */
function resolveByType(type: string, t: Translate): NotificationText | null {
  switch (type) {
    case 'PASSWORD_SETUP_SUGGESTED':
      return { title: t(`${NS}notifPwSetupTitle`), body: t(`${NS}notifPwSetupBody`) };
    default:
      return null;
  }
}

// ── Titles ──────────────────────────────────────────────────────────────────

/**
 * Every title key the catalogue knows — the same list as the Dart `_title`
 * switch. An explicit allowlist rather than `i18n.exists`: "recognised" has
 * to mean "a title", not "any string that happens to be in the namespace".
 */
export const TITLE_KEYS: readonly string[] = [
  'notifEventApprovedTitle',
  'notifEventCorrectedTitle',
  'notifEventRejectedTitle',
  'notifEventReviewedTitle',
  'notifHoursApprovedTitle',
  'notifHoursCorrectedTitle',
  'notifHoursRejectedTitle',
  'notifHoursReviewedTitle',
  'notifRecordNeedsReviewTitle',
  'notifAutoRejectedTitle',
  'notifIncompleteTimeTitle',
  'notifManualMarksTitle',
  'notifTransitCancelledTitle',
  'notifTransitDisputedTitle',
  'notifTransitDisputeResolvedTitle',
  'notifClockChangeTitle',
  'notifAccountDeletionTitle',
  'notifPunchCreatedTitle',
  'notifPunchRejectedTitle',
  'notifPunchCommentedTitle',
  'notifPunchAssignedTitle',
  'notifJobAssignedTitle',
  'notifJobStatusUpdatedTitle',
  'notifJobObservationTitle',
  'notifJobSubmittedTitle',
  'notifJobWithdrawnTitle',
  'notifInvoiceSubmittedTitle',
  'notifInvoiceApprovedTitle',
  'notifInvoiceObservedTitle',
  'notifInvoiceResubmittedTitle',
  'notifPaymentRegisteredTitle',
  'notifToolAssignedTitle',
  'notifToolAcceptedTitle',
  'notifToolRejectedTitle',
  'notifRfiSubmittedTitle',
  'notifRfiRespondedTitle',
  'notifExpenseSubmittedTitle',
  'notifExpenseResubmittedTitle',
  'notifExpenseApprovedTitle',
  'notifExpenseObservedTitle',
  'notifExpenseRejectedTitle',
  // Normally intercepted by resolveByType (the type is what both backends
  // share); resolved here too so the key alone is enough.
  'notifPwSetupTitle',
];

const TITLE_SET = new Set(TITLE_KEYS);

function resolveTitle(key: string, t: Translate): string | null {
  return TITLE_SET.has(key) ? t(NS + key) : null;
}

// ── Bodies ──────────────────────────────────────────────────────────────────

/** `t` narrowed to the notifications namespace. */
type Tr = (key: string, options?: Record<string, unknown>) => string;

function resolveBody(key: string, p: Params, t: Translate, lang: string): string | null {
  const tr: Tr = (k, o) => t(NS + k, o);
  const date = isoDate(p.date, lang);
  const project = str(p, 'project');
  const reviewer = str(p, 'reviewer');
  const event = eventName(str(p, 'event'), tr);
  const expenseType = expenseTypeName(str(p, 'expenseType'), tr);

  switch (key) {
    case 'notifEventApprovedBody':
      return withComment(tr('notifEventApprovedBody', { reviewer, event, date, project }), p, tr);
    case 'notifEventCorrectedBody':
      return withComment(tr('notifEventCorrectedBody', { reviewer, event, date, project }), p, tr);
    case 'notifEventRejectedBody':
      return withComment(tr('notifEventRejectedBody', { reviewer, event, date, project }), p, tr);
    case 'notifEventReviewedBody':
      return withComment(tr('notifEventReviewedBody', { reviewer, event, date, project }), p, tr);

    case 'notifHoursApprovedBody':
      return withComment(tr('notifHoursApprovedBody', { reviewer, date, project }), p, tr);
    case 'notifHoursCorrectedBody':
      return withComment(tr('notifHoursCorrectedBody', { reviewer, date, project }), p, tr);
    case 'notifHoursRejectedBody':
      return withComment(tr('notifHoursRejectedBody', { reviewer, date, project }), p, tr);
    case 'notifHoursReviewedBody':
      return withComment(tr('notifHoursReviewedBody', { reviewer, date, project }), p, tr);

    case 'notifRecordNeedsReviewBody':
      return tr('notifRecordNeedsReviewBody', { date, project });
    case 'notifRecordNeedsReviewNoCheckOutBody':
      return tr('notifRecordNeedsReviewNoCheckOutBody', { date, project });
    case 'notifAutoRejectedTransitOnlyBody':
      return tr('notifAutoRejectedTransitOnlyBody', { date, project });
    case 'notifAutoRejectedOnlyCheckInBody':
      return tr('notifAutoRejectedOnlyCheckInBody', { date, project });

    case 'notifIncompleteTimeBody':
      return tr('notifIncompleteTimeBody');

    case 'notifManualMarksCreatedBody':
      return tr('notifManualMarksCreatedBody', { actor: str(p, 'actor'), date, project, marks: marks(p, tr) });
    case 'notifManualMarksCompletedBody':
      return tr('notifManualMarksCompletedBody', { actor: str(p, 'actor'), date, project, marks: marks(p, tr) });

    case 'notifTransitCancelledBody': {
      const worker = str(p, 'worker');
      const to = str(p, 'to');
      const reason = str(p, 'reason');
      // The origin is optional. A separate sentence rather than the word
      // "unknown" dropped into the middle of a Spanish string.
      return nonEmpty(p.from)
        ? tr('notifTransitCancelledBody', { worker, to, from: p.from, reason })
        : tr('notifTransitCancelledUnknownOriginBody', { worker, to, reason });
    }
    case 'notifTransitDisputedBody':
      return tr('notifTransitDisputedBody', {
        worker: str(p, 'worker'),
        to: str(p, 'to'),
        minutes: int(p, 'minutes'),
        reason: str(p, 'reason'),
      });
    case 'notifTransitDisputeResolvedBody':
      return withComment(
        tr('notifTransitDisputeResolvedBody', { awarded: duration(int(p, 'awardedMinutes'), tr) }),
        p,
        tr,
      );

    case 'notifClockChangeBody':
      return tr('notifClockChangeBody', { worker: str(p, 'worker') });

    case 'notifAccountDeletionBody':
      return tr('notifAccountDeletionBody', { user: str(p, 'user'), role: roleName(str(p, 'role'), tr) });

    case 'notifPunchCreatedBody':
      return tr('notifPunchCreatedBody', { item: punchItem(p, tr, true), project });
    case 'notifPunchRejectedBody':
      return withReason(tr('notifPunchRejectedBody', { item: punchItem(p, tr), project }), p, tr);
    case 'notifPunchCommentedBody':
      return tr('notifPunchCommentedBody', { item: punchItem(p, tr), project, comment: str(p, 'comment') });
    case 'notifPunchAssignedBody':
      return tr('notifPunchAssignedBody', { actor: str(p, 'actor'), item: punchItem(p, tr), project });

    // ── Subcontractor jobs & invoices ─────────────────────────────────────
    case 'notifJobAssignedBody':
      return tr('notifJobAssignedBody', { job: str(p, 'job'), project });
    case 'notifJobStatusUpdatedBody':
      return withComment(
        tr('notifJobStatusUpdatedBody', { job: str(p, 'job'), status: jobStatusName(str(p, 'status'), t) }),
        p,
        tr,
      );
    case 'notifJobObservationBody':
      return tr('notifJobObservationBody', { job: str(p, 'job'), comment: str(p, 'comment') });
    case 'notifJobSubmittedBody':
      return tr('notifJobSubmittedBody', { actor: str(p, 'actor'), job: str(p, 'job') });
    case 'notifJobWithdrawnBody':
      return tr('notifJobWithdrawnBody', { actor: str(p, 'actor'), job: str(p, 'job') });
    case 'notifInvoiceSubmittedBody':
      return tr('notifInvoiceSubmittedBody', { actor: str(p, 'actor'), amount: money(p), job: str(p, 'job') });
    case 'notifInvoiceApprovedBody':
      return withComment(tr('notifInvoiceApprovedBody', { job: str(p, 'job') }), p, tr);
    case 'notifInvoiceObservedBody':
      return withComment(tr('notifInvoiceObservedBody', { job: str(p, 'job') }), p, tr);
    case 'notifInvoiceResubmittedBody':
      return tr('notifInvoiceResubmittedBody', { actor: str(p, 'actor'), amount: money(p), job: str(p, 'job') });
    case 'notifPaymentRegisteredBody': {
      const paid = tr('notifPaymentRegisteredBody', { job: str(p, 'job') });
      return nonEmpty(p.reference) ? tr('notifWithReference', { body: paid, reference: p.reference }) : paid;
    }

    // ── Warehouse tools ───────────────────────────────────────────────────
    case 'notifToolAssignedBody':
      return tr('notifToolAssignedBody', { tool: str(p, 'tool'), code: str(p, 'code'), project });
    case 'notifToolAcceptedBody':
      return tr('notifToolAcceptedBody', {
        actor: str(p, 'actor'),
        tool: str(p, 'tool'),
        code: str(p, 'code'),
        deliveredBy: str(p, 'deliveredBy'),
        receivedBy: str(p, 'receivedBy'),
      });
    case 'notifToolRejectedBody':
      return withReason(
        tr('notifToolRejectedBody', { actor: str(p, 'actor'), tool: str(p, 'tool'), code: str(p, 'code') }),
        p,
        tr,
      );

    // ── RFIs ──────────────────────────────────────────────────────────────
    case 'notifRfiSubmittedBody':
      return tr('notifRfiSubmittedBody', { rfi: rfiItem(p, tr), project });
    case 'notifRfiSubmittedDueBody':
      return tr('notifRfiSubmittedDueBody', { rfi: rfiItem(p, tr), project, date: isoDate(p.dueDate, lang) });
    case 'notifRfiRespondedBody':
      return tr('notifRfiRespondedBody', { rfi: rfiItem(p, tr), project, comment: str(p, 'comment') });

    // ── Expenses ──────────────────────────────────────────────────────────
    // The worker's three outcomes carry an optional comment; the backend
    // requires one to observe or reject and leaves it out on a plain
    // approval, so the clause turns on by presence like everywhere else.
    // The submission notices carry none, so they get no clause even if one
    // rides along — as on mobile.
    case 'notifExpenseSubmittedBody':
      return tr('notifExpenseSubmittedBody', { worker: str(p, 'worker'), type: expenseType, amount: money(p), project });
    case 'notifExpenseResubmittedBody':
      return tr('notifExpenseResubmittedBody', { worker: str(p, 'worker'), type: expenseType, amount: money(p), project });
    case 'notifExpenseApprovedBody':
      return withComment(tr('notifExpenseApprovedBody', { reviewer, type: expenseType, amount: money(p), date, project }), p, tr);
    case 'notifExpenseObservedBody':
      return withComment(tr('notifExpenseObservedBody', { reviewer, type: expenseType, amount: money(p), date, project }), p, tr);
    case 'notifExpenseRejectedBody':
      return withComment(tr('notifExpenseRejectedBody', { reviewer, type: expenseType, amount: money(p), date, project }), p, tr);

    // Normally intercepted by resolveByType; resolved here too so the key
    // alone is enough.
    case 'notifPwSetupBody':
      return tr('notifPwSetupBody');

    default:
      return null;
  }
}

// ── Param rendering ─────────────────────────────────────────────────────────

/** The panel's idiom for Intl locales — day-first in Spanish, month-first in English. */
const intlLocale = (lang: string): string => (lang.startsWith('es') ? 'es-GT' : 'en-US');

/**
 * The server sends an ISO date; the reader gets it in their own convention —
 * day-first in Spanish, month-first in English. An unparsable value is shown
 * raw rather than as "Invalid Date"; a missing one leaves the hole empty, as
 * on mobile.
 *
 * A date-only value (a work date, a due date — a LocalDate on the server) is
 * a calendar day, not an instant: it is parsed at local midnight and formatted
 * in the local zone, the panel's idiom for such dates, so the day never slips
 * to the one before when the browser sits east of the business timezone.
 * A full timestamp goes through fmtDate and the business timezone like every
 * other instant on screen.
 */
function isoDate(raw: unknown, lang: string): string {
  if (typeof raw !== 'string') return '';
  if (raw.includes('T')) {
    return Number.isNaN(new Date(raw).getTime()) ? raw : fmtDate(raw, intlLocale(lang));
  }
  const day = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(day.getTime())) return raw;
  return day.toLocaleDateString(intlLocale(lang), { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Time marks are named for the sentence they sit in, not with the one-word
 * stepper labels: those are UI chrome ("In", "Iniciar") and read as nonsense
 * mid-sentence.
 */
const EVENT_KEYS = new Map<string, string>([
  ['CHECK_IN', 'notifEventCheckIn'],
  ['CHECK_OUT', 'notifEventCheckOut'],
  ['LUNCH_START', 'notifEventLunchStart'],
  ['LUNCH_END', 'notifEventLunchEnd'],
  ['IN_TRANSIT', 'notifEventTransit'],
]);

function eventName(type: string, tr: Tr): string {
  const key = EVENT_KEYS.get(type);
  // An event type this build has not seen: the raw name beats an empty hole.
  return key ? tr(key) : type.toLowerCase().replace(/_/g, ' ');
}

const ROLE_KEYS = new Map<string, string>([
  ['ADMIN', 'notifRoleAdmin'],
  ['SUPERVISOR', 'notifRoleSupervisor'],
  ['WORKER', 'notifRoleWorker'],
  ['FINANCE', 'notifRoleFinance'],
  ['SUBCONTRACTOR', 'notifRoleSubcontractor'],
]);

function roleName(role: string, tr: Tr): string {
  const key = ROLE_KEYS.get(role);
  return key ? tr(key) : role.toLowerCase();
}

/**
 * Expense categories are named with the same words the expense screens use
 * (`admin:expenses.type.*`), for the same reason as `jobStatusName`: the
 * sentence and the screen the reader opens next must call the category one
 * thing. The words live in this namespace rather than being read out of
 * `admin` — the inbox's catalogue is the mobile one, ported whole, and the
 * reader of a notification is not always an admin.
 *
 * A category this build has not seen degrades to its humanised raw name
 * rather than folding into `OTHER`: labelling it "Otro" would be a lie where
 * the raw name is only a gap. Same rule as `eventName`.
 */
const EXPENSE_TYPE_KEYS = new Map<string, string>([
  ['FUEL', 'notifExpenseTypeFuel'],
  ['MATERIALS', 'notifExpenseTypeMaterials'],
  ['TOOLS', 'notifExpenseTypeTools'],
  ['PER_DIEM', 'notifExpenseTypePerDiem'],
  ['MINOR_PURCHASES', 'notifExpenseTypeMinorPurchases'],
  ['TRANSPORTATION', 'notifExpenseTypeTransportation'],
  ['OTHER', 'notifExpenseTypeOther'],
]);

function expenseTypeName(type: string, tr: Tr): string {
  const key = EXPENSE_TYPE_KEYS.get(type);
  return key ? tr(key) : type.toLowerCase().replace(/_/g, ' ');
}

const JOB_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'IN_REVIEW', 'OBSERVED', 'APPROVED', 'CLOSED']);

/**
 * Job statuses are named with the words the subcontractor screens' status
 * chips use, so the sentence and the screen it points at agree.
 */
function jobStatusName(status: string, t: Translate): string {
  if (JOB_STATUSES.has(status)) return t(`subcontractors:status.${status}`);
  // A status this build has not seen: the raw name beats an empty hole.
  return status.toLowerCase().replace(/_/g, ' ');
}

/**
 * `RFI #012 “Detalle de anclaje”` — the way both sides name a consulta. The
 * number arrives raw (and may be absent on a legacy row that never got one);
 * the zero-padding mirrors the server's formatRfiNumber.
 */
function rfiItem(p: Params, tr: Tr): string {
  const subject = str(p, 'subject');
  const number = p.rfiNumber;
  if (typeof number !== 'number' || !Number.isFinite(number)) return tr('notifRfiItemNoNumber', { subject });
  return tr('notifRfiItem', { number: String(Math.trunc(number)).padStart(3, '0'), subject });
}

/**
 * `$1,250.50` from raw cents — the same shape and en-US grouping as every
 * other amount in the panel: the amounts are US dollars, and the number on
 * the card must match the number on the invoice screen and PDF regardless of
 * the UI language.
 */
function money(p: Params): string {
  const cents = p.amountCents;
  return typeof cents === 'number' && Number.isFinite(cents) ? formatCents(cents) : '';
}

function duration(minutes: number, tr: Tr): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? tr('notifDurationHoursMinutes', { hours: h, minutes: m }) : tr('notifDurationMinutes', { minutes: m });
}

/**
 * `#012 "Fuga en el lavamanos"`, optionally with its location — the way both
 * the app and the client portal name an item.
 */
function punchItem(p: Params, tr: Tr, withLocation = false): string {
  const number = String(int(p, 'itemNumber')).padStart(3, '0');
  const item = tr('notifPunchItem', { number, title: str(p, 'itemTitle') });
  if (!withLocation) return item;
  return nonEmpty(p.location) ? tr('notifPunchItemAt', { item, location: p.location }) : item;
}

function marks(p: Params, tr: Tr): string {
  const list = p.marks;
  if (!Array.isArray(list)) return '';
  return list
    .filter((m): m is Params => m !== null && typeof m === 'object')
    .map(m => tr('notifMarkAt', { event: eventName(String(m.type ?? ''), tr), time: String(m.time ?? '') }))
    .join(', ');
}

/**
 * Reviewers' free-text comments are optional on every review sentence, so the
 * clause lives in one key instead of doubling the body keys.
 */
function withComment(body: string, p: Params, tr: Tr): string {
  return nonEmpty(p.comment) ? tr('notifWithComment', { body, comment: p.comment }) : body;
}

function withReason(body: string, p: Params, tr: Tr): string {
  return nonEmpty(p.reason) ? tr('notifWithReason', { body, reason: p.reason }) : body;
}

function asParams(raw: unknown): Params {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Params) : {};
}

function str(p: Params, key: string): string {
  const v = p[key];
  return typeof v === 'string' ? v : '';
}

function int(p: Params, key: string): number {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
