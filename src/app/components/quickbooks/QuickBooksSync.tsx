// BuildTrack — QuickBooks phase 3: sending client invoices and bills.
//
// The list comes from the server's own data for THIS tenant; nothing here
// reads QuickBooks. The buttons do reach it: "Enviar" creates, a changed
// document is updated, a deleted one is voided (invoices) or deleted (bills).
// The background sender does the same every few minutes once the admin
// switches it on — off by default, and only from the cut-over date, because
// everything before it was keyed into QuickBooks by hand.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExternalLink, Link2, RotateCcw, Send, SendHorizonal, Undo2, XCircle } from 'lucide-react';
import { cn } from '../ui/utils';
import { INPUT, Mono, MonoSelect } from '../projects/bt';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { fmtDate, fmtDateTime } from '../../helpers/dateTime';
import {
  getQuickBooksSync, sendQuickBooksDocument, sendReadyToQuickBooks, skipQuickBooksDocument, unskipQuickBooksDocument,
  updateQuickBooksSyncSettings, QUICKBOOKS_SYNC_COMPUTED_REASONS,
  type QuickBooksMappingTab, type QuickBooksSyncOverview, type QuickBooksSyncRow, type QuickBooksSyncRunResult,
  type QuickBooksSyncSettings, type QuickBooksSyncState, type QuickBooksSyncStateFilter, type QuickBooksSyncType,
} from '../../services/quickbooks';
import { Band, Block, Bones, LoadFailed, Switch, TabButton, Tag, money } from './bits';

const PAGE_SIZE = 25;

const STATE_FILTERS: QuickBooksSyncStateFilter[] = ['ALL', 'READY', 'BLOCKED', 'FAILED', 'CHANGED', 'SENT', 'SKIPPED', 'CLOSED'];

/** How each state is drawn: the square light and its colour, in the section's grammar. */
const STATE_LIGHT: Record<QuickBooksSyncState, { filled: boolean; color: string; pulse?: boolean }> = {
  READY: { filled: false, color: '#F97316' },
  BLOCKED: { filled: false, color: '#B3402A' },
  FAILED: { filled: true, color: '#B3402A' },
  SENT: { filled: true, color: '#2E7D4F' },
  CHANGED: { filled: false, color: '#C2410C' },
  SKIPPED: { filled: false, color: '#A69C8D' },
  SENDING: { filled: true, color: '#F97316', pulse: true },
  VOIDED: { filled: true, color: '#A69C8D' },
  DELETED: { filled: true, color: '#A69C8D' },
};

