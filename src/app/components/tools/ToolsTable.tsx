import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING, SecondaryButton } from '../onboarding/chrome';
import { Bone, CreateButton, EmptyWord, Mono } from '../projects/bt';
import type { ToolResponse } from '../../services/warehouse';
import {
  CellEmpty, Code, categoryName, daysSince, stampDay, stampMoment, stampTime, STATUS_EDGE, StatusChip,
} from './bits';

/**
 * 01 / 02 — the returnables table and its five states.
 *
 * The row's left edge carries the tool's state, and the "pending acceptance"
 * row sits on a paler ground: it is the one that asks for something. Whole
 * rows are clickable and open the record.
 */

export type TableState = 'loading' | 'data' | 'empty' | 'noMatch' | 'error' | 'forbidden';

const GRID = 'grid grid-cols-[96px_1fr_132px_176px_168px_150px_128px] gap-3 items-center';
const GRID_MD = 'grid grid-cols-[88px_1fr_168px_150px_116px] gap-3 items-center';

export function ToolsTable({ state, tools, lang, filterCount, totalTools, flashId, onOpen, onRegister, onRetry, onClearFilters, onGoConsumables }: {
  state: TableState;
  tools: ToolResponse[];
  lang: string;
  filterCount: number;
  /** Tools in the whole company, for the "there are N but none match" line. */
  totalTools: number | null;
  /** Just registered or just fixed: two seconds of paper and orange edge. */
  flashId: number | null;
  onOpen: (tool: ToolResponse) => void;
  onRegister: () => void;
  onRetry: () => void;
  onClearFilters: () => void;
  onGoConsumables: () => void;
}) {
  const { t } = useTranslation(['tools', 'common']);

  if (state === 'forbidden') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord word={t('tools:forbidden.word')} title={t('tools:forbidden.lead')} hint={t('tools:forbidden.body')} className="border-0 py-[76px]" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          tone="red"
          word={t('tools:error.word')}
          title={t('tools:error.lead')}
          hint={t('tools:error.body')}
          className="border-0"
          action={<SecondaryButton onClick={onRetry} className="bg-[#FAF7F0]">{t('tools:retry')}</SecondaryButton>}
        />
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tools:empty.none.word')}
          title={t('tools:empty.none.lead')}
          hint={t('tools:empty.none.body')}
          className="border-0 py-[76px]"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <CreateButton onClick={onRegister}><Plus className="w-3.5 h-3.5" strokeWidth={2.4} />{t('tools:action.register')}</CreateButton>
              <SecondaryButton onClick={onGoConsumables} className="bg-[#FAF7F0]">{t('tools:tab.consumable')}</SecondaryButton>
            </div>
          }
        />
      </div>
    );
  }
  if (state === 'noMatch') {
    return (
      <div className="bg-white border border-[#E7E1D5]">
        <EmptyWord
          word={t('tools:empty.filters.word')}
          title={totalTools != null ? t('tools:empty.filters.lead', { count: totalTools, conditions: t('tools:filter.conditions', { count: filterCount }) }) : t('tools:empty.filters.word')}
          className="border-0"
          action={<SecondaryButton onClick={onClearFilters} className="bg-[#FAF7F0]">{t('tools:filter.clear', { count: filterCount })}</SecondaryButton>}
        />
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E1D5]" data-testid="tools-table" data-tour="sec.tool-inventory.table">
      <div className={cn(GRID, 'hidden xl:grid px-4 h-7 items-center bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.13em] text-[#A69C8D]')}>
        <span>{t('tools:table.code')}</span>
        <span>{t('tools:table.tool')}</span>
        <span>{t('tools:table.category')}</span>
        <span>{t('tools:table.status')}</span>
        <span>{t('tools:table.holder')}</span>
        <span>{t('tools:table.project')}</span>
        <span>{t('tools:table.lastActivity')}</span>
      </div>
      <div className={cn(GRID_MD, 'hidden md:grid xl:hidden px-4 h-7 items-center bg-[#FBF8F2] border-b border-[#EDE7DB] font-bt-mono text-[9px] uppercase tracking-[0.13em] text-[#A69C8D]')}>
        <span>{t('tools:table.code')}</span>
        <span>{t('tools:table.tool')}</span>
        <span>{t('tools:table.status')}</span>
        <span>{t('tools:table.holder')}</span>
        <span>{t('tools:table.lastActivity')}</span>
      </div>

      {state === 'loading' && Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-[#F0EBE1] space-y-2">
          <Bone className="w-[35%] h-3" /><Bone className="w-[20%] h-[9px]" />
        </div>
      ))}

      {state === 'data' && tools.map(tool => (
        <ToolRow key={tool.id} tool={tool} lang={lang} flash={tool.id === flashId} onOpen={() => onOpen(tool)} />
      ))}
    </div>
  );
}

