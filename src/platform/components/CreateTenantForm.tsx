import type { ReactNode } from 'react';
import { useState } from 'react';
import { CornerDownRight, Lock, Mail } from 'lucide-react';
import { motion } from 'motion/react';

import { extractMessage } from '../lib/platformError';
import { createTenant } from '../services/platformDashboard';
import type { BillingInterval, CreateTenantResponse, PlanCode } from '../types';
import {
  ButtonSpinner,
  chipCx,
  FieldError,
  fieldInputCx,
  hintCx,
  labelCx,
  microLabelCx,
  primaryBtnCx,
  riseIn,
  secondaryBtnCx,
  staggerParent,
} from './console';

/** Mirrors the backend's SignupRequest/CreateTenantRequest slug rule exactly. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Derive a slug suggestion from the company name. Only a starting point —
 * the field stays editable, and the backend is the authority (it owns the
 * reserved list and the uniqueness check).
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: "Construcción" → "construccion"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, ''); // a trailing hyphen from the slice would fail the regex
}

type FieldKey = 'companyName' | 'tenantSlug' | 'adminFullName' | 'adminUsername' | 'adminEmail';

const PLAN_LIMITS: Record<PlanCode, string> = {
  PRO: '15 users · 2 admins',
  BUSINESS: '40 users · Unlimited admins',
};

/**
 * Create a customer workspace — the form half of the "Create new tenant"
 * screen (three numbered cards + a live summary rail, per the approved
 * design). Validation rules and the submit payload are unchanged from the
 * old dialog; only the presentation moved.
 *
 * There is deliberately no password field. The backend sets a random one
 * nobody reads and emails the admin a link to choose their own — support
 * staff never know a customer's password, so the form cannot offer to set it.
 */
