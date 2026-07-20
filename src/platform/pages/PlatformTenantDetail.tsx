import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronDown, ChevronRight, CirclePause, CirclePlay, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { PlatformModal } from '../components/PlatformModal';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { IssueCheckoutLinkDialog } from '../components/IssueCheckoutLinkDialog';
import { extractMessage } from '../lib/platformError';
import { fmtCents } from '../lib/money';
import { BillingStatusPill, TenantStatusPill } from '../components/TenantStatusPill';
import { usePlatformAuth } from '../context/PlatformAuthContext';
import {
  deleteTenant,
  getTenant,
  getTenantAudit,
  getTenantPayments,
  listTenantUsers,
  reactivateTenant,
  suspendTenant,
} from '../services/platformDashboard';
import type {
  Page,
  PlatformAuditEntry,
  PlatformCheckoutLinkResponse,
  PlatformPaymentEntry,
  TenantDetail,
  TenantPayments,
  TenantUserSummary,
} from '../types';
import { fmtDate, fmtDateTime } from '../../app/helpers/dateTime';
import {
  cardCx,
  chipCx,
  colHeadCx,
  CopyButton,
  dangerBtnCx,
  EASE_OUT,
  errorBoxCx,
  FieldError,
  fieldInputCx,
  hintCx,
  inkBtnCx,
  inputCx,
  labelCx,
  microLabelCx,
  monoInputCx,
  primaryBtnCx,
  secondaryBtnCx,
  Skeleton,
} from '../components/console';

type Tab = 'summary' | 'users' | 'audit' | 'payments';

const TAB_LABELS: Record<Tab, string> = {
  summary: 'Summary',
  users: 'Users',
  audit: 'Audit log',
  payments: 'Payments',
};

/**
 * A console-created PADDLE account that has not confirmed its first payment
 * yet — the state the header badge and the payment-link card exist for.
 */
function awaitingFirstPayment(tenant: TenantDetail): boolean {
  return (
    tenant.billingProvider === 'PADDLE' &&
    (tenant.billingStatus === 'CHECKOUT_PENDING' || tenant.billingStatus === 'PAYMENT_REQUIRED')
  );
}

