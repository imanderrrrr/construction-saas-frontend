import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../ui/utils';
import { useTourScopeWhileMounted } from '../../lib/tourScope';
import {
  isPayable, listInvoices, updateJobStatus,
  type JobStatus, type SubcontractorInvoiceDTO, type SubcontractorJobDTO,
} from '../../services/subcontractors';
import { DarkButton, FichaTabs, Panel, Row, type FichaTabDef } from '../projects/ficha/panel';
import { FOCUS_RING, InkBar, PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Bone, Mono, PaperNote, stampDay } from '../projects/bt';
import { CellEmpty, fmtMoney, JobStatusChip, OverdueStamp, softDate } from './bits';
import { JobNotes } from './JobNotes';
import { JobEvidence } from './JobEvidence';
import { JobTimeline } from './JobTimeline';

/**
 * 04 — the job detail, as a page.
 *
 * It used to replace the list without changing the URL: reloading sent you
 * back to the start and there was no way to hand a job to anyone. It is now
 * built like the jobsite and client fichas — breadcrumb, ink bar, money strip,
 * three tabs.
 *
 * The two decisions of the day are buttons on the bar, because approving and
 * sending back are 90 % of what anyone does with a job in review. The free
 * jump sits behind "Cambiar estado" with its warning: six identical buttons
 * made approving a job and reopening a closed one cost exactly one click each,
 * and neither explained its consequence.
 */

export type JobFichaTab = 'notes' | 'evidence' | 'history';

