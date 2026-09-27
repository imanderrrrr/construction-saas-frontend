// BuildTrack — QuickBooks phase 4: payments read back from the tenant's
// QuickBooks.
//
// Once the constructora switches it on, the payments of every document it sent
// to QuickBooks are recorded THERE — it is tied to the bank — and read back
// here: what each document and each jobsite shows as paid is QuickBooks'. The
// switch, the reads and the notices are this tenant's alone. Reads are
// metered (one meter for every constructora on BuildTrack's Intuit app), so
// nothing here reads QuickBooks on page load; "Actualizar pagos" spends one.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, Send } from 'lucide-react';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { fmtDate, fmtDateTime } from '../../helpers/dateTime';
import { ApiError, NoResponseError } from '../../lib/api';
import { paymentMethodLabel } from '../PayableCommon';
import {
  getQuickBooksPayments, refreshQuickBooksPayments, updateQuickBooksPaymentsSettings,
  type QuickBooksPaymentRead, type QuickBooksPaymentsStatus,
} from '../../services/quickbooks';
import { Band, Block, Bones, Fact, LoadFailed, Switch, Tag, money } from './bits';
import { connectionStop, describeError, loadFailureKey } from './errors';

export function QuickBooksPayments({ onOpenSync, onConnectionStop }: {
  /** Takes the admin to "Envíos", where each document with a local payment is flagged. */
  onOpenSync?: () => void;
  /** A read stopped because of the link itself: the connection card re-reads it. */
  onConnectionStop?: (code: string) => void;
}) {
  const { t, i18n } = useTranslation('quickbooks');
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'es';
  const [status, setStatus] = useState<QuickBooksPaymentsStatus | null>(null);
  /** Why the status could not be read, as the key of the band's body; null = read. */
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<'settings' | 'refresh' | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Switching off is asked too: what stays counted afterwards is not obvious
  // (QuickBooks' figures and payments stay; new payments are registered here).
  const [confirmingOff, setConfirmingOff] = useState(false);

  // State is only touched in the promise's callbacks, never synchronously in
  // the mount effect (react-hooks/set-state-in-effect).
  const load = useCallback(() => getQuickBooksPayments()
    .then(next => { setStatus(next); setLoadFailed(null); })
    .catch((e: unknown) => { setLoadFailed(loadFailureKey(e)); }), []);

  useEffect(() => { void load(); }, [load]);

  /** Tells the connection card when QuickBooks stopped a read because of the link. */
  const noticeStop = (failure: unknown) => {
    const code = connectionStop(failure);
    if (code) onConnectionStop?.(code);
  };

  const when = (iso: string) => fmtDateTime(iso, lang);
  const errorText = (code: string) => t(`payments.error.${code}`, { defaultValue: t('payments.error.other') });

  // A refusal is a toast where the admin is looking, never a band pushed in
  // on top of the section (the same rule as "Vincular" and "Envíos"). Without
  // the server's answer the status is re-read: switching on commits first and
  // then reads everything, so a switch that got no answer in time is most
  // likely on and still reading — not a failure to report. A permission
  // Intuit no longer renews is the connection card's to explain (it re-reads
  // and offers the reconnect); anything else is said here.
  const failed = async (e: unknown) => {
    noticeStop(e);
    if (e instanceof NoResponseError) {
      toast.info(t('stillWorking.payments'));
    } else if (e instanceof ApiError && e.code === 'QUICKBOOKS_PAYMENTS_COOLDOWN') {
      // Not a failure: the brake on "Actualizar pagos" (audit B8), with the
      // wait the server said.
      toast.info(t('payments.cooldown', { seconds: e.retryAfterSeconds ?? 60 }));
    } else if (!(onConnectionStop && e instanceof ApiError && e.code === 'QUICKBOOKS_NEEDS_RECONNECT')) {
      toast.error(t('error.actionFailed'), { description: describeError(e) });
    }
    await load();
  };

  const setEnabled = async (enabled: boolean) => {
    setBusy('settings');
    try {
      const next = await updateQuickBooksPaymentsSettings(enabled);
      setStatus(next);
      toast.success(t(enabled ? 'payments.toast.on' : 'payments.toast.off'));
      // Switching on reads everything at once; that read may stop on the link.
      noticeStop(next.lastError);
    } catch (e) {
      await failed(e);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    try {
      const { result, status: next } = await refreshQuickBooksPayments();
      setStatus(next);
      if (result.stoppedBy) {
        noticeStop(result.stoppedBy);
        toast.error(t('payments.toast.stopped'), { description: errorText(result.stoppedBy) });
      } else {
        toast.success(t('payments.toast.read', { count: result.documentsUpdated }));
      }
    } catch (e) {
      await failed(e);
    } finally {
      setBusy(null);
    }
  };

  if (loadFailed) {
    return (
      <LoadFailed
        title={t('load.errorTitle')}
        body={t(loadFailed)}
        retryLabel={t('retry')}
        onRetry={() => void load()}
        testId="quickbooks-payments-load-error"
      />
    );
  }
  if (!status) {
    return (
      <Block title={t('payments.title')}>
        <Bones widths={['40%', '65%']} />
      </Block>
    );
  }

  const reading = busy === 'refresh' || status.running;

  return (
    <div className="space-y-4 md:space-y-5" data-testid="quickbooks-payments">
      <Block
        title={t('payments.title')}
        hint={t('payments.desc')}
        right={
          <PrimaryButton
            onClick={() => void refresh()}
            disabled={!status.enabled || busy !== null || status.running}
            data-testid="quickbooks-payments-refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', reading && 'animate-spin')} strokeWidth={2} aria-hidden="true" />
            {reading ? t('payments.refreshing') : t('payments.refresh')}
          </PrimaryButton>
        }
        testId="quickbooks-payments-settings"
      >
        <div className="space-y-5 px-4 py-5 md:px-[18px]">
          <div>
            <Mono className="mb-1.5 block text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('payments.switch')}</Mono>
            <div className="flex items-center gap-3">
              <Switch
                on={status.enabled}
                label={t('payments.switch')}
                disabled={busy !== null}
                onToggle={() => (status.enabled ? setConfirmingOff(true) : setConfirming(true))}
              />
              <span className={cn('text-[13.5px] font-semibold', status.enabled ? 'text-[#0A0A0A]' : 'text-[#8A8175]')}>
                {status.enabled ? t('payments.on', { minutes: status.intervalMinutes }) : t('payments.off')}
              </span>
            </div>
            <p className="mt-2 max-w-[640px] text-[12.5px] leading-[1.5] text-[#5A5346]">{t('payments.help')}</p>
            {status.changedAt && status.changedBy && (
              <Mono className="mt-1.5 block text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">
                {t(status.enabled ? 'payments.turnedOn' : 'payments.turnedOff', { who: status.changedBy, when: when(status.changedAt) })}
              </Mono>
            )}
          </div>

          <dl className="grid grid-cols-1 border border-[#EDE7DB] sm:grid-cols-2">
            <Fact label={t('payments.lastRead')}>{status.readAt ? when(status.readAt) : t('payments.never')}</Fact>
            <Fact label={t('payments.nextRead')}>
              {!status.enabled ? '—' : status.cursor ? t('payments.nextCdc') : t('payments.nextFull')}
            </Fact>
          </dl>

          {status.lastError && (
            <p className="flex items-start gap-2 text-[13px] leading-[1.5] text-[#B3402A]" role="status" data-testid="quickbooks-payments-last-error">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.9} aria-hidden="true" />
              <span>{errorText(status.lastError)}</span>
            </p>
          )}
        </div>
      </Block>

      {status.enabled && status.localPaymentsDocuments > 0 && (
        <Band tone="danger" title={t('payments.local.title')} role="status" testId="quickbooks-payments-local">
          {t('payments.local.body', { count: status.localPaymentsDocuments, amount: money(status.localPaymentsCents) })}
          {onOpenSync && (
            <div className="mt-2.5">
              <SecondaryButton onClick={onOpenSync}>
                <Send className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                {t('payments.local.open')}
              </SecondaryButton>
            </div>
          )}
        </Band>
      )}

      <WebhookBlock status={status} when={when} />

      <Block title={t('payments.recent.title')} hint={t('payments.recent.desc')} testId="quickbooks-payments-recent">
        {status.recent.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#A69C8D] md:px-[18px]">{t('payments.recent.empty')}</p>
        ) : (
          <ul className="divide-y divide-[#EDE7DB]">
            {status.recent.map(p => (
              <RecentPayment key={`${p.type}:${p.docId}:${p.qboPaymentId}`} payment={p} lang={lang} when={when} />
            ))}
          </ul>
        )}
      </Block>

      <BtModal
        open={confirming}
        onOpenChange={setConfirming}
        kicker={t('payments.confirm.kicker')}
        title={t('payments.confirm.title')}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirming(false)}>{t('disconnect.cancel')}</SecondaryButton>
            <PrimaryButton onClick={() => { setConfirming(false); void setEnabled(true); }}>
              {t('payments.confirm.yes')}
            </PrimaryButton>
          </>
        }
      >
        <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A]">{t('payments.confirm.body')}</p>
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#5A5346]">{t('payments.confirm.note')}</p>
      </BtModal>

      <BtModal
        open={confirmingOff}
        onOpenChange={setConfirmingOff}
        kicker={t('payments.confirmOff.kicker')}
        title={t('payments.confirmOff.title')}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirmingOff(false)}>{t('disconnect.cancel')}</SecondaryButton>
            <PrimaryButton onClick={() => { setConfirmingOff(false); void setEnabled(false); }}>
              {t('payments.confirmOff.yes')}
            </PrimaryButton>
          </>
        }
      >
        <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A]">{t('payments.confirmOff.body')}</p>
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#5A5346]">{t('payments.confirmOff.note')}</p>
      </BtModal>
    </div>
  );
}

