import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { businessToday } from '../../helpers/dateTime';
import {
  getSubcontractorsSummary,
  type JobStatus, type SubcontractorDirectoryRow, type SubcontractorInvoiceDTO,
  type SubcontractorJobDTO, type SubcontractorsSummary,
} from '../../services/subcontractors';
import { FOCUS_RING } from '../onboarding/chrome';
import { Mono, stampDay } from '../projects/bt';
import { FLASH_MS } from './bits';
import { useRefData } from './refData';
import { DirectoryTab } from './DirectoryTab';
import { JobsTab, type JobsFilters } from './JobsTab';
import { InvoicesTab } from './InvoicesTab';
import { JobFicha } from './JobFicha';
import { AssignJobModal } from './AssignJobModal';
import { ChangeStatusModal } from './ChangeStatusModal';
import { ReviewInvoiceModal } from './ReviewInvoiceModal';
import { RegisterPaymentModal } from './RegisterPaymentModal';

/**
 * Subcontratistas — the section (Claude Design "Subcontratistas BuildTrack",
 * 2026-09). Three tabs where there were two, because the section was named
 * after people it never showed: it listed jobs.
 *
 * Nothing is created or deleted here. A subcontractor is a user with that role
 * and is created in Usuarios; the backend exposes no DELETE for jobs or
 * invoices and none is invented.
 *
 * Success is never a toast: the affected row is reloaded in place and lights
 * up for two seconds (`.bt-row-flash`).
 */

export type SubTab = 'directory' | 'jobs' | 'invoices';

