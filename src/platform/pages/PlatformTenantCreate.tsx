import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, ChevronRight, FileClock, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { CreateTenantForm } from '../components/CreateTenantForm';
import type { CreateTenantResponse } from '../types';
import { chipCx, EASE_OUT, pageTitleCx, secondaryBtnCx, primaryBtnCx } from '../components/console';

const PLAN_LIMITS: Record<CreateTenantResponse['planCode'], string> = {
  PRO: '15 users · 2 admins',
  BUSINESS: '40 users · Unlimited admins',
};

/**
 * The "Create new tenant" screen (was a modal; the approved design makes it
 * a dedicated page under /platform/tenants/new). The form itself — rules,
 * payload, service call — lives in CreateTenantForm; this page owns the
 * breadcrumb, the header and the post-create success state.
 */
export function PlatformTenantCreate() {
  const navigate = useNavigate();
  const [created, setCreated] = useState<CreateTenantResponse | null>(null);
  // Re-mounts a pristine form for "Create another".
  const [formKey, setFormKey] = useState(0);

  const backToTenants = () => {
    // Hand the result to the list so it can show its confirmation banner.
    navigate('/platform/tenants', created ? { state: { created } } : undefined);
  };

  return (
    <>
      <nav className="flex items-center gap-1.5 text-[12.5px] font-medium">
        <Link to="/platform/tenants" className="font-semibold text-bt-orange transition-colors hover:text-bt-orange-hover">
          Tenants
        </Link>
        <ChevronRight size={12} strokeWidth={2} className="text-bt-muted-2" />
        <span className="font-semibold text-bt-ink">New tenant</span>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {!created ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            <header className="mt-4">
              <h1 className={pageTitleCx}>Create new tenant</h1>
              <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-bt-muted">
                Creates the workspace, its admin, and a manually-billed plan. The admin gets an
                email to choose their own password — you never see it.
              </p>
              <p className="mt-1.5 text-[12.5px] text-bt-muted-2">All fields are required.</p>
            </header>

            <CreateTenantForm key={formKey} onCreated={setCreated} onCancel={backToTenants} />
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="mx-auto mt-14 max-w-[600px]"
          >
            <div className="flex flex-col items-center rounded-[14px] border border-bt-rule bg-white px-10 py-9 shadow-[0_1px_3px_rgba(23,19,15,0.06)]">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.1 }}
                className="flex size-11 items-center justify-center rounded-full bg-bt-orange shadow-[0_0_0_6px_rgba(249,115,22,0.14)]"
              >
                <Check size={22} strokeWidth={2.5} className="text-white" />
              </motion.div>
              <h2 className="mt-[18px] font-bt-heading text-[19px] font-bold text-bt-ink">Tenant created</h2>
              <p className="mt-2 max-w-[46ch] text-center text-sm leading-relaxed text-bt-muted">
                <span className="font-semibold text-bt-ink">{created.companyName}</span> is up and running.
                {created.setupLinkSent ? (
                  <>
                    {' '}We emailed an invitation to{' '}
                    <span className="font-semibold text-bt-ink">{created.adminEmail}</span> —{' '}
                    {created.adminUsername} will choose their own password from that link. You never see it.
                  </>
                ) : null}
              </p>

              {!created.setupLinkSent && (
                <div className="mt-4 flex w-full items-start gap-2 rounded-[10px] border border-[#EAD8A6] bg-[#F8EED2] px-4 py-3 text-[12.5px] leading-normal text-[#93640C]">
                  <TriangleAlert size={14} strokeWidth={2.2} className="mt-0.5 flex-none" />
                  <span>
                    Heads up: the set-up email to <span className="font-semibold">{created.adminEmail}</span> could
                    not be sent. Ask {created.adminUsername} to use “Forgot password” on the login screen with the
                    identifier <span className="font-bt-mono font-semibold">{created.tenantSlug}</span>.
                  </span>
                </div>
              )}

              <div className="mt-[22px] flex w-full flex-col gap-2 rounded-[10px] border border-bt-rule-2 bg-bt-paper px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-bt-muted">Login identifier</span>
                  <span className={`${chipCx} bg-white`}>{created.tenantSlug}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-bt-muted">Plan</span>
                  <span className="text-[13px] font-semibold text-bt-ink">
                    {created.planCode === 'PRO' ? 'Pro' : 'Business'} ·{' '}
                    {created.billingInterval === 'MONTHLY' ? 'Monthly' : 'Annual'} —{' '}
                    <span className="font-bt-mono text-xs">{PLAN_LIMITS[created.planCode]}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-bt-muted">Billing</span>
                  <span className="text-[13px] font-semibold text-bt-ink">Manual — outside the product</span>
                </div>
              </div>

              <div className="mt-6 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCreated(null);
                    setFormKey(k => k + 1);
                  }}
                  className={secondaryBtnCx}
                >
                  Create another
                </button>
                <button type="button" onClick={backToTenants} className={primaryBtnCx}>
                  Back to tenants
                </button>
              </div>

              <div className="mt-[18px] flex items-center gap-1.5 text-xs text-bt-muted-2">
                <FileClock size={12} strokeWidth={1.8} />
                <span>Recorded in the audit log.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