/**
 * Whether Intuit's change notices reach BuildTrack for this company. They are
 * set up once for the whole platform, not per constructora, so the tenant's
 * admin is told what it means — never asked to paste anything into Intuit.
 */
function WebhookBlock({ status, when }: { status: QuickBooksPaymentsStatus; when: (iso: string) => string }) {
  const { t } = useTranslation('quickbooks');
  const { webhook } = status;
  return (
    <Block
      title={t('payments.webhook.title')}
      right={<Tag tone={webhook.configured ? 'orange' : 'sand'}>{webhook.configured ? t('payments.webhook.on') : t('payments.webhook.off')}</Tag>}
      testId="quickbooks-payments-webhook"
    >
      <div className="space-y-4 px-4 py-5 md:px-[18px]">
        <Band tone="info">
          {/* A count: a one-minute interval reads "cada minuto", never "cada 1 minutos" (audit B15). */}
          {webhook.configured
            ? t('payments.webhook.onHelp', { count: status.intervalMinutes })
            : t('payments.webhook.offHelp', { count: status.intervalMinutes })}
        </Band>
        {webhook.configured && (
          <dl className="grid grid-cols-1 border border-[#EDE7DB] sm:grid-cols-2">
            <Fact label={t('payments.webhook.lastEvent')}>{webhook.lastEventAt ? when(webhook.lastEventAt) : t('payments.never')}</Fact>
            <Fact label={t('payments.webhook.pendingLabel')}>{t('payments.webhook.pending', { count: webhook.pendingEvents })}</Fact>
          </dl>
        )}
      </div>
    </Block>
  );
}

