// Public pricing section for the BuildTrack landing page.
//
// Pricing model: two flat tiers (Pro / Business) — no per-user billing.
// "Sweet spot" target is 11–30 employees. Setup fees ($499 / $999) are
// intentionally excluded from the cards (they appear only in the FAQ to
// avoid sticker-shock at the top of the funnel).
//
// INTERNAL — not for public display:
//   The OFJR Construction anchor client has a grandfathered deal:
//   Business at $399/mo locked for 24 months, then $539 with 10% off.
//   This is enforced in the (future) billing/admin module — never surface
//   it on the public site, in code, or in pricing.json.
//
// Roadmap items mentioned only as "coming soon" hints, not active features:
//   • QuickBooks integration (Business): Q3 2026
//   • Public API (Business): Q3 2026
//   • SSO / SAML (Enterprise): Q4 2026

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';

// Public sales contact — change here if the routing email changes.
const SALES_EMAIL = 'andersonaguirre794@gmail.com';

// Number of feature lines per plan (matches feature.0..feature.N-1 in pricing.json).
const FEATURES_PER_PLAN = 13;

// Number of FAQ entries (faq.0..faq.N-1 in pricing.json).
const FAQ_COUNT = 6;

// Plan card

interface PlanCardProps {
  planKey: 'pro' | 'business';
  billing: 'monthly' | 'annual';
  featured?: boolean;
}

const PLAN_CODE_BY_KEY = {
  pro: 'PRO',
  business: 'BUSINESS',
} as const;

const BILLING_INTERVAL_BY_KEY = {
  monthly: 'MONTHLY',
  annual: 'ANNUAL',
} as const;

function PlanCard({ planKey, billing, featured = false }: PlanCardProps) {
  const { t } = useTranslation('pricing');
  const navigate = useNavigate();
  // Phase-3: trial CTA goes straight into the public signup flow.
  // The plan choice rides the URL as backend-compatible intent enums.
  const goToSignup = () => {
    const planCode = PLAN_CODE_BY_KEY[planKey];
    const billingInterval = BILLING_INTERVAL_BY_KEY[billing];
    navigate(`/signup?plan=${planCode}&interval=${billingInterval}`);
  };

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

        {/* Price */}
        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight text-[#0A0A0A]">
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
          onClick={goToSignup}
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

// Section

export function Pricing() {
  const { t } = useTranslation('pricing');
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const faqItems = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    q: t(`faq.${i}.q`),
    a: t(`faq.${i}.a`),
  }));

  const enterpriseMailto =
    `mailto:${SALES_EMAIL}?subject=` +
    encodeURIComponent('BuildTrack Enterprise — Solicitud de información');

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-headline"
      className="py-24 bg-white"
    >
      <div className="max-w-6xl mx-auto px-6">

        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2
            id="pricing-headline"
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0A0A0A] mb-4"
          >
            {t('headline')}
          </h2>
          <p className="text-[#71717A] leading-relaxed">{t('subheadline')}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span
            className={`text-sm font-medium transition ${
              billing === 'monthly' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
            }`}
          >
            {t('billing.monthly')}
          </span>
          <Switch
            checked={billing === 'annual'}
            onCheckedChange={(checked) => setBilling(checked ? 'annual' : 'monthly')}
            aria-label={`${t('billing.monthly')} / ${t('billing.annual')}`}
          />
          <span
            className={`text-sm font-medium transition ${
              billing === 'annual' ? 'text-[#0A0A0A]' : 'text-[#71717A]'
            }`}
          >
            {t('billing.annual')}
          </span>
          {billing === 'annual' && (
            <Badge className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold ml-1">
              {t('billing.annualBadge')}
            </Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <PlanCard planKey="pro" billing={billing} />
          <PlanCard planKey="business" billing={billing} featured />
        </div>

        {/* Enterprise band */}
        <div className="mt-14 rounded-2xl bg-[#0A0A0A] text-white p-8 sm:p-10 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tracking-widest text-[#F97316] uppercase mb-2">
                {t('enterprise.eyebrow')}
              </p>
              <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 leading-tight">
                {t('enterprise.headline')}
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">
                {t('enterprise.body')}
              </p>
            </div>
            <a
              href={enterpriseMailto}
              className="inline-flex items-center justify-center h-12 px-7 rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white text-base font-medium transition whitespace-nowrap"
            >
              {t('enterprise.cta')}
              <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#0A0A0A] text-center mb-8">
            {t('faq.title')}
          </h3>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border-b border-[#D4D4D8] last:border-b-0"
              >
                <AccordionTrigger className="text-left text-base font-medium text-[#0A0A0A] hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#71717A] leading-relaxed pb-5">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
