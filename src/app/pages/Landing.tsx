import { useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  HardHat,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  WifiOff,
  FolderKanban,
  Timer,
  Wallet,
  Smartphone,
  Package,
  Star,
  Menu,
  X,
  FlaskConical,
  Bug,
  MessageSquareText,
  BadgeDollarSign,
  Headset,
  Mail,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Pricing } from './landing/Pricing';
import { BETA_CONTACT_EMAIL } from '../components/landing/BetaPlanCard';
import { AppSection } from '../components/landing/AppSection';
import { BlueprintGridSection } from '../components/landing/BlueprintGrid';
import { ProductWindow } from '../components/landing/ProductWindow';

type IconType = ComponentType<{ className?: string }>;

// Brand wordmark
function BuildTrackLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316] text-white">
        <HardHat className="h-5 w-5" />
      </span>
      <span>
        Build<span className="text-[#F97316]">Track</span>
      </span>
    </span>
  );
}

// Bento module cards
function ModCard({ icon: Icon, title, body }: { icon: IconType; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[#D4D4D8] bg-white p-6 transition-colors duration-200 hover:border-[#F97316]">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F97316]/10">
        <Icon className="h-5 w-5 text-[#F97316]" />
      </div>
      <h3 className="text-[17px] font-bold text-[#0A0A0A]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[#71717A]">{body}</p>
    </div>
  );
}

function ModCardBig({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: IconType;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#D4D4D8] bg-white p-6 transition-colors duration-200 hover:border-[#F97316] sm:p-7">
      <div>
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F97316]/10">
          <Icon className="h-5 w-5 text-[#F97316]" />
        </div>
        <h3 className="text-xl font-bold text-[#0A0A0A]">{title}</h3>
        <p className="mt-2 max-w-[480px] text-[15px] leading-relaxed text-[#71717A]">{body}</p>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function MiniProg({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex-1 rounded-lg bg-[#F4F4F5] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#71717A]">{label}</span>
        <span className="text-sm font-bold text-[#0A0A0A]">{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#D4D4D8]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function JobRow({ name, status, tone }: { name: string; status: string; tone: 'green' | 'orange' }) {
  const c = tone === 'green' ? { dot: '#16A34A', text: '#16A34A', bg: '#E7F6EC' } : { dot: '#C2410C', text: '#C2410C', bg: '#FDEBDD' };
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg bg-[#F4F4F5] px-3.5 py-2.5">
      <span className="flex items-center gap-2.5">
        <HardHat className="h-4 w-4 text-[#71717A]" />
        <span className="text-sm font-medium text-[#0A0A0A]">{name}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: c.bg }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
        <span className="text-xs font-semibold" style={{ color: c.text }}>
          {status}
        </span>
      </span>
    </div>
  );
}

export function Landing() {
  const { t } = useTranslation('landing');
  const whyPoints = [0, 1, 2].map((i) => t(`why.point.${i}`));
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const sectionLinks = [
    { href: '#features', label: t('nav.features') },
    { href: '#why', label: t('nav.why') },
    { href: '#app', label: t('nav.app') },
    { href: '#beta', label: t('nav.beta') },
    { href: '#pricing', label: t('nav.pricing') },
  ];

  // Joining the beta is a conversation, not a checkout: the CTA opens the
  // visitor's mail client with a prefilled message to the founder.
  const betaMailto =
    `mailto:${BETA_CONTACT_EMAIL}?subject=` +
    encodeURIComponent(t('beta.emailSubject')) +
    '&body=' +
    encodeURIComponent(t('beta.emailBody'));

  return (
    <div className="min-h-screen bg-white font-sans text-[#0A0A0A]">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-[#F4F4F5] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BuildTrackLogo className="text-lg" />

          {/* Desktop nav — the App link only fits from lg up */}
          <nav className="hidden items-center gap-5 md:flex">
            {sectionLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-sm font-medium text-[#71717A] transition hover:text-[#0A0A0A] ${
                  l.href === '#app' ? 'hidden lg:inline' : ''
                }`}
              >
                {l.label}
              </a>
            ))}
            <LanguageSwitcher />
            <Link to="/login">
              <Button variant="ghost" className="text-sm text-[#0A0A0A] hover:bg-[#F4F4F5]">
                {t('nav.signIn')}
              </Button>
            </Link>
            <Link to="/choose-plan">
              <Button className="bg-[#F97316] text-sm text-white hover:bg-[#C2410C]">{t('nav.start')}</Button>
            </Link>
          </nav>

          {/* Mobile: primary CTA + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <Link to="/choose-plan">
              <Button className="h-9 bg-[#F97316] px-3.5 text-sm text-white hover:bg-[#C2410C]">{t('nav.start')}</Button>
            </Link>
            <button
              type="button"
              aria-label={t('nav.menu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4D4D8] text-[#0A0A0A] transition hover:bg-[#F4F4F5]"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="border-t border-[#F4F4F5] bg-white px-4 pb-4 pt-2 md:hidden">
            {sectionLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-[#0A0A0A] transition hover:bg-[#F4F4F5]"
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-[#0A0A0A] transition hover:bg-[#F4F4F5]"
            >
              {t('nav.signIn')}
            </Link>
            <div className="mt-2 border-t border-[#F4F4F5] px-3 pt-3">
              <LanguageSwitcher />
            </div>
          </nav>
        )}
      </header>

      {/* Hero */}
      <BlueprintGridSection className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-12 pt-14 text-center sm:pb-16 sm:pt-20">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4D4D8] bg-[#F4F4F5] px-3.5 py-1.5 text-[13px] font-medium text-[#71717A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
            {t('hero.eyebrow')}
            {/* Beta pill: the whole site is honest about the product stage */}
            <a
              href="#beta"
              className="ml-1 rounded-full bg-[#F97316] px-2 py-0.5 text-[11px] font-bold tracking-wide text-white transition hover:bg-[#C2410C]"
            >
              {t('hero.betaPill')}
            </a>
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-[56px]">
            {t('hero.title.line1')} <span className="text-[#F97316]">{t('hero.title.highlight')}</span>.{' '}
            <br className="hidden sm:block" />
            {t('hero.title.line2')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#71717A]">{t('hero.subtitle')}</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/choose-plan">
              <Button className="h-12 bg-[#F97316] px-6 text-base text-white hover:bg-[#C2410C]">
                {t('hero.ctaPrimary')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="h-12 border-[#0A0A0A] px-6 text-base text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white">
                {t('hero.ctaSecondary')}
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-[13px] text-[#71717A]">{t('hero.note')}</p>
          <div className="mt-10 flex w-full justify-center sm:mt-14">
            <ProductWindow />
          </div>
        </div>
      </BlueprintGridSection>

      {/* Trust strip */}
      <div className="border-y border-[#D4D4D8] bg-[#F4F4F5]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5 sm:justify-between">
          {(
            [
              [ShieldCheck, 'Multi-empresa, datos aislados'],
              [Zap, 'Productivo en 1 semana'],
              [Globe, 'Bilingüe es / en'],
              [WifiOff, 'App de obra sin señal'],
            ] as [IconType, string][]
          ).map(([Icon, label]) => (
            <span key={label} className="flex items-center gap-2.5">
              <Icon className="h-[18px] w-[18px] text-[#F97316]" />
              <span className="text-sm font-medium text-[#0A0A0A]">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Modules — bento */}
      <section id="features" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <p className="mb-3 text-[13px] font-semibold tracking-wide text-[#F97316]">MÓDULOS</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('features.title')}</h2>
            <p className="mt-4 leading-relaxed text-[#71717A]">{t('features.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ModCardBig icon={FolderKanban} title={t('features.projects.title')} body={t('features.projects.body')}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <MiniProg label="Avance de obra" value="68%" pct={68} color="#F97316" />
                <MiniProg label="Presupuesto" value="62%" pct={62} color="#0A0A0A" />
              </div>
            </ModCardBig>
            <div className="grid gap-5">
              <ModCard icon={Timer} title={t('features.time.title')} body={t('features.time.body')} />
              <ModCard icon={Wallet} title={t('features.finance.title')} body={t('features.finance.body')} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="grid gap-5">
              <ModCard icon={Smartphone} title={t('features.mobile.title')} body={t('features.mobile.body')} />
              <ModCard icon={ShieldCheck} title={t('features.audit.title')} body={t('features.audit.body')} />
            </div>
            <ModCardBig icon={Package} title={t('features.subcontractors.title')} body={t('features.subcontractors.body')}>
              <div className="space-y-2">
                <JobRow name="Cuadrilla eléctrica" status="Aprobado" tone="green" />
                <JobRow name="Plomería — Torre A" status="En revisión" tone="orange" />
              </div>
            </ModCardBig>
          </div>
        </div>
      </section>

      {/* Videos */}
      <section id="demos" className="scroll-mt-20 border-t border-[#D4D4D8] bg-[#F4F4F5] py-16 sm:py-24">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6">
          <div className="mb-10 max-w-xl text-center">
            <p className="mb-3 text-[13px] font-semibold tracking-wide text-[#F97316]">EN ACCIÓN</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Míralo funcionando</h2>
            <p className="mt-4 leading-relaxed text-[#71717A]">
              Recorridos cortos por cada módulo. Iremos sumando más con cada actualización.
            </p>
          </div>
          <div className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2">
            {(
              [
                ['bitacora', 'Bitácora de obra', 'Asistencia auto-sugerida desde el reloj, clima, tareas del día, notas y fotos con visor.'],
                ['tiempo', 'Control de tiempo', 'Filtra por rol y aprueba marcajes con ubicación GPS, distancia y enlaces a Google Maps.'],
                ['kanban', 'Tablero de tareas', 'Kanban por proyecto: arrastra tarjetas entre columnas, con comentarios y adjuntos.'],
                ['finanzas', 'Finanzas', 'Seguimiento de contrato por proyecto: presupuesto vs. gastado, con desglose de costos.'],
              ] as [string, string, string][]
            ).map(([key, title, caption]) => (
              <figure
                key={key}
                className="overflow-hidden rounded-2xl border border-[#D4D4D8] bg-white shadow-[0_12px_34px_rgba(10,10,10,0.06)] transition-colors duration-200 hover:border-[#F97316]"
              >
                <div className="aspect-video overflow-hidden bg-[#0A0A0A]">
                  <video
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={`/demos/${key}.jpg`}
                    aria-label={`Demo: ${title}`}
                  >
                    <source src={`/demos/${key}.webm`} type="video/webm" />
                    <source src={`/demos/${key}.mp4`} type="video/mp4" />
                  </video>
                </div>
                <figcaption className="p-5">
                  <p className="text-[15px] font-bold text-[#0A0A0A]">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#71717A]">{caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="scroll-mt-20 bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F97316]">{t('why.eyebrow')}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t('why.title')}</h2>
            <p className="mt-5 leading-relaxed text-[#71717A]">{t('why.body')}</p>
            <ul className="mt-6 space-y-3.5">
              {whyPoints.map((line) => (
                <li key={line} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#F97316]/15">
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                  </span>
                  <span className="text-[#0A0A0A]">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-[#0A0A0A] p-6 text-white shadow-[0_24px_60px_rgba(10,10,10,0.2)] sm:p-8">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            </div>
            <p className="mt-6 text-xs tracking-wide text-white/50">{t('mock.label')}</p>
            <p className="text-2xl font-bold">{t('mock.projectName')}</p>
            <p className="mt-1 text-[13px] text-white/50">{t('mock.subtitle')}</p>
            <div className="mt-6 space-y-5">
              {(
                [
                  [t('mock.progress'), '68%', 68, '#F97316'],
                  [t('mock.budget'), '62%', 62, '#FFFFFF'],
                ] as [string, string, number, string][]
              ).map(([label, value, pct, color]) => (
                <div key={label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">{label}</span>
                    <span className="font-bold">{value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* App móvil */}
      <AppSection />

      {/* Testimonial */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5 fill-[#F97316] text-[#F97316]" />
            ))}
          </div>
          <p className="mt-7 text-[22px] font-semibold leading-snug tracking-tight text-[#0A0A0A] sm:text-[28px]">
            “Dejamos atrás cinco hojas de cálculo y dos grupos de WhatsApp. Hoy veo el avance y el presupuesto de cada obra en un solo lugar, en tiempo real.”
          </p>
          <div className="mt-8 flex items-center gap-3.5">
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#F97316] text-lg font-bold text-white">
              RS
            </span>
            <div className="text-left">
              <p className="text-base font-bold text-[#0A0A0A]">Roberto Salazar</p>
              <p className="text-sm text-[#71717A]">Director de obra · Constructora piloto</p>
            </div>
          </div>
        </div>
      </section>

      {/* Beta program — sets expectations honestly BEFORE the visitor sees
          the beta offer below: the product works and is in real use, but it
          is a beta (bugs possible, they help report, feedback loop). Joining
          is by email (no automatic billing): $350 for 2 months of full
          access, arranged personally with the founder. */}
      <section id="beta" className="scroll-mt-20 border-y border-[#D4D4D8] bg-[#F4F4F5] py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F97316] px-3.5 py-1.5 text-[12px] font-bold tracking-wide text-white">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              {t('beta.eyebrow')}
            </span>
            <h2 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] sm:text-4xl">
              {t('beta.title')}
            </h2>
            <p className="mt-4 leading-relaxed text-[#71717A]">{t('beta.body')}</p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                [Bug, 0],
                [MessageSquareText, 1],
                [Star, 2],
                [BadgeDollarSign, 3],
                [Headset, 4],
                [ShieldCheck, 5],
              ] as const
            ).map(([Icon, i]) => (
              <div
                key={i}
                className="rounded-2xl border border-[#D4D4D8] bg-white p-6 transition hover:border-[#F97316]"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F97316]/10">
                  <Icon className="h-5 w-5 text-[#F97316]" aria-hidden="true" />
                </div>
                <h3 className="mb-1.5 text-[15px] font-semibold text-[#0A0A0A]">
                  {t(`beta.item.${i}.title`)}
                </h3>
                <p className="text-sm leading-relaxed text-[#71717A]">
                  {t(`beta.item.${i}.body`)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <Button
              asChild
              className="h-12 bg-[#F97316] px-6 text-base text-white hover:bg-[#C2410C]"
            >
              <a href={betaMailto}>
                <Mail className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('beta.cta')}
              </a>
            </Button>
            <p className="text-[13px] text-[#71717A]">{t('beta.note')}</p>
          </div>
        </div>
      </section>

      {/* Pricing (existing component) */}
      <div id="pricing" className="scroll-mt-20">
        <Pricing />
      </div>

      {/* Final CTA */}
      <BlueprintGridSection dark className="bg-[#0A0A0A] text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-16 text-center sm:py-24">
          <h2 className="text-3xl font-bold tracking-tight sm:text-[44px]">
            {t('cta.title.line1')} <span className="text-[#F97316]">{t('cta.title.highlight')}</span>.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-white/60">{t('cta.subtitle')}</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/choose-plan">
              <Button className="h-12 bg-[#F97316] px-6 text-base text-white hover:bg-[#C2410C]">
                {t('cta.primary')}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/support">
              <Button variant="outline" className="h-12 border-white/30 bg-transparent px-6 text-base text-white hover:bg-white hover:text-[#0A0A0A]">
                {t('cta.secondary')}
              </Button>
            </Link>
          </div>
        </div>
      </BlueprintGridSection>

      {/* Footer */}
      <footer className="border-t border-[#D4D4D8] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-xs">
              <BuildTrackLogo className="text-lg" />
              <p className="mt-4 text-sm leading-relaxed text-[#71717A]">
                La plataforma de gestión para constructoras en crecimiento.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
              <FooterCol
                title="Producto"
                items={[
                  { label: 'Módulos', href: '#features' },
                  { label: 'Planes', href: '#pricing' },
                  { label: 'Demos', href: '#demos' },
                  { label: 'App móvil', href: '#app' },
                ]}
              />
              <FooterCol
                title="Empresa"
                items={[
                  { label: 'Por qué BuildTrack', href: '#why' },
                  { label: 'Contacto', to: '/support' },
                  { label: 'Soporte', to: '/support' },
                ]}
              />
              <FooterCol
                title="Legal"
                items={[
                  { label: t('footer.privacy'), to: '/privacy' },
                  { label: t('footer.terms'), to: '/terms' },
                ]}
              />
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#D4D4D8] pt-6 sm:flex-row">
            <p className="text-[13px] text-[#71717A]">© {new Date().getFullYear()} BuildTrack. Todos los derechos reservados.</p>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D4D4D8] px-2.5 py-1.5">
              <Globe className="h-3.5 w-3.5 text-[#71717A]" />
              <span className="text-[13px] font-medium text-[#0A0A0A]">Español</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; to?: string; href?: string }[];
}) {
  const linkClass = 'text-sm text-[#71717A] transition hover:text-[#0A0A0A]';
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-bold text-[#0A0A0A]">{title}</p>
      {items.map((it) =>
        it.to ? (
          <Link key={it.label} to={it.to} className={linkClass}>
            {it.label}
          </Link>
        ) : (
          <a key={it.label} href={it.href} className={linkClass}>
            {it.label}
          </a>
        ),
      )}
    </div>
  );
}
