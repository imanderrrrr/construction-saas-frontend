import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  HardHat,
  Clock,
  FolderKanban,
  Wallet,
  Smartphone,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Pricing } from './landing/Pricing';

// Brand-coloured wordmark used across the public site.
function BuildTrackLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#F97316] text-white">
        <HardHat className="w-5 h-5" />
      </span>
      <span>
        Build<span className="text-[#F97316]">Track</span>
      </span>
    </span>
  );
}

// Feature card

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="p-6 rounded-2xl border border-[#D4D4D8] bg-white hover:border-[#F97316] hover:shadow-md transition-all duration-200">
      <div className="w-11 h-11 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-[#0A0A0A] mb-1.5">{title}</h3>
      <p className="text-sm text-[#71717A] leading-relaxed">{body}</p>
    </div>
  );
}

// Page

export function Landing() {
  const { t } = useTranslation('landing');

  const whyPoints = [0, 1, 2].map((i) => t(`why.point.${i}`));

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A]">

      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <BuildTrackLogo className="text-lg" />
          <nav className="flex items-center gap-3">
            <a
              href="#features"
              className="hidden sm:inline text-sm text-[#71717A] hover:text-[#0A0A0A] transition"
            >
              {t('nav.features')}
            </a>
            <a
              href="#why"
              className="hidden sm:inline text-sm text-[#71717A] hover:text-[#0A0A0A] transition"
            >
              {t('nav.why')}
            </a>
            <a
              href="#pricing"
              className="hidden sm:inline text-sm text-[#71717A] hover:text-[#0A0A0A] transition"
            >
              {t('nav.pricing')}
            </a>
            <LanguageSwitcher />
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-sm text-[#0A0A0A] hover:bg-[#F4F4F5]"
              >
                {t('nav.signIn')}
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="text-sm bg-[#F97316] hover:bg-[#C2410C] text-white">
                {t('nav.start')}
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#F97316]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#0A0A0A]/5 blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4F4F5] border border-[#D4D4D8] text-xs font-medium text-[#71717A] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            {t('hero.eyebrow')}
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            {t('hero.title.line1')} <span className="text-[#F97316]">{t('hero.title.highlight')}</span>.
            <br className="hidden sm:block" />
            {t('hero.title.line2')}
          </h1>

          <p className="text-base sm:text-lg text-[#71717A] max-w-2xl mx-auto mb-9 leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                {t('hero.ctaPrimary')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="outline"
                className="h-12 px-7 text-base border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
              >
                {t('hero.ctaSecondary')}
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-xs text-[#71717A]">{t('hero.note')}</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-[#FAFAFA] border-y border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              {t('features.title')}
            </h2>
            <p className="text-[#71717A] leading-relaxed">{t('features.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature icon={FolderKanban} title={t('features.projects.title')}       body={t('features.projects.body')} />
            <Feature icon={Clock}        title={t('features.time.title')}           body={t('features.time.body')} />
            <Feature icon={Wallet}       title={t('features.finance.title')}        body={t('features.finance.body')} />
            <Feature icon={Smartphone}   title={t('features.mobile.title')}         body={t('features.mobile.body')} />
            <Feature icon={HardHat}      title={t('features.subcontractors.title')} body={t('features.subcontractors.body')} />
            <Feature icon={ShieldCheck}  title={t('features.audit.title')}          body={t('features.audit.body')} />
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="py-24">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-semibold tracking-widest text-[#F97316] uppercase">
              {t('why.eyebrow')}
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              {t('why.title')}
            </h2>
            <p className="mt-5 text-[#71717A] leading-relaxed">{t('why.body')}</p>
            <ul className="mt-6 space-y-3">
              {whyPoints.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <span className="mt-1 w-4 h-4 rounded-full bg-[#F97316]/15 text-[#F97316] flex items-center justify-center flex-shrink-0">
                    <span className="block w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                  </span>
                  <span className="text-[#0A0A0A]">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#0A0A0A] to-[#1c1c1c] p-8 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
              </div>
              <p className="text-sm text-white/60 mb-2">{t('mock.label')}</p>
              <p className="text-2xl font-semibold mb-1">{t('mock.projectName')}</p>
              <p className="text-xs text-white/50 mb-6">{t('mock.subtitle')}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">{t('mock.progress')}</span>
                  <span className="font-medium">68%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[68%] bg-[#F97316]" />
                </div>
                <div className="flex items-center justify-between text-sm pt-3">
                  <span className="text-white/70">{t('mock.budget')}</span>
                  <span className="font-medium">62%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-[62%] bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <Pricing />

      {/* CTA */}
      <section className="py-20 bg-[#0A0A0A] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            {t('cta.title.line1')} <span className="text-[#F97316]">{t('cta.title.highlight')}</span>.
          </h2>
          <p className="text-white/70 mb-8 max-w-xl mx-auto">{t('cta.subtitle')}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button className="h-12 px-7 text-base bg-[#F97316] hover:bg-[#C2410C] text-white">
                {t('cta.primary')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/support">
              <Button
                variant="outline"
                className="h-12 px-7 text-base border-white/30 text-white hover:bg-white hover:text-[#0A0A0A]"
              >
                {t('cta.secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-[#F4F4F5]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <BuildTrackLogo className="text-base" />
          <nav className="flex items-center gap-6 text-sm text-[#71717A]">
            <Link to="/privacy" className="hover:text-[#0A0A0A] transition">{t('footer.privacy')}</Link>
            <Link to="/terms"   className="hover:text-[#0A0A0A] transition">{t('footer.terms')}</Link>
            <Link to="/support" className="hover:text-[#0A0A0A] transition">{t('footer.support')}</Link>
          </nav>
          <p className="text-xs text-[#71717A]">
            © {new Date().getFullYear()} BuildTrack
          </p>
        </div>
      </footer>
    </div>
  );
}