export function QuickBooksSync({ onOpenMapping }: {
  /** Takes the admin to the "Vincular" tab that fixes a missing link. */
  onOpenMapping?: (tab: QuickBooksMappingTab) => void;
}) {
  const { t, i18n } = useTranslation('quickbooks');
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'es';
  const [data, setData] = useState<QuickBooksSyncOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<QuickBooksSyncType | 'ALL'>('ALL');
  const [stateFilter, setStateFilter] = useState<QuickBooksSyncStateFilter>('ALL');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<QuickBooksSyncRunResult | null>(null);

  // State is only touched after the await (react-hooks/set-state-in-effect).
  const load = useCallback(async () => {
    try {
      const next = await getQuickBooksSync({ type: typeFilter, state: stateFilter, page, size: PAGE_SIZE });
      setData(next);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [typeFilter, stateFilter, page]);

  useEffect(() => { void load(); }, [load]);

  /**
   * Runs one action, then re-reads the list: a send moves counters, not just
   * one row. A refusal is a toast where the admin is looking: the button is
   * often far down the list, and a band pushed in on top of the section was
   * out of view and slid another row's button under the pointer.
   */
  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
      await load();
    } catch (e) {
      toast.error(t('error.actionFailed'), { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const sendOne = (row: QuickBooksSyncRow) => run(`${row.type}:${row.docId}`, async () => {
    const after = await sendQuickBooksDocument(row.type, row.docId);
    if (after.state === 'SENT' || after.state === 'VOIDED' || after.state === 'DELETED') {
      toast.success(t(`sync.toast.${after.state}`, { number: after.number }));
    }
  });

  const sendAll = () => run('all', async () => {
    const result = await sendReadyToQuickBooks();
    setLastRun(result);
    toast.success(t('sync.toast.run', {
      created: result.created, updated: result.updated, removed: result.voided + result.deleted, failed: result.failed + result.blocked,
    }));
  });

  const when = (iso: string) => fmtDateTime(iso, lang);

  if (loadFailed) {
    return (
      <LoadFailed
        title={t('load.errorTitle')}
        body={t('load.errorBody')}
        retryLabel={t('retry')}
        onRetry={() => void load()}
        testId="quickbooks-sync-load-error"
      />
    );
  }
  if (!data) {
    return (
      <Block title={t('sync.settings.title')}>
        <Bones widths={['40%', '65%']} />
      </Block>
    );
  }

  const { settings, summary } = data;
  const pending = summary.ready + summary.changed;

  return (
    <div className="space-y-4 md:space-y-5" data-testid="quickbooks-sync">
      <SettingsBlock
        settings={settings}
        busy={busy}
        lang={lang}
        onSave={(cutoverDate, autoSend) => run('settings', async () => {
          await updateQuickBooksSyncSettings(cutoverDate, autoSend);
          toast.success(t('sync.settings.saved'));
        })}
        onOpenMapping={onOpenMapping}
        when={when}
      />

      <dl className="grid grid-cols-2 border border-[#E7E1D5] bg-white sm:grid-cols-5" data-testid="quickbooks-sync-counts">
        <Counter value={summary.ready} label={t('sync.count.ready')} />
        <Counter value={summary.blocked} label={t('sync.count.blocked')} alarm />
        <Counter value={summary.failed} label={t('sync.count.failed')} alarm />
        <Counter value={summary.sent} label={t('sync.count.sent')} />
        <Counter value={summary.changed} label={t('sync.count.changed')} />
      </dl>

      {(summary.localPayments ?? 0) > 0 && (
        <Band tone="danger" title={t('payments.local.title')} role="status" testId="quickbooks-sync-local-payments">
          {t('sync.localPayments', { count: summary.localPayments ?? 0 })}
        </Band>
      )}

      {lastRun && (lastRun.stoppedBy || lastRun.remaining > 0) && (
        <Band tone="info" role="status" testId="quickbooks-sync-run">
          {lastRun.stoppedBy
            ? t(`sync.stopped.${lastRun.stoppedBy}`, { defaultValue: t('sync.stopped.other') })
            : t('sync.remaining', { count: lastRun.remaining })}
        </Band>
      )}

      <Block
        title={t('sync.list.title')}
        hint={settings.cutoverDate
          ? t('sync.list.desc', { date: fmtDate(settings.cutoverDate, lang) })
          : t('sync.list.noCutover')}
        right={
          <PrimaryButton onClick={sendAll} disabled={busy !== null || pending === 0 || !settings.cutoverDate} data-testid="quickbooks-send-all">
            <SendHorizonal className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            {busy === 'all' ? t('sync.sending') : t('sync.sendAll', { count: pending })}
          </PrimaryButton>
        }
        testId="quickbooks-sync-list"
      >
        <div className="flex flex-col gap-3 border-b border-[#EDE7DB] px-2 md:flex-row md:items-center md:justify-between md:px-3">
          <div role="tablist" aria-label={t('sync.filter.state')} className="flex flex-wrap">
            {STATE_FILTERS.map(key => (
              <TabButton key={key} active={key === stateFilter} onClick={() => { setStateFilter(key); setPage(0); }}>
                {t(`sync.filter.${key}`)}
              </TabButton>
            ))}
          </div>
          <label className="flex items-center gap-2 px-2 pb-3 md:pb-0">
            <Mono className="text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('sync.filter.type')}</Mono>
            <MonoSelect
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value as QuickBooksSyncType | 'ALL'); setPage(0); }}
              aria-label={t('sync.filter.type')}
            >
              <option value="ALL">{t('sync.filter.typeAll')}</option>
              <option value="INVOICE">{t('sync.filter.typeInvoice')}</option>
              <option value="BILL">{t('sync.filter.typeBill')}</option>
            </MonoSelect>
          </label>
        </div>

        {data.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#A69C8D] md:px-[18px]">
            {settings.cutoverDate ? t('sync.empty') : t('sync.list.noCutover')}
          </p>
        ) : (
          <ul className="divide-y divide-[#EDE7DB]">
            {data.rows.map(row => (
              <SyncRow
                key={`${row.type}:${row.docId}`}
                row={row}
                autoSend={settings.autoSend}
                lang={lang}
                busy={busy === `${row.type}:${row.docId}`}
                disabled={busy !== null}
                when={when}
                onSend={() => void sendOne(row)}
                onSkip={() => void run(`${row.type}:${row.docId}`, () => skipQuickBooksDocument(row.type, row.docId))}
                onUnskip={() => void run(`${row.type}:${row.docId}`, () => unskipQuickBooksDocument(row.type, row.docId))}
                onOpenMapping={onOpenMapping}
              />
            ))}
          </ul>
        )}

        <Pager
          page={data.page}
          pageCount={data.totalPages}
          disabled={busy !== null}
          onPage={setPage}
          label={t('sync.pager', {
            from: data.totalElements === 0 ? 0 : data.page * data.size + 1,
            to: Math.min((data.page + 1) * data.size, data.totalElements),
            total: data.totalElements,
          })}
        />
      </Block>
    </div>
  );
}

