// BuildTrack — Public cancel page after Paddle Checkout.
//
// IMPORTANT: this page is intentionally INERT. It does NOT call the
// backend, does NOT touch tenant state, does NOT roll anything back.
// Paddle redirects users here when they close the overlay or abandon —
// no charge happened, so there is nothing for the SPA to undo. We just
// surface a neutral message and offer two ways back: the plans page
// (admin-only) and the dashboard.
//
// Visual chrome mirrors CheckoutSuccess for symmetry.

import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, HardHat, XCircle } from 'lucide-react';

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

export function CheckoutCancel() {
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
          <div className="rounded-2xl border border-[#D4D4D8] bg-white p-8 sm:p-10 shadow-sm">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F4F4F5] text-[#71717A]">
                <XCircle className="w-7 h-7" aria-hidden="true" />
              </span>

              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight text-[#0A0A0A] mb-4">
                  {t('cancel.title')}
                </h1>
                <p className="text-sm sm:text-base text-[#71717A] leading-relaxed">
                  {t('cancel.body')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <Link to="/admin/billing">
                  <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                    {t('cancel.cta.plans')}
                    <ArrowRight className="w-4 h-4 ml-1" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/admin/dashboard">
                  <Button
                    variant="outline"
                    className="h-12 px-7 text-base border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                  >
                    {t('cancel.cta.dashboard')}
                  </Button>
                </Link>
              </div>
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
