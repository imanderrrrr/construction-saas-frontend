// Intermediate plan-selection screen for the BuildTrack public site.
//
// Visitors who hit a generic "Start free" CTA from the landing land here
// instead of /signup, so they must explicitly pick Pro or Business, a
// billing interval, AND whether to start with the 14-day free trial or
// pay immediately, before they can create a company. The trial choice
// rides the URL to /signup as `trial=true|false`; the actual Paddle
// behaviour (apply trial vs charge now) is wired in the signup checkout.
//
// Reuses the same pricing strings (`pricing` namespace) as Pricing.tsx so
// the displayed amounts stay in lockstep with the public pricing page.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, HardHat, Sparkles } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

const FEATURES_PER_PLAN = 13;

const PLAN_CODE_BY_KEY = { pro: 'PRO', business: 'BUSINESS' } as const;
const BILLING_INTERVAL_BY_KEY = { monthly: 'MONTHLY', annual: 'ANNUAL' } as const;

type PlanKey = keyof typeof PLAN_CODE_BY_KEY;
type BillingKey = keyof typeof BILLING_INTERVAL_BY_KEY;
type TrialMode = 'trial' | 'pay';

interface PlanCardProps {
  planKey: PlanKey;
  billing: BillingKey;
  trialMode: TrialMode;
  featured?: boolean;
  onSelect: (planKey: PlanKey) => void;
}

