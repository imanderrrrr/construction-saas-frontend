import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../ui/utils';
import { ApiError } from '../../lib/api';
import { getContractHistory, getFinanceContractHistory } from '../../services/projects';
import { SecondaryButton } from '../onboarding/chrome';
import { EmptyWord, Mono, MonoSelect, stampDate } from '../projects/bt';
import { money, type BudgetRow } from './bits';
import { isContractMovement, toHistoryRow, type HistoryRow } from './history';
import { Amount, LoadFailure, TableSkeleton } from './ui';

/**
 * El historial (Claude Design "Presupuestos BuildTrack", board 07).
 *
 * At content width rather than in a 560 px window: seven rows of dates,
 * amounts and balances do not read inside a dialog. Finance reaches it too —
 * reading the book is how the accounts are squared, and nothing here writes.
 */

const COLS = '96px 1.45fr 1.05fr .95fr 1.15fr 1.5fr';
type TypeFilter = 'all' | 'contract' | 'consumption';

export function HistoryView({ row, readOnly, onBack }: {
  row: BudgetRow;
  readOnly: boolean;
  onBack: () => void;
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const fetch = readOnly ? getFinanceContractHistory : getContractHistory;
      const entries = await fetch(row.id);
      setRows(entries.map(toHistoryRow));
    } catch (err) {
      setRows([]);
      setFailure(err instanceof ApiError ? `${err.status} ${err.code ?? ''}`.trim() : String(err));
    } finally {
      setLoading(false);
    }
  }, [row.id, readOnly]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => rows.filter(entry => {
    if (typeFilter === 'contract') return isContractMovement(entry);
    if (typeFilter === 'consumption') return entry.movement != null && entry.movement.system;
    return true;
  }), [rows, typeFilter]);

  return (
    <div className="space-y-3.5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#8A8175] hover:text-[#C2410C] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.4} />
            {t('admin:budgets.history.back')}
          </button>
          <h2 className="font-bt-display font-extrabold uppercase text-[30px] md:text-[38px] leading-[0.92] text-[#0B0A09] mt-1.5">
            {t('admin:budgets.history.title', { project: row.name })}
          </h2>
          <Mono className="block text-[10px] tracking-[0.1em] text-[#5A5346] mt-2">
            {t('admin:budgets.history.universe', { count: rows.length, balance: money(row.contract) })}
          </Mono>
        </div>
        <MonoSelect
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as TypeFilter)}
          aria-label={t('admin:budgets.history.filter.label')}
        >
          <option value="all">{t('admin:budgets.history.filter.all')}</option>
          <option value="contract">{t('admin:budgets.history.filter.contract')}</option>
          <option value="consumption">{t('admin:budgets.history.filter.consumption')}</option>
        </MonoSelect>
      </div>

      {failure ? (
        <LoadFailure
          title={t('admin:budgets.history.loadError')}
          body={t('admin:budgets.history.loadErrorBody')}
          code={failure}
          onRetry={load}
          secondary={<SecondaryButton onClick={onBack} className="bg-white">{t('admin:budgets.history.back')}</SecondaryButton>}
        />
      ) : (
        <div className="bg-white border border-[#E7E1D5]">
          <div
            className="hidden lg:grid gap-3.5 px-[18px] py-2.5 bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A8175]"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>{t('admin:budgets.history.col.date')}</span>
            <span>{t('admin:budgets.history.col.movement')}</span>
            <span className="text-right">{t('admin:budgets.history.col.amount')}</span>
            <span>{t('admin:budgets.history.col.who')}</span>
            <span className="text-right">{t('admin:budgets.history.col.balance')}</span>
            <span>{t('admin:budgets.history.col.reason')}</span>
          </div>

          {loading ? (
            <TableSkeleton cols={COLS} />
          ) : visible.length === 0 ? (
            <EmptyWord
              word={t('admin:budgets.history.empty.word')}
              title={rows.length === 0 ? t('admin:budgets.history.noEntries') : t('admin:budgets.history.noMatch')}
              hint={rows.length === 0 ? t('admin:budgets.history.noEntriesHint') : undefined}
              className="border-0"
            />
          ) : (
            visible.map(entry => <HistoryLine key={entry.id} entry={entry} lang={lang} />)
          )}
        </div>
      )}
    </div>
  );
}

function HistoryLine({ entry, lang }: { entry: HistoryRow; lang: string }) {
  const { t } = useTranslation('admin');
  const sign = entry.movement?.sign ?? 'both';
  const label = entry.movement
    ? t(`budgets.history.type.${entry.movement.key}`)
    : entry.rawType;
  return (
    <div
      className="grid gap-3.5 items-baseline px-[18px] py-[11px] border-b border-[#F0EBE1] last:border-b-0 lg:[grid-template-columns:var(--bt-cols)] grid-cols-2"
      style={{ '--bt-cols': COLS } as React.CSSProperties}
    >
      <Mono className="text-[10px] tracking-[0.06em] text-[#8A8175] normal-case">{stampDate(entry.date, lang)}</Mono>
      <span className="text-[13px] font-medium text-[#0B0A09]">{label}</span>
      <Amount tone={sign === 'down' ? 'red' : sign === 'up' ? 'green' : 'ink'}>
        {sign === 'base' ? money(entry.amount) : `${entry.amount < 0 ? '' : '+'}${money(entry.amount)}`}
      </Amount>
      {/* The author is not in `contract_history` yet. The movements the system
          writes are still knowable from their type; the rest say so rather
          than repeating the hardcoded "admin" this screen used to print. */}
      <Mono className={cn('text-[9.5px] tracking-[0.08em]', entry.movement?.system ? 'text-[#5A5346]' : 'text-[#A69C8D]')}>
        {t(entry.movement?.system ? 'budgets.history.author.system' : 'budgets.history.author.unknown')}
      </Mono>
      <Mono className="text-[10.5px] text-right tabular-nums text-[#8A8175] normal-case">
        {money(entry.before)} → <span className="font-semibold text-[#0B0A09]">{money(entry.after)}</span>
      </Mono>
      <span className="text-[12px] leading-[1.45] text-[#5A5346] col-span-2 lg:col-span-1">{entry.reason}</span>
    </div>
  );
}