export function SubcontractorsSection({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { t, i18n } = useTranslation(['subcontractors', 'common']);
  const lang = i18n.language;
  const [tab, setTab] = useState<SubTab>('directory');
  const [job, setJob] = useState<SubcontractorJobDTO | null>(null);
  const [jobsFilters, setJobsFilters] = useState<JobsFilters | undefined>();
  const refData = useRefData();

  // The nine figures, over the whole tenant. `failed` is a first-class state:
  // the strips write an em dash rather than counting the page on screen.
  const [summary, setSummary] = useState<SubcontractorsSummary | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const loadSummary = useCallback(() => {
    getSubcontractorsSummary()
      .then(s => { setSummary(s); setSummaryState('ready'); })
      .catch(() => setSummaryState('failed'));
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Windows
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusJob, setStatusJob] = useState<SubcontractorJobDTO | null>(null);
  const [statusPreset, setStatusPreset] = useState<JobStatus | undefined>();
  const [reviewInvoice, setReviewInvoice] = useState<SubcontractorInvoiceDTO | null>(null);
  const [payInvoice, setPayInvoice] = useState<SubcontractorInvoiceDTO | null>(null);

  const [flashJobId, setFlashJobId] = useState<number | null>(null);
  const [flashInvoiceId, setFlashInvoiceId] = useState<number | null>(null);

  useEffect(() => {
    if (flashJobId == null) return;
    const timer = window.setTimeout(() => setFlashJobId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashJobId]);
  useEffect(() => {
    if (flashInvoiceId == null) return;
    const timer = window.setTimeout(() => setFlashInvoiceId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashInvoiceId]);

  const goToUsers = () => onNavigate?.('users');

  /** A directory row: Trabajos, already narrowed to that person. */
  const pickSubcontractor = (row: SubcontractorDirectoryRow) => {
    setJobsFilters({ subcontractorId: row.subcontractorId });
    setTab('jobs');
  };

  const handleAssigned = (created: SubcontractorJobDTO) => {
    setTab('jobs');
    setJobsFilters(undefined);
    setFlashJobId(created.id);
    loadSummary();
  };

  const handleJobChanged = (updated: SubcontractorJobDTO) => {
    setJob(prev => (prev?.id === updated.id ? updated : prev));
    setStatusJob(prev => (prev?.id === updated.id ? updated : prev));
    setFlashJobId(updated.id);
    loadSummary();
  };

  const handleInvoiceChanged = (updated: SubcontractorInvoiceDTO) => {
    setFlashInvoiceId(updated.id);
    loadSummary();
  };

  const today = useMemo(() => stampDay(businessToday(), lang), [lang]);

  const tabDefs: { key: SubTab; label: string; count?: number }[] = [
    { key: 'directory', label: t('subcontractors:tab.directory') },
    { key: 'jobs', label: t('subcontractors:tab.jobs'), count: summary?.totalJobs },
    { key: 'invoices', label: t('subcontractors:tab.invoices'), count: summary?.invoicesToReview },
  ];

  // The ficha is a page of its own: it replaces the list and claims the tour.
  if (job) {
    return (
      <>
        <JobFicha
          job={job}
          onBack={() => setJob(null)}
          onChangeStatus={preset => { setStatusPreset(preset); setStatusJob(job); }}
          onJobChanged={handleJobChanged}
          onOpenInvoice={invoice => setReviewInvoice(invoice)}
        />
        <ChangeStatusModal
          open={statusJob != null}
          onOpenChange={open => { if (!open) { setStatusJob(null); setStatusPreset(undefined); } }}
          job={statusJob}
          preset={statusPreset}
          onChanged={handleJobChanged}
        />
        <ReviewInvoiceModal
          open={reviewInvoice != null}
          onOpenChange={open => { if (!open) setReviewInvoice(null); }}
          invoice={reviewInvoice}
          agreedAmountCents={job.agreedAmountCents}
          onReviewed={handleInvoiceChanged}
          onPay={setPayInvoice}
        />
        <RegisterPaymentModal
          open={payInvoice != null}
          onOpenChange={open => { if (!open) setPayInvoice(null); }}
          invoice={payInvoice}
          onPaid={handleInvoiceChanged}
        />
      </>
    );
  }

  const headerFor: Record<SubTab, { kicker: string; title: string; stamp: string }> = {
    directory: { kicker: t('subcontractors:kicker'), title: t('subcontractors:title'), stamp: t('subcontractors:stamp') },
    jobs: { kicker: t('subcontractors:jobs.kicker'), title: t('subcontractors:jobs.title'), stamp: t('subcontractors:stamp') },
    invoices: { kicker: t('subcontractors:inv.kicker'), title: t('subcontractors:inv.title'), stamp: t('subcontractors:inv.stamp') },
  };
  const header = headerFor[tab];

  return (
    <>
      <div className="space-y-4">
        {/* ── The section's own header ─────────────────────────────────── */}
        <div className="flex items-end justify-between gap-5 flex-wrap">
          <div>
            <Mono className="block text-[11px] tracking-[0.15em] text-[#8A8175]">{header.kicker}</Mono>
            <h2 className="font-bt-display font-extrabold uppercase text-[38px] md:text-[50px] leading-[0.92] tracking-[0.01em] text-[#0A0A0A] mt-1">
              {header.title}
            </h2>
            <Mono className="block text-[11px] md:text-[12.5px] tracking-[0.06em] text-[#5A5346] mt-2">
              {summary
                ? t('subcontractors:countLine', { active: summary.activeSubcontractors, openJobs: summary.openJobs, overdue: summary.jobsOverdue })
                : t('subcontractors:subtitle')}
            </Mono>
          </div>
          <div className="text-right hidden md:block">
            <Mono className="block text-[12px] tracking-[0.08em] text-[#0A0A0A]">{today}</Mono>
            <Mono className="block text-[10px] tracking-[0.1em] text-[#A69C8D] mt-[3px]">{header.stamp}</Mono>
          </div>
        </div>

        {/* ── Three tabs where there were two ──────────────────────────── */}
        <div role="tablist" className="flex overflow-x-auto bt-scroll-none" data-tour="sec.subcontractors.tabs">
          {tabDefs.map(def => {
            const active = def.key === tab;
            return (
              <button
                key={def.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setTab(def.key); if (def.key === 'jobs') setJobsFilters(undefined); }}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-[11px] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap',
                  'border border-[#E7E1D5] -ml-px first:ml-0 transition-colors',
                  FOCUS_RING, 'focus-visible:outline-offset-[-2px]',
                  active ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A]' : 'bg-white text-[#5A5346] hover:bg-[#F3EEE4] hover:text-[#0A0A0A]',
                )}
              >
                <span className="md:hidden">{def.key === 'directory' ? t('subcontractors:tab.directoryShort') : def.label}</span>
                <span className="hidden md:inline">{def.label}</span>
                {def.count != null && def.count > 0 && (
                  <span className={cn('font-bt-mono text-[9px] font-semibold px-1.5 py-[2px] leading-none', active ? 'bg-[rgba(245,241,232,0.2)]' : 'bg-[#F3EEE4] text-[#0A0A0A]')}>
                    {def.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'directory' && (
          <DirectoryTab
            summary={summary}
            summaryState={summaryState}
            onPickSubcontractor={pickSubcontractor}
            onGoToUsers={goToUsers}
          />
        )}
        {tab === 'jobs' && (
          <JobsTab
            summary={summary}
            summaryState={summaryState}
            refData={refData}
            initialFilters={jobsFilters}
            onOpenJob={setJob}
            onAssign={() => setAssignOpen(true)}
            onSummaryStale={loadSummary}
            flashJobId={flashJobId}
          />
        )}
        {tab === 'invoices' && (
          <InvoicesTab
            summary={summary}
            summaryState={summaryState}
            refData={refData}
            onReview={setReviewInvoice}
            onPay={setPayInvoice}
            flashInvoiceId={flashInvoiceId}
          />
        )}
      </div>

      <AssignJobModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        refData={refData}
        presetSubcontractorId={jobsFilters?.subcontractorId}
        onAssigned={handleAssigned}
        onGoToUsers={goToUsers}
      />
      <ReviewInvoiceModal
        open={reviewInvoice != null}
        onOpenChange={open => { if (!open) setReviewInvoice(null); }}
        invoice={reviewInvoice}
        onReviewed={handleInvoiceChanged}
        onPay={setPayInvoice}
      />
      <RegisterPaymentModal
        open={payInvoice != null}
        onOpenChange={open => { if (!open) setPayInvoice(null); }}
        invoice={payInvoice}
        onPaid={handleInvoiceChanged}
      />
    </>
  );
}