function PlanCard({ planKey, billing, trialMode, featured = false, onSelect }: PlanCardProps) {
  const { t } = useTranslation('pricing');

  const name = t(`plans.${planKey}.name`);
  const tagline = t(`plans.${planKey}.tagline`);
  const monthlyPrice = t(`plans.${planKey}.priceMonthly`);
  const annualPerMonth = t(`plans.${planKey}.priceAnnualPerMonth`);
  const annualTotal = t(`plans.${planKey}.priceAnnualTotal`);
  const saving = t(`plans.${planKey}.saving`);

  const features = Array.from({ length: FEATURES_PER_PLAN }, (_, i) => t(`plans.${planKey}.feature.${i}`));

  const showAnnual = billing === 'annual';
  const displayPrice = showAnnual ? annualPerMonth : monthlyPrice;

  // CTA + fine print reflect the trial-vs-pay choice.
  const ctaLabel = trialMode === 'trial' ? t(`plans.${planKey}.ctaLabel`) : t('cta.subscribe', 'Suscribirme y pagar');
  const ctaHint =
    trialMode === 'trial'
      ? t(`plans.${planKey}.ctaHint`)
      : t('cta.payHint', { defaultValue: 'Cobro hoy {{price}}/mes · cancela cuando quieras', price: displayPrice });

  return (
    <Card
      aria-label={`${name} plan`}
      className={[
        'relative flex flex-col p-0 overflow-hidden',
        featured ? 'border-2 border-[#F97316] shadow-xl shadow-[#F97316]/10' : 'border border-[#D4D4D8]',
      ].join(' ')}
    >
      {featured && (
        <div className="absolute top-0 inset-x-0 bg-[#F97316] text-white text-xs font-semibold tracking-wide py-1.5 px-4 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('plans.business.badge')}</span>
        </div>
      )}

      <CardHeader className={featured ? 'pt-12' : 'pt-8'}>
        <CardTitle className="text-2xl font-semibold text-[#0A0A0A]">{name}</CardTitle>
        <CardDescription className="text-sm text-[#71717A] mt-1">{tagline}</CardDescription>

        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span data-testid={`choose-plan-price-${planKey}`} className="text-5xl font-bold tracking-tight text-[#0A0A0A]">
              {displayPrice}
            </span>
            <span className="text-base text-[#71717A]">{t('perMonth')}</span>
          </div>

          {showAnnual ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-[#71717A]">
                {annualTotal} {t('billing.billedAnnually')}
              </p>
              <Badge variant="secondary" className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold">
                {t('save', { amount: saving })}
              </Badge>
            </div>
          ) : (
            <p className="mt-2 text-xs text-transparent select-none">·</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        {planKey === 'business' && (
          <p className="text-xs font-medium text-[#0A0A0A] mb-3">{t('plans.business.everythingInPro')}</p>
        )}
        <ul className="space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${featured ? 'text-[#F97316]' : 'text-[#0A0A0A]'}`} aria-hidden="true" />
              <span className="text-[#0A0A0A] leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pb-8">
        <Button
          onClick={() => onSelect(planKey)}
          data-testid={`choose-plan-select-${planKey}`}
          className={[
            'w-full h-11 text-base',
            featured ? 'bg-[#F97316] hover:bg-[#C2410C] text-white' : 'bg-[#0A0A0A] hover:bg-[#27272A] text-white',
          ].join(' ')}
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
        </Button>
        <p className="text-xs text-[#71717A] text-center">{ctaHint}</p>
      </CardFooter>
    </Card>
  );
}

// Segmented control: start a free trial vs. pay immediately.
function TrialChoice({ value, onChange }: { value: TrialMode; onChange: (v: TrialMode) => void }) {
  const { t } = useTranslation('auth');
  const options: { key: TrialMode; title: string; sub: string }[] = [
    { key: 'trial', title: t('choosePlan.trial.title', '14 días gratis'), sub: t('choosePlan.trial.sub', 'Sin cargo hoy') },
    { key: 'pay', title: t('choosePlan.pay.title', 'Pagar ahora'), sub: t('choosePlan.pay.sub', 'Activa al instante') },
  ];
  return (
    <div className="inline-flex gap-1 rounded-xl bg-[#F4F4F5] p-1.5">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={[
              'flex flex-col items-center rounded-lg px-7 py-2.5 transition',
              active ? 'border border-[#D4D4D8] bg-white shadow-sm' : 'border border-transparent',
            ].join(' ')}
          >
            <span className={`text-[15px] font-bold ${active ? 'text-[#0A0A0A]' : 'text-[#71717A]'}`}>{o.title}</span>
            <span className="text-xs text-[#71717A]">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChoosePlan() {
  const { t } = useTranslation(['pricing', 'auth']);
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingKey>('monthly');
  const [trialMode, setTrialMode] = useState<TrialMode>('trial');

  const goToSignup = (planKey: PlanKey) => {
    const planCode = PLAN_CODE_BY_KEY[planKey];
    const billingInterval = BILLING_INTERVAL_BY_KEY[billing];
    const trial = trialMode === 'trial';
    navigate(`/signup?plan=${planCode}&interval=${billingInterval}&trial=${trial}`);
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-white font-sans text-[#0A0A0A]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#F4F4F5] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <button
            type="button"
            onClick={goBack}
            data-testid="choose-plan-back"
            className="inline-flex items-center gap-2 text-sm text-[#71717A] transition hover:text-[#0A0A0A]"
            aria-label={t('auth:choosePlan.back')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{t('auth:choosePlan.back')}</span>
          </button>

          <span className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316] text-white">
              <HardHat className="h-5 w-5" />
            </span>
            <span>
              Build<span className="text-[#F97316]">Track</span>
            </span>
          </span>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] font-medium text-[#71717A] sm:inline">
              {t('auth:choosePlan.step', 'Paso 1 de 2')}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-14">
        <div className="mx-auto mb-9 max-w-2xl text-center">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {t('auth:choosePlan.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#71717A]">{t('auth:choosePlan.subtitle')}</p>
        </div>

        {/* Trial-vs-pay choice */}
        <div className="mb-7 flex justify-center">
          <TrialChoice value={trialMode} onChange={setTrialMode} />
        </div>

        {/* Billing toggle */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <span className={`text-sm font-medium transition ${billing === 'monthly' ? 'text-[#0A0A0A]' : 'text-[#71717A]'}`}>
            {t('pricing:billing.monthly')}
          </span>
          <Switch
            checked={billing === 'annual'}
            onCheckedChange={(checked) => setBilling(checked ? 'annual' : 'monthly')}
            aria-label={`${t('pricing:billing.monthly')} / ${t('pricing:billing.annual')}`}
          />
          <span className={`text-sm font-medium transition ${billing === 'annual' ? 'text-[#0A0A0A]' : 'text-[#71717A]'}`}>
            {t('pricing:billing.annual')}
          </span>
          {billing === 'annual' && (
            <Badge className="ml-1 border-0 bg-[#F97316]/10 text-[11px] font-semibold text-[#F97316]">
              {t('pricing:billing.annualBadge')}
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          <PlanCard planKey="pro" billing={billing} trialMode={trialMode} onSelect={goToSignup} />
          <PlanCard planKey="business" billing={billing} trialMode={trialMode} featured onSelect={goToSignup} />
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-[#71717A]">{t('auth:choosePlan.note')}</p>
      </section>
    </div>
  );
}
