import { Link } from 'react-router';
import { Check, FileClock, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { fmtCents } from '../lib/money';
import type { CreateTenantResponse } from '../types';
import { chipCx, CopyButton, EASE_OUT, microLabelCx, primaryBtnCx, secondaryBtnCx } from './console';

const PLAN_LIMITS: Record<CreateTenantResponse['planCode'], string> = {
  PRO: '15 users · 2 admins',
  BUSINESS: '40 users · Unlimited admins',
};

/**
 * The post-create confirmation card. Split from PlatformTenantCreate so the
 * provider-dependent branches — payment link present / email failed / link
 * minting failed — are unit-testable without driving the whole page's
 * AnimatePresence swap.
 *
 * For a PADDLE tenant this is the one place staff reliably see the checkout
 * link right after creation; the copy button exists because Anderson sends
 * it over WhatsApp too, not just the automatic email.
 */
export function TenantCreatedCard({
  created,
  onCreateAnother,
  onBack,
}: {
  created: CreateTenantResponse;
  onCreateAnother: () => void;
  onBack: () => void;
}) {
  const isPaddle = created.billingProvider === 'PADDLE';

  return (
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
        <span className="font-semibold text-bt-ink">{created.companyName}</span>{' '}
        {isPaddle ? 'was created and is awaiting its first payment.' : 'is up and running.'}
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
          <span className="text-[13px] font-semibold text-bt-ink">
            {isPaddle ? (
              <>
                Paddle — automatic
                {created.customPriceUsdCents != null && (
                  <>
                    {' '}·{' '}
                    <span className="font-bt-mono text-xs">
                      {fmtCents(created.customPriceUsdCents)}/{created.billingInterval === 'MONTHLY' ? 'mo' : 'yr'}
                    </span>
                  </>
                )}
              </>
            ) : (
              'Manual — outside the product'
            )}
          </span>
        </div>
      </div>

      {isPaddle && created.checkoutUrl && (
        <div className="mt-3 w-full rounded-[10px] border border-bt-rule-2 bg-bt-paper px-4 py-3.5">
          <div className={`${microLabelCx} mb-2`}>Payment link</div>
          <div className="flex items-center gap-2.5">
            <span
              className="min-w-0 flex-1 truncate font-bt-mono text-xs font-semibold text-bt-ink"
              title={created.checkoutUrl}
            >
              {created.checkoutUrl}
            </span>
            <CopyButton value={created.checkoutUrl} />
          </div>
          <p className="mt-2 text-xs leading-normal text-bt-muted">
            {created.checkoutLinkEmailSent ? (
              <>
                Also emailed to <span className="font-semibold text-bt-ink">{created.adminEmail}</span>.{' '}
              </>
            ) : (
              <>
                <span className="font-semibold text-[#93640C]">The payment email could not be sent</span> —
                copy the link and send it yourself.{' '}
              </>
            )}
            Access unlocks automatically once Paddle confirms the payment; if nobody pays within
            7 days the workspace is auto-suspended.
          </p>
        </div>
      )}

      {isPaddle && !created.checkoutUrl && (
        <div className="mt-3 flex w-full items-start gap-2 rounded-[10px] border border-[#EEC4B2] bg-[#FAEDE7] px-4 py-3 text-[12.5px] leading-normal text-[#B42318]">
          <TriangleAlert size={14} strokeWidth={2.2} className="mt-0.5 flex-none" />
          <span>
            The workspace was created, but the Paddle checkout link could not be issued
            {created.checkoutError ? (
              <>
                {' '}(<span className="font-bt-mono font-semibold">{created.checkoutError}</span>)
              </>
            ) : null}
            . There is no live payment link yet — issue a new one from the{' '}
            <Link
              to={`/platform/tenants/${created.tenantId}`}
              className="font-semibold underline hover:no-underline"
            >
              tenant page
            </Link>
            .
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-2.5">
        <button type="button" onClick={onCreateAnother} className={secondaryBtnCx}>
          Create another
        </button>
        <button type="button" onClick={onBack} className={primaryBtnCx}>
          Back to tenants
        </button>
      </div>

      <div className="mt-[18px] flex items-center gap-1.5 text-xs text-bt-muted-2">
        <FileClock size={12} strokeWidth={1.8} />
        <span>Recorded in the audit log.</span>
      </div>
    </div>
  );
}
