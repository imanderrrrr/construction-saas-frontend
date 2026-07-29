import { useTranslation } from 'react-i18next';
import type { WorkerHoursSummary } from '../../services/time';

/**
 * Shared spine for the labour trio — Horas → Costo → Nómina.
 *
 * All three read the SAME aggregate (getAdminHoursReport); what makes them
 * different is which number leads and which question they answer. These
 * helpers keep them looking like family without making them interchangeable.
 */

export type LaborScreen = 'hours' | 'labor-cost' | 'labor-payroll';

export function Mono({ children, className = '', style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span className={`font-bt-mono uppercase tracking-[0.1em] ${className}`} style={style}>
      {children}
    </span>
  );
}

export function initials(fullName: string | null | undefined, username: string): string {
  const base = (fullName && fullName.trim()) || username;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "1,234.56" — money always carries two decimals in this trio. */
export function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};

/**
 * YYYY-MM-DD in the *browser's* timezone. toISOString() would answer in UTC,
 * which in Panama (UTC-5) rolls the jobsite day forward every evening.
 */
function ymd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Monday of the current week → today. */
export function weekRange(): { from: string; to: string } {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  const from = new Date(d);
  from.setDate(d.getDate() - day);
  return { from: ymd(from), to: ymd(d) };
}

export function monthRange(): { from: string; to: string } {
  const d = new Date();
  return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) };
}

/** "20 JUL – 22 JUL 2026" */
export function fmtRange(from: string, to: string, lang: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const loc = lang.startsWith('es') ? 'es-GT' : 'en-US';
  const clean = (s: string) => s.replace(/\./g, '').replace(/-/g, ' ');
  const a = clean(new Date(`${from}T00:00:00`).toLocaleDateString(loc, opts));
  const b = clean(new Date(`${to}T00:00:00`).toLocaleDateString(loc, { ...opts, year: 'numeric' }));
  return `${a} – ${b}`.toUpperCase();
}

export function fmtDay(iso: string, lang: string): string {
  return new Date(`${iso}T00:00:00`)
    .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { weekday: 'short', day: '2-digit' })
    .replace(/\./g, '').toUpperCase();
}

/** Unpaid hours, falling back to all approved hours when the API omits it. */
export function unpaidHours(w: WorkerHoursSummary): number {
  return w.unpaidApprovedHours ?? w.totalApprovedHours;
}

/** What the worker is owed right now; null when there's no rate to multiply by. */
export function amountOwed(w: WorkerHoursSummary): number | null {
  if (w.hourlyRate == null) return null;
  return unpaidHours(w) * w.hourlyRate;
}

/**
 * What the approved hours cost; null without a rate.
 *
 * Deliberately NOT the API's `projectedCost`, which only covers hours that are
 * still unpaid — a cost report has to answer "what did this period cost",
 * whether or not the money already went out. Paid vs unpaid is Nómina's job.
 */
export function projectedCost(w: WorkerHoursSummary): number | null {
  if (w.hourlyRate == null) return null;
  return w.totalApprovedHours * w.hourlyRate;
}

/**
 * What this worker's payment will draw from each jobsite.
 *
 * Confirming a payment deducts from every project the worker touched, one
 * ledger row each — so the budget check has to be per jobsite, not on the
 * worker's total.
 */
export function unpaidByProject(w: WorkerHoursSummary): { projectId: number; name: string; amount: number }[] {
  if (w.hourlyRate == null) return [];
  const tally = new Map<number, { name: string; amount: number }>();
  for (const d of w.dailyEntries ?? []) {
    if (d.paid || d.approvalStatus !== 'APPROVED' || !d.totalHours) continue;
    const cost = d.entryCost ?? d.totalHours * w.hourlyRate;
    const prev = tally.get(d.projectId);
    tally.set(d.projectId, { name: d.projectName, amount: (prev?.amount ?? 0) + cost });
  }
  return [...tally.entries()].map(([projectId, v]) => ({ projectId, ...v }));
}