function ToolRow({ tool, lang, flash, onOpen }: { tool: ToolResponse; lang: string; flash: boolean; onOpen: () => void }) {
  const { t } = useTranslation(['tools']);
  const pending = tool.status === 'Pending Acceptance';
  const unsignedDays = pending ? daysSince(tool.lastActivityAt) : null;

  // The second line says what happened last, in the words of what happened:
  // "out since the 5th · 2 days unsigned" is not the same sentence as
  // "returned on the 5th · good".
  const subline = pending
    ? (unsignedDays != null && unsignedDays > 0
      ? t('tools:row.unsigned', { date: stampDay(tool.lastActivityAt, lang), count: unsignedDays })
      : t('tools:row.unsignedToday', { time: stampTime(tool.lastActivityAt, lang) }))
    : null;

  const holder = tool.assignedTo
    ? (tool.status === 'Lost' ? t('tools:row.lastHolder', { name: tool.assignedTo }) : tool.assignedTo)
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`tool-row-${tool.id}`}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
      className={cn(
        'border-b border-[#F0EBE1] border-l-[3px] cursor-pointer transition-colors px-4 py-2 min-h-[56px] md:min-h-[48px]',
        pending ? 'bg-[#FFFDFA]' : tool.status === 'Lost' ? 'bg-[#FBF8F2]' : 'bg-white',
        'hover:bg-[#FBF8F2]',
        flash && 'bt-row-flash',
        FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
      )}
      style={{ borderLeftColor: STATUS_EDGE[tool.status] ?? '#CDBFA6' }}
    >
      {/* Desktop */}
      <div className={cn(GRID, 'hidden xl:grid')}>
        <Code className="text-[11px] truncate">{tool.code}</Code>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#0B0A09] truncate leading-[1.25]">{tool.name}</div>
          {subline && <Mono className="block text-[9px] tracking-[0.09em] text-[#C2410C] mt-[2px] truncate">{subline}</Mono>}
        </div>
        <Mono className="text-[9.5px] tracking-[0.06em] text-[#5A5346] truncate">{categoryName(t, tool.category)}</Mono>
        <div><StatusChip status={tool.status} /></div>
        {holder
          ? <span className="text-[12.5px] text-[#0B0A09] truncate">{holder}</span>
          : <CellEmpty>{tool.status === 'Available' ? t('tools:row.inWarehouse') : t('tools:row.nobody')}</CellEmpty>}
        {tool.projectName
          ? <span className="text-[12px] text-[#5A5346] truncate">{tool.projectName}</span>
          : <CellEmpty>{t('tools:row.noProject')}</CellEmpty>}
        <Mono className="text-[10px] tracking-[0.06em] text-[#5A5346] truncate">
          {stampMoment(tool.lastActivityAt ?? tool.lastActivity, lang, t('tools:row.todayWord'))}
        </Mono>
      </div>

      {/* Tablet: the category drops into the subline, the holder keeps the name */}
      <div className={cn(GRID_MD, 'hidden md:grid xl:hidden')}>
        <Code className="text-[11px] truncate">{tool.code}</Code>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[#0B0A09] truncate">{tool.name}</div>
          <Mono className="block text-[9px] tracking-[0.09em] text-[#A69C8D] mt-[2px] truncate">
            {[categoryName(t, tool.category), tool.projectName].filter(Boolean).join(' · ')}
          </Mono>
        </div>
        <div><StatusChip status={tool.status} short /></div>
        {holder ? <span className="text-[12.5px] text-[#0B0A09] truncate">{holder}</span> : <CellEmpty>{tool.status === 'Available' ? t('tools:row.inWarehouse') : t('tools:row.nobody')}</CellEmpty>}
        <Mono className="text-[10px] tracking-[0.06em] text-[#5A5346] truncate">{stampDay(tool.lastActivityAt ?? tool.lastActivity, lang)}</Mono>
      </div>

      {/* Phone: a card */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <Code className="text-[11px]">{tool.code}</Code>
          <StatusChip status={tool.status} short />
        </div>
        <div className="text-[14.5px] font-semibold text-[#0B0A09] mt-1 leading-[1.3]">{tool.name}</div>
        <Mono className="block text-[9px] tracking-[0.09em] text-[#A69C8D] mt-1">
          {subline ?? [categoryName(t, tool.category), stampDay(tool.lastActivityAt ?? tool.lastActivity, lang)].filter(Boolean).join(' · ')}
        </Mono>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[12px] text-[#0B0A09] truncate flex-1 min-w-0">
            {holder ?? (tool.status === 'Available' ? t('tools:row.inWarehouse') : t('tools:row.nobody'))}
          </span>
          {tool.projectName && <Mono className="text-[9px] tracking-[0.06em] text-[#A69C8D] truncate">{tool.projectName}</Mono>}
        </div>
      </div>
    </div>
  );
}
