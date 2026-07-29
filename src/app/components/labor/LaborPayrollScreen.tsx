import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Check, CreditCard, Download, Loader2, X } from 'lucide-react';
import {
  confirmPayment, getAdminHoursReport,
  type AdminHoursReportResponse, type WorkerHoursSummary,
} from '../../services/time';
import type { BudgetWarning } from '../../types';
import { listProjects } from '../../services/projects';
import { ApiError } from '../../lib/api';
import {
  GRID_INK, LaborFilters, LaborHeader, LaborSkeleton, Mono, amountOwed, fmtRange,
  budgetBlockers, initials, mainProject, money, monthRange, paidAmount, unpaidHours, weekRange,
} from './shared';

/**
 * Nómina — "¿a quién le debo pagar, cuánto, y ya le pagué?".
 *
 * The most operational of the three: it's used on pay day, list in hand. Paid
 * and unpaid are separated so hard you can tell them apart across the room,
 * and confirming a payment surfaces any budget overrun BEFORE you commit.
 */
export function LaborPayrollScreen({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const lang = i18n.language;

  const [range, setRange] = useState<'week' | 'month'>('week');
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [status, setStatus] = useState<'' | 'unpaid' | 'paid'>('');
  const [data, setData] = useState<AdminHoursReportResponse | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string; remainingCents: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState<WorkerHoursSummary | null>(null);

  const { from, to } = range === 'week' ? weekRange() : monthRange();

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      setData(await getAdminHoursReport({
        dateFrom: from, dateTo: to,
        projectId: project ? Number(project) : undefined,
      }));
    } catch { setError(true); setData(null); }
    finally { setLoading(false); }
  }, [from, to, project]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    listProjects({ status: 'ACTIVE', page: 0, size: 100 })
      .then(p => setProjects(p.content.map(x => ({
        id: x.id, name: x.name, remainingCents: x.remainingBudgetCents,
      }))))
      .catch(() => setProjects([]));
  }, []);

  const workers = data?.workers ?? [];
  const isPaid = (w: WorkerHoursSummary) => unpaidHours(w) <= 0;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workers.filter(w => {
      if (needle && !`${w.workerName ?? ''} ${w.workerUsername}`.toLowerCase().includes(needle)) return false;
      if (status === 'unpaid' && isPaid(w)) return false;
      if (status === 'paid' && !isPaid(w)) return false;
      return true;
    });
  }, [workers, q, status]);

  /** projectId → remaining contract in dollars, for the pre-flight budget check. */
  const remainingByProject = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of projects) if (p.remainingCents != null) m.set(p.id, p.remainingCents / 100);
    return m;
  }, [projects]);

  const unpaid = visible.filter(w => !isPaid(w));
  const paid = visible.filter(w => isPaid(w));
  const rateless = unpaid.filter(w => w.hourlyRate == null);
  const totalOwed = unpaid.reduce((s, w) => s + (amountOwed(w) ?? 0), 0);
  const totalPaid = paid.reduce((s, w) => s + paidAmount(w), 0);

  // Owed first (biggest first), rateless pushed to the end — they can't be paid yet.
  const unpaidSorted = [...unpaid].sort((a, b) => {
    const ra = a.hourlyRate == null ? 1 : 0, rb = b.hourlyRate == null ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return (amountOwed(b) ?? 0) - (amountOwed(a) ?? 0);
  });

  const chips = [
    q && { key: 'q', label: `${t('admin:lab.f.search')} · ${q}`, clear: () => setQ('') },
    status && { key: 'status', label: `${t('admin:pay.f.payment')} · ${t(`admin:pay.f.${status}`)}`, clear: () => setStatus('') },
    project && { key: 'project', label: `${t('admin:lab.f.project')} · ${projects.find(p => String(p.id) === project)?.name ?? project}`, clear: () => setProject('') },
    range !== 'week' && { key: 'range', label: `${t('admin:lab.f.range')} · ${t('admin:lab.f.month')}`, clear: () => setRange('week') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const allPaid = !loading && !error && workers.length > 0 && workers.every(isPaid) && !q && !status;

  return (
    <div className="relative p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <LaborHeader
        screen="labor-payroll" onNavigate={onNavigate}
        title={t('admin:pay.title')}
        summary={t('admin:pay.summary', {
          amount: money(totalOwed), count: unpaid.length, range: fmtRange(from, to, lang),
        })}
        right={
          <button onClick={() => exportCsv(visible, from, to, isPaid)}
            className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#FAF7F0] px-4 py-3 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]">
            <Download className="w-3.5 h-3.5" />{t('admin:lab.export')}
          </button>
        }
      />

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <div className="flex items-baseline">
            <span className="font-bt-display font-bold text-2xl text-[#8A8175] self-start mt-1">$</span>
            <span className="font-bt-display font-bold text-[44px] leading-none text-[#0A0A0A]">{money(totalOwed)}</span>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:pay.ind.owed')}</Mono>
        </div>
        <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
          <span className="font-bt-display font-bold text-[44px] leading-none text-[#0A0A0A]">{unpaid.length}</span>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">
            {t('admin:pay.ind.toPay')}
            {rateless.length > 0 && <span className="text-[#C2410C]"> · {t('admin:pay.ind.blocked', { count: rateless.length })}</span>}
          </Mono>
        </div>
        <div className="p-4 md:px-5">
          <div className="flex items-baseline">
            <span className="font-bt-display font-bold text-xl text-[#7A9A7E] self-start mt-1">$</span>
            <span className="font-bt-display font-bold text-[44px] leading-none text-[#2E6B34]">{money(totalPaid)}</span>
          </div>
          <Mono className="block text-[10.5px] text-[#5A5346] mt-1.5">{t('admin:pay.ind.paid')}</Mono>
        </div>
      </div>

      <LaborFilters
        q={q} onQ={setQ} range={range} onRange={setRange}
        project={project} onProject={setProject} projects={projects}
        chips={chips} onClear={() => { setQ(''); setProject(''); setStatus(''); setRange('week'); }}
        extra={
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}
            className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
            <option value="">{t('admin:pay.f.all')}</option>
            <option value="unpaid">{t('admin:pay.f.unpaid')}</option>
            <option value="paid">{t('admin:pay.f.paid')}</option>
          </select>
        }
      />

      {/* List */}
      <div className="bg-white border border-[#E4E4E7] min-h-[320px]">
        {loading ? <LaborSkeleton /> : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71717A]">{t('admin:lab.error')}</p>
            <button onClick={load} className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] border border-[#DBD0BB] px-3 py-1.5 hover:border-[#F97316]">
              {t('common:buttons.retry')}
            </button>
          </div>
        ) : allPaid ? (
          <div className="py-[70px] px-6 text-center">
            <div className="w-16 h-16 mx-auto bg-[#0A0A0A] flex items-center justify-center">
              <Check className="w-8 h-8 text-[#F97316]" />
            </div>
            <div className="font-bt-display font-bold text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-4">
              {t('admin:pay.allPaidBig')}
            </div>
            <p className="font-bt-heading font-bold text-base text-[#5A5346] mt-2">{t('admin:pay.allPaidSub')}</p>
          </div>
        ) : workers.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:pay.emptyBig')}</div>
            <p className="font-bt-heading font-bold text-base text-[#0A0A0A] mt-2.5">{t('admin:pay.emptyTitle')}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-[70px] px-6 text-center">
            <div className="font-bt-display font-bold text-4xl leading-none text-[#CDBFA6]">{t('admin:usr.noMatchBig')}</div>
          </div>
        ) : (
          <>
            {unpaidSorted.length > 0 && (
              <Group title={t('admin:pay.groupUnpaid')} dot="#F97316" bg="#FBF8F2" color="#0A0A0A" count={unpaidSorted.length}>
                {unpaidSorted.map(w => (
                  <PayRow key={w.workerId} w={w} paid={false} onPay={() => setPaying(w)} onNavigate={onNavigate}
                    lang={lang} blockers={budgetBlockers(w, remainingByProject)} />
                ))}
              </Group>
            )}
            {paid.length > 0 && (
              <Group title={t('admin:pay.groupPaid')} dot="#7A9A7E" bg="#F3F5F1" color="#2E6B34" count={paid.length}>
                {paid.map(w => (
                  <PayRow key={w.workerId} w={w} paid onPay={() => {}} onNavigate={onNavigate} lang={lang} blockers={[]} />
                ))}
              </Group>
            )}
          </>
        )}
      </div>

      {paying && (
        <ConfirmPaymentDialog
          worker={paying} from={from} to={to} lang={lang}
          blockers={budgetBlockers(paying, remainingByProject)}
          onClose={() => setPaying(null)}
          onDone={() => { setPaying(null); load(); }}
        />
      )}
    </div>
  );
}