export function PlatformTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { role } = usePlatformAuth();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<Page<TenantUserSummary> | null>(null);
  const [audit, setAudit] = useState<Page<PlatformAuditEntry> | null>(null);
  const [payments, setPayments] = useState<TenantPayments | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Dialog state — held in the parent so dialogs can refresh `tenant` after success.
  const [showSuspend, setShowSuspend] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showIssueLink, setShowIssueLink] = useState(false);
  // The last link issued from THIS page, so the billing card can confirm
  // whether the accompanying email went out. Cleared implicitly on nav.
  const [lastIssue, setLastIssue] = useState<PlatformCheckoutLinkResponse | null>(null);

  // Payments (billing summary + history) are OWNER/BILLING only — mirrors the
  // backend @PreAuthorize on /platform/tenants/{id}/payments.
  const canBilling = role === 'OWNER' || role === 'BILLING';

  const loadTenant = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getTenant(id)
      .then(setTenant)
      .catch(err => setError(err?.message ?? 'Failed to load tenant.'))
      .finally(() => setLoading(false));
  }, [id]);

  const loadUsers = useCallback(() => {
    if (!id) return;
    listTenantUsers(id, 0, 50)
      .then(setUsers)
      .catch(() => setUsers(null));
  }, [id]);

  const loadAudit = useCallback(() => {
    if (!id) return;
    getTenantAudit(id, 0, 100)
      .then(setAudit)
      .catch(() => setAudit(null));
  }, [id]);

  const loadPayments = useCallback(() => {
    if (!id) return;
    getTenantPayments(id)
      .then(setPayments)
      .catch(() => setPayments(null));
  }, [id]);

  useEffect(() => { loadTenant(); }, [loadTenant]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === 'audit') loadAudit(); }, [tab, loadAudit]);
  useEffect(() => { if (tab === 'payments') loadPayments(); }, [tab, loadPayments]);

  if (!id) {
    return <p className="text-bt-muted">Invalid tenant id.</p>;
  }

  const canSuspend = role === 'OWNER' || role === 'SUPPORT';
  const canDelete = role === 'OWNER';
  // Checkout links are OWNER/SUPPORT — the roles that provision tenants —
  // mirroring the backend @PreAuthorize on /billing/checkout-link.
  const canIssueLink = role === 'OWNER' || role === 'SUPPORT';
  const showDeleteItem = tenant ? canDelete && tenant.status !== 'DELETED' : false;
  const hasActions = tenant !== null && (canSuspend || showDeleteItem);

  const tabs: Tab[] = canBilling
    ? ['summary', 'users', 'audit', 'payments']
    : ['summary', 'users', 'audit'];

  return (
    <>
      <nav className="flex items-center gap-1.5 text-[12.5px] font-medium">
        <Link to="/platform/tenants" className="font-semibold text-bt-orange transition-colors hover:text-bt-orange-hover">
          Tenants
        </Link>
        <ChevronRight size={12} strokeWidth={2} className="text-bt-muted-2" />
        <span className="font-semibold text-bt-ink">{tenant?.name ?? '…'}</span>
      </nav>

      {loading && (
        <div className="mt-5">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-4 h-4 w-48" />
          <Skeleton className="mt-8 h-40 w-full rounded-xl" />
        </div>
      )}
      {error && <div className={`${errorBoxCx} mt-5`}>{error}</div>}

      {tenant && !loading && (
        <>
          <header className="mt-4 flex items-start justify-between gap-5">
            <div className="flex min-w-0 flex-wrap items-center gap-3.5">
              <h1 className="font-bt-display text-[34px] font-extrabold uppercase leading-none tracking-[0.015em] text-bt-ink">
                {tenant.name}
              </h1>
              <span className={`${chipCx} border-bt-rule bg-white px-2.5 py-1`}>{tenant.slug}</span>
              <TenantStatusPill status={tenant.status} />
              {awaitingFirstPayment(tenant) && <BillingStatusPill status={tenant.billingStatus} />}
            </div>

            {hasActions && (
              <div className="relative flex-none">
                <button
                  type="button"
                  onClick={() => setMenuOpen(o => !o)}
                  className={`${secondaryBtnCx} h-9 gap-1.5 px-3.5 text-[13px]`}
                >
                  <span>Actions</span>
                  <ChevronDown size={13} strokeWidth={2} className="text-bt-muted" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -2 }}
                        transition={{ duration: 0.15, ease: EASE_OUT }}
                        className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 origin-top-right rounded-[10px] border border-bt-rule bg-white p-1.5 shadow-[0_8px_24px_rgba(23,19,15,0.16)]"
                      >
                        {canSuspend && (
                          <>
                            <MenuItem
                              icon={<CirclePause size={14} strokeWidth={1.8} className="text-bt-muted" />}
                              label="Suspend workspace"
                              enabled={tenant.status === 'ACTIVE'}
                              onClick={() => { setMenuOpen(false); setShowSuspend(true); }}
                            />
                            <MenuItem
                              icon={<CirclePlay size={14} strokeWidth={1.8} className="text-bt-muted" />}
                              label="Reactivate workspace"
                              enabled={tenant.status === 'SUSPENDED'}
                              onClick={() => { setMenuOpen(false); setShowReactivate(true); }}
                            />
                          </>
                        )}
                        {canSuspend && showDeleteItem && <div className="mx-1 my-1 h-px bg-bt-rule-3" />}
                        {showDeleteItem && (
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); setShowDelete(true); }}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-medium text-[#B42318] transition-colors hover:bg-[#FAEDE7]"
                          >
                            <Trash2 size={14} strokeWidth={1.8} />
                            <span>Delete workspace</span>
                          </button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </header>

          <nav className="mt-6 flex gap-0.5 border-b border-bt-rule">
            {tabs.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative -mb-px cursor-pointer px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  tab === key ? 'text-bt-ink' : 'text-bt-muted hover:text-bt-ink'
                }`}
              >
                {TAB_LABELS[key]}
                {tab === key && (
                  <motion.span
                    layoutId="tenant-detail-tab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-bt-orange"
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                  />
                )}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              {tab === 'summary' && (
                <SummaryTab
                  tenant={tenant}
                  canIssueLink={canIssueLink}
                  lastIssue={lastIssue}
                  onIssueNewLink={() => setShowIssueLink(true)}
                />
              )}
              {tab === 'users' && <UsersTab data={users} />}
              {tab === 'audit' && <AuditTab data={audit} />}
              {tab === 'payments' && canBilling && (
                <PaymentsTab data={payments} onRecord={() => setShowRecordPayment(true)} />
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {showSuspend && (
              <SuspendDialog
                tenantSlug={tenant.slug}
                onClose={() => setShowSuspend(false)}
                onSuccess={() => {
                  setShowSuspend(false);
                  loadTenant();
                }}
                tenantId={tenant.id}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showReactivate && (
              <ReactivateDialog
                onClose={() => setShowReactivate(false)}
                onSuccess={() => {
                  setShowReactivate(false);
                  loadTenant();
                }}
                tenantId={tenant.id}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showDelete && (
              <DeleteDialog
                tenantSlug={tenant.slug}
                tenantId={tenant.id}
                onClose={() => setShowDelete(false)}
                onSuccess={() => {
                  setShowDelete(false);
                  loadTenant();
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showRecordPayment && (
              <RecordPaymentDialog
                tenantId={tenant.id}
                tenantName={tenant.name}
                currentPeriodEndsAt={payments?.currentPeriodEndsAt ?? null}
                onClose={() => setShowRecordPayment(false)}
                onSuccess={updated => {
                  setShowRecordPayment(false);
                  setPayments(updated);
                }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showIssueLink && (
              <IssueCheckoutLinkDialog
                tenantId={tenant.id}
                tenantName={tenant.name}
                onClose={() => setShowIssueLink(false)}
                onIssued={issued => {
                  setShowIssueLink(false);
                  setLastIssue(issued);
                  // Refresh so pendingCheckoutUrl reflects the new live link.
                  loadTenant();
                }}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  enabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-medium text-bt-ink transition-colors ${
        enabled ? 'cursor-pointer hover:bg-bt-paper' : 'pointer-events-none opacity-40'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Tabs ────────────────────────────────────────────────────────

function SummaryRow({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`grid grid-cols-[200px_1fr] items-center gap-4 px-6 py-3.5 ${first ? '' : 'border-t border-bt-rule-3'}`}>
      <span className="text-[12.5px] text-bt-muted">{label}</span>
      <span className="text-[13px] font-semibold text-bt-ink">{children}</span>
    </div>
  );
}

function SummaryTab({
  tenant,
  canIssueLink,
  lastIssue,
  onIssueNewLink,
}: {
  tenant: TenantDetail;
  canIssueLink: boolean;
  lastIssue: PlatformCheckoutLinkResponse | null;
  onIssueNewLink: () => void;
}) {
  const pending = awaitingFirstPayment(tenant);
  // Only report on the freshly issued link while it is still the live one.
  const justIssued = lastIssue !== null && lastIssue.checkoutUrl === tenant.pendingCheckoutUrl;

  return (
    <>
      <div className={`${cardCx} mt-6 overflow-hidden`}>
        <SummaryRow label="Created" first>{fmtDateTime(tenant.createdAt)}</SummaryRow>
        <SummaryRow label="Updated">{fmtDateTime(tenant.updatedAt)}</SummaryRow>
        <SummaryRow label="Workspace identifier"><span className={chipCx}>{tenant.slug}</span></SummaryRow>
        <SummaryRow label="Status"><TenantStatusPill status={tenant.status} /></SummaryRow>
        {tenant.status === 'SUSPENDED' && tenant.suspensionReason && (
          <SummaryRow label="Suspension reason">
            {tenant.suspensionReason === 'PENDING_PAYMENT'
              ? 'Auto-suspended — the first payment never arrived'
              : 'Suspended by platform staff'}
          </SummaryRow>
        )}
        <SummaryRow label="Users (total / active)">
          <span className="font-bt-mono text-xs">{tenant.userCount} / {tenant.activeUserCount}</span>
        </SummaryRow>
        <SummaryRow label="Projects"><span className="font-bt-mono text-xs">{tenant.projectCount}</span></SummaryRow>
        <SummaryRow label="Clients"><span className="font-bt-mono text-xs">{tenant.clientCount}</span></SummaryRow>
      </div>

      <div className={`${cardCx} mt-5 overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-bt-rule-3 px-6 py-4">
          <span className="font-bt-heading text-[13px] font-bold text-bt-ink">Billing</span>
          {tenant.billingStatus && <BillingStatusPill status={tenant.billingStatus} />}
        </div>
        {tenant.billingProvider === null ? (
          <p className="px-6 py-5 text-sm text-bt-muted">No billing account (legacy tenant).</p>
        ) : (
          <>
            <SummaryRow label="Provider" first>
              {tenant.billingProvider === 'PADDLE'
                ? 'Paddle — automatic card billing'
                : 'Manual — outside the product'}
            </SummaryRow>
            {tenant.negotiatedPriceCents != null && (
              <SummaryRow label="Negotiated price">
                <span className="font-bt-mono text-[13px]">{fmtCents(tenant.negotiatedPriceCents)} USD</span>
                <span className="ml-1.5 font-normal text-bt-muted">per period, fixed for life</span>
              </SummaryRow>
            )}
            {pending && (
              <div className="border-t border-bt-rule-3 px-6 py-4">
                <div className={`${microLabelCx} mb-2`}>Payment link</div>
                {tenant.pendingCheckoutUrl ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="min-w-0 flex-1 truncate font-bt-mono text-xs font-semibold text-bt-ink"
                        title={tenant.pendingCheckoutUrl}
                      >
                        {tenant.pendingCheckoutUrl}
                      </span>
                      <CopyButton value={tenant.pendingCheckoutUrl} />
                      {canIssueLink && (
                        <button
                          type="button"
                          onClick={onIssueNewLink}
                          className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-lg border border-bt-rule bg-white px-3 text-xs font-semibold text-bt-ink transition-colors hover:bg-bt-paper"
                        >
                          <RefreshCw size={13} strokeWidth={1.8} className="text-bt-muted" />
                          <span>Issue new link</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-normal text-bt-muted">
                      {justIssued &&
                        (lastIssue.emailSent
                          ? 'Fresh link issued and emailed to the workspace admin. '
                          : 'Fresh link issued — the email could not be sent, so copy it and send it yourself. ')}
                      Access unlocks automatically when Paddle confirms the payment. Issuing a new link
                      supersedes this one and restarts the 7-day auto-suspension window.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm leading-normal text-bt-muted">
                      No live payment link — the last checkout attempt failed, expired, or was never
                      issued.
                    </p>
                    {canIssueLink && (
                      <button type="button" onClick={onIssueNewLink} className={`${primaryBtnCx} flex-none`}>
                        <RefreshCw size={14} strokeWidth={2} />
                        <span>Issue new link</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <tr key={i} className="border-t border-bt-rule-3">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="px-4 py-3 first:pl-6 last:pr-6">
              <Skeleton className="h-3.5 w-24" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function UsersTab({ data }: { data: Page<TenantUserSummary> | null }) {
  return (
    <div className={`${cardCx} mt-6 overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-bt-rule-3 px-6 py-4">
        <span className="font-bt-heading text-[13px] font-bold text-bt-ink">Users</span>
        {data && <span className={microLabelCx}>{data.totalElements} users</span>}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className={`text-left ${colHeadCx}`}>
            <th className="px-6 py-2.5 font-semibold">Username</th>
            <th className="px-4 py-2.5 font-semibold">Full name</th>
            <th className="px-4 py-2.5 font-semibold">Role</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-6 py-2.5 font-semibold">Email</th>
          </tr>
        </thead>
        <tbody>
          {!data && <TableSkeleton cols={5} />}
          {data && data.content.length === 0 && (
            <tr className="border-t border-bt-rule-3">
              <td colSpan={5} className="px-6 py-8 text-bt-muted">No users.</td>
            </tr>
          )}
          {data?.content.map(u => (
            <tr key={u.id} className="border-t border-bt-rule-3 transition-colors hover:bg-[#F9F5EC]">
              <td className="px-6 py-3 font-bt-mono text-xs font-semibold text-bt-ink">{u.username}</td>
              <td className="px-4 py-3 text-[13px] text-bt-ink">{u.fullName ?? '—'}</td>
              <td className="px-4 py-3 text-[12.5px] font-semibold text-bt-ink">{u.role}</td>
              <td className="px-4 py-3 text-[12.5px] text-bt-muted">{u.status}</td>
              <td className="px-6 py-3 text-[12.5px] text-bt-muted">{u.email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTab({ data }: { data: Page<PlatformAuditEntry> | null }) {
  return (
    <div className={`${cardCx} mt-6 overflow-hidden`}>
      <div className="border-b border-bt-rule-3 px-6 py-4">
        <span className="font-bt-heading text-[13px] font-bold text-bt-ink">Audit log</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className={`text-left ${colHeadCx}`}>
            <th className="px-6 py-2.5 font-semibold">When</th>
            <th className="px-4 py-2.5 font-semibold">Actor</th>
            <th className="px-4 py-2.5 font-semibold">Action</th>
            <th className="px-4 py-2.5 font-semibold">Outcome</th>
            <th className="px-6 py-2.5 font-semibold">Message</th>
          </tr>
        </thead>
        <tbody>
          {!data && <TableSkeleton cols={5} />}
          {data && data.content.length === 0 && (
            <tr className="border-t border-bt-rule-3">
              <td colSpan={5} className="px-6 py-8 text-bt-muted">No audit entries.</td>
            </tr>
          )}
          {data?.content.map(a => (
            <tr key={a.id} className="border-t border-bt-rule-3">
              <td className="whitespace-nowrap px-6 py-3 font-bt-mono text-xs text-bt-muted">{fmtDateTime(a.createdAt)}</td>
              <td className="px-4 py-3">
                <span className="font-bt-mono text-xs text-bt-muted">{a.actorEmail}</span>{' '}
                <span className="text-[11px] text-bt-muted-2">({a.actorRole})</span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-block rounded-[5px] border border-bt-rule-2 bg-bt-paper px-1.5 py-0.5 font-bt-mono text-[11px] font-semibold text-bt-ink">
                  {a.action}
                </span>
              </td>
              <td className={`px-4 py-3 text-[12.5px] font-semibold ${a.outcome === 'SUCCESS' ? 'text-[#3D6112]' : 'text-[#B42318]'}`}>
                {a.outcome}
              </td>
              <td className="max-w-md truncate px-6 py-3 text-[12.5px] text-bt-muted" title={a.message ?? ''}>
                {a.message ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Payments (billing) tab ──────────────────────────────────────

/** "Valid until" display + relative note, red when overdue (per the design). */
function untilInfo(currentPeriodEndsAt: string | null, billingStatus: string | null): {
  display: string;
  note: string;
  overdue: boolean;
} {
  if (!currentPeriodEndsAt) return { display: '—', note: 'no active access', overdue: false };
  const days = Math.round((new Date(currentPeriodEndsAt).getTime() - Date.now()) / 86_400_000);
  const display = fmtDate(currentPeriodEndsAt);
  if (billingStatus === 'PAUSED') return { display, note: 'workspace paused', overdue: false };
  if (days > 0) return { display, note: `in ${days} days`, overdue: false };
  if (days === 0) return { display, note: 'today', overdue: false };
  if (billingStatus === 'EXPIRED') return { display, note: `expired ${-days} days ago`, overdue: true };
  return { display, note: `${-days} days overdue`, overdue: true };
}

function PaymentsTab({
  data,
  onRecord,
}: {
  data: TenantPayments | null;
  onRecord: () => void;
}) {
  if (!data) {
    return (
      <div className={`${cardCx} mt-6 px-6 py-5`}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-3.5 w-64" />
      </div>
    );
  }

  const hasAccount = data.billingProvider !== null;
  const isManual = data.billingProvider === 'MANUAL';
  const until = untilInfo(data.currentPeriodEndsAt, data.billingStatus);

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className={`${cardCx} flex items-center justify-between gap-6 px-6 py-5`}>
        <div className="flex flex-wrap items-start gap-11">
          <div>
            <div className={`${microLabelCx} mb-2`}>Status</div>
            {hasAccount ? (
              <BillingStatusPill status={data.billingStatus} />
            ) : (
              <span className="text-sm leading-6 text-bt-muted">No billing account</span>
            )}
          </div>
          <div>
            <div className={`${microLabelCx} mb-2`}>Plan</div>
            <div className="text-sm font-semibold leading-6 text-bt-ink">
              {data.planCode
                ? `${data.planCode === 'PRO' ? 'Pro' : 'Business'} · ${data.billingInterval === 'ANNUAL' ? 'Annual' : 'Monthly'}`
                : '—'}
            </div>
          </div>
          <div>
            <div className={`${microLabelCx} mb-2`}>Billing provider</div>
            <div className="text-sm font-semibold leading-6 text-bt-ink">
              {data.billingProvider === 'MANUAL' ? 'Manual' : data.billingProvider === 'PADDLE' ? 'Paddle' : '—'}
            </div>
          </div>
          <div>
            <div className={`${microLabelCx} mb-2`}>Valid until</div>
            <div className={`font-bt-mono text-base font-semibold leading-6 ${until.overdue ? 'text-[#B42318]' : 'text-bt-ink'}`}>
              {until.display}
            </div>
            <div className={`mt-0.5 text-[11.5px] ${until.overdue ? 'text-[#B42318]' : 'text-bt-muted-2'}`}>
              {until.note}
            </div>
          </div>
        </div>
        {isManual && (
          <button type="button" onClick={onRecord} className={`${primaryBtnCx} flex-none`}>
            <Plus size={14} strokeWidth={2.2} />
            <span>Record payment</span>
          </button>
        )}
      </div>

      {data.billingProvider === 'PADDLE' && (
        <p className="text-xs text-bt-muted-2">
          Billed through Paddle — the period is managed automatically, so manual payments don&apos;t apply.
        </p>
      )}

      <div className={`${cardCx} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-bt-rule-3 px-6 py-4">
          <span className="font-bt-heading text-[13px] font-bold text-bt-ink">Payment history</span>
          <span className={microLabelCx}>All amounts USD</span>
        </div>
        {data.payments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-bt-muted">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${colHeadCx}`}>
                  <th className="px-6 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 font-semibold">Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Covers until</th>
                  <th className="px-6 py-2.5 font-semibold">Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p: PlatformPaymentEntry, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.03 }}
                    className="border-t border-bt-rule-3 transition-colors hover:bg-[#F9F5EC]"
                  >
                    <td className="whitespace-nowrap px-6 py-3 font-bt-mono text-xs text-bt-muted">{fmtDate(p.paidAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bt-mono text-[13px] font-semibold text-bt-ink">
                      {fmtCents(p.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-bt-ink">{p.method}</td>
                    <td className="max-w-48 truncate px-4 py-3 font-bt-mono text-xs text-bt-muted">{p.reference ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bt-mono text-xs text-bt-muted">{fmtDate(p.coversUntil)}</td>
                    <td className="truncate px-6 py-3 text-[12.5px] text-bt-muted">{p.recordedByEmail}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────

function SuspendDialog({
  tenantId,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) {
      setLocalError('Reason must be at least 5 characters.');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    setServerError(null);
    try {
      await suspendTenant(tenantId, reason.trim());
      onSuccess();
    } catch (err) {
      setServerError(extractMessage(err) ?? 'Suspend failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformModal title="Suspend workspace" onClose={onClose}>
      <p className="mt-1.5 text-[13px] leading-normal text-bt-muted">
        Everyone in <span className={chipCx}>{tenantSlug}</span> will be blocked from API access
        until you reactivate. The reason is recorded in the audit log.
      </p>
      {serverError && <div className={`${errorBoxCx} mt-3`}>{serverError}</div>}
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="s-reason" className={labelCx}>Reason</label>
        <input
          id="s-reason"
          type="text"
          value={reason}
          onChange={e => { setReason(e.target.value); setLocalError(null); }}
          placeholder="e.g. Payment overdue"
          disabled={submitting}
          className={fieldInputCx({ invalid: !!localError })}
        />
        <div className={hintCx}>Short — it&apos;s recorded in the audit log.</div>
        {localError && <FieldError role="alert">{localError}</FieldError>}
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} disabled={submitting} className={secondaryBtnCx}>Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className={inkBtnCx}>
          {submitting ? 'Suspending…' : 'Suspend workspace'}
        </button>
      </div>
    </PlatformModal>
  );
}

function ReactivateDialog({
  tenantId,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await reactivateTenant(tenantId, note.trim() || undefined);
      onSuccess();
    } catch (err) {
      setError(extractMessage(err) ?? 'Reactivate failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformModal title="Reactivate workspace" onClose={onClose}>
      <p className="mt-1.5 text-[13px] leading-normal text-bt-muted">
        Users will regain access immediately. An optional note will appear in the audit log.
      </p>
      {error && <div className={`${errorBoxCx} mt-3`}>{error}</div>}
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="r-note" className={labelCx}>
          Note <span className="font-medium text-bt-muted-2">(optional)</span>
        </label>
        <input
          id="r-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Payment received"
          disabled={submitting}
          className={inputCx}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} disabled={submitting} className={secondaryBtnCx}>Cancel</button>
        <button type="button" onClick={submit} disabled={submitting} className={primaryBtnCx}>
          {submitting ? 'Reactivating…' : 'Reactivate workspace'}
        </button>
      </div>
    </PlatformModal>
  );
}

/** Slug-confirm input focuses red, not orange — this is the destructive path. */
const dangerInputCx =
  'h-[38px] w-full rounded-lg border border-bt-rule bg-white px-3 font-bt-mono text-[13px] text-bt-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-bt-muted-2 focus:border-[#B42318] focus:shadow-[0_0_0_3px_rgba(180,35,24,0.14)] disabled:opacity-60';

function DeleteDialog({
  tenantId,
  tenantSlug,
  onClose,
  onSuccess,
}: {
  tenantId: number;
  tenantSlug: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmSlug, setConfirmSlug] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slugMatches = confirmSlug.trim() === tenantSlug;

  const submit = async () => {
    if (reason.trim().length < 5) {
      setLocalError('Reason must be at least 5 characters.');
      return;
    }
    if (!slugMatches) {
      setLocalError('Confirmation slug does not match.');
      return;
    }
    setSubmitting(true);
    setLocalError(null);
    setServerError(null);
    try {
      await deleteTenant(tenantId, reason.trim(), confirmSlug.trim());
      onSuccess();
    } catch (err) {
      setServerError(extractMessage(err) ?? 'Delete failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformModal title="Delete workspace" onClose={onClose}>
      <p className="mt-1.5 text-[13px] leading-normal text-bt-muted">
        Marks the workspace DELETED. Data rows remain in tables for audit lineage; the
        workspace becomes unreachable. This is irreversible from the dashboard — only
        OWNER can perform it.
      </p>
      {serverError && <div className={`${errorBoxCx} mt-3`}>{serverError}</div>}
      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor="d-slug" className={labelCx}>
          Type <span className={`${chipCx} text-[11.5px]`}>{tenantSlug}</span> to confirm
        </label>
        <input
          id="d-slug"
          type="text"
          value={confirmSlug}
          onChange={e => { setConfirmSlug(e.target.value); setLocalError(null); }}
          placeholder={tenantSlug}
          spellCheck={false}
          autoComplete="off"
          disabled={submitting}
          className={dangerInputCx}
        />
      </div>
      <div className="mt-3.5 flex flex-col gap-1.5">
        <label htmlFor="d-reason" className={labelCx}>Reason</label>
        <input
          id="d-reason"
          type="text"
          value={reason}
          onChange={e => { setReason(e.target.value); setLocalError(null); }}
          placeholder="Required, min 5 characters — recorded in the audit log"
          disabled={submitting}
          className={fieldInputCx({ invalid: !!(localError && reason.trim().length < 5) })}
        />
        {localError && <FieldError role="alert">{localError}</FieldError>}
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} disabled={submitting} className={secondaryBtnCx}>Cancel</button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className={`${dangerBtnCx} ${slugMatches ? '' : 'pointer-events-none opacity-45'}`}
        >
          {submitting ? 'Deleting…' : 'Delete workspace'}
        </button>
      </div>
    </PlatformModal>
  );
}
