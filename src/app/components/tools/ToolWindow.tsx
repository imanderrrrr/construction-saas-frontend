import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { getToolHistory, type ToolHistoryEntry, type ToolResponse } from '../../services/warehouse';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, EmptyWord, Mono, PaperNote } from '../projects/bt';
import { actionName, categoryName, CellEmpty, Code, daysSince, isOut, stampDay, StatusChip, WhoCan } from './bits';

/**
 * 03 — the tool's record.
 *
 * It used to live inside the width of one column as an expandable row. The
 * history is what answers the expensive questions — who had it, who reported
 * it, when it went out unsigned — and nine movements with an action, a person,
 * a project, a date and a reason do not fit in 130 px without hiding the
 * reason, which is exactly the datum being looked for.
 *
 * It is the same record for three roles. The admin gets Edit and Fix status;
 * the warehouse would get Assign or Return; the supervisor gets no buttons.
 * The history, the details and the "who has it now" panel are identical.
 */

export function ToolWindow({ open, onOpenChange, tool, lang, keepers, onGoUsers, onEdit, onFixStatus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: ToolResponse | null;
  lang: string;
  /** The company's warehouse users: who can take this tool back. */
  keepers: { id: number; fullName?: string | null; username: string }[];
  /** Only used when there is no warehouse user to name. */
  onGoUsers?: () => void;
  onEdit: () => void;
  onFixStatus: () => void;
}) {
  const { t } = useTranslation(['tools', 'common']);
  const [history, setHistory] = useState<ToolHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const toolId = tool?.id ?? null;

  const load = useCallback(() => {
    if (toolId == null) return;
    setFailed(false);
    getToolHistory(toolId).then(setHistory).catch(() => setFailed(true));
  }, [toolId]);

  useEffect(() => {
    if (!open || toolId == null) return;
    setHistory(null);
    load();
  }, [open, toolId, load]);

  if (!tool) return null;

  const pending = tool.status === 'Pending Acceptance';
  const out = isOut(tool.status);
  const unsigned = pending ? daysSince(tool.lastActivityAt) : null;

  return (
    <BtModal
      open={open}
      onOpenChange={onOpenChange}
      width={1152}
      kicker={t('tools:detail.kicker', { category: categoryName(t, tool.category).toLowerCase() })}
      title={tool.name}
      bodyClassName="px-0 md:px-0 py-0"
      footer={
        <>
          <div className="md:mr-auto flex flex-wrap items-center gap-2.5">
            <Code className="text-[15px] tracking-[0.06em] bg-[#F3EEE4] px-2 py-1">{tool.code}</Code>
            <StatusChip status={tool.status} />
            {pending && unsigned != null && (
              <Mono className="text-[9.5px] tracking-[0.08em] text-[#C2410C]">
                {t('tools:detail.since', { date: stampDay(tool.lastActivityAt, lang), count: unsigned })}
              </Mono>
            )}
          </div>
          <SecondaryButton onClick={onEdit}>{t('tools:action.edit')}</SecondaryButton>
          <PrimaryButton onClick={onFixStatus}>{t('tools:action.fixStatus')}</PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col lg:flex-row">
        {/* The history */}
        <div className="flex-1 min-w-0 px-5 py-5 md:px-[22px]">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <Mono className="text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09]">
              {t('tools:detail.history', { count: history?.length ?? 0 })}
            </Mono>
            <Mono className="text-[9px] tracking-[0.1em] text-[#A69C8D]">{t('tools:detail.history.note')}</Mono>
          </div>

          {history == null && !failed && (
            <div className="pl-[22px] border-l border-[#EDE7DB] space-y-4">
              {[0, 1, 2].map(i => <div key={i} className="space-y-1.5"><Bone className="w-2/3 h-3" /><Bone className="w-1/2 h-[9px]" /></div>)}
            </div>
          )}
          {failed && (
            <PaperNote tone="red">
              <div>{t('tools:error.lead')}</div>
              <button type="button" onClick={load} className="font-bt-mono text-[9.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316] mt-1.5">
                {t('tools:retry')}
              </button>
            </PaperNote>
          )}
          {history != null && history.length === 0 && (
            <EmptyWord word={t('tools:detail.history.empty')} title="" className="border-0 py-8 bg-transparent" />
          )}
          {history != null && history.length > 0 && (
            <ol className="pl-[22px] border-l border-[#EDE7DB]">
              {history.map((h, i) => (
                <li key={h.id} className="relative pb-[18px] last:pb-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute -left-[27px] top-[5px] w-[9px] h-[9px]',
                      i === 0 ? 'bg-[#F97316]' : i === history.length - 1 ? 'border border-[#DBD0BB] bg-white' : 'bg-[#DBD0BB]',
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="text-[9px] font-semibold tracking-[0.11em] bg-[#F3EEE4] text-[#0B0A09] px-1.5 py-[3px]">
                      {actionName(t, h.action)}
                    </Mono>
                    <span className="font-bt-heading font-bold text-[13px] text-[#0B0A09]">
                      {[h.worker, h.project].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1">
                    {[h.worker, h.date, h.time].filter(Boolean).join(' · ')}
                  </Mono>
                  {h.notes && (
                    <p className="text-[12.5px] leading-[1.5] text-[#2E2A24] mt-1.5 whitespace-pre-wrap break-words">{h.notes}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Who has it, and the details */}
        <div className="w-full lg:w-[372px] flex-shrink-0 bg-[#FBF8F2] border-t lg:border-t-0 lg:border-l border-[#EDE7DB] px-5 py-5 md:px-[22px] space-y-5">
          <section>
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] mb-2.5">{t('tools:detail.holder')}</Mono>
            {tool.assignedTo ? (
              <>
                <div className="text-[14px] font-semibold text-[#0B0A09]">{tool.assignedTo}</div>
                {tool.projectName && <Mono className="block text-[9.5px] tracking-[0.08em] text-[#8A8175] mt-1">{tool.projectName}</Mono>}
                {pending && (
                  <>
                    <p className="text-[12.5px] leading-[1.55] text-[#2E2A24] mt-2.5">{t('tools:detail.holder.unsigned')}</p>
                    {unsigned != null && (
                      <Mono className="block text-[9.5px] font-semibold tracking-[0.08em] text-[#C2410C] mt-2">
                        {t('tools:detail.holder.days', { count: unsigned })}
                      </Mono>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="text-[14px] font-semibold text-[#0B0A09]">{t('tools:detail.holder.none')}</div>
                <p className="text-[12.5px] leading-[1.55] text-[#5A5346] mt-1.5">{t('tools:detail.holder.noneBody')}</p>
              </>
            )}
          </section>

          {out && (
            // The tool is on site, not at the counter: this is not cancelled
            // from here, and the window says who can.
            <PaperNote>
              <div className="font-semibold">{t('tools:detail.warehouseSolves')}</div>
              <div className="mt-1.5">{t('tools:detail.warehouseSolves.body')}</div>
              <WhoCan keepers={keepers} onGoUsers={onGoUsers} className="mt-3" />
            </PaperNote>
          )}

          <section>
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] mb-2">{t('tools:detail.data')}</Mono>
            <Row label={t('tools:detail.field.code')}><Code className="text-[12px]">{tool.code}</Code></Row>
            <Row label={t('tools:detail.field.category')}>{categoryName(t, tool.category)}</Row>
            <Row label={t('tools:detail.field.registered')}><Mono className="text-[11.5px] tracking-[0.04em]">{stampDay(tool.dateRegistered, lang)}</Mono></Row>
            <Row label={t('tools:detail.field.project')}>
              {tool.projectName ?? <CellEmpty>{t('tools:row.noProject')}</CellEmpty>}
            </Row>
          </section>

          <section>
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0B0A09] mb-2">{t('tools:detail.notes')}</Mono>
            {tool.notes
              ? <p className="text-[12.5px] leading-[1.55] text-[#2E2A24] whitespace-pre-wrap break-words">{tool.notes}</p>
              : <CellEmpty>{t('tools:row.noNotes')}</CellEmpty>}
          </section>
        </div>
      </div>
    </BtModal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-[8px] border-b border-[#F0EBE1] last:border-b-0">
      <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] flex-shrink-0 pt-[2px]">{label}</Mono>
      <div className="text-[12.5px] leading-[1.45] text-[#0B0A09] text-right min-w-0 break-words">{children}</div>
    </div>
  );
}
