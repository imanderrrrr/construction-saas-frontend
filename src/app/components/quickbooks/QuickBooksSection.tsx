// BuildTrack — QuickBooks Online: the tenant's link to the company that keeps
// its books.
//
// Ported from OFJR's phase 1–3 screens and redrawn in the panel's own
// language. It connects, proves the link works and lets it be undone; under
// the connection, three sections: "Vincular" (phase 2: which record is
// which), "Envíos" (phase 3: invoices and bills going to QuickBooks) and
// "Pagos" (phase 4: their payments, read back from QuickBooks). It says in
// plain words what is sent and what is not. Each constructora connects ITS
// company — the server keys everything by the session's tenant, so this
// screen never mentions one.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link2, RefreshCw, Unplug } from 'lucide-react';
import { Mono } from '../projects/bt';
import { DestroyButton, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { ApiError, NoResponseError } from '../../lib/api';
import { fmtDateTime } from '../../helpers/dateTime';
import {
  disconnectQuickBooks, getQuickBooksStatus, openIntuitConsent, QUICKBOOKS_SUCCESS_OUTCOMES, startQuickBooksConnect,
  testQuickBooksConnection, type QuickBooksMappingTab, type QuickBooksOutcome, type QuickBooksStatus,
} from '../../services/quickbooks';
import { Band, Block, Bones, Explain, Fact, LoadFailed, StateChip, TabButton, Tag, onTabKey } from './bits';
import { QuickBooksMapping } from './QuickBooksMapping';
import { QuickBooksSync } from './QuickBooksSync';
import { QuickBooksPayments } from './QuickBooksPayments';
import { describeError, loadFailureKey } from './errors';

type Busy = 'connect' | 'test' | 'disconnect' | null;
type Section = 'mapping' | 'sync' | 'payments';
const SECTIONS: Section[] = ['mapping', 'sync', 'payments'];
/** Ids that tie each tab to the panel it shows (one section on the page). */
const sectionTabId = (key: Section) => `qb-section-tab-${key}`;
const SECTION_PANEL = 'qb-section-panel';

export function QuickBooksSection({ outcome = null }: {
  /** How the last trip through Intuit ended, read from `?quickbooks=` by the dashboard. */
  outcome?: QuickBooksOutcome | null;
}) {
  const { t, i18n } = useTranslation('quickbooks');
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'es';
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  /** Why the status could not be read, as the key of the band's body; null = read. */
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The arrival banner reports the trip through Intuit; once the admin acts
  // again it is stale (a "connected" banner above a just-disconnected card).
  const [showOutcome, setShowOutcome] = useState(true);
  const [section, setSection] = useState<Section>('mapping');
  // A jump from "Envíos" to the link a document is missing: the tab to open,
  // and a counter that remounts the list so a second jump to the same tab works.
  const [mappingTab, setMappingTab] = useState<QuickBooksMappingTab>('clients');
  const [mappingVisit, setMappingVisit] = useState(0);
  // "Envíos" or "Pagos" stopped because of the link itself (a rejected
  // permission): the card re-reads its state and, while it still reads
  // «Conectado», says so — until a test of the link comes out fine.
  const [stoppedBy, setStoppedBy] = useState<string | null>(null);

  const openMapping = (tab: QuickBooksMappingTab) => {
    setMappingTab(tab);
    setMappingVisit(n => n + 1);
    setSection('mapping');
  };

  // State is only touched after the await: a synchronous set inside the
  // mount effect would cascade a render (react-hooks/set-state-in-effect).
  const load = useCallback(async () => {
    try {
      const next = await getQuickBooksStatus();
      setStatus(next);
      setLoadFailed(null);
    } catch (e) {
      setLoadFailed(loadFailureKey(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onConnectionStop = (code: string) => {
    setStoppedBy(code);
    void load();
  };

  const connect = async () => {
    setBusy('connect');
    setActionError(null);
    setShowOutcome(false);
    try {
      const { authorizationUrl } = await startQuickBooksConnect();
      // The page is leaving for Intuit: stay "busy" so a second click cannot
      // mint a second state while the navigation starts.
      openIntuitConsent(authorizationUrl);
    } catch (e) {
      setBusy(null);
      setActionError(messageOf(e));
    }
  };

  /** No answer in time is not a refusal: the server most likely carried on. */
  const failed = (e: unknown) => {
    if (e instanceof NoResponseError) toast.info(t('stillWorking.status'));
    else setActionError(messageOf(e));
  };

  const test = async () => {
    setBusy('test');
    setActionError(null);
    setShowOutcome(false);
    try {
      const next = await testQuickBooksConnection();
      setStatus(next);
      setStoppedBy(null);
      toast.success(t('toast.tested', { company: next.companyName ?? t('companyUnknown') }));
    } catch (e) {
      // A permission Intuit no longer renews is the card's to explain: the
      // reload turns it into "Hay que reconectar", with the button to do it.
      // A band on top would say the same thing twice, in red.
      if (!(e instanceof ApiError && e.code === 'QUICKBOOKS_NEEDS_RECONNECT')) failed(e);
      void load();
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    setActionError(null);
    setShowOutcome(false);
    try {
      setStatus(await disconnectQuickBooks());
      setConfirmOpen(false);
      toast.success(t('toast.disconnected'));
    } catch (e) {
      failed(e);
      if (e instanceof NoResponseError) {
        // The link is undone here before Intuit is told, so by now it most
        // likely is: say so with the card, not behind the still-open modal.
        setConfirmOpen(false);
        void load();
      }
    } finally {
      setBusy(null);
    }
  };

  const when = (iso: string | null) => (iso ? fmtDateTime(iso, lang) : '—');
  const shownState = status ? (status.configured ? status.state : 'NOT_CONNECTED') : null;

  return (
    <div className="space-y-4 md:space-y-5" data-testid="quickbooks-section">
      {/* Masthead: kicker, display title, one line of intent. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#C2410C]">{t('kicker')}</Mono>
          <h2 className="font-bt-display font-extrabold uppercase text-[30px] md:text-[36px] leading-[0.9] text-[#0A0A0A] mt-1.5">{t('title')}</h2>
          <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-2 max-w-[720px]">{t('lede')}</p>
        </div>
        {/* Without the Intuit keys the environment is only the server's default
            (sandbox): the tag would call a live BuildTrack "pruebas" (audit B14). */}
        {status?.configured && <Tag tone={status.environment === 'PRODUCTION' ? 'orange' : 'sand'}>{t(`env.${status.environment}`)}</Tag>}
      </div>

      {outcome && showOutcome && <OutcomeBand outcome={outcome} />}
      {/* While the disconnect window is open, its failure is said inside it, not behind it. */}
      {actionError && !confirmOpen && <Band tone="danger" title={t('error.generic')} role="alert" testId="quickbooks-action-error">{actionError}</Band>}

      {loadFailed ? (
        <LoadFailed title={t('load.errorTitle')} body={t(loadFailed)} retryLabel={t('retry')} onRetry={() => void load()} testId="quickbooks-load-error" />
      ) : !status || !shownState ? (
        <Block title={t('connection.title')}>
          <Bones widths={['35%', '70%', '55%']} />
        </Block>
      ) : (
        <Block
          title={t('connection.title')}
          hint={t('connection.hint')}
          right={<StateChip state={shownState} label={t(`state.${shownState}`)} />}
          testId="quickbooks-connection"
        >
          <div className="space-y-5 px-4 py-5 md:px-[18px]">
            {!status.configured ? (
              <Explain title={t('notConfigured.title')}>{t('notConfigured.body')}</Explain>
            ) : status.state === 'NOT_CONNECTED' ? (
              <>
                <Explain title={t('notConnected.title')}>{t('notConnected.body')}</Explain>
                {/* Said before the trip, not only after a refusal: an outside
                    accountant with access to several constructoras' books is
                    exactly who picks the wrong one on Intuit's screen. */}
                <p className="text-[12.5px] leading-[1.5] text-[#5A5346]" data-testid="quickbooks-one-company">
                  {t('notConnected.oneCompany')}
                </p>
                {status.environment === 'SANDBOX' && (
                  <Mono className="block text-[9.5px] tracking-[0.06em] text-[#A69C8D] normal-case">{t('notConnected.sandboxHint')}</Mono>
                )}
                <PrimaryButton onClick={connect} disabled={busy !== null} data-testid="quickbooks-connect">
                  <Link2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                  {busy === 'connect' ? t('button.redirecting') : t('button.connect')}
                </PrimaryButton>
              </>
            ) : (
              <>
                {status.state === 'NEEDS_RECONNECT' && (
                  <Band tone="danger" title={t('needsReconnect.title')} role="alert">
                    {t(`error.${status.lastError ?? 'REFRESH_REJECTED'}`, { defaultValue: t('error.generic') })}
                  </Band>
                )}
                {status.state === 'ACTIVE' && status.lastError && (
                  <Band tone="danger" title={t('error.generic')} role="alert">
                    {t(`error.${status.lastError}`, { defaultValue: t('error.generic') })}
                  </Band>
                )}
                {status.state === 'ACTIVE' && stoppedBy && (
                  <Band tone="danger" title={t('stopped.title')} role="alert" testId="quickbooks-stopped">
                    {t(`stopped.${stoppedBy}`, { defaultValue: t('stopped.other') })}
                  </Band>
                )}

                <dl className="grid grid-cols-1 border border-[#EDE7DB] sm:grid-cols-2">
                  <Fact label={t('field.company')} strong>{status.companyName ?? t('companyUnknown')}</Fact>
                  <Fact label={t('field.realm')} mono>{status.realmId ?? '—'}</Fact>
                  <Fact label={t('field.connectedBy')}>{status.connectedBy ?? '—'}</Fact>
                  <Fact label={t('field.connectedAt')}>{when(status.connectedAt)}</Fact>
                  <Fact label={t('field.lastRefreshed')}>{when(status.lastRefreshedAt)}</Fact>
                  <Fact label={t('field.hardExpiry')}>{when(status.refreshTokenHardExpiresAt)}</Fact>
                </dl>

                {status.state === 'ACTIVE' && (
                  <p className="text-[12.5px] leading-[1.5] text-[#8A8175]">{t('active.renewNote')}</p>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {status.state === 'NEEDS_RECONNECT' && status.lastError !== 'ENVIRONMENT_CHANGED' && (
                    <PrimaryButton onClick={connect} disabled={busy !== null}>
                      <Link2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                      {busy === 'connect' ? t('button.redirecting') : t('button.reconnect')}
                    </PrimaryButton>
                  )}
                  {status.state === 'ACTIVE' && (
                    <SecondaryButton onClick={test} disabled={busy !== null}>
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                      {t('button.test')}
                    </SecondaryButton>
                  )}
                  <DestroyButton onClick={() => { setActionError(null); setConfirmOpen(true); }} disabled={busy !== null}>
                    <Unplug className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                    {t('button.disconnect')}
                  </DestroyButton>
                </div>
              </>
            )}
          </div>
        </Block>
      )}

      {status?.configured && status.state === 'ACTIVE' && (
        <>
          <div
            role="tablist"
            aria-label={t('section.label')}
            onKeyDown={e => onTabKey(e, SECTIONS, section, setSection, sectionTabId)}
            className="flex border-b border-[#E7E1D5]"
            data-testid="quickbooks-sections"
          >
            {SECTIONS.map(key => (
              <TabButton key={key} id={sectionTabId(key)} controls={SECTION_PANEL} active={key === section} onClick={() => setSection(key)}>
                {t(`section.${key}`)}
              </TabButton>
            ))}
          </div>
          <div role="tabpanel" id={SECTION_PANEL} aria-labelledby={sectionTabId(section)}>
            {section === 'mapping' && <QuickBooksMapping key={mappingVisit} initialTab={mappingTab} />}
            {section === 'sync' && <QuickBooksSync onOpenMapping={openMapping} onConnectionStop={onConnectionStop} />}
            {section === 'payments' && <QuickBooksPayments onOpenSync={() => setSection('sync')} onConnectionStop={onConnectionStop} />}
          </div>
        </>
      )}

      <Band tone="info" title={t('scope.title')}>{t('scope.body')}</Band>

      <BtModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        kicker={t('disconnect.kicker')}
        kickerTone="red"
        title={t('disconnect.title')}
        closeDisabled={busy === 'disconnect'}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirmOpen(false)} disabled={busy === 'disconnect'}>
              {t('disconnect.cancel')}
            </SecondaryButton>
            <DestroyButton onClick={disconnect} disabled={busy === 'disconnect'}>
              {t('disconnect.confirm')}
            </DestroyButton>
          </>
        }
      >
        {actionError && (
          <div className="mb-4">
            <Band tone="danger" title={t('disconnect.failed')} role="alert" testId="quickbooks-disconnect-error">{actionError}</Band>
          </div>
        )}
        <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A]">{t('disconnect.body')}</p>
        {/* Disconnecting stops the payments read as switching it off does. */}
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#5A5346]">{t('disconnect.payments')}</p>
      </BtModal>
    </div>
  );
}

/** The result of coming back from Intuit, shown once on arrival. */
function OutcomeBand({ outcome }: { outcome: QuickBooksOutcome }) {
  const { t } = useTranslation('quickbooks');
  if (QUICKBOOKS_SUCCESS_OUTCOMES.has(outcome)) {
    return <Band tone="success" title={t('outcome.successTitle')} role="status" testId="quickbooks-outcome">{t(`outcome.${outcome}`)}</Band>;
  }
  return <Band tone="danger" title={t('outcome.errorTitle')} role="alert" testId="quickbooks-outcome">{t(`outcome.${outcome}`)}</Band>;
}

/** The server's sentence, or the panel's when no answer came back — never the browser's (audit B16). */
function messageOf(e: unknown): string {
  return describeError(e);
}