export function JobFicha({ job, onBack, onChangeStatus, onJobChanged, onOpenInvoice }: {
  job: SubcontractorJobDTO;
  onBack: () => void;
  /**
   * Opens the status window (07). A preset is the bar's "Devolver con
   * observación": the same window, already aimed at Observado, where the
   * comment is what the subcontractor will read in their app.
   */
  onChangeStatus: (preset?: JobStatus) => void;
  /** The job moved: the parent refreshes the list, the figures and this page. */
  onJobChanged: (job: SubcontractorJobDTO) => void;
  onOpenInvoice: (invoice: SubcontractorInvoiceDTO) => void;
}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;
  const [tab, setTab] = useState<JobFichaTab>('notes');
  const [busy, setBusy] = useState<'approve' | null>(null);
  const [actionError, setActionError] = useState(false);
  const [noteCount, setNoteCount] = useState<number | null>(job.observationCount);
  const [evidenceCount, setEvidenceCount] = useState<number | null>(job.evidenceCount);

  // This page claims the tour while it is on screen (lib/tourScope).
  useTourScopeWhileMounted('subcontractors-ficha', t('subcontractors:ficha.tourLabel'));

  // The money strip: what was agreed, plus this job's own invoices.
  const [invoices, setInvoices] = useState<SubcontractorInvoiceDTO[] | null>(null);
  const loadInvoices = useCallback(() => {
    listInvoices({ subcontractorId: job.subcontractorId, size: 100 })
      .then(page => setInvoices(page.content.filter(i => i.jobId === job.id)))
      // The strip degrades to the agreed amount alone rather than inventing a
      // balance; the Facturas tab is still the authority.
      .catch(() => setInvoices([]));
  }, [job.id, job.subcontractorId]);
  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const money = useMemo(() => {
    const rows = invoices ?? [];
    const invoiced = rows.reduce((sum, i) => sum + i.amountCents, 0);
    const paid = rows.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amountCents, 0);
    const balance = rows.filter(i => isPayable(i.status)).reduce((sum, i) => sum + i.amountCents, 0);
    return { invoiced, paid, balance };
  }, [invoices]);

  const approve = async () => {
    setBusy('approve');
    setActionError(false);
    try {
      const updated = await updateJobStatus(job.id, { status: 'APPROVED' });
      onJobChanged(updated);
    } catch {
      setActionError(true);
    } finally {
      setBusy(null);
    }
  };

  const tabs: FichaTabDef<JobFichaTab>[] = [
    { key: 'notes', label: t('subcontractors:ficha.tab.notes'), count: noteCount },
    { key: 'evidence', label: t('subcontractors:ficha.tab.evidence'), count: evidenceCount },
    { key: 'history', label: t('subcontractors:ficha.tab.history') },
  ];

  const kicker = t('subcontractors:ficha.kicker', {
    name: job.subcontractorName ?? t('subcontractors:ficha.noSubcontractor'),
    id: job.id,
  });

  const moneyCell = (label: string, value: string, opts: { accent?: boolean; pending?: boolean } = {}) => (
    <div className={cn('px-4 py-[13px] md:px-5 min-w-0', opts.accent && 'bg-[#FBF8F2]')}>
      <Mono className={cn('block text-[9.5px] tracking-[0.12em]', opts.accent ? 'text-[#C2410C]' : 'text-[#5A5346]')}>{label}</Mono>
      <div className={cn('font-bt-display font-extrabold text-[26px] md:text-[32px] leading-none tabular-nums mt-1.5 truncate', opts.accent ? 'text-[#C2410C]' : 'text-[#0A0A0A]')}>
        {opts.pending ? <Bone className="w-20 h-7" /> : value}
      </div>
    </div>
  );
  const moneyPending = invoices == null;

  return (
    <div className="max-w-[1206px]">
      <nav aria-label={t('subcontractors:ficha.breadcrumb')} className="mb-3.5">
        <button
          type="button"
          onClick={onBack}
          className={cn('group inline-flex items-center gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#5A5346] hover:text-[#C2410C] max-w-full', FOCUS_RING)}
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#C2410C]" strokeWidth={2.2} />
          <span>{t('subcontractors:ficha.breadcrumb')}</span>
          <span className="text-[#B4A992]">/</span>
          <span>{t('subcontractors:ficha.breadcrumbJobs')}</span>
          <span className="text-[#B4A992]">/</span>
          <span className="text-[#0A0A0A] group-hover:text-[#C2410C] truncate">{job.title}</span>
        </button>
      </nav>

      <div data-tour="sec.subcontractors-ficha.job-actions">
        <InkBar grid={26} className="px-4 py-4 md:px-5 md:pt-4 md:pb-[18px]">
          <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0">
              <Mono className="block text-[10px] font-semibold tracking-[0.14em] text-[#F97316] truncate">{kicker}</Mono>
              <h2 className="font-bt-display font-extrabold uppercase text-[28px] md:text-[38px] leading-none tracking-[0.01em] mt-1.5 break-words">{job.title}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <JobStatusChip status={job.status} onDark />
                <Mono className="inline-flex items-center border border-[rgba(245,241,232,0.4)] text-[9.5px] tracking-[0.1em] text-[#F5F1E8] px-[7px] py-[3px]">{job.projectName}</Mono>
                {job.dueDate ? (
                  <Mono className={cn('text-[10px] tracking-[0.1em]', job.isOverdue ? 'text-[#F97316] font-semibold' : 'text-[rgba(245,241,232,0.7)]')}>
                    {t('subcontractors:ficha.dueDate', { date: softDate(job.dueDate, lang) })}
                  </Mono>
                ) : (
                  <Mono className="text-[10px] tracking-[0.1em] text-[rgba(245,241,232,0.55)]">{t('subcontractors:ficha.noDueDate')}</Mono>
                )}
                {job.isOverdue && <OverdueStamp />}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-wrap md:items-center gap-2 md:justify-end flex-shrink-0">
              <DarkButton onClick={() => onChangeStatus()} className="w-full md:w-auto">{t('subcontractors:ficha.changeStatus')}</DarkButton>
              <DarkButton onClick={() => onChangeStatus('OBSERVED')} className="w-full md:w-auto">
                <span className="md:hidden">{t('subcontractors:ficha.sendBackShort')}</span>
                <span className="hidden md:inline">{t('subcontractors:ficha.sendBack')}</span>
              </DarkButton>
              <PrimaryButton
                onClick={approve}
                disabled={busy === 'approve' || job.status === 'APPROVED'}
                className="w-full md:w-auto px-[15px] py-[10px] text-[10px]"
              >
                {busy === 'approve' ? t('subcontractors:ficha.approving') : t('subcontractors:ficha.approve')}
              </PrimaryButton>
            </div>
          </div>
        </InkBar>
      </div>

      {actionError && <PaperNote tone="red" className="mt-3">{t('subcontractors:ficha.actionFailed')}</PaperNote>}

      {/* The money strip: the answer to "have I already paid for this?" without
          leaving the page. The balance comes from their approved invoices. */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-[#E7E1D5] border-t-0 divide-x divide-[#E7E1D5]" data-tour="sec.subcontractors-ficha.money">
        {moneyCell(t('subcontractors:ficha.money.agreed'), job.agreedAmountCents != null ? fmtMoney(job.agreedAmountCents) : '—')}
        {moneyCell(t('subcontractors:ficha.money.invoiced'), fmtMoney(money.invoiced), { pending: moneyPending })}
        {moneyCell(t('subcontractors:ficha.money.paid'), fmtMoney(money.paid), { pending: moneyPending })}
        {moneyCell(t('subcontractors:ficha.money.balance'), fmtMoney(money.balance), { accent: true, pending: moneyPending })}
      </div>

      <div className="bg-white border border-[#E7E1D5] border-t-0 px-4 py-4 md:px-[22px] md:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 lg:gap-[30px]">
          <div>
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2">{t('subcontractors:ficha.field.description')}</Mono>
            {job.description
              ? <p className="text-[13.5px] leading-[1.6] text-[#2E2A24] whitespace-pre-wrap break-words">{job.description}</p>
              : <CellEmpty>{t('subcontractors:ficha.field.noDescription')}</CellEmpty>}
          </div>
          <div>
            <Row label={t('subcontractors:ficha.field.project')}>{job.projectName}</Row>
            <Row label={t('subcontractors:ficha.field.assigned')}>
              <Mono className="text-[12px] tracking-[0.04em]">{stampDay(job.assignedAt, lang)}</Mono>
            </Row>
            <Row label={t('subcontractors:ficha.field.dueDate')}>
              {job.dueDate
                ? <Mono className={cn('text-[12px] tracking-[0.04em]', job.isOverdue && 'text-[#B3402A] font-semibold')}>{stampDay(job.dueDate, lang)}</Mono>
                : <CellEmpty>{t('subcontractors:jobs.row.noDueDate')}</CellEmpty>}
            </Row>
          </div>
        </div>
      </div>

      <div className="mt-4" data-tour="sec.subcontractors-ficha.tabs">
        <FichaTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      <div className="mt-px">
        {tab === 'notes' && <JobNotes jobId={job.id} onCountChange={setNoteCount} />}
        {tab === 'evidence' && <JobEvidence jobId={job.id} jobTitle={job.title} onCountChange={setEvidenceCount} />}
        {tab === 'history' && <JobTimeline jobId={job.id} />}
      </div>

      {/* This job's invoices, so the money strip is auditable from here. */}
      {invoices != null && invoices.length > 0 && (
        <div className="mt-4">
          <Panel title={t('subcontractors:tab.invoices')} purpose={t('subcontractors:ficha.money.hint')}>
            <div className="border border-[#EDE7DB]">
              {invoices.map(inv => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => onOpenInvoice(inv)}
                  className={cn('w-full flex items-center gap-3 px-3.5 py-3 border-b border-[#F0EBE1] last:border-b-0 bg-white text-left hover:bg-[#FBF8F2] transition-colors', FOCUS_RING, 'focus-visible:outline-offset-[-2px]')}
                >
                  <Mono className="text-[11.5px] font-semibold tracking-[0.04em] text-[#0A0A0A] w-[120px] flex-shrink-0 truncate">
                    {inv.invoiceNumber ?? t('subcontractors:inv.row.noNumber')}
                  </Mono>
                  <Mono className="text-[12.5px] tabular-nums text-[#0A0A0A] flex-1 text-right">{fmtMoney(inv.amountCents)}</Mono>
                  <Mono className="text-[9.5px] tracking-[0.1em] text-[#5A5346] w-[110px] text-right flex-shrink-0">
                    {t(`subcontractors:invoiceStatus.${inv.status}`)}
                  </Mono>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="md:hidden mt-4">
        <SecondaryButton onClick={onBack} className="w-full bg-[#FAF7F0] py-3">{t('subcontractors:ficha.breadcrumbJobs')}</SecondaryButton>
      </div>
    </div>
  );
}