function RecentPayment({ payment: p, lang, when }: { payment: QuickBooksPaymentRead; lang: string; when: (iso: string) => string }) {
  const { t } = useTranslation('quickbooks');
  const { t: tf } = useTranslation('finance');
  return (
    <li className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-6 md:px-[18px]" data-testid="quickbooks-payment-read">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <Tag>{t(`payments.kind.${p.type}`)}</Tag>
          <span className="text-[14px] font-semibold text-[#0A0A0A]">{p.number}</span>
          {p.party && <span className="text-[13px] text-[#5A5346]">· {p.party}</span>}
        </p>
        <p className="text-[12.5px] text-[#8A8175]">
          {[fmtDate(p.date, lang), paymentMethodLabel(p.method, tf), p.reference].filter(Boolean).join(' · ')}
        </p>
        <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">
          {t('payments.recent.qboId', { id: p.qboPaymentId })} · {when(p.readAt)}
        </Mono>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        {p.voided && <Tag tone="red">{t('payments.recent.voided')}</Tag>}
        <Amount voided={p.voided}>{money(p.amountCents)}</Amount>
      </div>
    </li>
  );
}

function Amount({ voided, children }: { voided: boolean; children: ReactNode }) {
  return (
    <span className={cn('font-bt-mono text-[14px] font-semibold tracking-[0.02em] tabular-nums', voided ? 'text-[#8A8175] line-through' : 'text-[#0A0A0A]')}>
      {children}
    </span>
  );
}
