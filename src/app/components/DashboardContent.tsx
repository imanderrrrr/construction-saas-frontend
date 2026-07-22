import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, ChevronRight,
  Clock, HandCoins, ListChecks, RefreshCw, Wallet,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { searchAuditLogs, type AuditLogDTO } from '../services/audit';
import { listProjects } from '../services/projects';
import {
  getBudgetBlock, getMoneyBlock, getProjectPulse, getTodayBlock,
  type BudgetBlock, type MoneyBlock, type ProjectPulse, type TodayBlock,
} from '../services/dashboard';
import { businessToday, fmtDateTime } from '../helpers/dateTime';
import { AuthService } from '../services/auth';

/**
 * Redesigned admin dashboard — the landing's industrial language brought into
 * the panel: Big Shoulders display numerals, IBM Plex Mono micro-labels, ink
 * hero blocks with a blueprint grid, bone-paper surfaces, orange only where it
 * asks for attention.
 *
 * Blocks fail independently: each renders data, its skeleton, or a quiet
 * fallback, so one broken aggregate never blanks the screen.
 */

type BlockState<T> = { state: 'loading' | 'ok' | 'error'; data: T | null };

const loading = { state: 'loading' as const, data: null };

/** "$18,450" — cents → whole dollars, no decimals (the design's marker style). */
function money(cents: number): string {
  return Math.round(cents / 100).toLocaleString('en-US');
}

/** Display numeral with the $ deliberately smaller and top-aligned (design fix). */
function BigMoney({ cents, className = '' }: { cents: number; className?: string }) {
  return (
    <span className={`font-bt-display font-bold leading-none tracking-tight ${className}`}>
      <span className="align-top text-[0.55em] mr-0.5">$</span>
      {money(cents)}
    </span>
  );
}

function MonoLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-bt-mono text-[10px] uppercase tracking-[0.12em] ${className}`}>
      {children}
    </p>
  );
}

/** Blueprint grid backdrop for ink blocks — same motif as the landing hero. */
const GRID_BG: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

export function DashboardContent({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const username = AuthService.getUsername();

  const [moneyB, setMoneyB] = useState<BlockState<MoneyBlock>>(loading);
  const [todayB, setTodayB] = useState<BlockState<TodayBlock>>(loading);
  const [budgetB, setBudgetB] = useState<BlockState<BudgetBlock>>(loading);
  const [activity, setActivity] = useState<BlockState<AuditLogDTO[]>>(loading);
  const [obras, setObras] = useState<{ id: number; name: string }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    const date = businessToday();
    setMoneyB(loading); setTodayB(loading); setBudgetB(loading); setActivity(loading);

    const [m, td, b, a, p] = await Promise.allSettled([
      getMoneyBlock(date),
      getTodayBlock(date),
      getBudgetBlock(),
      searchAuditLogs({ page: 0, size: 5 }),
      listProjects({ status: 'ACTIVE', page: 0, size: 100 }),
    ]);
    setMoneyB(m.status === 'fulfilled' ? { state: 'ok', data: m.value } : { state: 'error', data: null });
    setTodayB(td.status === 'fulfilled' ? { state: 'ok', data: td.value } : { state: 'error', data: null });
    setBudgetB(b.status === 'fulfilled' ? { state: 'ok', data: b.value } : { state: 'error', data: null });
    setActivity(a.status === 'fulfilled' ? { state: 'ok', data: a.value.content } : { state: 'error', data: null });
    if (p.status === 'fulfilled') {
      setObras(p.value.content.map(pr => ({ id: pr.id, name: pr.name })));
    }
    setLastUpdated(fmtDateTime(new Date().toISOString(), i18n.language));
  }, [i18n.language]);

  useEffect(() => { load(); }, [load]);

  const anyError = [moneyB, todayB, budgetB].some(b => b.state === 'error');

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <MonoLabel className="text-[#71717A] mb-1">{t('admin:dash.kicker')}</MonoLabel>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A]">
            {t('admin:dash.title')}
          </h2>
          <p className="text-sm text-[#52525B] mt-1.5">{t('admin:dash.subtitle')}</p>
        </div>
        <div className="text-right">
          <MonoLabel className="text-[#71717A]">
            {t('admin:dash.todayStamp', { date: businessToday() })}
          </MonoLabel>
          {lastUpdated && (
            <button onClick={load}
              className="mt-1 inline-flex items-center gap-1.5 font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#71717A] hover:text-[#F97316] transition-colors">
              <RefreshCw className="w-3 h-3" />{t('admin:dash.refreshed', { time: lastUpdated })}
            </button>
          )}
        </div>
      </div>

      {anyError && (
        <div className="flex items-center justify-between border border-red-200 bg-red-50 px-4 py-2.5 rounded-lg">
          <p className="text-xs text-red-700">{t('admin:dash.partialError')}</p>
          <button onClick={load} className="text-xs font-semibold text-red-700 underline">
            {t('common:buttons.retry')}
          </button>
        </div>
      )}

      {/* ── DINERO (hero) ──────────────────────────────────────────────── */}
      <section data-tour="money" aria-label={t('admin:dash.money.label')}
        className="relative bg-[#0A0A0A] text-white rounded-xl overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={GRID_BG} />
        <div className="relative p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <MonoLabel className="text-white/90">
              <span className="text-[#F97316] mr-2">■</span>{t('admin:dash.money.label')}
            </MonoLabel>
            <MonoLabel className="text-white/25 hidden sm:block">{t('admin:dash.revStamp')}</MonoLabel>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-white/10">
            {/* Por cobrar vencido — the number that hurts, in orange */}
            <div className="md:pr-6">
              <MonoLabel className="text-[#F97316] mb-2">{t('admin:dash.money.overdue')}</MonoLabel>
              {moneyB.state === 'loading' ? <Skeleton className="h-14 w-40 bg-white/10" /> : (
                <>
                  <BigMoney cents={moneyB.data?.receivablesOverdue.amountCents ?? 0}
                    className={`text-5xl md:text-6xl ${(moneyB.data?.receivablesOverdue.count ?? 0) > 0 ? 'text-[#F97316]' : 'text-white/40'}`} />
                  <MonoLabel className="text-white/50 mt-2.5">
                    {(moneyB.data?.receivablesOverdue.count ?? 0) > 0
                      ? t('admin:dash.money.overdueMeta', {
                          count: moneyB.data?.receivablesOverdue.count ?? 0,
                          days: moneyB.data?.receivablesOverdue.oldestDays ?? 0,
                        })
                      : t('admin:dash.money.overdueZero')}
                  </MonoLabel>
                  <button onClick={() => onNavigate('accounts-receivable')}
                    className="mt-4 inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white font-bt-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 transition-colors">
                    {t('admin:dash.money.overdueCta')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Por pagar próximos 7 días */}
            <div className="md:px-6">
              <MonoLabel className="text-white/60 mb-2">{t('admin:dash.money.dueSoon')}</MonoLabel>
              {moneyB.state === 'loading' ? <Skeleton className="h-12 w-32 bg-white/10" /> : (
                <>
                  <BigMoney cents={moneyB.data?.payablesDueSoon.amountCents ?? 0} className="text-4xl md:text-5xl text-white" />
                  <MonoLabel className="text-white/50 mt-2.5">
                    {t('admin:dash.money.dueSoonMeta', { count: moneyB.data?.payablesDueSoon.count ?? 0 })}
                  </MonoLabel>
                  <button onClick={() => onNavigate('accounts-payable')}
                    className="mt-4 inline-flex items-center gap-2 border border-white/25 hover:border-white/60 text-white font-bt-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 transition-colors">
                    {t('admin:dash.money.dueSoonCta')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Gastos por aprobar */}
            <div className="md:pl-6">
              <MonoLabel className="text-white/60 mb-2">{t('admin:dash.money.expenses')}</MonoLabel>
              {moneyB.state === 'loading' ? <Skeleton className="h-12 w-28 bg-white/10" /> : (
                <>
                  <BigMoney cents={moneyB.data?.expensesPending.amountCents ?? 0} className="text-4xl md:text-5xl text-white" />
                  <MonoLabel className="text-white/50 mt-2.5">
                    {t('admin:dash.money.expensesMeta', { count: moneyB.data?.expensesPending.count ?? 0 })}
                  </MonoLabel>
                  <button onClick={() => onNavigate('expenses')}
                    className="mt-4 inline-flex items-center gap-2 border border-[#F97316]/60 hover:bg-[#F97316]/10 text-[#F97316] font-bt-mono text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 transition-colors">
                    {t('admin:dash.money.expensesCta')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOY EN OBRA + PRESUPUESTO ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        <section data-tour="today" className="bg-white border border-[#E4E4E7] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <MonoLabel className="text-[#0A0A0A]">{t('admin:dash.today.label')}</MonoLabel>
            <MonoLabel className="text-[#A1A1AA]">{t('admin:dash.today.meta')}</MonoLabel>
          </div>
          {todayB.state === 'loading' ? (
            <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-8 w-2/3" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 divide-x divide-[#E4E4E7]">
                <div className="pr-4">
                  <span className="font-bt-display font-bold text-5xl leading-none text-[#0A0A0A]">
                    {todayB.data?.workersTotal ?? '—'}
                  </span>
                  <MonoLabel className="text-[#71717A] mt-2">{t('admin:dash.today.workers')}</MonoLabel>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    {t('admin:dash.today.spread', { count: todayB.data?.byProject.length ?? 0 })}
                  </p>
                </div>
                <div className="pl-4">
                  <span className="font-bt-display font-bold text-5xl leading-none text-[#0A0A0A]">
                    {todayB.data?.pendingApprovalRecords ?? '—'}
                  </span>
                  <MonoLabel className="text-[#71717A] mt-2">{t('admin:dash.today.pending')}</MonoLabel>
                  <button onClick={() => onNavigate('time-approvals')}
                    className="mt-2 inline-flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white font-bt-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 transition-colors">
                    {t('admin:dash.today.approveCta')} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {(todayB.data?.byProject.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {todayB.data!.byProject.map(p => (
                    <span key={p.projectId}
                      className="font-bt-mono text-[10px] uppercase tracking-[0.08em] border border-[#E4E4E7] bg-[#FAFAFA] text-[#3F3F46] px-2.5 py-1">
                      {p.projectName} · {p.workers}
                    </span>
                  ))}
                </div>
              )}

              {(todayB.data?.idleActiveProjects.length ?? 0) > 0 && (
                <div className="mt-4 border-l-2 border-[#F97316] bg-[#F97316]/5 px-3 py-2.5 space-y-1">
                  {todayB.data!.idleActiveProjects.slice(0, 3).map(p => (
                    <p key={p.id} className="text-xs text-[#3F3F46] flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                      <span className="min-w-0 truncate"><b>{p.name}</b> — {t('admin:dash.today.idle')}</span>
                      <button onClick={() => onNavigate('projects')}
                        className="text-[#F97316] font-semibold hover:underline whitespace-nowrap ml-auto">
                        {t('admin:dash.review')} →
                      </button>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section data-tour="budget" className="bg-white border border-[#E4E4E7] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <MonoLabel className="text-[#0A0A0A]">{t('admin:dash.budget.label')}</MonoLabel>
            <MonoLabel className="text-[#A1A1AA]">{t('admin:dash.budget.meta')}</MonoLabel>
          </div>
          {budgetB.state === 'loading' ? (
            <div className="space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (budgetB.data?.projects.length ?? 0) === 0 ? (
            <p className="text-sm text-[#71717A] py-6 text-center">{t('admin:dash.budget.empty')}</p>
          ) : (
            <div className="space-y-4">
              {budgetB.data!.projects.slice(0, 5).map(p => (
                <div key={p.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                      {p.name}
                      {p.critical && (
                        <span className="ml-2 font-bt-mono text-[9px] uppercase tracking-[0.1em] bg-[#F97316] text-white px-1.5 py-0.5">
                          {t('admin:dash.budget.critical')}
                        </span>
                      )}
                    </p>
                    <span className={`font-bt-display font-bold text-xl leading-none ${p.critical ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`}>
                      {p.consumedPct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F4F4F5] mt-1.5">
                    <div className={p.critical ? 'h-full bg-[#F97316]' : 'h-full bg-[#0A0A0A]'}
                      style={{ width: `${Math.min(p.consumedPct, 100)}%` }} />
                  </div>
                  <MonoLabel className="text-[#A1A1AA] mt-1">
                    {t('admin:dash.budget.rowMeta', { remaining: money(p.remainingCents), contract: money(p.contractCents) })}
                  </MonoLabel>
                </div>
              ))}
              {budgetB.data!.recentChangeOrder && (
                <p className="text-xs text-[#3F3F46] flex items-center gap-2 border-t border-[#E4E4E7] pt-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                  <span className="min-w-0 truncate">
                    <b>{t('admin:dash.budget.coBadge', { count: budgetB.data!.recentChangeOrder.countLast30Days })}</b>
                    {' · '}{budgetB.data!.recentChangeOrder.projectName} · +${money(budgetB.data!.recentChangeOrder.amountCents)}
                  </span>
                  <button onClick={() => onNavigate('projects')}
                    className="text-[#F97316] font-semibold hover:underline whitespace-nowrap ml-auto">
                    {t('admin:dash.review')} →
                  </button>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── PULSO DE OBRA ──────────────────────────────────────────────── */}
      <PulseSection obras={obras} username={username} onNavigate={onNavigate} />

      {/* ── ACTIVIDAD + ACCESOS ────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-[#E4E4E7] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <MonoLabel className="text-[#0A0A0A]">{t('admin:dash.activity.label')}</MonoLabel>
            <button onClick={() => onNavigate('audit')}
              className="font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#F97316] hover:underline inline-flex items-center gap-1">
              {t('admin:dash.activity.all')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {activity.state === 'loading' ? (
            <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (activity.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-[#71717A] py-4 text-center">{t('admin:dash.activity.empty')}</p>
          ) : (
            <ul className="divide-y divide-[#F4F4F5]">
              {activity.data!.map(ev => (
                <li key={ev.id} className="py-2 flex items-center gap-3 text-xs">
                  <span className="font-bt-mono text-[#A1A1AA] w-14 flex-shrink-0">
                    {ev.occurredAt ? fmtDateTime(ev.occurredAt, i18n.language).split(',').pop()?.trim() : '—'}
                  </span>
                  <span className="text-[#0A0A0A] font-medium truncate">{ev.actorUsername || '—'}</span>
                  <span className="font-bt-mono text-[10px] uppercase tracking-[0.06em] text-[#3F3F46] bg-[#F4F4F5] px-1.5 py-0.5 flex-shrink-0">
                    {ev.action}
                  </span>
                  <span className="text-[#A1A1AA] truncate hidden sm:inline">{ev.entityType ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white border border-[#E4E4E7] rounded-xl p-5">
          <MonoLabel className="text-[#0A0A0A] mb-3">{t('admin:dash.quick.label')}</MonoLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {([
              { icon: Clock, key: 'hours', nav: 'time-approvals', sub: todayB.data ? t('admin:dash.quick.hoursSub', { count: todayB.data.pendingApprovalRecords }) : null },
              { icon: CheckCircle2, key: 'expenses', nav: 'expenses', sub: moneyB.data ? `${moneyB.data.expensesPending.count} · $${money(moneyB.data.expensesPending.amountCents)}` : null },
              { icon: HandCoins, key: 'collect', nav: 'accounts-receivable', sub: moneyB.data ? t('admin:dash.quick.collectSub', { amount: money(moneyB.data.receivablesOverdue.amountCents) }) : null },
              { icon: CalendarPlus, key: 'sitelog', nav: 'projects', sub: t('admin:dash.quick.sitelogSub') },
              { icon: Wallet, key: 'payables', nav: 'accounts-payable', sub: moneyB.data ? `$${money(moneyB.data.payablesDueSoon.amountCents)} / 7d` : null },
              { icon: ListChecks, key: 'punch', nav: 'projects', sub: t('admin:dash.quick.punchSub') },
            ] as const).map(a => (
              <button key={a.key} onClick={() => onNavigate(a.nav)}
                className="group border border-[#E4E4E7] hover:border-[#F97316] bg-[#FAFAFA] hover:bg-white text-left p-3 transition-colors">
                <a.icon className="w-4 h-4 text-[#71717A] group-hover:text-[#F97316] transition-colors" />
                <p className="font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#0A0A0A] mt-2 leading-snug">
                  {t(`admin:dash.quick.${a.key}`)}
                </p>
                {a.sub && <p className="text-[10px] text-[#A1A1AA] mt-0.5 truncate">{a.sub}</p>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Pulso de obra: pick a jobsite, answer the client call in five seconds.
 * The chip rail is ONE row, right-aligned on desktop, with scroll contained to
 * the rail (never the page) and edge fades; the selection persists per user.
 */
function PulseSection({
  obras, username, onNavigate,
}: {
  obras: { id: number; name: string }[];
  username: string | null;
  onNavigate: (section: string) => void;
}) {
  const { t } = useTranslation(['admin']);
  const storageKey = `bt.dash.pulse.${username ?? 'anon'}`;

  const [selected, setSelected] = useState<number | null>(null);
  const [pulse, setPulse] = useState<BlockState<ProjectPulse>>(loading);
  const railRef = useRef<HTMLDivElement>(null);

  // Default: last choice if still active, else the first obra.
  useEffect(() => {
    if (obras.length === 0 || selected !== null) return;
    let saved: number | null = null;
    try { saved = Number(localStorage.getItem(storageKey)) || null; } catch { /* private mode */ }
    setSelected(obras.some(o => o.id === saved) ? saved : obras[0].id);
  }, [obras, selected, storageKey]);

  useEffect(() => {
    if (selected === null) return;
    try { localStorage.setItem(storageKey, String(selected)); } catch { /* private mode */ }
    let cancelled = false;
    setPulse(loading);
    getProjectPulse(selected, businessToday())
      .then(p => { if (!cancelled) setPulse({ state: 'ok', data: p }); })
      .catch(() => { if (!cancelled) setPulse({ state: 'error', data: null }); });
    // Keep the active chip visible INSIDE the rail only — no page scroll.
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>(`[data-obra="${selected}"]`);
    if (rail && el) {
      const target = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2;
      rail.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
    return () => { cancelled = true; };
  }, [selected, storageKey]);

  if (obras.length === 0) return null;

  const fin = pulse.data?.financial ?? null;

  return (
    <section data-tour="pulse" className="rounded-xl overflow-hidden border border-[#E4E4E7]">
      {/* Ink header with the rail */}
      <div className="relative bg-[#0A0A0A] text-white">
        <div className="absolute inset-0 pointer-events-none" style={GRID_BG} />
        <div className="relative px-5 py-4 flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
          <div className="min-w-0 flex-shrink-0">
            <MonoLabel className="text-white/90">
              <span className="text-[#F97316] mr-2">■</span>{t('admin:dash.pulse.label')}
            </MonoLabel>
            <h3 className="font-bt-heading font-semibold text-lg md:text-xl mt-1">
              {t('admin:dash.pulse.title')}
            </h3>
          </div>
          {/* Rail: ONE row, right-anchored, self-contained scroll */}
          <div className="relative min-w-0 w-full md:w-auto md:flex-1 md:max-w-[52%]">
            <div ref={railRef}
              className="flex gap-2 overflow-x-auto md:justify-end [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ maskImage: 'linear-gradient(90deg, transparent, black 20px, black calc(100% - 20px), transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 20px, black calc(100% - 20px), transparent)' }}>
              {obras.map((o, i) => (
                <button key={o.id} data-obra={o.id} onClick={() => setSelected(o.id)}
                  className={`flex-shrink-0 font-bt-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 border transition-colors whitespace-nowrap ${
                    selected === o.id
                      ? 'bg-[#F97316] border-[#F97316] text-white'
                      : 'border-white/25 text-white/80 hover:border-white/60'
                  }`}>
                  <span className={`mr-1.5 ${selected === o.id ? 'text-white/80' : 'text-white/40'}`}>
                    OB-{String(i + 1).padStart(2, '0')}
                  </span>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bone-paper body */}
      <div className="bg-[#EDE5D6]/60">
        {pulse.state === 'loading' ? (
          <div className="grid md:grid-cols-4 gap-4 p-5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : pulse.state === 'error' ? (
          <p className="text-sm text-[#71717A] p-6 text-center">{t('admin:dash.pulse.error')}</p>
        ) : (
          <div className="grid md:grid-cols-4 md:divide-x divide-[#D5C9B4]/60">
            {/* Última bitácora */}
            <div className="p-5">
              <MonoLabel className="text-[#3F3F46] mb-2">{t('admin:dash.pulse.sitelog')}</MonoLabel>
              {pulse.data?.lastSiteLog ? (
                <>
                  <MonoLabel className="text-[#F97316] mb-1.5">{pulse.data.lastSiteLog.workDate}</MonoLabel>
                  <p className="text-sm text-[#0A0A0A] leading-snug line-clamp-3">
                    {pulse.data.lastSiteLog.notes ?? t('admin:dash.pulse.sitelogNoNotes')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#71717A]">{t('admin:dash.pulse.sitelogEmpty')}</p>
              )}
              <button onClick={() => onNavigate('projects')}
                className="mt-3 font-bt-mono text-[10px] uppercase tracking-[0.1em] text-[#0A0A0A] hover:text-[#F97316] inline-flex items-center gap-1 transition-colors">
                {t('admin:dash.pulse.sitelogCta')} <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Pendientes */}
            <div className="p-5">
              <MonoLabel className="text-[#3F3F46] mb-2">{t('admin:dash.pulse.pending')}</MonoLabel>
              <div className="flex items-baseline gap-2">
                <span className="font-bt-display font-bold text-4xl leading-none text-[#0A0A0A]">
                  {pulse.data?.openPunchItems ?? 0}
                </span>
                <MonoLabel className="text-[#71717A]">{t('admin:dash.pulse.punchOpen')}</MonoLabel>
              </div>
              {(pulse.data?.openRfis ?? 0) > 0 && (
                <p className="mt-3 text-xs text-[#3F3F46] border-l-2 border-[#F97316] bg-white/60 px-2.5 py-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#F97316] flex-shrink-0" />
                  {t('admin:dash.pulse.rfiAlert', {
                    count: pulse.data!.openRfis,
                    days: pulse.data!.oldestOpenRfiDays ?? 0,
                  })}
                </p>
              )}
            </div>

            {/* Financiero exprés */}
            <div className="p-5">
              <MonoLabel className="text-[#3F3F46] mb-3">{t('admin:dash.pulse.financial')}</MonoLabel>
              {([
                { key: 'contract', cents: fin?.contractCents ?? null, pct: 100 },
                { key: 'invoiced', cents: fin?.invoicedCents ?? 0, pct: fin?.contractCents ? Math.min(100, Math.round(((fin.invoicedCents) * 100) / fin.contractCents)) : 0 },
                { key: 'collected', cents: fin?.collectedCents ?? 0, pct: fin?.contractCents ? Math.min(100, Math.round(((fin.collectedCents) * 100) / fin.contractCents)) : 0 },
              ] as const).map(row => (
                <div key={row.key} className="mb-2.5">
                  <div className="flex items-baseline justify-between">
                    <MonoLabel className="text-[#71717A]">{t(`admin:dash.pulse.${row.key}`)}</MonoLabel>
                    <span className="font-bt-mono text-sm font-semibold text-[#0A0A0A]">
                      {row.cents !== null ? `$${money(row.cents)}` : '—'}
                    </span>
                  </div>
                  <div className="h-1 bg-[#D5C9B4]/50 mt-1">
                    <div className="h-full bg-[#0A0A0A]" style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="flex items-baseline justify-between mt-3">
                <MonoLabel className="text-[#71717A]">{t('admin:dash.pulse.budgetPct')}</MonoLabel>
                <span className="font-bt-display font-bold text-xl leading-none text-[#0A0A0A]">
                  {fin?.budgetConsumedPct !== null && fin?.budgetConsumedPct !== undefined ? `${fin.budgetConsumedPct}%` : '—'}
                </span>
              </div>
            </div>

            {/* Hoy trabajaron */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <MonoLabel className="text-[#3F3F46]">{t('admin:dash.pulse.workers')}</MonoLabel>
                <MonoLabel className="text-[#A1A1AA]">
                  {t('admin:dash.pulse.workersCount', { count: pulse.data?.workersToday.length ?? 0 })}
                </MonoLabel>
              </div>
              {(pulse.data?.workersToday.length ?? 0) === 0 ? (
                <p className="text-sm text-[#71717A]">{t('admin:dash.pulse.workersEmpty')}</p>
              ) : (
                <ul className="space-y-1.5">
                  {pulse.data!.workersToday.slice(0, 6).map(name => (
                    <li key={name} className="flex items-center gap-2 text-sm text-[#0A0A0A]">
                      <span className="w-6 h-6 bg-[#0A0A0A] text-white font-bt-mono text-[9px] flex items-center justify-center flex-shrink-0">
                        {name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      <span className="truncate">{name}</span>
                    </li>
                  ))}
                  {pulse.data!.workersToday.length > 6 && (
                    <li className="text-xs text-[#71717A]">
                      +{pulse.data!.workersToday.length - 6} {t('admin:dash.pulse.workersMore')}
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