/**
 * Jobsites this payment would push past their remaining contract.
 * Mirrors the backend's guard, which rejects the whole payment (409).
 */
export function budgetBlockers(
  w: WorkerHoursSummary,
  remainingByProject: Map<number, number>,
): { name: string; amount: number; remaining: number }[] {
  return unpaidByProject(w).flatMap(p => {
    const remaining = remainingByProject.get(p.projectId);
    if (remaining == null || p.amount <= remaining) return [];
    return [{ name: p.name, amount: p.amount, remaining }];
  });
}

/**
 * What has already been paid to this worker for the period on screen.
 *
 * NOT `lastPaymentAmountCents`: confirming one payment produces one ledger row
 * per jobsite, so the "last" row is just the final slice. A worker who split
 * the week across two sites would otherwise show a fraction of what they got.
 */
export function paidAmount(w: WorkerHoursSummary): number {
  const paid = (w.dailyEntries ?? []).filter(d => d.paid && d.approvalStatus === 'APPROVED');
  if (paid.length === 0) return (w.lastPaymentAmountCents ?? 0) / 100;
  return paid.reduce((s, d) => {
    if (d.entryCost != null) return s + d.entryCost;
    return s + (w.hourlyRate != null ? (d.totalHours ?? 0) * w.hourlyRate : 0);
  }, 0);
}

/**
 * One entry per calendar day the worker actually shows up in.
 *
 * The API returns one entry per record, so a worker who split a day across two
 * jobsites appears twice — which is why `daysWorked` can read "5 of 3 days".
 * Collapsing by date is what makes "each square is one day" true.
 */
export function attendanceDays(
  w: WorkerHoursSummary,
): { date: string; hours: number; late: boolean; present: boolean }[] {
  const byDate = new Map<string, { hours: number; late: boolean; present: boolean }>();
  for (const d of w.dailyEntries ?? []) {
    const prev = byDate.get(d.date) ?? { hours: 0, late: false, present: false };
    byDate.set(d.date, {
      hours: prev.hours + (d.totalHours ?? 0),
      late: prev.late || d.isLate === true,
      present: prev.present || d.clockIn != null,
    });
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));
}

/** Calendar days the period covers, inclusive — the "X of Y days" denominator. */
export function periodDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Hours this worker has sitting in PENDING — not yet counted anywhere. */
export function pendingHours(w: WorkerHoursSummary): number {
  return (w.dailyEntries ?? [])
    .filter(d => d.approvalStatus === 'PENDING')
    .reduce((s, d) => s + (d.totalHours ?? 0), 0);
}

/** The jobsite a worker spent most of the period on — for grouping/labels. */
export function mainProject(w: WorkerHoursSummary): string {
  const tally = new Map<string, number>();
  for (const d of w.dailyEntries ?? []) {
    if (!d.projectName) continue;
    tally.set(d.projectName, (tally.get(d.projectName) ?? 0) + (d.totalHours ?? 0));
  }
  let best = ''; let bestH = -1;
  tally.forEach((h, name) => { if (h > bestH) { best = name; bestH = h; } });
  return best;
}

/**
 * The HORAS | COSTO | NÓMINA switch that sits in every header — the thing that
 * tells the admin these are three views of one story, and lets them hop.
 */