function Group({ title, dot, bg, color, count, children }: {
  title: string; dot: string; bg: string; color: string; count: number; children: React.ReactNode;
}) {
  const { t } = useTranslation(['admin']);
  return (
    <div>
      <div className="flex items-center gap-3 px-5 pt-3 pb-2.5 border-b border-[#EDE7DB]" style={{ background: bg }}>
        <span className="w-2.5 h-2.5 block" style={{ background: dot }} />
        <Mono className="text-[10.5px] tracking-[0.14em] whitespace-nowrap" style={{ color }}>{title}</Mono>
        <span className="flex-1 h-px bg-[#DED4C2]" />
        <Mono className="text-[9.5px] text-[#B4A992] whitespace-nowrap">{t('admin:lab.peopleCount', { count })}</Mono>
      </div>
      {children}
    </div>
  );
}

function PayRow({ w, paid, onPay, onNavigate, lang, blockers }: {
  w: WorkerHoursSummary; paid: boolean; onPay: () => void; onNavigate: (s: string) => void; lang: string;
  blockers: { name: string; amount: number; remaining: number }[];
}) {
  const { t } = useTranslation(['admin']);
  const rateless = w.hourlyRate == null;
  const owed = amountOwed(w);
  const periodPaid = paidAmount(w);
  const lastDate = w.lastPaymentDate
    ? new Date(w.lastPaymentDate).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase()
    : null;

  return (
    <div onClick={() => { if (!paid && !rateless) onPay(); }}
      className={`flex gap-3.5 items-center px-5 py-4 border-b border-[#F0EBE1] transition-colors ${paid ? '' : 'cursor-pointer hover:bg-[#FBF8F2]'}`}
      style={{ borderLeft: !paid && rateless ? '3px solid #F97316' : '3px solid transparent', opacity: paid ? 0.72 : 1 }}>
      <span className={`w-10 h-10 flex items-center justify-center font-bt-mono text-[13px] font-semibold flex-shrink-0 ${
        paid ? 'bg-[#EDE5D6] text-[#8A8175]' : rateless ? 'bg-[#0A0A0A] text-[#F97316]' : 'bg-[#0A0A0A] text-[#F5F1E8]'
      }`}>
        {initials(w.workerName, w.workerUsername)}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] font-semibold text-[#0A0A0A]">{w.workerName || w.workerUsername}</span>
          <Mono className="text-[10px] normal-case tracking-normal text-[#A69C8D] truncate">{mainProject(w)}</Mono>
          {!paid && rateless && (
            <Mono className="text-[9px] font-semibold tracking-[0.06em] bg-[#F97316] text-[#0A0A0A] px-1.5 py-0.5">
              {t('admin:cost.ratelessTag')}
            </Mono>
          )}
          {paid && (
            <Mono className="inline-flex items-center gap-1 text-[9px] font-semibold tracking-[0.06em] bg-[#E8F0E5] text-[#2E6B34] px-1.5 py-0.5">
              <Check className="w-2.5 h-2.5" />{t('admin:pay.paidTag')}
            </Mono>
          )}
        </div>
        <Mono className="text-[10.5px] tracking-[0.04em] normal-case text-[#A69C8D]">
          {paid
            ? t('admin:pay.rowPaid', { date: lastDate ?? '—', amount: money(periodPaid) })
            : rateless
              ? t('admin:pay.rowRateless', { hours: unpaidHours(w).toFixed(1) })
              : lastDate
                ? t('admin:pay.rowUnpaid', { hours: unpaidHours(w).toFixed(1), date: lastDate, amount: money(periodPaid) })
                : t('admin:pay.rowUnpaidNever', { hours: unpaidHours(w).toFixed(1) })}
          {blockers.length > 0 && (
            <span className="text-[#EA580C] font-semibold"> · {t('admin:pay.touchesBudget')}</span>
          )}
        </Mono>
      </div>
      <div className="flex-shrink-0 text-right min-w-[104px]">
        <div className="flex items-baseline gap-0.5 justify-end">
          <span className={`font-bt-display font-bold text-base ${paid ? 'text-[#B4A992]' : rateless ? 'text-[#C6BBA6]' : 'text-[#8A8175]'}`}>$</span>
          <span className={`font-bt-display font-bold text-3xl leading-none ${paid ? 'text-[#8A8175]' : rateless ? 'text-[#C6BBA6]' : 'text-[#0A0A0A]'}`}>
            {paid ? money(periodPaid) : rateless ? '—' : money(owed ?? 0)}
          </span>
        </div>
        <Mono className="block text-[9px] tracking-[0.06em] text-[#B4A992] mt-0.5">
          {paid ? t('admin:pay.paidTag') : rateless ? t('admin:pay.notCalculable') : t('admin:pay.toPay')}
        </Mono>
      </div>
      <div className="flex-shrink-0 w-[150px] flex justify-end" onClick={e => e.stopPropagation()}>
        {!paid && !rateless && (
          <button onClick={onPay}
            className="inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#2E6B34] text-[#F5F1E8] px-3.5 py-2.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.07em] transition-colors">
            <CreditCard className="w-3.5 h-3.5" />{t('admin:pay.confirm')}
          </button>
        )}
        {!paid && rateless && (
          <button onClick={() => onNavigate('users')}
            className="inline-flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#C2410C] hover:text-[#F97316]">
            {t('admin:cost.setRate')} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/** The pay-day dialog: what exactly gets paid, and what it does to the budget. */
function ConfirmPaymentDialog({ worker, from, to, lang, blockers, onClose, onDone }: {
  worker: WorkerHoursSummary; from: string; to: string; lang: string;
  blockers: { name: string; amount: number; remaining: number }[];
  onClose: () => void; onDone: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True when the error is the budget guard, which deserves the loud treatment. */
  const [blocked, setBlocked] = useState(false);
  const [warnings, setWarnings] = useState<BudgetWarning[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const hours = unpaidHours(worker);
  const amount = amountOwed(worker) ?? 0;

  async function submit() {
    setSaving(true); setError(null);
    try {
      const res = await confirmPayment({
        workerId: worker.workerId, periodFrom: from, periodTo: to,
        notes: notes.trim() || null,
      });
      // The backend reports overruns after the fact; show them before closing.
      if (res.budgetWarnings?.length) { setWarnings(res.budgetWarnings); setSaving(false); return; }
      onDone();
    } catch (e) {
      // The budget guard rejects the payment outright (409). That's not a
      // technical failure — it's a decision the admin needs to see loudly.
      setBlocked(e instanceof ApiError && e.code === 'BUDGET_EXCEEDED');
      setError(e instanceof Error ? e.message : t('admin:pay.d.error'));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-[#0B0A09]/50 flex items-center justify-center p-6" onClick={() => !saving && onClose()}>
      <div onClick={e => e.stopPropagation()}
        className="w-[520px] max-w-full max-h-full overflow-y-auto bg-white border border-[#CDBFA6] shadow-2xl">
        {/* Ink header */}
        <div className="relative overflow-hidden bg-[#0A0A0A] text-[#F5F1E8] px-5 py-4">
          <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
          <div className="relative flex items-center justify-between">
            <Mono className="text-[11px] tracking-[0.14em] text-[#F97316]">{t('admin:pay.d.title')}</Mono>
            <button onClick={onClose} disabled={saving}
              className="w-7 h-7 border border-[#F5F1E8]/25 flex items-center justify-center hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-40">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative flex items-center gap-3 mt-3.5">
            <span className="w-11 h-11 bg-[#F97316] text-[#0A0A0A] flex items-center justify-center font-bt-mono text-[15px] font-semibold">
              {initials(worker.workerName, worker.workerUsername)}
            </span>
            <div className="min-w-0">
              <p className="font-bt-heading font-bold text-lg text-[#F5F1E8]">{worker.workerName || worker.workerUsername}</p>
              <Mono className="block text-[10.5px] normal-case tracking-normal text-[#F5F1E8]/60 mt-0.5 truncate">
                @{worker.workerUsername} · {mainProject(worker)}
              </Mono>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          {warnings ? (
            /* Budget overrun reported by the backend after committing */
            <>
              <div className="flex gap-3 items-start bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-4 py-3.5">
                <AlertTriangle className="w-5 h-5 text-[#EA580C] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bt-heading font-bold text-sm text-[#0A0A0A]">{t('admin:pay.d.budgetTitle')}</p>
                  <div className="text-[12.5px] text-[#43301F] leading-relaxed mt-1 space-y-2">
                    {/* Built from the payload, not w.message — that one is English-only. */}
                    {warnings.map((w, i) => (
                      <div key={i}>
                        <p>{t('admin:pay.d.budgetBody', {
                          remaining: money(w.remainingBudgetCents / 100),
                          projected: money(w.projectedLaborCostCents / 100),
                        })}</p>
                        {w.pendingWorkers?.length > 0 && (
                          <Mono className="block text-[10px] tracking-[0.06em] text-[#8A5A32] mt-1 normal-case">
                            {t('admin:pay.d.budgetWho', {
                              names: w.pendingWorkers.map(p => p.workerName ?? `#${p.workerId}`).join(', '),
                            })}
                          </Mono>
                        )}
                        <Mono className="block text-[10px] tracking-[0.06em] text-[#8A5A32] mt-0.5">
                          {t('admin:pay.d.budgetShort', { amount: money(Math.abs(w.effectiveRemainingCents) / 100) })}
                        </Mono>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={onDone}
                className="w-full mt-4 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] px-4 py-3 font-bt-mono text-[11px] uppercase tracking-[0.07em] font-semibold transition-colors">
                {t('common:buttons.close', { defaultValue: 'Cerrar' })}
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 border border-[#E4E4E7]">
                <div className="p-3.5 border-r border-b border-[#EDE7DB]">
                  <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175]">{t('admin:pay.d.period')}</Mono>
                  <Mono className="block text-[13px] normal-case tracking-normal text-[#0A0A0A] mt-1">{fmtRange(from, to, lang)}</Mono>
                </div>
                <div className="p-3.5 border-b border-[#EDE7DB]">
                  <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175]">{t('admin:pay.d.hoursToSettle')}</Mono>
                  <Mono className="block text-[13px] normal-case tracking-normal text-[#0A0A0A] mt-1">
                    {hours.toFixed(1)} h × ${worker.hourlyRate?.toFixed(2)}
                  </Mono>
                </div>
                <div className="col-span-2 p-3.5 bg-[#FBF8F2] flex items-center justify-between">
                  <Mono className="text-[10px] tracking-[0.1em] text-[#5A5346]">{t('admin:pay.d.amount')}</Mono>
                  <div className="flex items-baseline gap-0.5">
                    <span className="font-bt-display font-bold text-xl text-[#8A8175]">$</span>
                    <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">{money(amount)}</span>
                  </div>
                </div>
              </div>

              {/* Pre-flight budget check — the backend rejects the whole payment
                  when a jobsite can't cover it, so say so before they commit. */}
              {blockers.length > 0 && (
                <div className="flex gap-3 items-start bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-4 py-3.5 mt-4">
                  <AlertTriangle className="w-[18px] h-[18px] text-[#EA580C] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bt-heading font-bold text-sm text-[#0A0A0A]">
                      {t('admin:pay.d.preTitle', { project: blockers[0].name })}
                    </p>
                    <div className="text-[12.5px] text-[#43301F] leading-relaxed mt-1 space-y-1">
                      {blockers.map(b => (
                        <p key={b.name}>
                          {t('admin:pay.d.preBody', {
                            project: b.name, amount: money(b.amount),
                            remaining: money(b.remaining), over: money(b.amount - b.remaining),
                          })}
                        </p>
                      ))}
                      <p className="font-semibold">{t('admin:pay.d.preFix')}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Mono className="block text-[10px] tracking-[0.08em] text-[#5A5346] mb-2">{t('admin:pay.d.notes')}</Mono>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('admin:pay.d.notesPh')}
                  className="w-full h-14 resize-none border border-[#CDBFA6] bg-[#FAF7F0] px-3 py-2.5 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]" />
              </div>

              <div className="flex gap-2.5 items-center bg-[#F7F3EA] border border-[#ECE4D5] px-3 py-2.5 mt-3.5">
                <Check className="w-4 h-4 text-[#5A5346] flex-shrink-0" />
                <span className="text-[12px] text-[#5A5346] leading-snug">
                  {t('admin:pay.d.afterNote', { hours: hours.toFixed(1), name: (worker.workerName || worker.workerUsername).split(/\s+/)[0] })}
                </span>
              </div>

              {error && (
                <div className="mt-3 bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-3 py-2.5">
                  <span className="text-[12.5px] text-[#43301F]">{error}</span>
                </div>
              )}

              <div className="flex gap-2.5 mt-5">
                <button onClick={onClose} disabled={saving}
                  className="border border-[#DBD0BB] bg-white px-4 py-3 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] disabled:opacity-40">
                  {t('common:buttons.cancel')}
                </button>
                <button onClick={submit} disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0A0A0A] hover:bg-[#2E6B34] text-[#F5F1E8] px-4 py-3 font-bt-mono text-[11px] font-semibold uppercase tracking-[0.07em] disabled:opacity-60 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {t('admin:pay.d.confirmCta', { amount: money(amount) })}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function exportCsv(
  workers: WorkerHoursSummary[], from: string, to: string,
  isPaid: (w: WorkerHoursSummary) => boolean,
) {
  const header = ['Trabajador', 'Usuario', 'Tarifa', 'Horas sin pagar', 'A pagar', 'Estado', 'Ultimo pago', 'Pagado en el periodo'];
  const rows = workers.map(w => [
    w.workerName ?? '', w.workerUsername,
    w.hourlyRate?.toFixed(2) ?? '', unpaidHours(w).toFixed(1),
    (amountOwed(w) ?? 0).toFixed(2), isPaid(w) ? 'PAGADO' : 'PENDIENTE',
    w.lastPaymentDate ?? '', paidAmount(w).toFixed(2),
  ]);
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = `nomina-${from}-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
