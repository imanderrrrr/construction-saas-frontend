// Intermediate plan-selection screen for the BuildTrack public site.
//
// Visitors who hit a generic "Start free" CTA from the landing land here
// instead of /signup, so they must explicitly pick Pro or Business and a
// billing interval before they can create a company. Pricing in the
// landing's <Pricing /> section already routes straight to /signup with
// the proper query params, so that path stays untouched.
//
// Reuses the same pricing strings (`pricing` namespace) as Pricing.tsx so
// the displayed amounts stay in lockstep with the public pricing page.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HardHat,
  Sparkles,
} from 'lucide-react';

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

// Same feature catalogue as Pricing.tsx — keep these in sync if the
// pricing.json shape changes.
const FEATURES_PER_PLAN = 13;

const PLAN_CODE_BY_KEY = {
  pro: 'PRO',
  business: 'BUSINESS',
} as const;

const BILLING_INTERVAL_BY_KEY = {
  monthly: 'MONTHLY',
  annual: 'ANNUAL',
} as const;

type PlanKey = keyof typeof PLAN_CODE_BY_KEY;
type BillingKey = keyof typeof BILLING_INTERVAL_BY_KEY;

interface PlanCardProps {
  planKey: PlanKey;
  billing: BillingKey;
  featured?: boolean;
  onSelect: (planKey: PlanKey) => void;
}

function PlanCard({ planKey, billing, featured = false, onSelect }: PlanCardProps) {
  const { t } = useTranslation('pricing');

  const name = t(`plans.${planKey}.name`);
  const tagline = t(`plans.${planKey}.tagline`);
  const monthlyPrice = t(`plans.${planKey}.priceMonthly`);
  const annualPerMonth = t(`plans.${planKey}.priceAnnualPerMonth`);
  const annualTotal = t(`plans.${planKey}.priceAnnualTotal`);
  const saving = t(`plans.${planKey}.saving`);
  const ctaLabel = t(`plans.${planKey}.ctaLabel`);
  const ctaHint = t(`plans.${planKey}.ctaHint`);

  const features = Array.from({ length: FEATURES_PER_PLAN }, (_, i) =>
    t(`plans.${planKey}.feature.${i}`),
  );

  const showAnnual = billing === 'annual';
  const displayPrice = showAnnual ? annualPerMonth : monthlyPrice;

  return (
    <Card
      aria-label={`${name} plan`}
      className={[
        'relative flex flex-col p-0 overflow-hidden',
        featured
          ? 'border-2 border-[#F97316] shadow-xl shadow-[#F97316]/10'
          : 'border border-[#D4D4D8]',
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
        <CardDescription className="text-sm text-[#71717A] mt-1">
          {tagline}
        </CardDescription>

        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span
              data-testid={`choose-plan-price-${planKey}`}
              className="text-5xl font-bold tracking-tight text-[#0A0A0A]"
            >
              {displayPrice}
            </span>
            <span className="text-base text-[#71717A]">{t('perMonth')}</span>
          </div>

          {showAnnual ? (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-[#71717A]">
                {annualTotal} {t('billing.billedAnnually')}
              </p>
              <Badge
                variant="secondary"
                className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold"
              >
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
          <p className="text-xs font-medium text-[#0A0A0A] mb-3">
            {t('plans.business.everythingInPro')}
          </p>
        )}
        <ul className="space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  featured ? 'text-[#F97316]' : 'text-[#0A0A0A]'
                }`}
                aria-hidden="true"
              />
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
            featured
              ? 'bg-[#F97316] hover:bg-[#C2410C] text-white'
              : 'bg-[#0A0A0A] hover:bg-[#27272A] text-white',
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

export function ChoosePlan() {
  const { t } = useTranslation(['pricing', 'auth']);
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingKey>('monthly');

  const goToSignup = (planKey: PlanKey) => {
    const planCode = PLAN_CODE_BY_KEY[planKey];
    const billingInterval = BILLING_INTERVAL_BY_KEY[billing];
    navigate(`/signup?plan=${planCode}&interval=${billingInterval}`);
  };

  const goBack = () => {
    // Prefer the previous page if there is one (e.g. came from landing),
    // otherwise fall back to "/" so we never strand the user on a blank
    // history entry.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">
      {/* Header — visually consistent with Landing.tsx */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            data-testid="choose-plan-back"
            className="inline-flex items-center gap-2 text-sm text-[#71717A] hover:text-[#0A0A0A] transition"
            aria-label={t('auth:choosePlan.back')}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{t('auth:choosePlan.back')}</span>
          </button>

          <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-lg">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F97316] text-white">
              <HardHat className="w-5 h-5" />
            </span>
            <span>
              Build<span className="text-[#F97316]">Track</span>
            </span>
          </span>

          <LanguageSwitcher />
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4F4F5] border border-[#D4D4D8] text-xs font-medium text-[#71717A] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
              {t('auth:choosePlan.eyebrow')}
            </span>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-tight mb-4">
              {t('auth:choosePlan.title')}
            </h1>

            <p className="text-base text-[#71717A] leading-relaxed">
              {t('auth:choosePlan.subtitle')}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span
              className={`text-sm font-medium transition ${
                billing === 'monthly' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
              }`}
            >
              {t('pricing:billing.monthly')}
            </span>
            <Switch
              checked={billing === 'annual'}
              onCheckedChange={(checked) => setBilling(checked ? 'annual' : 'monthly')}
              aria-label={`${t('pricing:billing.monthly')} / ${t('pricing:billing.annual')}`}
            />
            <span
              className={`text-sm font-medium transition ${
                billing === 'annual' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
              }`}
            >
              {t('pricing:billing.annual')}
            </span>
            {billing === 'annual' && (
              <Badge className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold ml-1">
                {t('pricing:billing.annualBadge')}
              </Badge>
            )}
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <PlanCard planKey="pro" billing={billing} onSelect={goToSignup} />
            <PlanCard
              planKey="business"
              billing={billing}
              featured
              onSelect={goToSignup}
            />
          </div>

          <p className="mt-10 text-center text-xs text-[#71717A]">
            {t('auth:choosePlan.note')}
          </p>
        </div>
      </section>
    </div>
  );
}