export function LaborSwitch({ current, onNavigate }: {
  current: LaborScreen;
  onNavigate: (section: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  const tabs: { key: LaborScreen; label: string }[] = [
    { key: 'hours', label: t('admin:lab.tab.hours') },
    { key: 'labor-cost', label: t('admin:lab.tab.cost') },
    { key: 'labor-payroll', label: t('admin:lab.tab.payroll') },
  ];
  return (
    <div className="flex border border-[#DBD0BB]">
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onNavigate(tab.key)}
          className={`font-bt-mono text-[9.5px] uppercase tracking-[0.1em] px-2 py-1 transition-colors ${
            current === tab.key ? 'bg-[#0A0A0A] text-[#F5F1E8]' : 'text-[#A69C8D] hover:text-[#C2410C]'
          }`}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Shared filter shell: search + range + project, with removable chips. */
export function LaborFilters({
  q, onQ, range, onRange, project, onProject, projects, extra, chips, onClear,
}: {
  q: string; onQ: (v: string) => void;
  range: 'week' | 'month'; onRange: (v: 'week' | 'month') => void;
  project: string; onProject: (v: string) => void;
  projects: { id: number; name: string }[];
  extra?: React.ReactNode;
  chips: { key: string; label: string; clear: () => void }[];
  onClear: () => void;
}) {
  const { t } = useTranslation(['admin']);
  return (
    <div className="bg-white border border-[#E4E4E7] p-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[190px] max-w-[280px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A69C8D" strokeWidth="2"
            strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
          </svg>
          <input value={q} onChange={e => onQ(e.target.value)} placeholder={t('admin:lab.f.searchPlaceholder')}
            className="w-full border border-[#DBD0BB] bg-[#FAF7F0] py-2 pl-8 pr-3 text-[13px] text-[#0A0A0A] outline-none focus:border-[#F97316]" />
        </div>
        <select value={range} onChange={e => onRange(e.target.value as 'week' | 'month')}
          className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer">
          <option value="week">{t('admin:lab.f.week')}</option>
          <option value="month">{t('admin:lab.f.month')}</option>
        </select>
        <select value={project} onChange={e => onProject(e.target.value)}
          className="appearance-none border border-[#DBD0BB] bg-[#FAF7F0] px-3 py-2 font-bt-mono text-[11px] uppercase tracking-[0.06em] text-[#0A0A0A] cursor-pointer max-w-[230px]">
          <option value="">{t('admin:lab.f.allProjects')}</option>
          {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>
        {extra}
        {chips.length > 0 && (
          <button onClick={onClear}
            className="ml-auto font-bt-mono text-[10.5px] uppercase tracking-[0.1em] font-semibold text-[#C2410C] hover:text-[#F97316]">
            {t('admin:audit.f.clear')} ✕
          </button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#EDE7DB]">
          {chips.map(c => (
            <button key={c.key} onClick={c.clear}
              className="inline-flex items-center gap-2 border border-[#DBD0BB] bg-[#F3EEE4] px-2.5 py-1 font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#0A0A0A] hover:border-[#F97316]">
              {c.label} <span className="text-[#8A8175]">✕</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Row skeleton shared by the three lists. */
export function LaborSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="py-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3.5 items-center px-5 py-4 border-b border-[#F0EBE1]">
          <div className="w-10 h-10 bg-[#EAE4D8] animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="w-1/3 h-3 bg-[#EAE4D8] animate-pulse mb-2" />
            <div className="w-1/2 h-2 bg-[#EAE4D8] animate-pulse" />
          </div>
          <div className="w-20 h-7 bg-[#EAE4D8] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Shared section header: kicker + switch + display title + summary line. */
export function LaborHeader({
  screen, onNavigate, title, summary, alert, right,
}: {
  screen: LaborScreen;
  onNavigate: (section: string) => void;
  title: string;
  summary: string;
  alert?: string | null;
  right?: React.ReactNode;
}) {
  const { t } = useTranslation(['admin']);
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t(`admin:lab.kicker.${screen}`)}</Mono>
          <LaborSwitch current={screen} onNavigate={onNavigate} />
        </div>
        <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1.5">
          {title}
        </h2>
        <Mono className="block text-[12.5px] tracking-[0.06em] normal-case text-[#5A5346] mt-2">
          {summary}
          {alert && <span className="text-[#EA580C]"> · {alert}</span>}
        </Mono>
      </div>
      {right}
    </div>
  );
}
