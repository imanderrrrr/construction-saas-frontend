import { useState } from 'react';

import { PlatformModal } from './PlatformModal';
import { extractMessage } from '../lib/platformError';
import { createTenant } from '../services/platformDashboard';
import type { BillingInterval, CreateTenantResponse, PlanCode } from '../types';

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

/**
 * Create a customer workspace.
 *
 * There is deliberately no password field. The backend sets a random one
 * nobody reads and emails the admin a link to choose their own — support
 * staff never know a customer's password, so the form cannot offer to set it.
 */
export function CreateTenantDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (result: CreateTenantResponse) => void;
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
  const [error, setError] = useState<string | null>(null);

  // Auto-fill the slug from the company name until staff edit it themselves.
  const onCompanyNameChange = (value: string) => {
    setCompanyName(value);
    if (!slugTouched) setTenantSlug(slugify(value));
  };

  const validate = (): string | null => {
    if (companyName.trim().length < 2) return 'Company name must be at least 2 characters.';
    if (tenantSlug.length < 3 || tenantSlug.length > 60) return 'Workspace identifier must be 3–60 characters.';
    if (!SLUG_RE.test(tenantSlug)) {
      return 'Workspace identifier must be lowercase letters, digits and hyphens, and cannot start or end with a hyphen.';
    }
    if (adminFullName.trim().length < 2) return "Admin's full name must be at least 2 characters.";
    if (adminUsername.trim().length < 3) return 'Admin username must be at least 3 characters.';
    if (!USERNAME_RE.test(adminUsername.trim())) {
      return 'Admin username may only contain letters, digits, dots, underscores or hyphens.';
    }
    if (!adminEmail.trim()) return "Admin email is required — it is where the set-up link is sent.";
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
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
      setError(extractMessage(err) ?? 'Could not create the workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformModal title="New tenant" onClose={onClose}>
      <p className="text-sm text-slate-600 mb-4">
        Creates the workspace, its admin, and a manually-billed plan. The admin gets an
        email to choose their own password — you never see it.
      </p>

      {error && (
        <div role="alert" className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Field label="Company name">
          <input
            value={companyName}
            onChange={e => onCompanyNameChange(e.target.value)}
            placeholder="Acme Construcciones"
            disabled={submitting}
            className={inputClass}
          />
        </Field>

        <Field
          label="Workspace identifier"
          hint="The customer types this to log in. Lowercase letters, digits and hyphens."
        >
          <input
            value={tenantSlug}
            onChange={e => {
              setSlugTouched(true);
              setTenantSlug(e.target.value);
            }}
            placeholder="acme-construcciones"
            disabled={submitting}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <hr className="border-slate-200" />

        <Field label="Admin full name">
          <input
            value={adminFullName}
            onChange={e => setAdminFullName(e.target.value)}
            placeholder="Ana Admin"
            disabled={submitting}
            className={inputClass}
          />
        </Field>

        <Field label="Admin username">
          <input
            value={adminUsername}
            onChange={e => setAdminUsername(e.target.value)}
            placeholder="ana.admin"
            disabled={submitting}
            className={`${inputClass} font-mono`}
          />
        </Field>

        <Field label="Admin email" hint="Where the set-your-password link goes. Required.">
          <input
            type="email"
            value={adminEmail}
            onChange={e => setAdminEmail(e.target.value)}
            placeholder="ana@acme.example"
            disabled={submitting}
            className={inputClass}
          />
        </Field>

        <hr className="border-slate-200" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <select
              value={planCode}
              onChange={e => setPlanCode(e.target.value as PlanCode)}
              disabled={submitting}
              className={inputClass}
            >
              <option value="PRO">Pro — 15 users, 2 admins</option>
              <option value="BUSINESS">Business — 40 users, unlimited admins</option>
            </select>
          </Field>
          <Field label="Billing interval">
            <select
              value={billingInterval}
              onChange={e => setBillingInterval(e.target.value as BillingInterval)}
              disabled={submitting}
              className={inputClass}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          The plan sets the workspace's user and admin limits. Billing is handled outside the
          product — no card, no Paddle subscription, and Paddle webhooks cannot alter it.
        </p>
      </div>

      <div className="mt-5 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-3 py-1.5 border border-slate-300 rounded text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded text-sm"
        >
          {submitting ? 'Creating…' : 'Create tenant'}
        </button>
      </div>
    </PlatformModal>
  );
}

const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-50';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
