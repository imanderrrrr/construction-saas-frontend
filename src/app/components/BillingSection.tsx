import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Mail, Pen, Zap } from 'lucide-react';
import { BillingService, type BillingStatusResponse } from '../services/billing';

/**
 * Suscripción — now a normal section INSIDE the panel (the old standalone page
 * that dropped the sidebar survives only for payment-locked tenants). Same
 * industrial language as the dashboard: an ink status hero with the date as the
 * hero number, a plan strip, a carácter alert when needed, and a single
 * contact CTA. No prices, no checkout — billing is negotiated by email.
 */

// Support inbox for plan/method changes. Change here if it ever moves.
const SUPPORT_EMAIL = 'hola@buildtrack.gt';

type VisualState = 'active' | 'trialing' | 'past_due' | 'canceling' | 'none';

function mailtoHref(orgHint: string | null): string {
  const subject = `Suscripción — ${orgHint ?? 'BuildTrack'}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** Backend billing snapshot → one of the five designed states. */
function toVisualState(s: BillingStatusResponse | null): VisualState {
  const v = s?.billingStatus ?? null;
  if (!v || v === 'CHECKOUT_PENDING' || v === 'CANCELED' || v === 'EXPIRED' || v === 'INCOMPLETE') return 'none';
  if (v === 'TRIALING' || s?.isTrialing) return 'trialing';
  if (v === 'PAST_DUE' || v === 'PAYMENT_REQUIRED') return 'past_due';
  if (v === 'ACTIVE') return s?.cancelAtPeriodEnd ? 'canceling' : 'active';
  return 'active';
}

function fmtDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '—';
  return new Date(iso)
    .toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/\./g, '').toUpperCase();
}

function fmtMonthYear(iso: string | null | undefined, lang: string): string {
  if (!iso) return '—';
  const s = new Date(iso).toLocaleDateString(lang.startsWith('es') ? 'es-GT' : 'en-US', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const GRID_LIGHT: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(245,241,232,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(245,241,232,0.055) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};
const GRID_INK: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(rgba(11,10,9,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(11,10,9,0.035) 1px, transparent 1px)',
  backgroundSize: '26px 26px',
};

function Mono({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={`font-bt-mono uppercase tracking-[0.12em] ${className}`} style={style}>{children}</span>;
}

export function BillingSection() {
  const { t, i18n } = useTranslation(['admin']);
  const lang = i18n.language;
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    BillingService.getStatus()
      .then(s => { if (!cancelled) { setStatus(s); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const vs = useMemo(() => toVisualState(status), [status]);
  const href = mailtoHref(null);
  const isPaddle = status?.hasPaddleSubscription === true;
  const attn = vs === 'trialing' || vs === 'past_due' || vs === 'canceling';

  // Hero content per state.
  const hero = useMemo(() => {
    const end = status?.currentPeriodEndsAt;
    const trialEnd = status?.trialEndsAt;
    switch (vs) {
      case 'active':
        return { dot: '#D5C9B4', label: t('admin:sub.st.active'), kicker: t('admin:sub.hero.renewKicker'),
          big: fmtDate(end, lang), sub: isPaddle ? t('admin:sub.hero.autoSub') : t('admin:sub.hero.manualSub'),
          tag: daysUntil(end) != null ? t('admin:sub.hero.inDays', { count: Math.max(0, daysUntil(end)!) }) : '' };
      case 'trialing': {
        const d = daysUntil(trialEnd) ?? 0;
        return { dot: '#F97316', label: t('admin:sub.st.trialing'), kicker: t('admin:sub.hero.trialKicker'),
          big: t('admin:sub.hero.days', { count: Math.max(0, d) }), sub: t('admin:sub.hero.until', { date: fmtDate(trialEnd, lang) }),
          tag: t('admin:sub.hero.planTag') };
      }
      case 'past_due': {
        const d = Math.abs(daysUntil(end) ?? 0);
        return { dot: '#F97316', label: t('admin:sub.st.pastDue'), kicker: t('admin:sub.hero.expiredKicker'),
          big: t('admin:sub.hero.daysAgo', { count: d }), sub: t('admin:sub.hero.validUntilManual', { date: fmtDate(end, lang) }),
          tag: t('admin:sub.hero.actionTag') };
      }
      case 'canceling':
        return { dot: '#F97316', label: t('admin:sub.st.canceling'), kicker: t('admin:sub.hero.activeUntil'),
          big: fmtDate(end, lang), sub: t('admin:sub.hero.thenCloses'), tag: t('admin:sub.hero.cancelsTag') };
      default:
        return { dot: 'rgba(245,241,232,0.4)', label: t('admin:sub.st.none'), kicker: t('admin:sub.hero.readyKicker'),
          big: t('admin:sub.hero.activateBig'), sub: t('admin:sub.hero.coordSub'), tag: '' };
    }
  }, [vs, status, lang, t, isPaddle]);

  // Optional carácter alert per state.
  const alert = useMemo(() => {
    switch (vs) {
      case 'trialing': return { title: t('admin:sub.alert.trial.t'), body: t('admin:sub.alert.trial.b'), cta: t('admin:sub.alert.trial.cta') };
      case 'past_due': return { title: t('admin:sub.alert.pastDue.t'), body: t('admin:sub.alert.pastDue.b'), cta: t('admin:sub.alert.pastDue.cta') };
      case 'canceling': return { title: t('admin:sub.alert.canceling.t'), body: t('admin:sub.alert.canceling.b'), cta: t('admin:sub.alert.canceling.cta') };
      default: return null;
    }
  }, [vs, t]);

  const planLabel = status?.planCode
    ? `${status.planCode} · ${status.billingInterval ? t(`admin:sub.interval.${status.billingInterval}`) : ''}`.trim()
    : '—';
  const methodLabel = vs === 'none' ? '—' : (isPaddle ? t('admin:sub.method.auto') : t('admin:sub.method.manual'));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Mono className="text-[11px] tracking-[0.15em] text-[#71717A]">{t('admin:sub.kicker')}</Mono>
          <h2 className="font-bt-display font-bold uppercase text-4xl md:text-5xl leading-none text-[#0A0A0A] mt-1">
            {t('admin:sub.title')}
          </h2>
          <p className="text-sm text-[#52525B] mt-1.5">{t('admin:sub.subtitle')}</p>
        </div>
        <div className="text-right">
          <Mono className="block text-[10px] text-[#A1A1AA]">{t('admin:sub.negotiated')}</Mono>
        </div>
      </div>

      {loading ? (
        <div className="bg-[#0A0A0A] rounded-xl h-56 animate-pulse" />
      ) : error ? (
        <div className="border border-red-200 bg-red-50 px-4 py-6 rounded-xl text-center">
          <p className="text-sm text-red-700">{t('admin:sub.error')}</p>
        </div>
      ) : (
        <>
          {/* Status hero */}
          <section className="relative overflow-hidden bg-[#0A0A0A] text-[#F5F1E8] rounded-xl p-6 md:p-7">
            <div className="absolute inset-0 pointer-events-none" style={GRID_LIGHT} />
            <div className="relative flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 block" style={{ background: hero.dot }} />
                <Mono className="text-[12px] tracking-[0.14em] text-[#F5F1E8]">{hero.label}</Mono>
              </div>
              <Mono className="text-[10px] tracking-[0.14em] text-[#F5F1E8]/40 border border-[#F5F1E8]/20 px-2.5 py-1">REV 07.2026</Mono>
            </div>
            <div className="relative flex items-end justify-between gap-6 flex-wrap">
              <div className="min-w-0">
                <Mono className={`block text-[12px] tracking-[0.13em] mb-2 ${attn ? 'text-[#F97316]' : 'text-[#F5F1E8]/60'}`}>{hero.kicker}</Mono>
                <div className="font-bt-display font-bold leading-[0.84] tracking-tight text-6xl md:text-7xl"
                  style={{ color: attn ? '#F97316' : '#F5F1E8' }}>
                  {hero.big}
                </div>
                <Mono className="block text-[11px] tracking-[0.06em] normal-case text-[#F5F1E8]/60 mt-3">{hero.sub}</Mono>
              </div>
              {hero.tag && (
                <Mono className="text-[11px] font-semibold tracking-[0.1em] px-3 py-2 whitespace-nowrap"
                  style={{ color: attn ? '#F97316' : '#F5F1E8', border: `1px solid ${attn ? 'rgba(249,115,22,0.55)' : 'rgba(245,241,232,0.28)'}` }}>
                  {hero.tag}
                </Mono>
              )}
            </div>
          </section>

          {/* Plan strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border border-[#E4E4E7]">
            <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB]">
              <Mono className="block text-[10px] text-[#8A8175] mb-2">{t('admin:sub.plan')}</Mono>
              <div className="font-bt-display font-bold text-2xl leading-none text-[#0A0A0A]">{planLabel}</div>
            </div>
            <div className="p-4 md:px-5 sm:border-r border-[#EDE7DB] border-t sm:border-t-0">
              <Mono className="block text-[10px] text-[#8A8175] mb-2">{t('admin:sub.method.label')}</Mono>
              <div className="flex items-center gap-2">
                {vs !== 'none' && (isPaddle ? <Zap className="w-4 h-4 text-[#0A0A0A]" /> : <Pen className="w-4 h-4 text-[#0A0A0A]" />)}
                <span className="text-base font-semibold text-[#0A0A0A]">{methodLabel}</span>
              </div>
            </div>
            <div className="p-4 md:px-5 border-t sm:border-t-0">
              <Mono className="block text-[10px] text-[#8A8175] mb-2">{t('admin:sub.since')}</Mono>
              <div className="text-base font-semibold text-[#0A0A0A] pt-0.5">
                {vs === 'none' ? '—' : fmtMonthYear(status?.currentPeriodStartsAt, lang)}
              </div>
            </div>
          </div>

          {/* Carácter alert */}
          {alert && (
            <div className="flex gap-3.5 items-start bg-[#FBEDE0] border border-[#F6CFA6] border-l-[3px] border-l-[#F97316] px-4 py-4">
              <AlertTriangle className="w-5 h-5 text-[#EA580C] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bt-heading font-bold text-base text-[#0A0A0A]">{alert.title}</p>
                <p className="text-[13.5px] leading-relaxed text-[#43301F] mt-1">{alert.body}</p>
                <a href={href} className="mt-3 inline-flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-[#0A0A0A] font-bt-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-3.5 py-2">
                  {alert.cta} <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Contact — the only commercial CTA */}
          <div className="relative overflow-hidden bg-[#EDE5D6] border border-[#DBD0BB] px-5 py-5 flex justify-between items-center gap-6 flex-wrap">
            <div className="absolute inset-0 pointer-events-none" style={GRID_INK} />
            <div className="relative min-w-0 max-w-[620px]">
              <Mono className="block text-[10.5px] text-[#8A8175] mb-1.5">{t('admin:sub.talk')}</Mono>
              <p className="font-bt-heading font-bold text-lg md:text-xl leading-snug text-[#0A0A0A]">
                {vs === 'none' ? t('admin:sub.contact.none') : t('admin:sub.contact.default')}
              </p>
              <p className="text-[13px] text-[#5A5346] mt-1.5">{t('admin:sub.contact.hint')}</p>
            </div>
            <a href={href} className="relative inline-flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#F97316] text-[#F5F1E8] hover:text-[#0A0A0A] font-bt-mono text-[12px] font-semibold uppercase tracking-[0.1em] px-5 py-3.5 whitespace-nowrap flex-shrink-0 transition-colors">
              {vs === 'none' ? t('admin:sub.cta.activate') : t('admin:sub.cta.write')} <Mail className="w-4 h-4" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
