// The Beta program card. While BuildTrack is in beta the plan is NOT a
// self-serve purchase and there is NO automatic billing: the customer
// contacts the founder by email to join, and the $350 / 2-month terms are
// arranged personally. Shared by the landing Pricing section and the
// /choose-plan screen so the copy and price stay in lockstep (strings live
// in the `pricing` namespace under `plans.beta.*`).

import { useTranslation } from 'react-i18next';
import { Check, FlaskConical, Mail } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card';

// Where "join the beta" emails are addressed. Same inbox as the Enterprise
// contact in Pricing.tsx; kept as a local const (exported) to avoid a
// circular import between Pricing and this card.
export const BETA_CONTACT_EMAIL = 'andersonaguirre794@gmail.com';

const BETA_FEATURES = 8;

interface BetaPlanCardProps {
  /** Override the inbox that "join the beta" emails are addressed to. */
  email?: string;
}

export function BetaPlanCard({ email = BETA_CONTACT_EMAIL }: BetaPlanCardProps) {
  const { t } = useTranslation('pricing');

  const features = Array.from({ length: BETA_FEATURES }, (_, i) =>
    t(`plans.beta.feature.${i}`),
  );

  // No checkout — the CTA opens the visitor's mail client with a prefilled
  // message. The founder replies and arranges the beta (price + payment)
  // personally. Nothing is charged automatically.
  const mailtoHref =
    `mailto:${email}?subject=` +
    encodeURIComponent(t('plans.beta.emailSubject')) +
    '&body=' +
    encodeURIComponent(t('plans.beta.emailBody'));

  return (
    <Card
      aria-label={`${t('plans.beta.name')} plan`}
      className="relative flex flex-col p-0 overflow-hidden border-2 border-[#F97316] shadow-xl shadow-[#F97316]/10"
    >
      <div className="absolute top-0 inset-x-0 bg-[#F97316] text-white text-xs font-semibold tracking-wide py-1.5 px-4 flex items-center justify-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{t('plans.beta.badge')}</span>
      </div>

      <CardHeader className="pt-12">
        <CardTitle className="text-2xl font-semibold text-[#0A0A0A]">
          {t('plans.beta.name')}
        </CardTitle>
        <CardDescription className="text-sm text-[#71717A] mt-1">
          {t('plans.beta.tagline')}
        </CardDescription>

        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span
              data-testid="choose-plan-price-beta"
              className="text-5xl font-bold tracking-tight text-[#0A0A0A]"
            >
              {t('plans.beta.price')}
            </span>
            <span className="text-base text-[#71717A]">
              {t('plans.beta.priceUnit')}
            </span>
          </div>
          <div className="mt-2">
            <Badge
              variant="secondary"
              className="bg-[#F97316]/10 text-[#F97316] border-0 text-[11px] font-semibold whitespace-normal text-left"
            >
              {t('plans.beta.priceNote')}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <ul className="space-y-2.5">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <Check
                className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#F97316]"
                aria-hidden="true"
              />
              <span className="text-[#0A0A0A] leading-snug">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pb-8">
        <Button
          asChild
          className="w-full h-11 text-base bg-[#F97316] hover:bg-[#C2410C] text-white"
        >
          <a href={mailtoHref} data-testid="choose-plan-select-beta">
            <Mail className="w-4 h-4 mr-1" aria-hidden="true" />
            {t('plans.beta.ctaLabel')}
          </a>
        </Button>
        <p className="text-xs text-[#71717A] text-center">
          {t('plans.beta.ctaHint')}
        </p>
      </CardFooter>
    </Card>
  );
}
