// BuildTrack — Public success page after Paddle Checkout.
//
// IMPORTANT: this page is intentionally INERT. It does NOT call the
// backend, does NOT activate the tenant, does NOT mutate any state.
// Tenant activation is driven exclusively by the signed Paddle webhook
// processed server-side. The user landing here from Paddle's redirect
// just sees a neutral "we're processing it" message — if the payment
// fails, the webhook simply never activates and the user gets an email
// from the operator.
//
// Visual chrome mirrors the public landing (BuildTrack logo header,
// language switcher, soft hero blurs, dark "Enterprise band" used as the
// hero card) so the page feels like part of the site rather than a Paddle
// stub.

import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, HardHat } from 'lucide-react';

import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

function BuildTrackLogo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}
    >
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F97316] text-white">
        <HardHat className="w-5 h-5" aria-hidden="true" />
      </span>
      <span>
        Build<span className="text-[#F97316]">Track</span>
      </span>
    </span>
  );
}

export function CheckoutSuccess() {
  const { t } = useTranslation('billing');

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BuildTrackLogo className="text-lg" />
          <nav className="flex items-center gap-3">
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden flex items-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto px-6 py-20 w-full">
          <div className="rounded-2xl bg-[#0A0A0A] text-white p-8 sm:p-10">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F97316]/15 text-[#F97316]">
                <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
              </span>

              <div>
                <p className="text-xs font-semibold tracking-widest text-[#F97316] uppercase mb-3">
                  BuildTrack
                </p>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight mb-4">
                  {t('success.title')}
                </h1>
                <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                  {t('success.body')}
                </p>
                <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
                  {t('success.note')}
                </p>
              </div>

              <Link to="/admin/dashboard" className="mt-2">
                <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                  {t('success.cta.dashboard')}
                  <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          <BuildTrackLogo className="text-base" />
        </div>
      </footer>
    </div>
  );
}
