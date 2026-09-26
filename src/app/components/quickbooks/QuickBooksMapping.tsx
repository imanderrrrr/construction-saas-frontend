// BuildTrack — QuickBooks phase 2: what the connected company is, and which of
// the tenant's records are which of its records.
//
// Everything here reads the server's local copy of QuickBooks; only "Refresh
// from QuickBooks" and "Create in QuickBooks" reach Intuit. Reads are metered
// by Intuit — one meter for every constructora on BuildTrack — so the screen
// never lists QuickBooks live, and the refresh answers 429 while the company's
// cooldown runs.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Minus, Plus, RefreshCw, Search, Unlink } from 'lucide-react';
import { cn } from '../ui/utils';
import { INPUT, Mono } from '../projects/bt';
import { PrimaryButton, SecondaryButton, DestroyButton, TertiaryButton } from '../onboarding/chrome';
import { BtModal } from '../bt/windows';
import { ApiError } from '../../lib/api';
import { fmtDateTime } from '../../helpers/dateTime';
import {
  acceptQuickBooksSuggestions, createInQuickBooks, getQuickBooksMappings, linkQuickBooks, QUICKBOOKS_CREATABLE,
  QUICKBOOKS_REFRESH_COOLDOWN_CODE, refreshQuickBooksCompany, searchQuickBooksOptions, unlinkQuickBooks,
  type QuickBooksCompany, type QuickBooksMappingOverview, type QuickBooksMappingRow, type QuickBooksOption,
} from '../../services/quickbooks';
import { Band, Block, Bones, LoadFailed, TabButton, Tag, money } from './bits';

type Tab = 'clients' | 'projects' | 'vendors' | 'categories' | 'invoiceItem';
const TABS: Tab[] = ['clients', 'projects', 'vendors', 'categories', 'invoiceItem'];

/** finance:payable.category.* keys, by PayableCategory. */
const CATEGORY_KEY: Record<string, string> = {
  MATERIALS: 'materials',
  EQUIPMENT_RENTAL: 'equipmentRental',
  SUBCONTRACTOR: 'subcontractor',
  SERVICES: 'services',
  OTHER: 'other',
};

