import { useState } from 'react';

import { PlatformModal } from './PlatformModal';
import { extractMessage } from '../lib/platformError';
import { issueCheckoutLink } from '../services/platformDashboard';
import type { PlatformCheckoutLinkResponse } from '../types';
import { errorBoxCx, primaryBtnCx, secondaryBtnCx, ButtonSpinner } from './console';

/**
 * Confirm-and-issue dialog for a fresh Paddle checkout link. The action has
 * side effects staff should consciously accept — the old link dies, the
 * customer gets a new email, and the 7-day auto-suspension clock restarts —
 * so it is a modal, not a bare button.
 *
 * On success the dialog hands the response up and closes; the caller
 * refreshes the tenant so the billing card shows the new live link.
 */
export function IssueCheckoutLinkDialog({
  tenantId,
  tenantName,
  onClose,
  onIssued,
}: {
  tenantId: number;
  tenantName: string;
  onClose: () => void;
  onIssued: (issued: PlatformCheckoutLinkResponse) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      onIssued(await issueCheckoutLink(tenantId));
    } catch (err) {
      setError(extractMessage(err) ?? 'Could not issue a new checkout link.');
      setSubmitting(false);
    }
  };

  return (
    <PlatformModal title={`Issue new payment link · ${tenantName}`} onClose={onClose}>
      <p className="mt-1.5 text-[13px] leading-normal text-bt-muted">
        Mints a fresh Paddle checkout at the account&apos;s negotiated price and emails it to the
        workspace admin. Any previous link stops working, and the 7-day auto-suspension window
        restarts from now.
      </p>
      {error && (
        <div role="alert" className={`${errorBoxCx} mt-3`}>
          {error}
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" onClick={onClose} disabled={submitting} className={secondaryBtnCx}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={submitting} className={primaryBtnCx}>
          {submitting ? (
            <>
              <ButtonSpinner />
              <span>Issuing…</span>
            </>
          ) : (
            <span>Issue new link</span>
          )}
        </button>
      </div>
    </PlatformModal>
  );
}