// ── Settings: cut-over date and the switch ──────────────────────────────────

function SettingsBlock({ settings, busy, lang, onSave, onOpenMapping, when }: {
  settings: QuickBooksSyncSettings;
  busy: string | null;
  lang: string;
  onSave: (cutoverDate: string | null, autoSend: boolean) => void;
  onOpenMapping?: (tab: QuickBooksMappingTab) => void;
  when: (iso: string) => string;
}) {
  const { t } = useTranslation('quickbooks');
  const [date, setDate] = useState(settings.cutoverDate ?? '');
  const [confirming, setConfirming] = useState(false);

  // A saved date (or one set from another screen) replaces what is typed.
  useEffect(() => { setDate(settings.cutoverDate ?? ''); }, [settings.cutoverDate]);

  const dirty = (date || null) !== settings.cutoverDate;
  const saving = busy === 'settings';

  const toggle = () => {
    if (settings.autoSend) {
      onSave(settings.cutoverDate, false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <Block title={t('sync.settings.title')} hint={t('sync.settings.desc')} testId="quickbooks-sync-settings">
      <div className="space-y-5 px-4 py-5 md:px-[18px]">
        {!settings.preferencesRead && (
          <Band tone="info" role="status" testId="quickbooks-sync-prefs-unread">
            {t('sync.settings.prefsUnread')}
            {onOpenMapping && (
              <>
                {' '}
                <button
                  type="button"
                  className={cn('font-semibold text-[#C2410C] underline underline-offset-2 hover:text-[#F97316]', FOCUS_RING)}
                  onClick={() => onOpenMapping('clients')}
                >
                  {t('sync.settings.goRefresh')}
                </button>
              </>
            )}
          </Band>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <label htmlFor="qb-cutover" className="mb-1.5 block">
              <Mono className="text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('sync.settings.cutover')}</Mono>
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="qb-cutover"
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={cn(INPUT, 'max-w-[200px]')}
              />
              <SecondaryButton
                onClick={() => onSave(date || null, date ? settings.autoSend : false)}
                disabled={!dirty || busy !== null}
              >
                {saving ? t('sync.settings.saving') : t('sync.settings.saveDate')}
              </SecondaryButton>
            </div>
            <p className="mt-2 max-w-[520px] text-[12.5px] leading-[1.5] text-[#5A5346]">{t('sync.settings.cutoverHelp')}</p>
          </div>

          <div>
            <Mono className="mb-1.5 block text-[9.5px] tracking-[0.12em] text-[#8A8175]">{t('sync.settings.auto')}</Mono>
            <div className="flex items-center gap-3">
              <Switch
                on={settings.autoSend}
                label={t('sync.settings.auto')}
                disabled={busy !== null || (!settings.autoSend && !settings.cutoverDate)}
                onToggle={toggle}
              />
              <span className={cn('text-[13.5px] font-semibold', settings.autoSend ? 'text-[#0A0A0A]' : 'text-[#8A8175]')}>
                {settings.autoSend ? t('sync.settings.autoOn', { minutes: settings.autoSendIntervalMinutes }) : t('sync.settings.autoOff')}
              </span>
            </div>
            <p className="mt-2 max-w-[520px] text-[12.5px] leading-[1.5] text-[#5A5346]">
              {!settings.cutoverDate ? t('sync.settings.autoNeedsCutover') : t('sync.settings.autoHelp')}
            </p>
            {settings.autoSendChangedAt && settings.autoSendChangedBy && (
              <Mono className="mt-1.5 block text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">
                {t(settings.autoSend ? 'sync.settings.turnedOn' : 'sync.settings.turnedOff', {
                  who: settings.autoSendChangedBy, when: when(settings.autoSendChangedAt),
                })}
              </Mono>
            )}
            {settings.lastRunAt && (
              <Mono className="mt-1 block text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">
                {t('sync.settings.lastRun', { when: when(settings.lastRunAt) })}
              </Mono>
            )}
          </div>
        </div>
      </div>

      <BtModal
        open={confirming}
        onOpenChange={setConfirming}
        kicker={t('sync.confirm.kicker')}
        title={t('sync.confirm.title')}
        footer={
          <>
            <SecondaryButton onClick={() => setConfirming(false)}>{t('disconnect.cancel')}</SecondaryButton>
            <PrimaryButton onClick={() => { setConfirming(false); onSave(settings.cutoverDate, true); }}>
              {t('sync.confirm.yes')}
            </PrimaryButton>
          </>
        }
      >
        <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A]">
          {/* A count, not a bare number: an interval of one minute reads "Cada minuto", never "Cada 1 minutos". */}
          {t('sync.confirm.body', {
            count: settings.autoSendIntervalMinutes,
            date: settings.cutoverDate ? fmtDate(settings.cutoverDate, lang) : '—',
          })}
        </p>
        <p className="mt-3 text-[12.5px] leading-[1.5] text-[#5A5346]">{t('sync.confirm.note')}</p>
      </BtModal>
    </Block>
  );
}

/** One of the five counters: the figure in display type over its mono label. */
function Counter({ value, label, alarm = false }: { value: number; label: string; alarm?: boolean }) {
  const hot = alarm && value > 0;
  return (
    <div className="border-b border-r border-[#EDE7DB] px-4 py-3 last:border-r-0 sm:border-b-0 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r">
      <dd className={cn('font-bt-display text-[26px] font-extrabold leading-none', hot ? 'text-[#B3402A]' : 'text-[#0A0A0A]')}>{value}</dd>
      <dt className="mt-1.5"><Mono className={cn('text-[9.5px] tracking-[0.12em]', hot ? 'text-[#B3402A]' : 'text-[#8A8175]')}>{label}</Mono></dt>
    </div>
  );
}

function Pager({ page, pageCount, disabled, onPage, label }: {
  page: number; pageCount: number; disabled: boolean; onPage: (page: number) => void; label: string;
}) {
  const { t } = useTranslation('quickbooks');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDE7DB] px-4 py-3 md:px-[18px]">
      <Mono className="text-[9.5px] tracking-[0.1em] text-[#8A8175]">{label}</Mono>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <SecondaryButton onClick={() => onPage(page - 1)} disabled={disabled || page <= 0}>{t('sync.pager.prev')}</SecondaryButton>
          <SecondaryButton onClick={() => onPage(page + 1)} disabled={disabled || page >= pageCount - 1}>{t('sync.pager.next')}</SecondaryButton>
        </div>
      )}
    </div>
  );
}

