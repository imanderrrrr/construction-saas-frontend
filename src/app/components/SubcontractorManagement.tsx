// OFJR Construction — Subcontractor Management (Admin Panel)
// Full CRUD for subcontractor jobs & invoices with timeline, evidence, observations

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Briefcase, FileText, Plus, Search, RotateCcw,
  Clock, Eye, MessageSquare,
  CheckCircle2, AlertCircle, DollarSign,
  ArrowRight, ArrowLeft, X, Image, File, Loader2, AlertTriangle,
  Download, ExternalLink,
} from 'lucide-react';
import { StatCard } from './StatCard';
import {
  listJobs, createJob, updateJobStatus, getJob, getJobTimeline,
  getJobEvidence, getJobObservations, addJobObservation,
  getEvidenceFileUrl, getInvoiceFileUrl,
  listInvoices, reviewInvoice, registerPayment,
  ADMIN_JOB_TRANSITIONS, INVOICE_TRANSITIONS,
  type SubcontractorJobDTO, type SubcontractorInvoiceDTO,
  type JobStatus, type InvoiceStatus,
  type TimelineEntry, type EvidenceEntry, type ObservationEntry,
  type PageResponse,
} from '../services/subcontractors';
import { listUsers, type UserDTO } from '../services/users';
import { api } from '../lib/api';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// ── Helpers ────────────────────────────────────────

function formatCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isImageEvidence(ev: { contentType?: string; evidenceType: string }): boolean {
  if (ev.contentType) return ev.contentType.startsWith('image/');
  return ev.evidenceType === 'PROGRESS_PHOTO' || ev.evidenceType === 'FINAL_EVIDENCE';
}

// ── Status badge colors ────────────────────────────

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
  ASSIGNED:    'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_REVIEW:   'bg-purple-50 text-purple-700 border-purple-200',
  OBSERVED:    'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED:      'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]',
};

const JOB_STATUS_DOTS: Record<JobStatus, string> = {
  ASSIGNED:    'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  IN_REVIEW:   'bg-purple-500',
  OBSERVED:    'bg-orange-500',
  APPROVED:    'bg-emerald-500',
  CLOSED:      'bg-[#71717A]',
};

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  SUBMITTED:       'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:       'bg-purple-50 text-purple-700 border-purple-200',
  OBSERVED:        'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID:            'bg-[#FAFAFA] text-[#71717A] border-[#D4D4D8]',
};

function invoiceStatusColor(status: InvoiceStatus | string): string {
  return INVOICE_STATUS_STYLES[status as InvoiceStatus] ?? 'bg-gray-50 text-gray-700 border-gray-200';
}

const INVOICE_STATUS_DOTS: Record<InvoiceStatus, string> = {
  SUBMITTED:       'bg-blue-500',
  IN_REVIEW:       'bg-purple-500',
  OBSERVED:        'bg-orange-500',
  APPROVED:        'bg-emerald-500',
  PENDING_PAYMENT: 'bg-amber-500',
  PAID:            'bg-[#71717A]',
};

// ── Sub-components ─────────────────────────────────

function JobStatusBadge({ status, t }: { status: JobStatus; t: (k: string) => string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${JOB_STATUS_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${JOB_STATUS_DOTS[status]}`} />
      {t(`subcontractors:status.${status}`)}
    </span>
  );
}

function InvoiceStatusBadge({ status, t }: { status: InvoiceStatus; t: (k: string) => string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${INVOICE_STATUS_STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${INVOICE_STATUS_DOTS[status]}`} />
      {t(`subcontractors:invoiceStatus.${status}`)}
    </span>
  );
}

interface SimpleProject { id: number; name: string; }

// ── Modal wrapper ──────────────────────────────────