export function CreateTenantForm({
  onCreated,
  onCancel,
}: {
  onCreated: (result: CreateTenantResponse) => void;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminFullName, setAdminFullName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planCode, setPlanCode] = useState<PlanCode>('PRO');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

  // Auto-fill the slug from the company name until staff edit it themselves.
  const onCompanyNameChange = (value: string) => {
    setCompanyName(value);
    if (!slugTouched) setTenantSlug(slugify(value));
  };

  // Same rules and messages as the backend mirror in the old dialog, split
  // per field so errors can sit next to what they describe.
  const fieldError = (key: FieldKey): string | null => {
    switch (key) {
      case 'companyName':
        return companyName.trim().length < 2 ? 'Company name must be at least 2 characters.' : null;
      case 'tenantSlug':
        if (tenantSlug.length < 3 || tenantSlug.length > 60) return 'Workspace identifier must be 3–60 characters.';
        if (!SLUG_RE.test(tenantSlug)) {
          return 'Workspace identifier must be lowercase letters, digits and hyphens, and cannot start or end with a hyphen.';
        }
        return null;
      case 'adminFullName':
        return adminFullName.trim().length < 2 ? "Admin's full name must be at least 2 characters." : null;
      case 'adminUsername':
        if (adminUsername.trim().length < 3) return 'Admin username must be at least 3 characters.';
        if (!USERNAME_RE.test(adminUsername.trim())) {
          return 'Admin username may only contain letters, digits, dots, underscores or hyphens.';
        }
        return null;
      case 'adminEmail':
        return adminEmail.trim() ? null : 'Admin email is required — it is where the set-up link is sent.';
    }
  };

  const visibleError = (key: FieldKey): string | null => (touched[key] ? fieldError(key) : null);
  const markTouched = (key: FieldKey) => setTouched(t => ({ ...t, [key]: true }));

  const ALL_FIELDS: FieldKey[] = ['companyName', 'tenantSlug', 'adminFullName', 'adminUsername', 'adminEmail'];

  const submit = async () => {
    setTouched({ companyName: true, tenantSlug: true, adminFullName: true, adminUsername: true, adminEmail: true });
    if (ALL_FIELDS.some(k => fieldError(k) !== null)) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await createTenant({
        companyName: companyName.trim(),
        tenantSlug: tenantSlug.trim(),
        adminUsername: adminUsername.trim(),
        adminFullName: adminFullName.trim(),
        adminEmail: adminEmail.trim(),
        planCode,
        billingInterval,
      });
      onCreated(result);
    } catch (err) {
      setServerError(extractMessage(err) ?? 'Could not create the workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugEcho = tenantSlug.trim();
  const planName = planCode === 'PRO' ? 'Pro' : 'Business';
  const intervalLabel = billingInterval === 'MONTHLY' ? 'Monthly' : 'Annual';

  return (
    <div className="mt-7 flex items-start gap-7">
      {/* Form column */}
      <div className="min-w-0 max-w-[660px] flex-1">
        <motion.div
          className={`flex flex-col gap-5 transition-opacity duration-200 ${submitting ? 'pointer-events-none opacity-55' : ''}`}
          variants={staggerParent}
          initial="hidden"
          animate="show"
        >
          <SectionCard number="1" title="Workspace">
            <Field
              id="f-company"
              label="Company name"
              error={visibleError('companyName')}
            >
              <input
                id="f-company"
                type="text"
                value={companyName}
                onChange={e => onCompanyNameChange(e.target.value)}
                onBlur={() => markTouched('companyName')}
                placeholder="Acme Construcciones"
                disabled={submitting}
                className={fieldInputCx({ invalid: !!visibleError('companyName') })}
              />
            </Field>
            <Field
              id="f-ident"
              label="Workspace identifier"
              hint="The customer types this to log in. Lowercase letters, digits and hyphens."
              error={visibleError('tenantSlug')}
            >
              <input
                id="f-ident"
                type="text"
                value={tenantSlug}
                onChange={e => {
                  setSlugTouched(true);
                  setTenantSlug(e.target.value);
                }}
                onBlur={() => markTouched('tenantSlug')}
                placeholder="acme-construcciones"
                spellCheck={false}
                autoComplete="off"
                disabled={submitting}
                className={fieldInputCx({ invalid: !!visibleError('tenantSlug'), mono: true })}
              />
              {slugEcho && !visibleError('tenantSlug') && (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <CornerDownRight size={13} strokeWidth={2} className="text-bt-muted-2" />
                  <span className="text-xs text-bt-muted">Their login handle:</span>
                  <span className={chipCx}>{slugEcho}</span>
                </div>
              )}
            </Field>
          </SectionCard>

          <SectionCard number="2" title="Administrator" subtitle="· The workspace's first user">
            <div className="grid grid-cols-2 gap-4">
              <Field id="f-aname" label="Admin full name" error={visibleError('adminFullName')}>
                <input
                  id="f-aname"
                  type="text"
                  value={adminFullName}
                  onChange={e => setAdminFullName(e.target.value)}
                  onBlur={() => markTouched('adminFullName')}
                  placeholder="Ana Admin"
                  disabled={submitting}
                  className={fieldInputCx({ invalid: !!visibleError('adminFullName') })}
                />
              </Field>
              <Field
                id="f-auser"
                label="Admin username"
                hint="Letters, digits, dots, underscores or hyphens."
                error={visibleError('adminUsername')}
              >
                <input
                  id="f-auser"
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  onBlur={() => markTouched('adminUsername')}
                  placeholder="ana.admin"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={submitting}
                  className={fieldInputCx({ invalid: !!visibleError('adminUsername'), mono: true })}
                />
              </Field>
            </div>
            <Field
              id="f-aemail"
              label="Admin email"
              hint="Where the set-your-password link goes."
              error={visibleError('adminEmail')}
            >
              <input
                id="f-aemail"
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                onBlur={() => markTouched('adminEmail')}
                placeholder="ana@acme.example"
                spellCheck={false}
                autoComplete="off"
                disabled={submitting}
                className={fieldInputCx({ invalid: !!visibleError('adminEmail') })}
              />
            </Field>
            <div className="flex items-start gap-2 rounded-lg border border-bt-rule-2 bg-bt-paper px-3 py-2.5">
              <Lock size={14} strokeWidth={1.8} className="mt-0.5 flex-none text-bt-muted" />
              <span className="text-[12.5px] leading-normal text-bt-muted">
                <span className="font-semibold text-bt-ink">The password is chosen by the customer.</span>{' '}
                The invite email contains a set-your-password link — staff never see or set passwords.
              </span>
            </div>
          </SectionCard>

          <SectionCard
            number="3"
            title="Plan & billing"
            headerNote="The plan sets the workspace's user and admin limits. Billing is handled outside the product — no card, no Paddle subscription, and Paddle webhooks cannot alter it."
          >
            <div className="flex flex-col gap-2">
              <span className={labelCx}>Plan</span>
              <div className="grid grid-cols-2 gap-3">
                <PlanCard
                  name="Pro"
                  selected={planCode === 'PRO'}
                  onPick={() => setPlanCode('PRO')}
                  disabled={submitting}
                >
                  <PlanFigure value="15" unit="users" />
                  <span className="text-[12.5px] text-bt-rule">·</span>
                  <PlanFigure value="2" unit="admins" />
                </PlanCard>
                <PlanCard
                  name="Business"
                  selected={planCode === 'BUSINESS'}
                  onPick={() => setPlanCode('BUSINESS')}
                  disabled={submitting}
                >
                  <PlanFigure value="40" unit="users" />
                  <span className="text-[12.5px] text-bt-rule">·</span>
                  <PlanFigure value="Unlimited" unit="admins" small />
                </PlanCard>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className={labelCx}>Billing interval</span>
              <div className="inline-flex gap-0.5 self-start rounded-[9px] border border-bt-rule-2 bg-bt-rule-3 p-[3px]">
                <SegmentButton
                  label="Monthly"
                  active={billingInterval === 'MONTHLY'}
                  onPick={() => setBillingInterval('MONTHLY')}
                  disabled={submitting}
                />
                <SegmentButton
                  label="Annual"
                  active={billingInterval === 'ANNUAL'}
                  onPick={() => setBillingInterval('ANNUAL')}
                  disabled={submitting}
                />
              </div>
            </div>
          </SectionCard>
        </motion.div>

        {serverError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-[#EEC4B2] bg-[#FAEDE7] px-4 py-3 text-sm text-[#B42318]"
          >
            {serverError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={secondaryBtnCx}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={`${primaryBtnCx} min-w-[136px]`}
          >
            {submitting ? (
              <>
                <ButtonSpinner />
                <span>Creating tenant…</span>
              </>
            ) : (
              <span>Create tenant</span>
            )}
          </button>
        </div>
      </div>

      {/* Live summary rail */}
      <motion.aside
        className="sticky top-6 w-[316px] flex-none"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <div className="rounded-xl border border-bt-rule bg-bt-paper-2 shadow-[0_1px_2px_rgba(23,19,15,0.04)]">
          <div className="border-b border-bt-rule px-5 py-4 font-bt-heading text-[13px] font-bold text-bt-ink">
            Summary <span className="font-bt-body font-medium text-bt-muted">— what will be created</span>
          </div>
          <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
            <div>
              <div className={`${microLabelCx} mb-2`}>Workspace</div>
              <SummaryRow label="Company">
                <SummaryValue value={companyName} />
              </SummaryRow>
              <SummaryRow label="Login identifier">
                {slugEcho ? (
                  <motion.span
                    key="chip"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={chipCx}
                  >
                    {slugEcho}
                  </motion.span>
                ) : (
                  <SummaryValue value="" />
                )}
              </SummaryRow>
            </div>
            <div className="border-t border-bt-rule pt-3.5">
              <div className={`${microLabelCx} mb-2`}>Administrator</div>
              <SummaryRow label="Full name">
                <SummaryValue value={adminFullName} />
              </SummaryRow>
              <SummaryRow label="Username">
                <SummaryValue value={adminUsername} mono />
              </SummaryRow>
              <SummaryRow label="Invite goes to">
                <SummaryValue value={adminEmail} />
              </SummaryRow>
            </div>
            <div className="border-t border-bt-rule pt-3.5">
              <div className={`${microLabelCx} mb-2`}>Plan</div>
              <SummaryRow label="Plan">
                <motion.span
                  key={`${planName}-${intervalLabel}`}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-right text-[13px] font-semibold text-bt-ink"
                >
                  {planName} · {intervalLabel}
                </motion.span>
              </SummaryRow>
              <SummaryRow label="Limits">
                <motion.span
                  key={planCode}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-right font-bt-mono text-xs font-semibold text-bt-ink"
                >
                  {PLAN_LIMITS[planCode]}
                </motion.span>
              </SummaryRow>
              <SummaryRow label="Billing">
                <span className="text-right text-[13px] font-semibold text-bt-ink">Manual — outside the product</span>
              </SummaryRow>
            </div>
            <div className="flex items-start gap-2 border-t border-bt-rule pt-3.5">
              <Mail size={14} strokeWidth={1.8} className="mt-0.5 flex-none text-bt-muted" />
              <span className="text-xs leading-normal text-bt-muted">
                An invitation goes to the admin's email with a set-password link.
              </span>
            </div>
          </div>
        </div>
      </motion.aside>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────

function SectionCard({
  number,
  title,
  subtitle,
  headerNote,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  headerNote?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={riseIn}
      className="rounded-xl border border-bt-rule bg-white shadow-[0_1px_2px_rgba(23,19,15,0.04)]"
    >
      <div className={`flex gap-2.5 border-b border-bt-rule-3 px-6 py-4 ${headerNote ? 'items-start' : 'items-center'}`}>
        <span className="flex size-[22px] flex-none items-center justify-center rounded-[7px] border border-bt-rule-2 bg-bt-rule-3 font-bt-mono text-[11px] font-semibold text-bt-muted">
          {number}
        </span>
        <span className="min-w-0">
          <span className="font-bt-heading text-sm font-bold text-bt-ink">
            {title}
            {subtitle && <span className="ml-1.5 font-bt-body text-[12.5px] font-medium text-bt-muted-2">{subtitle}</span>}
          </span>
          {headerNote && (
            <span className="mt-1 block max-w-[56ch] text-[12.5px] font-normal leading-normal text-bt-muted">
              {headerNote}
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-[18px] px-6 pb-6 pt-5">{children}</div>
    </motion.div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCx}>{label}</label>
      {children}
      {hint && <div className={hintCx}>{hint}</div>}
      {error && <FieldError role="alert">{error}</FieldError>}
    </div>
  );
}

function PlanCard({
  name,
  selected,
  onPick,
  disabled,
  children,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      className={`flex cursor-pointer flex-col gap-2.5 rounded-[10px] border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 disabled:cursor-not-allowed ${
        selected
          ? 'border-bt-orange bg-bt-orange/5 shadow-[0_0_0_3px_rgba(249,115,22,0.14)]'
          : 'border-bt-rule bg-white hover:shadow-[0_1px_3px_rgba(23,19,15,0.1)]'
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-bt-heading text-[13.5px] font-bold text-bt-ink">{name}</span>
        <span
          className={`flex size-4 flex-none items-center justify-center rounded-full border-[1.5px] transition-colors ${
            selected ? 'border-bt-orange' : 'border-bt-rule'
          }`}
        >
          <span className={`size-2 rounded-full transition-colors ${selected ? 'bg-bt-orange' : 'bg-transparent'}`} />
        </span>
      </span>
      <span className="flex items-baseline gap-1.5">{children}</span>
    </button>
  );
}

function PlanFigure({ value, unit, small }: { value: string; unit: string; small?: boolean }) {
  return (
    <>
      <span className={`font-bt-mono font-semibold text-bt-ink ${small ? 'text-[13px]' : 'text-[15px]'}`}>{value}</span>
      <span className="text-[12.5px] text-bt-muted">{unit}</span>
    </>
  );
}

function SegmentButton({
  label,
  active,
  onPick,
  disabled,
}: {
  label: string;
  active: boolean;
  onPick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={active}
      className={`relative cursor-pointer rounded-[7px] px-4 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed ${
        active ? 'text-bt-ink' : 'text-bt-muted hover:text-bt-ink'
      }`}
    >
      {active && (
        <motion.span
          layoutId="bt-interval-segment"
          className="absolute inset-0 rounded-[7px] border border-bt-rule bg-white shadow-[0_1px_2px_rgba(23,19,15,0.08)]"
          transition={{ duration: 0.22, ease: [0.22, 0.7, 0.25, 1] }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex-none text-[12.5px] text-bt-muted">{label}</span>
      {children}
    </div>
  );
}

function SummaryValue({ value, mono = false }: { value: string; mono?: boolean }) {
  const filled = value.trim().length > 0;
  return (
    <motion.span
      key={filled ? 'value' : 'empty'}
      initial={{ opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`truncate text-right font-semibold ${
        mono ? 'font-bt-mono text-xs' : 'text-[13px]'
      } ${filled ? 'text-bt-ink' : 'text-bt-muted-2'}`}
    >
      {filled ? value.trim() : '—'}
    </motion.span>
  );
}