export function QuickBooksMapping() {
  const { t, i18n } = useTranslation(['quickbooks', 'finance']);
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'es';
  const [overview, setOverview] = useState<QuickBooksMappingOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('clients');
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** The per-company brake, when it held a refresh: information, not an error. */
  const [cooldownNotice, setCooldownNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState<QuickBooksMappingRow | null>(null);

  // State is only touched after the await (react-hooks/set-state-in-effect).
  const load = useCallback(async () => {
    try {
      const next = await getQuickBooksMappings();
      setOverview(next);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Runs one action; the server answers every mutation with a fresh overview. */
  const run = async (key: string, action: () => Promise<QuickBooksMappingOverview | void>, success?: string) => {
    setBusy(key);
    setActionError(null);
    setCooldownNotice(null);
    try {
      const next = await action();
      if (next) setOverview(next);
      if (success) toast.success(success);
    } catch (e) {
      // The per-company brake is the system looking after the shared Intuit
      // meter, not something that went wrong: it gets its own calm band that
      // says when, never the red one.
      if (e instanceof ApiError && e.code === QUICKBOOKS_REFRESH_COOLDOWN_CODE) {
        setCooldownNotice(t('quickbooks:company.cooldown', { seconds: e.retryAfterSeconds ?? 60 }));
      } else {
        setActionError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => run('refresh', async () => {
    await refreshQuickBooksCompany();
    return getQuickBooksMappings();
  }, t('quickbooks:company.refreshed'));

  const rows = overview ? overview[tab] : [];
  const suggestions = rows.filter(r => !r.link && r.suggestion).length;

  const label = (row: QuickBooksMappingRow) => {
    if (row.type === 'PAYABLE_CATEGORY') return t(`finance:payable.category.${CATEGORY_KEY[row.localKey] ?? 'other'}`);
    if (row.type === 'INVOICE_ITEM') return t('quickbooks:mapping.invoiceItem.label');
    return row.localLabel;
  };

  if (loadFailed) {
    return (
      <LoadFailed
        title={t('quickbooks:load.errorTitle')}
        body={t('quickbooks:load.errorBody')}
        retryLabel={t('quickbooks:retry')}
        onRetry={() => void load()}
        testId="quickbooks-mapping-load-error"
      />
    );
  }
  if (!overview) {
    return (
      <Block title={t('quickbooks:company.title')}>
        <Bones widths={['30%', '60%']} />
      </Block>
    );
  }

  const company = overview.company;
  const read = company.profileReadAt != null;

  return (
    <div className="space-y-4 md:space-y-5" data-testid="quickbooks-mapping">
      {actionError && <Band tone="danger" title={t('quickbooks:error.generic')} role="alert" testId="quickbooks-mapping-error">{actionError}</Band>}
      {cooldownNotice && <Band tone="info" title={t('quickbooks:company.cooldownTitle')} role="status" testId="quickbooks-cooldown">{cooldownNotice}</Band>}

      <CompanyBlock
        company={company}
        refreshing={busy === 'refresh'}
        disabled={busy !== null}
        onRefresh={refresh}
        when={(iso) => fmtDateTime(iso, lang)}
      />

      <Block
        title={t('quickbooks:mapping.title')}
        hint={t('quickbooks:mapping.desc')}
        right={suggestions > 0 ? (
          <SecondaryButton
            disabled={busy !== null}
            onClick={() => run('accept', async () => (await acceptQuickBooksSuggestions(rows[0]?.type)).overview,
              t('quickbooks:mapping.accepted', { count: suggestions }))}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
            {t('quickbooks:mapping.acceptAll', { count: suggestions })}
          </SecondaryButton>
        ) : undefined}
      >
        <div role="tablist" className="flex flex-wrap border-b border-[#EDE7DB] px-2 md:px-3">
          {TABS.map(key => {
            const list = overview[key];
            const linked = list.filter(r => r.link).length;
            return (
              <TabButton key={key} active={key === tab} onClick={() => setTab(key)}>
                {t(`quickbooks:mapping.tab.${key}`)} <span className="text-[#A69C8D]">{linked}/{list.length}</span>
              </TabButton>
            );
          })}
        </div>

        <div className="px-4 py-4 md:px-[18px]">
          {!read ? (
            <p className="text-[13px] leading-[1.5] text-[#5A5346]">{t('quickbooks:mapping.needsRefresh')}</p>
          ) : (
            <>
              <Mono className="block text-[9.5px] tracking-[0.06em] text-[#8A8175] normal-case mb-3">
                {t(tab === 'projects'
                  ? `quickbooks:mapping.hint.projects.${company.jobTracking === 'PROJECTS' ? 'projects' : 'subCustomers'}`
                  : `quickbooks:mapping.hint.${tab}`)}
              </Mono>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#A69C8D]">{t(`quickbooks:mapping.empty.${tab}`)}</p>
              ) : (
                <ul className="divide-y divide-[#EDE7DB] border border-[#EDE7DB]">
                  {rows.map(row => (
                    <MappingRow
                      key={`${row.type}:${row.localKey}`}
                      row={row}
                      label={label(row)}
                      lang={lang}
                      busy={busy === `${row.type}:${row.localKey}`}
                      disabled={busy !== null}
                      onPick={() => setPicking(row)}
                      onAccept={() => row.suggestion && run(`${row.type}:${row.localKey}`,
                        () => linkQuickBooks(row.type, row.localKey, row.suggestion!.qboId))}
                      onUnlink={() => run(`${row.type}:${row.localKey}`, () => unlinkQuickBooks(row.type, row.localKey))}
                      onCreate={() => run(`${row.type}:${row.localKey}`, () => createInQuickBooks(row.type, row.localKey),
                        t('quickbooks:mapping.created', { name: label(row) }))}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Block>

      {picking && (
        <OptionPicker
          row={picking}
          label={label(picking)}
          onClose={() => setPicking(null)}
          onPick={(option) => {
            const row = picking;
            setPicking(null);
            void run(`${row.type}:${row.localKey}`, () => linkQuickBooks(row.type, row.localKey, option.qboId));
          }}
        />
      )}
    </div>
  );
}

// ── The company card ─────────────────────────────────────────────────────────

function CompanyBlock({ company, refreshing, disabled, onRefresh, when }: {
  company: QuickBooksCompany;
  refreshing: boolean;
  disabled: boolean;
  onRefresh: () => void;
  when: (iso: string) => string;
}) {
  const { t } = useTranslation('quickbooks');
  const read = company.profileReadAt != null;
  return (
    <Block
      title={t('company.title')}
      hint={read && company.directoryRefreshedAt ? t('company.refreshedAt', { when: when(company.directoryRefreshedAt) }) : undefined}
      right={
        <SecondaryButton onClick={onRefresh} disabled={disabled} data-testid="quickbooks-refresh">
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} strokeWidth={2} aria-hidden="true" />
          {refreshing ? t('company.refreshing') : t('company.refresh')}
        </SecondaryButton>
      }
      testId="quickbooks-company"
    >
      <div className="space-y-4 px-4 py-5 md:px-[18px]">
        {!read ? (
          <p className="max-w-[680px] text-[13px] leading-[1.55] text-[#5A5346]">{t('company.unread')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bt-heading font-bold text-[15px] text-[#0A0A0A]">
                {t(`plan.${company.plan ?? 'OTHER'}`, { defaultValue: company.offeringSku ?? t('plan.OTHER') })}
              </span>
              {company.country && <Tag>{company.country}</Tag>}
              {company.homeCurrency && <Tag>{company.homeCurrency}</Tag>}
            </div>
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <Capability on={company.projectsEnabled} label={t('company.cap.projects')} />
              <Capability on={company.expensesByCustomer} label={t('company.cap.expensesByCustomer')} />
              <Capability on={company.classTracking} label={t('company.cap.classes')} />
              <Capability on={company.locationTracking} label={t('company.cap.locations')} />
            </ul>
            <Band tone="info">
              {t(company.jobTracking === 'PROJECTS' ? 'company.jobs.projects' : 'company.jobs.subCustomers')}
              {company.expensesByCustomer === false && <> {t('company.jobs.noExpenseSplit')}</>}
            </Band>
            <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">
              {t('company.counts', {
                customers: company.directoryCounts.CUSTOMER ?? 0,
                vendors: company.directoryCounts.VENDOR ?? 0,
                accounts: company.directoryCounts.ACCOUNT ?? 0,
                items: company.directoryCounts.ITEM ?? 0,
              })}
            </Mono>
          </>
        )}
      </div>
    </Block>
  );
}

function Capability({ on, label }: { on: boolean | null; label: string }) {
  const Icon = on ? Check : Minus;
  return (
    <li className={cn('flex items-center gap-2 text-[13px]', on ? 'text-[#0A0A0A]' : 'text-[#A69C8D]')}>
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', on ? 'text-[#2E7D4F]' : 'text-[#DBD0BB]')} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </li>
  );
}

// ── One row ─────────────────────────────────────────────────────────────────

function MappingRow({ row, label, lang, busy, disabled, onPick, onAccept, onUnlink, onCreate }: {
  row: QuickBooksMappingRow;
  label: string;
  lang: string;
  busy: boolean;
  disabled: boolean;
  onPick: () => void;
  onAccept: () => void;
  onUnlink: () => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('quickbooks');
  let status: ReactNode;
  if (row.link) {
    status = (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[#0A0A0A]">
          <Mono className="text-[9.5px] tracking-[0.08em] text-[#8A8175] mr-1.5">{t('mapping.linkedTo')}</Mono>
          {row.link.qboName ?? row.link.qboId}
        </span>
        {row.link.createdInQbo && <Tag tone="orange">{t('mapping.createdHere')}</Tag>}
        {!row.link.stillActive && <Tag tone="red">{t('mapping.inactiveThere')}</Tag>}
      </span>
    );
  } else if (row.suggestion) {
    status = (
      <span className="text-[#5A5346]">
        <Mono className="text-[9.5px] tracking-[0.08em] text-[#C2410C] mr-1.5">{t('mapping.suggestion')}</Mono>
        <span className="text-[#0A0A0A]">{row.suggestion.fullName ?? row.suggestion.name}</span>
      </span>
    );
  } else {
    status = <Mono className="text-[9.5px] tracking-[0.08em] text-[#A69C8D]">{t('mapping.unlinked')}</Mono>;
  }

  return (
    // Side by side only from lg: next to the sidebar, a narrower screen leaves
    // the name a few letters wide.
    <li className={cn('flex flex-col gap-2 px-3 py-3 md:px-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6', !row.link && 'bg-[#FBF8F2]')}>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13.5px] font-semibold text-[#0A0A0A]">{label}</p>
        {row.type === 'VENDOR' && row.billCount != null ? (
          <Mono className="block mt-0.5 text-[9.5px] tracking-[0.06em] text-[#8A8175] normal-case">
            {t('mapping.bills', { count: row.billCount })} · {money(row.billTotalCents ?? 0, lang)}
          </Mono>
        ) : row.detail ? (
          <Mono className="block mt-0.5 text-[9.5px] tracking-[0.06em] text-[#8A8175] normal-case">{row.detail}</Mono>
        ) : null}
        <p className="mt-1 text-[12.5px]">{status}</p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap gap-2">
        {row.link ? (
          <>
            <SecondaryButton onClick={onPick} disabled={disabled}>
              <Search className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{t('mapping.change')}
            </SecondaryButton>
            <DestroyButton onClick={onUnlink} disabled={disabled}>
              <Unlink className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{t('mapping.unlink')}
            </DestroyButton>
          </>
        ) : (
          <>
            {row.suggestion && (
              <PrimaryButton onClick={onAccept} disabled={disabled}>
                <Check className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />{busy ? t('mapping.working') : t('mapping.accept')}
              </PrimaryButton>
            )}
            <SecondaryButton onClick={onPick} disabled={disabled}>
              <Search className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />{t('mapping.pick')}
            </SecondaryButton>
            {QUICKBOOKS_CREATABLE.has(row.type) && (
              <SecondaryButton onClick={onCreate} disabled={disabled}>
                <Plus className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />{t('mapping.create')}
              </SecondaryButton>
            )}
          </>
        )}
      </div>
    </li>
  );
}

// ── The picker ──────────────────────────────────────────────────────────────

function OptionPicker({ row, label, onClose, onPick }: {
  row: QuickBooksMappingRow;
  label: string;
  onClose: () => void;
  onPick: (option: QuickBooksOption) => void;
}) {
  const { t } = useTranslation('quickbooks');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<QuickBooksOption[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const found = await searchQuickBooksOptions(row.type, query);
        if (!cancelled) { setOptions(found); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [row.type, query]);

  const tag = useMemo(() => (o: QuickBooksOption) => {
    if (o.isProject) return t('picker.project');
    if (o.isSubCustomer) return t('picker.subCustomer');
    return o.accountType ?? null;
  }, [t]);

  return (
    <BtModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      kicker={t('picker.kicker')}
      title={label}
      width={560}
      footer={<TertiaryButton onClick={onClose}>{t('disconnect.cancel')}</TertiaryButton>}
    >
      <label className="block">
        <span className="sr-only">{t('picker.search')}</span>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('picker.search')}
          className={INPUT}
          data-testid="quickbooks-picker-search"
        />
      </label>
      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {failed ? (
          <p className="py-4 text-[13px] text-[#8A8175]">{t('load.errorBody')}</p>
        ) : options == null ? (
          <Bones widths={['70%', '50%']} />
        ) : options.length === 0 ? (
          <p className="py-4 text-[13px] text-[#8A8175]">{t('picker.none')}</p>
        ) : (
          <ul className="divide-y divide-[#EDE7DB] border border-[#EDE7DB]">
            {options.map(o => (
              <li key={o.qboId}>
                <button
                  type="button"
                  onClick={() => onPick(o)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13.5px] text-[#0A0A0A] transition-colors hover:bg-[#FBEDE0] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#F97316] focus-visible:outline-offset-[-2px]"
                >
                  <span className="min-w-0 truncate">{o.fullName ?? o.name}</span>
                  {tag(o) && <Tag>{tag(o)}</Tag>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BtModal>
  );
}