function Modal({ open, onClose, title, wide, extraWide, children }: { open: boolean; onClose: () => void; title: string; wide?: boolean; extraWide?: boolean; children: React.ReactNode }) {
  if (!open) return null;
  const sizeClass = extraWide ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A0A0A]/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-xl border border-[#D4D4D8] shadow-xl w-full ${sizeClass} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button onClick={() => onPage(current - 1)} disabled={current === 0}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-40">
        &laquo;
      </button>
      {Array.from({ length: total }, (_, i) => (
        <button key={i} onClick={() => onPage(i)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${i === current ? 'bg-[#F97316] text-white border-[#F97316]' : 'border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]'}`}>
          {i + 1}
        </button>
      ))}
      <button onClick={() => onPage(current + 1)} disabled={current >= total - 1}
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-40">
        &raquo;
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────

export function SubcontractorManagement() {
  const { t } = useTranslation(['subcontractors', 'common']);

  // Tab state
  const [activeTab, setActiveTab] = useState<'jobs' | 'invoices'>('jobs');

  // Jobs state
  const [jobs, setJobs] = useState<SubcontractorJobDTO[]>([]);
  const [jobsPage, setJobsPage] = useState(0);
  const [jobsTotalPages, setJobsTotalPages] = useState(0);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('');

  // Job Detail view
  const [selectedJob, setSelectedJob] = useState<SubcontractorJobDTO | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<SubcontractorInvoiceDTO[]>([]);
  const [invoicesPage, setInvoicesPage] = useState(0);
  const [invoicesTotalPages, setInvoicesTotalPages] = useState(0);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');

  // Dropdown data
  const [subcontractors, setSubcontractors] = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);

  // Modals
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showChangeStatus, setShowChangeStatus] = useState<SubcontractorJobDTO | null>(null);
  const [showReviewInvoice, setShowReviewInvoice] = useState<SubcontractorInvoiceDTO | null>(null);
  const [showPayment, setShowPayment] = useState<SubcontractorInvoiceDTO | null>(null);

  // ── Data loading ────────────────────────────────

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const data = await listJobs({ status: jobStatusFilter || undefined, page: jobsPage, size: 10 });
      setJobs(data.content);
      setJobsTotalPages(data.totalPages);
    } catch {
      toast.error(t('subcontractors:toast.error'));
    } finally {
      setJobsLoading(false);
    }
  }, [jobStatusFilter, jobsPage, t]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const data = await listInvoices({ status: invoiceStatusFilter || undefined, page: invoicesPage, size: 10 });
      setInvoices(data.content);
      setInvoicesTotalPages(data.totalPages);
    } catch {
      toast.error(t('subcontractors:toast.error'));
    } finally {
      setInvoicesLoading(false);
    }
  }, [invoiceStatusFilter, invoicesPage, t]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { if (activeTab === 'invoices') loadInvoices(); }, [activeTab, loadInvoices]);

  // Load dropdown data once (subcontractors + projects for the create-job form)
  const [refDataError, setRefDataError] = useState(false);
  const loadRefData = useCallback(() => {
    setRefDataError(false);
    Promise.all([
      listUsers({ role: 'SUBCONTRACTOR', size: 200 }).then(r => setSubcontractors(r.content)),
      api<PageResponse<SimpleProject>>('/api/v1/admin/projects?size=200').then(r => setProjects(r.content)),
    ]).catch(() => setRefDataError(true));
  }, []);
  useEffect(() => { loadRefData(); }, [loadRefData]);

  // ── KPIs ────────────────────────────────────────

  const jobKpis = {
    total: jobs.length,
    inProgress: jobs.filter(j => j.status === 'IN_PROGRESS').length,
    inReview: jobs.filter(j => j.status === 'IN_REVIEW').length,
    overdue: jobs.filter(j => j.isOverdue).length,
    approved: jobs.filter(j => j.status === 'APPROVED' || j.status === 'CLOSED').length,
  };

  const invoiceKpis = {
    total: invoices.length,
    pendingPayment: invoices.filter(i => i.status === 'PENDING_PAYMENT').length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    observed: invoices.filter(i => i.status === 'OBSERVED').length,
  };

  // ── Filtered jobs (client-side search) ──────────

  const filteredJobs = jobSearch
    ? jobs.filter(j =>
        j.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
        (j.subcontractorName ?? '').toLowerCase().includes(jobSearch.toLowerCase())
      )
    : jobs;

  // ── If a job is selected, show the detail view ──

  if (selectedJob) {
    return (
      <JobDetailView
        job={selectedJob}
        t={t}
        onBack={() => setSelectedJob(null)}
        onChangeStatus={() => setShowChangeStatus(selectedJob)}
        onStatusUpdated={async () => {
          setShowChangeStatus(null);
          loadJobs();
          toast.success(t('subcontractors:toast.statusUpdated'));
          // Refresh the selected job to reflect the new status immediately
          try {
            const updated = await getJob(selectedJob.id);
            setSelectedJob(updated);
          } catch { /* list reload will handle it */ }
        }}
        showChangeStatus={showChangeStatus}
        setShowChangeStatus={setShowChangeStatus}
      />
    );
  }

  // ── Render ──────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#D4D4D8] p-1 w-fit">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'jobs' ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
        >
          <Briefcase className="w-4 h-4" /> {t('subcontractors:tabs.jobs')}
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'invoices' ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
        >
          <FileText className="w-4 h-4" /> {t('subcontractors:tabs.invoices')}
        </button>
      </div>

      {/* ════════════ JOBS TAB ════════════ */}
      {activeTab === 'jobs' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard icon={Briefcase} title={t('subcontractors:kpi.totalJobs')} value={jobKpis.total} subtitle={t('subcontractors:kpi.allAssigned')} iconBgColor="bg-blue-50" iconColor="text-blue-600" isLoading={jobsLoading} />
            <StatCard icon={Clock} title={t('subcontractors:kpi.inProgress')} value={jobKpis.inProgress} subtitle={t('subcontractors:kpi.activeWork')} iconBgColor="bg-amber-50" iconColor="text-amber-600" isLoading={jobsLoading} />
            <StatCard icon={Eye} title={t('subcontractors:kpi.inReview')} value={jobKpis.inReview} subtitle={t('subcontractors:kpi.pendingReview')} iconBgColor="bg-purple-50" iconColor="text-purple-600" isLoading={jobsLoading} />
            <StatCard icon={AlertTriangle} title={t('subcontractors:kpi.overdue')} value={jobKpis.overdue} subtitle={t('subcontractors:kpi.pastDueDate')} iconBgColor="bg-red-50" iconColor="text-red-600" isLoading={jobsLoading} />
            <StatCard icon={CheckCircle2} title={t('subcontractors:kpi.approved')} value={jobKpis.approved} subtitle={t('subcontractors:kpi.completedWork')} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" isLoading={jobsLoading} />
          </div>

          {/* Filters + CTA */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A]" />
                  <input value={jobSearch} onChange={e => setJobSearch(e.target.value)}
                    maxLength={FIELD_LIMITS.SEARCH}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                    placeholder={t('subcontractors:filter.search')} />
                </div>
              </div>
              <select value={jobStatusFilter} onChange={e => { setJobStatusFilter(e.target.value); setJobsPage(0); }}
                className="px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 bg-white">
                <option value="">{t('subcontractors:filter.allStatuses')}</option>
                {(['ASSIGNED','IN_PROGRESS','IN_REVIEW','OBSERVED','APPROVED','CLOSED'] as JobStatus[]).map(s => (
                  <option key={s} value={s}>{t(`subcontractors:status.${s}`)}</option>
                ))}
              </select>
              {(jobSearch || jobStatusFilter) && (
                <button onClick={() => { setJobSearch(''); setJobStatusFilter(''); setJobsPage(0); }}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
                  <RotateCcw className="w-3.5 h-3.5" /> {t('subcontractors:filter.reset')}
                </button>
              )}
              <button onClick={() => setShowCreateJob(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white transition-colors ml-auto">
                <Plus className="w-4 h-4" /> {t('subcontractors:btn.assignJob')}
              </button>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            {jobsLoading ? (
              <div className="animate-pulse h-64" />
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Briefcase className="w-10 h-10 text-[#D4D4D8]" />
                <p className="text-sm text-[#71717A]">{t('subcontractors:empty.jobs')}</p>
                <p className="text-xs text-[#D4D4D8]">{t('subcontractors:empty.createFirst')}</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#FAFAFA] text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.title')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.subcontractor')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.project')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.status')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.dueDate')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase w-28" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4D4D8]">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-[#FAFAFA]/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#0A0A0A]">{job.title}</span>
                              {job.isOverdue && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-600 border border-red-200">
                                  {t('subcontractors:overdue')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{job.subcontractorName ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{job.projectName}</td>
                          <td className="px-4 py-3"><JobStatusBadge status={job.status} t={t} /></td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{job.dueDate ? formatDate(job.dueDate) : t('subcontractors:noDueDate')}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setSelectedJob(job)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F97316]/10 text-[#F97316] hover:bg-[#F97316]/20 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> {t('subcontractors:btn.viewDetails')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-[#D4D4D8]">
                  {filteredJobs.map(job => (
                    <div key={job.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#0A0A0A]">{job.title}</p>
                          <p className="text-xs text-[#71717A]">{job.subcontractorName} — {job.projectName}</p>
                        </div>
                        <JobStatusBadge status={job.status} t={t} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#71717A]">{job.dueDate ? formatDate(job.dueDate) : t('subcontractors:noDueDate')}</span>
                        {job.isOverdue && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-50 text-red-600 border border-red-200">
                            {t('subcontractors:overdue')}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#F97316] text-white hover:bg-[#C2410C] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> {t('subcontractors:btn.viewDetails')}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pagination current={jobsPage} total={jobsTotalPages} onPage={setJobsPage} />
          </div>
        </>
      )}

      {/* ════════════ INVOICES TAB ════════════ */}
      {activeTab === 'invoices' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={FileText} title={t('subcontractors:kpi.totalInvoices')} value={invoiceKpis.total} subtitle={t('subcontractors:kpi.allSubmitted')} iconBgColor="bg-blue-50" iconColor="text-blue-600" isLoading={invoicesLoading} />
            <StatCard icon={DollarSign} title={t('subcontractors:kpi.pendingPayment')} value={invoiceKpis.pendingPayment} subtitle={t('subcontractors:kpi.awaitingPayment')} iconBgColor="bg-amber-50" iconColor="text-amber-600" isLoading={invoicesLoading} />
            <StatCard icon={CheckCircle2} title={t('subcontractors:kpi.paid')} value={invoiceKpis.paid} subtitle={t('subcontractors:kpi.paymentComplete')} iconBgColor="bg-emerald-50" iconColor="text-emerald-600" isLoading={invoicesLoading} />
            <StatCard icon={AlertCircle} title={t('subcontractors:kpi.observed')} value={invoiceKpis.observed} subtitle={t('subcontractors:kpi.needsAttention')} iconBgColor="bg-orange-50" iconColor="text-orange-600" isLoading={invoicesLoading} />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <select value={invoiceStatusFilter} onChange={e => { setInvoiceStatusFilter(e.target.value); setInvoicesPage(0); }}
                className="px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 bg-white">
                <option value="">{t('subcontractors:filter.allStatuses')}</option>
                {(['SUBMITTED','IN_REVIEW','OBSERVED','APPROVED','PENDING_PAYMENT','PAID'] as InvoiceStatus[]).map(s => (
                  <option key={s} value={s}>{t(`subcontractors:invoiceStatus.${s}`)}</option>
                ))}
              </select>
              {invoiceStatusFilter && (
                <button onClick={() => { setInvoiceStatusFilter(''); setInvoicesPage(0); }}
                  className="flex items-center gap-1 px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg text-[#71717A] hover:bg-[#FAFAFA]">
                  <RotateCcw className="w-3.5 h-3.5" /> {t('subcontractors:filter.reset')}
                </button>
              )}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            {invoicesLoading ? (
              <div className="animate-pulse h-64" />
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <FileText className="w-10 h-10 text-[#D4D4D8]" />
                <p className="text-sm text-[#71717A]">{t('subcontractors:empty.invoices')}</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#FAFAFA] text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.invoiceNumber')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.job')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.subcontractor')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.invoiceAmount')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.invoiceStatus')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.submittedAt')}</th>
                        <th className="px-4 py-3 text-xs font-semibold text-[#71717A] uppercase">{t('subcontractors:table.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4D4D8]">
                      {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#FAFAFA]/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{inv.invoiceNumber || `#${inv.id}`}</td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{inv.jobTitle}</td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{inv.subcontractorName ?? '—'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A]">{formatCents(inv.amountCents)}</td>
                          <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} t={t} /></td>
                          <td className="px-4 py-3 text-sm text-[#71717A]">{formatDate(inv.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {INVOICE_TRANSITIONS[inv.status].length > 0 && inv.status !== 'PENDING_PAYMENT' && (
                                <button onClick={() => setShowReviewInvoice(inv)}
                                  className="px-2 py-1 text-xs font-medium rounded-md bg-[#F97316]/10 text-[#F97316] hover:bg-[#F97316]/20 transition-colors">
                                  {t('subcontractors:btn.reviewInvoice')}
                                </button>
                              )}
                              {inv.status === 'PENDING_PAYMENT' && (
                                <button onClick={() => setShowPayment(inv)}
                                  className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                  {t('subcontractors:btn.registerPayment')}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile invoice cards */}
                <div className="md:hidden divide-y divide-[#D4D4D8]">
                  {invoices.map(inv => (
                    <div key={inv.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#0A0A0A]">{inv.invoiceNumber || `#${inv.id}`}</span>
                        <InvoiceStatusBadge status={inv.status} t={t} />
                      </div>
                      <p className="text-xs text-[#71717A]">{inv.jobTitle} — {inv.subcontractorName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#0A0A0A]">{formatCents(inv.amountCents)}</span>
                        <span className="text-xs text-[#71717A]">{formatDate(inv.createdAt)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        {INVOICE_TRANSITIONS[inv.status].length > 0 && inv.status !== 'PENDING_PAYMENT' && (
                          <button onClick={() => setShowReviewInvoice(inv)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F97316] text-white">
                            {t('subcontractors:btn.reviewInvoice')}
                          </button>
                        )}
                        {inv.status === 'PENDING_PAYMENT' && (
                          <button onClick={() => setShowPayment(inv)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white">
                            {t('subcontractors:btn.registerPayment')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pagination current={invoicesPage} total={invoicesTotalPages} onPage={setInvoicesPage} />
          </div>
        </>
      )}

      {/* ════════════ MODALS ════════════ */}

      {/* Create Job */}
      <CreateJobModal
        open={showCreateJob}
        onClose={() => setShowCreateJob(false)}
        subcontractors={subcontractors}
        projects={projects}
        refDataError={refDataError}
        onRetryRefData={loadRefData}
        t={t}
        onCreated={() => { setShowCreateJob(false); loadJobs(); toast.success(t('subcontractors:toast.jobCreated')); }}
      />

      {/* Change Status */}
      <ChangeStatusModal
        open={!!showChangeStatus}
        job={showChangeStatus}
        onClose={() => setShowChangeStatus(null)}
        t={t}
        onUpdated={() => { setShowChangeStatus(null); loadJobs(); toast.success(t('subcontractors:toast.statusUpdated')); }}
      />

      {/* Review Invoice */}
      <ReviewInvoiceModal
        open={!!showReviewInvoice}
        invoice={showReviewInvoice}
        onClose={() => setShowReviewInvoice(null)}
        t={t}
        onReviewed={() => { setShowReviewInvoice(null); loadInvoices(); toast.success(t('subcontractors:toast.invoiceReviewed')); }}
      />

      {/* Register Payment */}
      <PaymentModal
        open={!!showPayment}
        invoice={showPayment}
        onClose={() => setShowPayment(null)}
        t={t}
        onPaid={() => { setShowPayment(null); loadInvoices(); toast.success(t('subcontractors:toast.paymentRegistered')); }}
      />
    </div>
  );
}

// ── Job Detail View ───────────────────────────────

type DetailTab = 'observations' | 'timeline' | 'evidence';

function JobDetailView({ job, t, onBack, onChangeStatus, onStatusUpdated, showChangeStatus, setShowChangeStatus }: {
  job: SubcontractorJobDTO;
  t: (k: string) => string;
  onBack: () => void;
  onChangeStatus: () => void;
  onStatusUpdated: () => void;
  showChangeStatus: SubcontractorJobDTO | null;
  setShowChangeStatus: (j: SubcontractorJobDTO | null) => void;
}) {
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('observations');

  // Data
  const [observations, setObservations] = useState<ObservationEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [evidence, setEvidence] = useState<EvidenceEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Observation input
  const [obsBody, setObsBody] = useState('');
  const [obsSending, setObsSending] = useState(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Load data when tab changes
  useEffect(() => {
    setLoading(true);
    if (activeDetailTab === 'observations') {
      getJobObservations(job.id)
        .then(setObservations)
        .catch(() => toast.error(t('subcontractors:toast.error')))
        .finally(() => setLoading(false));
    } else if (activeDetailTab === 'timeline') {
      getJobTimeline(job.id)
        .then(setTimeline)
        .catch(() => toast.error(t('subcontractors:toast.error')))
        .finally(() => setLoading(false));
    } else {
      getJobEvidence(job.id)
        .then(setEvidence)
        .catch(() => toast.error(t('subcontractors:toast.error')))
        .finally(() => setLoading(false));
    }
  }, [activeDetailTab, job.id, t]);

  // Poll for new observations when chat tab is active
  useEffect(() => {
    if (activeDetailTab !== 'observations') return;
    const interval = setInterval(async () => {
      try {
        const latest = await getJobObservations(job.id);
        setObservations(prev =>
          latest.length !== prev.length ? latest : prev
        );
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeDetailTab, job.id]);

  // Auto-scroll observations
  useEffect(() => {
    const el = document.getElementById('detail-obs-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [observations]);

  const handleSendObservation = async () => {
    if (obsBody.trim().length < 5) return;
    setObsSending(true);
    try {
      const newMsg = await addJobObservation(job.id, { message: obsBody.trim() });
      setObservations(prev => [...prev, newMsg]);
      setObsBody('');
    } catch (e: any) {
      toast.error(e?.message ?? t('subcontractors:toast.error'));
    } finally { setObsSending(false); }
  };

  // Split evidence into images and documents
  const imageEvidence = evidence.filter(ev => isImageEvidence(ev));
  const documentEvidence = evidence.filter(ev => !isImageEvidence(ev));

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back button + Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t('subcontractors:btn.back')}
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">{job.title}</h2>
          <p className="text-xs text-[#71717A]">
            {job.subcontractorName} — {job.projectName}
          </p>
        </div>
        <JobStatusBadge status={job.status} t={t} />
      </div>

      {/* Job summary card */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('subcontractors:table.subcontractor')}</p>
            <p className="text-sm text-[#0A0A0A]">{job.subcontractorName ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('subcontractors:table.project')}</p>
            <p className="text-sm text-[#0A0A0A]">{job.projectName}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('subcontractors:table.dueDate')}</p>
            <p className="text-sm text-[#0A0A0A]">{job.dueDate ? formatDate(job.dueDate) : t('subcontractors:noDueDate')}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('subcontractors:table.assigned')}</p>
            <p className="text-sm text-[#0A0A0A]">{formatDate(job.assignedAt)}</p>
          </div>
          {job.description && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-[10px] font-semibold text-[#71717A] uppercase">{t('subcontractors:modal.createJob.description')}</p>
              <p className="text-sm text-[#0A0A0A]">{job.description}</p>
            </div>
          )}
        </div>
        {ADMIN_JOB_TRANSITIONS[job.status].length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#D4D4D8]">
            <button onClick={onChangeStatus}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#F97316] text-white hover:bg-[#C2410C] transition-colors">
              <ArrowRight className="w-3.5 h-3.5" /> {t('subcontractors:btn.changeStatus')}
            </button>
          </div>
        )}
      </div>

      {/* Detail Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#D4D4D8] p-1 w-fit">
        <button
          onClick={() => setActiveDetailTab('observations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeDetailTab === 'observations' ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
        >
          <MessageSquare className="w-4 h-4" /> {t('subcontractors:detail.observations')}
        </button>
        <button
          onClick={() => setActiveDetailTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeDetailTab === 'timeline' ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
        >
          <Clock className="w-4 h-4" /> {t('subcontractors:detail.timeline')}
        </button>
        <button
          onClick={() => setActiveDetailTab('evidence')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeDetailTab === 'evidence' ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'}`}
        >
          <Image className="w-4 h-4" /> {t('subcontractors:detail.evidence')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
          </div>
        ) : (
          <>
            {/* ── Observations Tab ── */}
            {activeDetailTab === 'observations' && (
              <div className="flex flex-col" style={{ height: '60vh' }}>
                {/* Messages */}
                <div id="detail-obs-scroll" className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAFA]">
                  {observations.length === 0 ? (
                    <p className="text-sm text-[#71717A] text-center py-8">{t('subcontractors:detail.noObservations')}</p>
                  ) : (
                    observations.map(msg => {
                      const isAdmin = msg.authorRole === 'ADMIN';
                      return (
                        <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isAdmin
                            ? 'bg-[#F97316] text-white rounded-br-md'
                            : 'bg-white border border-[#D4D4D8] text-[#0A0A0A] rounded-bl-md'
                          }`}>
                            <div className={`flex items-center gap-2 mb-1 ${isAdmin ? 'justify-end' : ''}`}>
                              <span className={`text-[10px] font-semibold ${isAdmin ? 'text-blue-100' : 'text-[#F97316]'}`}>
                                {msg.authorName ?? 'Unknown'}
                              </span>
                              <span className={`text-[10px] ${isAdmin ? 'text-blue-200' : 'text-[#71717A]'}`}>
                                {formatDateTime(msg.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed">{msg.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* Input */}
                <div className="border-t border-[#D4D4D8] p-4 bg-white">
                  <div className="flex gap-2">
                    <input
                      value={obsBody}
                      onChange={e => setObsBody(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendObservation(); } }}
                      placeholder={t('subcontractors:modal.observation.placeholder')}
                      maxLength={FIELD_LIMITS.LONG_TEXT}
                      className="flex-1 px-4 py-2.5 text-sm border border-[#D4D4D8] rounded-full focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                      disabled={obsSending}
                    />
                    <button onClick={handleSendObservation} disabled={obsSending || obsBody.trim().length < 5}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-[#F97316] hover:bg-[#C2410C] text-white disabled:opacity-40 transition-colors">
                      {obsSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Timeline Tab ── */}
            {activeDetailTab === 'timeline' && (
              <div className="p-6">
                {timeline.length === 0 ? (
                  <p className="text-sm text-[#71717A] text-center py-8">{t('subcontractors:modal.timeline.empty')}</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.map(entry => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-[#F97316] mt-1.5" />
                          <div className="w-px flex-1 bg-[#D4D4D8]" />
                        </div>
                        <div className="pb-3">
                          <p className="text-sm font-medium text-[#0A0A0A]">{entry.action}</p>
                          <p className="text-xs text-[#71717A]">{entry.actorName} — {formatDateTime(entry.createdAt)}</p>
                          {entry.comment && <p className="text-xs text-[#71717A] mt-1 bg-[#FAFAFA] p-2 rounded-lg">{entry.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Evidence Tab ── */}
            {activeDetailTab === 'evidence' && (
              <div className="p-6 space-y-6">
                {evidence.length === 0 ? (
                  <p className="text-sm text-[#71717A] text-center py-8">{t('subcontractors:modal.evidence.empty')}</p>
                ) : (
                  <>
                    {/* Images section */}
                    {imageEvidence.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#71717A] uppercase mb-3 flex items-center gap-2">
                          <Image className="w-3.5 h-3.5" /> {t('subcontractors:detail.images')} ({imageEvidence.length})
                        </h4>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                          {imageEvidence.map(ev => (
                            <button
                              key={ev.id}
                              onClick={() => setLightboxUrl(getEvidenceFileUrl(ev.id))}
                              className="group relative aspect-square rounded-lg overflow-hidden border border-[#D4D4D8] hover:border-[#F97316] transition-colors bg-[#FAFAFA]"
                            >
                              <img
                                src={getEvidenceFileUrl(ev.id)}
                                alt={ev.originalName ?? `Evidence #${ev.id}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                                <p className="text-[9px] text-white truncate">{ev.originalName ?? `#${ev.id}`}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents section */}
                    {documentEvidence.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#71717A] uppercase mb-3 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5" /> {t('subcontractors:detail.documents')} ({documentEvidence.length})
                        </h4>
                        <div className="space-y-2">
                          {documentEvidence.map(ev => (
                            <a
                              key={ev.id}
                              href={getEvidenceFileUrl(ev.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 border border-[#D4D4D8] rounded-lg hover:bg-[#FAFAFA] transition-colors"
                            >
                              <div className="w-10 h-10 rounded-lg bg-[#FAFAFA] flex items-center justify-center flex-shrink-0">
                                {ev.evidenceType === 'INVOICE'
                                  ? <DollarSign className="w-5 h-5 text-amber-500" />
                                  : <FileText className="w-5 h-5 text-[#71717A]" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#0A0A0A] truncate">{ev.originalName ?? `Evidence #${ev.id}`}</p>
                                <div className="flex items-center gap-2 text-[10px] text-[#71717A]">
                                  <span>{ev.uploaderName ?? 'Unknown'}</span>
                                  <span>•</span>
                                  <span>{formatDateTime(ev.createdAt)}</span>
                                </div>
                                {ev.description && <p className="text-xs text-[#71717A] mt-0.5 truncate">{ev.description}</p>}
                              </div>
                              <Download className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox for images */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <div className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-sm" />
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-2 -right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-lg text-[#71717A] hover:text-[#0A0A0A]"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={lightboxUrl}
              alt="Evidence"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Change Status Modal (shared with main view) */}
      <ChangeStatusModal
        open={!!showChangeStatus}
        job={showChangeStatus}
        onClose={() => setShowChangeStatus(null)}
        t={t}
        onUpdated={onStatusUpdated}
      />
    </div>
  );
}

// ── Create Job Modal ───────────────────────────────

function CreateJobModal({ open, onClose, subcontractors, projects, t, onCreated, refDataError, onRetryRefData }: {
  open: boolean; onClose: () => void; subcontractors: UserDTO[]; projects: SimpleProject[];
  t: (k: string) => string; onCreated: () => void; refDataError: boolean; onRetryRefData: () => void;
}) {
  const [form, setForm] = useState({ subcontractorId: '', projectId: '', title: '', description: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.subcontractorId) { setError(t('subcontractors:validation.subcontractorRequired')); return; }
    if (!form.projectId) { setError(t('subcontractors:validation.projectRequired')); return; }
    if (!form.title.trim()) { setError(t('subcontractors:validation.titleRequired')); return; }
    setSaving(true);
    setError('');
    try {
      await createJob({
        subcontractorId: Number(form.subcontractorId),
        projectId: Number(form.projectId),
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate || null,
      });
      setForm({ subcontractorId: '', projectId: '', title: '', description: '', dueDate: '' });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? t('subcontractors:toast.error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('subcontractors:modal.createJob.title')}>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {refDataError && (
          <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{t('subcontractors:modal.createJob.refDataError')}</span>
            <button type="button" onClick={onRetryRefData} className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
            </button>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.createJob.subcontractor')}</label>
          <select value={form.subcontractorId} onChange={e => setForm({ ...form, subcontractorId: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 bg-white">
            <option value="">{t('subcontractors:modal.createJob.subcontractorPlaceholder')}</option>
            {subcontractors.map(u => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.createJob.project')}</label>
          <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 bg-white">
            <option value="">{t('subcontractors:modal.createJob.projectPlaceholder')}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.createJob.jobTitle')}</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            maxLength={FIELD_LIMITS.SHORT_NAME}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            placeholder={t('subcontractors:modal.createJob.jobTitlePlaceholder')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.createJob.description')}</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}
            maxLength={FIELD_LIMITS.LONG_TEXT}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 resize-none"
            placeholder={t('subcontractors:modal.createJob.descriptionPlaceholder')} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.createJob.dueDate')}</label>
          <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30" />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]">
            {t('subcontractors:btn.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('subcontractors:btn.save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Change Status Modal ────────────────────────────

function ChangeStatusModal({ open, job, onClose, t, onUpdated }: {
  open: boolean; job: SubcontractorJobDTO | null; onClose: () => void;
  t: (k: string) => string; onUpdated: () => void;
}) {
  const [newStatus, setNewStatus] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const transitions = job ? ADMIN_JOB_TRANSITIONS[job.status] : [];

  const handleSubmit = async () => {
    if (!job || !newStatus) return;
    setSaving(true);
    try {
      await updateJobStatus(job.id, { status: newStatus, comment: comment.trim() || null });
      setNewStatus(''); setComment('');
      onUpdated();
    } catch (e: any) {
      toast.error(e?.message ?? t('subcontractors:toast.error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('subcontractors:modal.changeStatus.title')}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-[#71717A] uppercase mb-1">{t('subcontractors:modal.changeStatus.current')}</p>
          {job && <JobStatusBadge status={job.status} t={t} />}
        </div>
        {transitions.length === 0 ? (
          <p className="text-sm text-[#71717A]">{t('subcontractors:modal.changeStatus.noTransitions')}</p>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.changeStatus.newStatus')}</label>
              <div className="flex flex-wrap gap-2">
                {transitions.map(s => (
                  <button key={s} onClick={() => setNewStatus(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${newStatus === s ? 'bg-[#F97316] text-white border-[#F97316]' : 'border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}>
                    {t(`subcontractors:status.${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.changeStatus.comment')}</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                maxLength={FIELD_LIMITS.NOTE}
                className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 resize-none"
                placeholder={t('subcontractors:modal.changeStatus.commentPlaceholder')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]">
                {t('subcontractors:btn.cancel')}
              </button>
              <button onClick={handleSubmit} disabled={saving || !newStatus}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white disabled:opacity-50 transition-colors">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('subcontractors:btn.save')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Review Invoice Modal (wide: PDF preview + sidebar) ─────────

function ReviewInvoiceModal({ open, invoice, onClose, t, onReviewed }: {
  open: boolean; invoice: SubcontractorInvoiceDTO | null; onClose: () => void;
  t: (k: string) => string; onReviewed: () => void;
}) {
  const [action, setAction] = useState<'APPROVE' | 'OBSERVE' | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!invoice || !action) return;
    setSaving(true);
    try {
      await reviewInvoice(invoice.id, { action, comment: comment.trim() || null });
      setAction(''); setComment('');
      onReviewed();
    } catch (e: any) {
      toast.error(e?.message ?? t('subcontractors:toast.error'));
    } finally { setSaving(false); }
  };

  const fileUrl = invoice ? getInvoiceFileUrl(invoice.id) : '';
  const isImage = invoice?.fileContentType?.startsWith('image/');
  const isPdf = invoice?.fileContentType === 'application/pdf';

  return (
    <Modal open={open} onClose={onClose} title={t('subcontractors:modal.reviewInvoice.title')} extraWide>
      <div className="flex gap-6 min-h-[60vh]">
        {/* Left: File preview */}
        <div className="flex-1 min-w-0 bg-[#FAFAFA] rounded-lg border border-[#D4D4D8] flex items-center justify-center overflow-hidden">
          {invoice?.hasFile ? (
            isPdf ? (
              <iframe
                src={fileUrl}
                className="w-full h-full rounded-lg"
                style={{ minHeight: '60vh' }}
                title={t('subcontractors:modal.reviewInvoice.pdfTitle')}
              />
            ) : isImage ? (
              <img
                src={fileUrl}
                alt="Invoice"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            ) : (
              <div className="text-center p-8">
                <File className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
                <p className="text-sm text-[#71717A] mb-3">{t('subcontractors:modal.reviewInvoice.unsupportedPreview')}</p>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#F97316] text-white hover:bg-[#C2410C] transition-colors">
                  <Download className="w-4 h-4" /> {t('subcontractors:btn.download')}
                </a>
              </div>
            )
          ) : (
            <div className="text-center p-8">
              <FileText className="w-12 h-12 text-[#71717A] mx-auto mb-3" />
              <p className="text-sm text-[#71717A]">{t('subcontractors:modal.reviewInvoice.noFile')}</p>
            </div>
          )}
        </div>

        {/* Right: Invoice info + review actions */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {invoice && (
            <div className="bg-[#FAFAFA] rounded-lg p-4 space-y-2">
              <p className="text-base font-semibold text-[#0A0A0A]">{invoice.invoiceNumber || `#${invoice.id}`}</p>
              <div className="space-y-1">
                <p className="text-xs text-[#71717A]">{t('subcontractors:table.job')}</p>
                <p className="text-sm text-[#0A0A0A]">{invoice.jobTitle}</p>
              </div>
              {invoice.projectName && (
                <div className="space-y-1">
                  <p className="text-xs text-[#71717A]">{t('subcontractors:table.project')}</p>
                  <p className="text-sm text-[#0A0A0A]">{invoice.projectName}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-[#71717A]">{t('subcontractors:table.subcontractor')}</p>
                <p className="text-sm text-[#0A0A0A]">{invoice.subcontractorName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[#71717A]">{t('subcontractors:table.amount')}</p>
                <p className="text-lg font-bold text-[#0A0A0A]">{formatCents(invoice.amountCents)}</p>
              </div>
              {invoice.description && (
                <div className="space-y-1">
                  <p className="text-xs text-[#71717A]">{t('subcontractors:modal.reviewInvoice.description')}</p>
                  <p className="text-sm text-[#0A0A0A]">{invoice.description}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs text-[#71717A]">{t('subcontractors:table.status')}</p>
                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${invoiceStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
              </div>
              <p className="text-xs text-[#71717A]">
                {t('subcontractors:modal.reviewInvoice.createdAt')}: {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Previous reviewer comment if any */}
          {invoice?.reviewerComment && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">{t('subcontractors:modal.reviewInvoice.previousComment')}</p>
              <p className="text-sm text-orange-800">{invoice.reviewerComment}</p>
              {invoice.reviewerName && (
                <p className="text-xs text-orange-500 mt-1">— {invoice.reviewerName}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div>
            <label className="block text-xs font-semibold text-[#0A0A0A] mb-2">{t('subcontractors:modal.reviewInvoice.action')}</label>
            <div className="flex gap-2">
              <button onClick={() => setAction('APPROVE')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${action === 'APPROVE' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}>
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> {t('subcontractors:btn.approve')}
              </button>
              <button onClick={() => setAction('OBSERVE')}
                className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${action === 'OBSERVE' ? 'bg-orange-500 text-white border-orange-500' : 'border-[#D4D4D8] text-[#0A0A0A] hover:bg-[#FAFAFA]'}`}>
                <AlertCircle className="w-4 h-4 inline mr-1" /> {t('subcontractors:btn.observe')}
              </button>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.reviewInvoice.comment')}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
              maxLength={FIELD_LIMITS.NOTE}
              className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 resize-none"
              placeholder={t('subcontractors:modal.reviewInvoice.commentPlaceholder')} />
          </div>

          {/* Submit / Cancel */}
          <div className="flex flex-col gap-2 mt-auto">
            <button onClick={handleSubmit} disabled={saving || !action}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white disabled:opacity-50 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('subcontractors:btn.save')}
            </button>
            <button onClick={onClose} className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]">
              {t('subcontractors:btn.cancel')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Payment Modal ──────────────────────────────────

function PaymentModal({ open, invoice, onClose, t, onPaid }: {
  open: boolean; invoice: SubcontractorInvoiceDTO | null; onClose: () => void;
  t: (k: string) => string; onPaid: () => void;
}) {
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      await registerPayment(invoice.id, { paymentReference: reference.trim() || null });
      setReference('');
      onPaid();
    } catch (e: any) {
      toast.error(e?.message ?? t('subcontractors:toast.error'));
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('subcontractors:modal.payment.title')}>
      <div className="space-y-4">
        {invoice && (
          <div className="bg-[#FAFAFA] rounded-lg p-3 space-y-1">
            <p className="text-sm font-medium text-[#0A0A0A]">{invoice.invoiceNumber || `#${invoice.id}`}</p>
            <p className="text-xs text-[#71717A]">{invoice.subcontractorName}</p>
            <p className="text-sm font-semibold text-[#0A0A0A]">{formatCents(invoice.amountCents)}</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#0A0A0A] mb-1">{t('subcontractors:modal.payment.reference')}</label>
          <input value={reference} onChange={e => setReference(e.target.value)}
            maxLength={FIELD_LIMITS.REFERENCE}
            className="w-full px-3 py-2 text-sm border border-[#D4D4D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
            placeholder={t('subcontractors:modal.payment.referencePlaceholder')} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-[#D4D4D8] text-[#71717A] hover:bg-[#FAFAFA]">
            {t('subcontractors:btn.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('subcontractors:btn.registerPayment')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