/** The state of one document: a square light and the word. */
function StateLight({ state, label }: { state: QuickBooksSyncState; label: string }) {
  const light = STATE_LIGHT[state];
  const faint = light.color === '#A69C8D';
  return (
    <span
      className={cn('inline-flex items-center gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap', faint ? 'text-[#8A8175]' : 'text-[#0A0A0A]')}
      data-testid="quickbooks-sync-state"
      data-state={state}
    >
      <span
        aria-hidden="true"
        className={cn('inline-block h-2.5 w-2.5 border', light.pulse && 'animate-pulse')}
        style={{ borderColor: light.color, backgroundColor: light.filled ? light.color : 'transparent' }}
      />
      {label}
    </span>
  );
}

// ── One document ────────────────────────────────────────────────────────────

function SyncRow({ row, autoSend, lang, busy, disabled, when, onSend, onSkip, onUnskip, onOpenMapping }: {
  row: QuickBooksSyncRow;
  autoSend: boolean;
  lang: string;
  busy: boolean;
  disabled: boolean;
  when: (iso: string) => string;
  onSend: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onOpenMapping?: (tab: QuickBooksMappingTab) => void;
}) {
  const { t } = useTranslation('quickbooks');
  const kind = row.type === 'BILL' ? 'BILL' : row.documentType === 'CHANGE_ORDER_REQUEST' ? 'CHANGE_ORDER' : 'INVOICE';
  const trouble = row.state === 'BLOCKED' || row.state === 'FAILED';
  // Blocks worked out on our side (links, tax, discounts) clear on their
  // own once fixed; a refusal from QuickBooks needs "Reintentar".
  const onlyFromQuickBooks = row.reasons.length > 0 && row.reasons.every(r => !QUICKBOOKS_SYNC_COMPUTED_REASONS.has(r));

  let detail: ReactNode = null;
  if (row.state === 'CHANGED') {
    detail = row.deletedHere ? t(`sync.detail.deleted.${row.type}`) : t('sync.detail.changed');
  } else if (row.state === 'READY' && autoSend) {
    detail = t('sync.detail.readyAuto');
  } else if (row.state === 'SKIPPED') {
    detail = t('sync.detail.skipped', { who: row.skippedBy ?? '—' });
  } else if (row.state === 'VOIDED' || row.state === 'DELETED') {
    detail = t(`sync.detail.${row.state}`);
  }

  const actions: ReactNode[] = [];
  const primary = (label: string, Icon: typeof Send) => (
    <PrimaryButton key="send" onClick={onSend} disabled={disabled}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
      {busy ? t('sync.sending') : label}
    </PrimaryButton>
  );
  switch (row.state) {
    case 'READY':
      actions.push(primary(t('sync.action.send'), Send));
      break;
    case 'CHANGED':
      actions.push(primary(row.deletedHere ? t(`sync.action.remove.${row.type}`) : t('sync.action.update'), Send));
      break;
    case 'FAILED':
      actions.push(primary(t('sync.action.retry'), RotateCcw));
      break;
    case 'BLOCKED':
      if (onlyFromQuickBooks) {
        actions.push(primary(t(row.reasons.includes('QBO_DELETED') ? 'sync.action.recreate' : 'sync.action.retry'), RotateCcw));
      }
      break;
    case 'SENT':
      if (row.warning) {
        actions.push(
          <SecondaryButton key="files" onClick={onSend} disabled={disabled}>
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            {t('sync.action.retryFiles')}
          </SecondaryButton>,
        );
      }
      break;
    default:
      break;
  }
  if (onOpenMapping) {
    row.linkTabs.forEach(tab => actions.push(
      <SecondaryButton key={`fix-${tab}`} onClick={() => onOpenMapping(tab)} disabled={disabled}>
        <Link2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
        {t(`sync.fix.${tab}`)}
      </SecondaryButton>,
    ));
  }
  if (row.qboUrl) {
    actions.push(
      <a
        key="open"
        href={row.qboUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center justify-center gap-2 border border-[#DBD0BB] bg-transparent px-3.5 py-2.5 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0A0A0A] transition-colors hover:border-[#F97316] hover:text-[#C2410C]',
          FOCUS_RING,
        )}
      >
        <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
        {t('sync.action.open')}
      </a>,
    );
  }
  if (row.state === 'SKIPPED') {
    actions.push(
      <SecondaryButton key="unskip" onClick={onUnskip} disabled={disabled}>
        <Undo2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
        {t('sync.action.unskip')}
      </SecondaryButton>,
    );
  } else if (!['SENDING', 'VOIDED', 'DELETED'].includes(row.state)) {
    actions.push(
      <TertiaryButton key="skip" onClick={onSkip} disabled={disabled} className="inline-flex items-center gap-1.5 px-1 py-2.5">
        <XCircle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
        {t('sync.action.skip')}
      </TertiaryButton>,
    );
  }

  return (
    <li
      className={cn('flex flex-col gap-3 px-4 py-4 md:px-[18px] lg:flex-row lg:items-start lg:justify-between lg:gap-6', trouble && 'bg-[#FBF8F2]')}
      data-testid="quickbooks-sync-row"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <Tag tone={kind === 'CHANGE_ORDER' ? 'orange' : 'sand'}>{t(`sync.kind.${kind}`)}</Tag>
          <span className="text-[14px] font-semibold text-[#0A0A0A]">{row.number}</span>
          {row.vendorInvoiceNumber && <span className="text-[12px] text-[#A69C8D]">· {row.vendorInvoiceNumber}</span>}
          {row.party && <span className="text-[13px] text-[#5A5346]">· {row.party}</span>}
        </p>
        <p className="text-[12.5px] text-[#8A8175]">
          {[row.projectName, row.date ? fmtDate(row.date, lang) : null].filter(Boolean).join(' · ')}
          {row.amountCents != null && <> · <span className="font-bt-mono text-[12px] tracking-[0.04em] text-[#0A0A0A]">{money(row.amountCents, lang)}</span></>}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <StateLight state={row.state} label={t(`sync.state.${row.state}`)} />
          {row.qboDocNumber && row.state !== 'READY' && (
            <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">{t('sync.qboNumber', { number: row.qboDocNumber })}</Mono>
          )}
        </div>
        {row.reasons.map(reason => (
          <p key={reason} className={cn('text-[13px] leading-[1.5]', trouble ? 'text-[#0A0A0A]' : 'text-[#5A5346]')}>
            {t(`sync.reason.${reason}`, { defaultValue: t('sync.reason.other', { code: reason }) })}
          </p>
        ))}
        {row.errorMessage && (
          <Mono className="block break-words text-[10px] tracking-[0.04em] text-[#8A8175] normal-case">{t('sync.quickbooksSaid', { message: row.errorMessage })}</Mono>
        )}
        {row.state === 'FAILED' && row.nextAttemptAt && (
          <p className="text-[12px] text-[#8A8175]">{t('sync.nextAttempt', { when: when(row.nextAttemptAt) })}</p>
        )}
        {detail && <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{detail}</p>}
        {row.warning && (
          <p className="text-[12.5px] leading-[1.5] text-[#B3402A]">
            {t(`sync.warning.${row.warning}`, { sent: row.attachmentsSent ?? 0, total: row.attachmentsTotal ?? 0 })}
          </p>
        )}
        {(row.localPaymentsCount ?? 0) > 0 && (
          <p className="text-[12.5px] leading-[1.5] text-[#B3402A]" data-testid="quickbooks-sync-row-local-payments">
            {t('sync.localPaymentsRow', { count: row.localPaymentsCount ?? 0 })}{' '}
            <span className="font-bt-mono text-[12px] tracking-[0.04em]">{money(row.localPaymentsCents ?? 0, lang)}</span>
          </p>
        )}
        {!row.warning && row.type === 'BILL' && (row.attachmentsTotal ?? 0) > 0 && row.state === 'SENT' && (
          <p className="text-[12px] text-[#8A8175]">{t('sync.files', { count: row.attachmentsTotal ?? 0 })}</p>
        )}
        {row.sentAt && (
          <Mono className="block text-[9.5px] tracking-[0.08em] text-[#A69C8D] normal-case">
            {t('sync.sentBy', { who: row.sentBy === 'system' ? t('sync.system') : row.sentBy, when: when(row.sentAt) })}
          </Mono>
        )}
      </div>
      {actions.length > 0 && <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:max-w-[440px] lg:justify-end">{actions}</div>}
    </li>
  );
}
