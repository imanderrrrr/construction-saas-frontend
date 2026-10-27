import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { AssistantLauncher } from '../components/landing/AssistantLauncher';
import { BlueprintGrid } from '../components/landing/BlueprintGrid';
import { BuildTrackLogo } from '../components/landing/BuildTrackLogo';
import { DemoVideos } from '../components/landing/DemoVideos';
import { MobileMenu, NAV_LINK, NavLinks, SignInLink, StickyBar } from '../components/landing/LandingNav';
import { LogoBuildOverlay } from '../components/landing/LogoBuildOverlay';
import { PhoneMock } from '../components/landing/PhoneMock';
import { DashboardSheet, PayablesSheet, DailyLogSheet } from '../components/landing/PlatformSheets';
import { Testimonials } from '../components/landing/Testimonials';
import { initAnalytics, track } from '../lib/analytics';
import { SUPPORT_EMAIL, supportMailto } from '../lib/contact';
import { usePublicPageTitle } from '../hooks/usePublicPageTitle';

/**
 * The public landing page.
 *
 * Ported from the approved Claude Design project "BuildTrack para
 * constructoras" (sheet: BuildTrack Landing v2), which draws the site as a set
 * of construction drawings: blueprint grid, sheet numbers, title blocks.
 *
 * No prices anywhere, by design — the primary CTA books a live demo and the
 * secondary joins the free 2-month beta, both by email. Nothing on this page
 * links into the /choose-plan billing flow.
 */

// Shared type scales, so a heading tweak happens once.
const SECTION = 'mx-auto max-w-[1400px] px-[clamp(22px,5vw,64px)]';
const LABEL = 'font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted';
const H2 =
  'font-bt-heading text-[clamp(32px,3.9vw,52px)] font-bold leading-[1.04] tracking-[-0.015em] text-bt-ink';
const H2_DARK =
  'font-bt-heading text-[clamp(30px,3.6vw,48px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-bone text-balance';
const CTA_PRIMARY =
  'inline-block rounded-[2px] bg-bt-orange px-[30px] py-4 text-base font-bold tracking-[-0.01em] text-bt-ink transition-colors hover:bg-bt-orange-hover';
const CTA_GHOST =
  'border-b border-[rgba(248,243,235,0.35)] pb-[3px] text-base font-medium text-bt-bone transition-colors hover:border-bt-orange hover:text-bt-orange';

/** BuildTrack Field on the App Store — the live listing, verified 2026-09-12. */
const APP_STORE_URL = 'https://apps.apple.com/gt/app/buildtrack-field/id6807602939';

export function Landing() {
  const { t } = useTranslation('landing');
  usePublicPageTitle(t('meta.title'));

  const mailtoDemo = supportMailto(t('demo.emailSubject'));
  const mailtoBeta = supportMailto(t('beta.emailSubject'));

  useEffect(() => {
    initAnalytics();
  }, []);

  // Which button moved the visitor, so the analytics can tell the hero from the footer.
  const cta = (name: 'demo' | 'beta' | 'app_store', place: string) => () => track('cta_click', { cta: name, place });
  const email = (topic: 'demo' | 'beta', place: string) => () => track('contact_email', { topic, place });

  // The sticky bar shows once the hero has scrolled away.
  const heroRef = useRef<HTMLElement>(null);

  // The nav logo is where «BuildTrack se construye» lands; it hides while the video stands in for it.
  const logoMarkRef = useRef<HTMLSpanElement>(null);
  const [logoStandIn, setLogoStandIn] = useState(false);

  return (
    <div className="bt-public bg-bt-paper font-bt-body text-base text-bt-ink">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header ref={heroRef} className="relative flex min-h-[100svh] flex-col overflow-hidden bg-bt-ink">
        <BlueprintGrid fade="hero" lineOpacity={0.05} />

        <nav
          aria-label={t('nav.menu')}
          className={`${SECTION} relative z-[2] flex w-full flex-wrap items-center justify-between gap-6 pb-3.5 pt-[clamp(18px,2.6vh,30px)]`}
        >
          <Link to="/" aria-label="BuildTrack" className={logoStandIn ? 'opacity-0' : undefined}>
            <BuildTrackLogo boxPx={32} textPx={20} markRef={logoMarkRef} />
          </Link>
          {/* Below lg the links fold into the menu button instead of wrapping into two rows. */}
          <div className="flex flex-wrap items-center gap-[clamp(14px,2.2vw,30px)] max-lg:hidden">
            <LanguageSwitcher variant="public" />
            <NavLinks className={NAV_LINK} />
            <SignInLink place="nav" />
          </div>
          <MobileMenu place="nav" className="lg:hidden" />
        </nav>

        <div
          className={`${SECTION} relative z-[1] flex w-full flex-1 flex-col pt-[clamp(44px,8vh,110px)]`}
        >
          <h1 className="font-bt-display text-[clamp(60px,11vw,168px)] font-extrabold uppercase leading-[0.88] tracking-[0.01em] text-bt-bone">
            <span data-anim style={{ animationDelay: '0.05s' }} className="block">
              {t('hero.line1')}
            </span>
            <span data-anim style={{ animationDelay: '0.15s' }} className="block text-bt-orange">
              {t('hero.line2')}
            </span>
          </h1>

          <p
            data-anim
            style={{ animationDelay: '0.26s' }}
            className="mt-[clamp(28px,4vh,44px)] max-w-[34ch] text-pretty text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-bt-muted-2"
          >
            {t('hero.subtitle')}
          </p>

          <div
            data-anim
            style={{ animationDelay: '0.36s' }}
            className="mt-[clamp(28px,4.5vh,48px)] flex flex-wrap items-center gap-[clamp(18px,2.5vw,32px)]"
          >
            <a href="#demo" className={CTA_PRIMARY} onClick={cta('demo', 'hero')}>
              {t('cta.demo')}
            </a>
            <a href="#beta" className={CTA_GHOST} onClick={cta('beta', 'hero')}>
              {t('cta.beta')}
            </a>
          </div>

          <p
            data-anim
            style={{ animationDelay: '0.46s' }}
            className="mt-[clamp(20px,3vh,30px)] font-bt-mono text-xs tracking-[0.08em] text-bt-muted"
          >
            {t('hero.note')}
          </p>

          {/* Drawing rule along the foot of the sheet */}
          <div
            data-anim
            style={{ animationDelay: '0.58s', animationDuration: '0.9s' }}
            className="mt-auto pt-[clamp(40px,7vh,90px)]"
          >
            <div className="flex flex-wrap justify-between gap-4 border-t border-[rgba(168,154,135,0.28)] py-4 font-bt-mono text-[11px] tracking-[0.1em] text-bt-muted-2">
              <span>{t('hero.coord')}</span>
              <span className="text-bt-muted">{t('hero.rev')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── The problem ──────────────────────────────────────────────── */}
      <section id="problema" className="scroll-mt-16 bg-bt-paper">
        <div className={`${SECTION} py-[clamp(72px,10vw,128px)]`}>
          <p className={`${LABEL} mb-5`}>{t('problem.label')}</p>
          <h2 className={`${H2} max-w-[22ch] text-balance`}>{t('problem.title')}</h2>
          <p className="mt-[18px] max-w-[52ch] text-pretty text-[clamp(15px,1.3vw,17px)] leading-[1.55] text-bt-muted">
            {t('problem.subtitle')}
          </p>

          <div className="mt-[clamp(36px,4.5vw,56px)] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] border-y border-bt-rule">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`border-l border-bt-rule px-[26px] pb-9 pt-7 ${i === 3 ? 'border-r' : ''}`}
              >
                <p className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-orange">
                  {t(`problem.${i}.label`)}
                </p>
                <h3 className="mt-3.5 text-balance font-bt-heading text-xl font-bold tracking-[-0.01em] text-bt-ink">
                  {t(`problem.${i}.title`)}
                </h3>
                <p className="mt-3 text-pretty text-[14.5px] leading-[1.6] text-bt-muted">
                  {t(`problem.${i}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The system: five modules ─────────────────────────────────── */}
      <section id="sistema" className="scroll-mt-16 border-t border-bt-rule bg-bt-paper">
        <div className={`${SECTION} py-[clamp(72px,10vw,128px)]`}>
          <div className="mb-[clamp(40px,5vw,64px)] flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={`${LABEL} mb-5`}>{t('system.label')}</p>
              <h2 className={H2}>{t('system.title')}</h2>
              <p className="mt-[18px] max-w-[46ch] text-pretty text-[clamp(15px,1.3vw,17px)] leading-[1.55] text-bt-muted">
                {t('system.subtitle')}
              </p>
            </div>
            <p className={`${LABEL} pb-1.5`}>{t('system.mono')}</p>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] border-y border-bt-rule">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`flex flex-col gap-3.5 border-l border-bt-rule px-[22px] pb-[34px] pt-[26px] ${
                  i === 5 ? 'border-r' : ''
                }`}
              >
                <p
                  className={`font-bt-mono text-[10.5px] tracking-[0.14em] ${
                    i === 5 ? 'text-bt-orange' : 'text-bt-muted'
                  }`}
                >
                  {t(`system.${i}.label`)}
                </p>
                <h3 className="font-bt-heading text-[19px] font-bold tracking-[-0.01em] text-bt-ink">
                  {t(`system.${i}.title`)}
                </h3>
                <p className="text-pretty text-[14.5px] leading-[1.6] text-bt-muted">
                  {t(`system.${i}.body`)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-[18px] font-bt-mono text-[10.5px] tracking-[0.1em] text-bt-muted">
            {t('system.portal')}{' '}
            <a href="#confianza" className="text-bt-orange">
              {t('system.portalLink')}
            </a>
          </p>

          {/* What changes — it used to be a section of its own that restated
              the modules; here it closes them, so the page is one screen shorter. */}
          <div id="resultados" className="mt-[clamp(48px,6vw,80px)] scroll-mt-16">
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <p className={LABEL}>{t('results.label')}</p>
              <h3 className="font-bt-heading text-[clamp(22px,2.2vw,28px)] font-bold tracking-[-0.015em] text-bt-ink">
                {t('results.title')}
              </h3>
            </div>
            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-x-[clamp(20px,2.5vw,36px)] gap-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t-2 border-bt-ink pt-4">
                  <p className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-orange">R-0{i}</p>
                  <h4 className="mt-2 font-bt-heading text-[17px] font-bold tracking-[-0.01em] text-bt-ink">
                    {t(`results.${i}.title`)}
                  </h4>
                  <p className="mt-2 text-pretty text-[14px] leading-[1.6] text-bt-muted">
                    {t(`results.${i}.body`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform: drawing sheets + real footage ──────────────────── */}
      <section id="plataforma" className="scroll-mt-16 bg-bt-paper-2">
        <div className={`${SECTION} py-[clamp(72px,10vw,128px)]`}>
          <p className={`${LABEL} mb-5`}>{t('sheets.label')}</p>
          <h2 className={H2}>{t('sheets.title')}</h2>
          <p className="mb-[clamp(40px,5vw,60px)] mt-[18px] max-w-[52ch] text-pretty text-[clamp(15px,1.3vw,17px)] leading-[1.55] text-bt-muted">
            {t('sheets.subtitle')}
          </p>

          <DashboardSheet />

          <div className="mt-[clamp(28px,3.5vw,44px)] grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-stretch gap-[clamp(20px,2.5vw,28px)]">
            <PayablesSheet />
            <DailyLogSheet />
          </div>

          <DemoVideos />
        </div>
      </section>

      {/* ── Field app ────────────────────────────────────────────────── */}
      <section id="app" className="relative scroll-mt-16 overflow-hidden bg-bt-ink">
        <BlueprintGrid fade="bottom" lineOpacity={0.04} />
        <div
          className={`${SECTION} relative flex flex-wrap items-center gap-[clamp(40px,6vw,100px)] py-[clamp(72px,10vw,128px)]`}
        >
          <div className="min-w-[300px] flex-[1.2]">
            <p className="mb-5 font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted-2">
              {t('app.label')}
            </p>
            <h2 className="max-w-[18ch] text-balance font-bt-heading text-[clamp(32px,3.9vw,52px)] font-bold leading-[1.04] tracking-[-0.015em] text-bt-bone">
              {t('app.title1')} <span className="text-bt-orange">{t('app.title2')}</span>
            </h2>
            <p className="mt-5 max-w-[48ch] text-pretty text-[clamp(15px,1.35vw,17.5px)] leading-[1.6] text-bt-muted-2">
              {t('app.subtitle')}
            </p>

            <div className="mt-8 border-t border-[rgba(248,243,235,0.16)]">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-[18px] border-b border-[rgba(248,243,235,0.16)] py-[15px]"
                >
                  <span className="w-8 flex-none font-bt-mono text-[10.5px] tracking-[0.12em] text-bt-orange">
                    A-0{i}
                  </span>
                  <p className="text-pretty text-[15px] leading-[1.55] text-bt-bone">
                    <strong className="font-semibold">{t(`app.${i}.bold`)}</strong>{' '}
                    <span className="text-bt-muted-2">{t(`app.${i}.rest`)}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-[18px]">
              {/* BuildTrack Field is live on the App Store, so this one is a
                  real link. Custom line art rather than Apple's badge artwork,
                  to match the rest of the sheet — same call the Google Play
                  badge below already made. */}
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                onClick={cta('app_store', 'app')}
                className="inline-flex items-center gap-3 rounded-[2px] bg-bt-orange px-[22px] py-3 text-bt-ink transition-colors hover:bg-bt-orange-hover"
              >
                <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
                  <path
                    d="M9 1 L9 12.4 M5 8.6 L9 12.6 L13 8.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2 14.4 L2 18.4 L16 18.4 L16 14.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="flex flex-col">
                  <span className="font-bt-mono text-[8.5px] tracking-[0.12em]">
                    {t('app.appStore')}
                  </span>
                  <span className="mt-0.5 text-[15px] font-semibold">App Store</span>
                </span>
              </a>

              {/* Google Play is still in closed testing: no public listing to
                  link to, so this stays a badge — and says "coming soon"
                  rather than "available". Swap it for an <a> the day the
                  listing goes public. */}
              <span className="inline-flex items-center gap-3 rounded-[2px] border border-[rgba(248,243,235,0.28)] px-[22px] py-3">
                <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
                  <path
                    d="M1.5 1 L13 10 L1.5 19 Z"
                    fill="none"
                    stroke="#A89A87"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 6.8 L16.5 10 L13 13.2"
                    fill="none"
                    stroke="#A89A87"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="flex flex-col">
                  <span className="font-bt-mono text-[8.5px] tracking-[0.12em] text-bt-muted">
                    {t('app.playSoon')}
                  </span>
                  <span className="mt-0.5 text-[15px] font-semibold text-bt-muted-2">Google Play</span>
                </span>
              </span>
            </div>

            <p className="mt-[18px] font-bt-mono text-[11px] tracking-[0.1em] text-bt-muted">
              {t('app.storeName')}
            </p>
          </div>

          <div className="flex min-w-[280px] flex-1 justify-center">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────── */}
      <section id="para-quien" className="scroll-mt-16 border-t border-bt-rule bg-bt-paper">
        <div
          className={`${SECTION} flex flex-wrap items-start gap-[clamp(36px,6vw,96px)] py-[clamp(64px,8vw,104px)]`}
        >
          <div className="min-w-[280px] flex-1">
            <p className={`${LABEL} mb-5`}>{t('who.label')}</p>
            <h2 className="text-balance font-bt-heading text-[clamp(30px,3.5vw,46px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-ink">
              {t('who.title')}
            </h2>
          </div>
          <div className="min-w-[300px] max-w-[640px] flex-[1.2]">
            <p className="mb-1.5 font-bt-mono text-[10.5px] tracking-[0.12em] text-bt-orange">
              {t('who.forYou')}
            </p>
            <div className="border-t border-bt-rule">
              {[1, 2, 3, 4].map((i) => (
                <p
                  key={i}
                  className="border-b border-bt-rule-2 py-3.5 text-[15px] leading-[1.55] text-bt-brown"
                >
                  {t(`who.${i}`)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof (renders only once there is a real testimonial) */}
      <Testimonials />

      {/* ── Trust ────────────────────────────────────────────────────── */}
      <section id="confianza" className="scroll-mt-16 bg-bt-paper-2">
        <div className={`${SECTION} py-[clamp(64px,8vw,104px)]`}>
          <p className={`${LABEL} mb-5`}>{t('trust.label')}</p>
          <h2 className={`${H2} max-w-[26ch] text-balance`}>{t('trust.title')}</h2>

          <div className="mt-[clamp(36px,4.5vw,52px)] grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] border-y border-bt-rule-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`border-l border-bt-rule-4 px-6 pb-[34px] pt-7 ${i === 3 ? 'border-r' : ''}`}
              >
                <p className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-orange">
                  {t(`trust.${i}.label`)}
                </p>
                <p className="mt-3.5 text-pretty text-[15px] leading-[1.6] text-bt-brown">
                  {t(`trust.${i}.body`)}
                  {i === 3 && (
                    <>
                      {' '}
                      <Link
                        to="/status"
                        className="border-b border-bt-muted-2 font-semibold text-bt-ink transition-colors hover:border-bt-orange hover:text-bt-orange"
                      >
                        {t('trust.3.link')}
                      </Link>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo (the "pricing" destination) ─────────────────────────── */}
      <section id="demo" className="scroll-mt-16 bg-bt-ink">
        <div
          className={`${SECTION} flex flex-wrap items-start gap-[clamp(40px,6vw,96px)] py-[clamp(72px,10vw,120px)]`}
        >
          <div className="min-w-[300px] flex-[1.2]">
            <p className="mb-[22px] font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted-2">
              {t('demo.label')}
            </p>
            <h2 className={H2_DARK}>{t('demo.title')}</h2>
            <p className="mt-[22px] max-w-[52ch] text-pretty text-[clamp(15px,1.35vw,17.5px)] leading-[1.6] text-bt-muted-2">
              {t('demo.subtitle')}
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-[26px]">
              <a href={mailtoDemo} className={CTA_PRIMARY} onClick={email('demo', 'demo')}>
                {t('cta.demo')}
              </a>
              <a
                href={mailtoDemo}
                onClick={email('demo', 'demo-address')}
                className="border-b border-[rgba(168,154,135,0.4)] pb-0.5 font-bt-mono text-xs tracking-[0.06em] text-bt-muted-2 transition-colors hover:border-bt-orange hover:text-bt-orange"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <p className="mt-[22px] font-bt-mono text-[11px] tracking-[0.08em] text-bt-muted">
              {t('demo.note')}
            </p>
          </div>

          <div className="min-w-[280px] max-w-[520px] flex-1">
            <div className="border-t border-[rgba(248,243,235,0.16)]">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-[18px] border-b border-[rgba(248,243,235,0.16)] py-4"
                >
                  <span className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-muted-2">
                    D-0{i}
                  </span>
                  <span className="text-pretty text-right text-[15.5px] text-bt-bone">
                    {t(`demo.${i}`)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-[18px] text-pretty text-sm leading-[1.6] text-bt-muted-2">
              {t('demo.alt')}{' '}
              <a
                href="#beta"
                onClick={cta('beta', 'demo-alt')}
                className="border-b border-[rgba(168,154,135,0.4)] font-semibold text-bt-bone transition-colors hover:border-bt-orange hover:text-bt-orange"
              >
                {t('demo.altLink')}
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Beta ─────────────────────────────────────────────────────── */}
      <section id="beta" className="scroll-mt-16 bg-bt-brown">
        <div
          className={`${SECTION} flex flex-wrap items-start gap-[clamp(40px,6vw,96px)] py-[clamp(72px,10vw,120px)]`}
        >
          <div className="min-w-[300px] flex-[1.2]">
            <p className="mb-[22px] font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted-2">
              {t('beta.label')}
            </p>
            <h2 className={H2_DARK}>{t('beta.title')}</h2>
            <p className="mt-[22px] max-w-[52ch] text-pretty text-[clamp(15px,1.35vw,17.5px)] leading-[1.6] text-bt-muted-2">
              {t('beta.subtitle')}
            </p>
            <div className="mt-[34px] flex flex-wrap items-center gap-[26px]">
              <a href={mailtoBeta} className={CTA_PRIMARY} onClick={email('beta', 'beta')}>
                {t('beta.cta')}
              </a>
              <a
                href={mailtoBeta}
                onClick={email('beta', 'beta-address')}
                className="border-b border-[rgba(168,154,135,0.4)] pb-0.5 font-bt-mono text-xs tracking-[0.06em] text-bt-muted-2 transition-colors hover:border-bt-orange hover:text-bt-orange"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>

          <div className="min-w-[280px] max-w-[520px] flex-1">
            <div className="border-t border-[rgba(248,243,235,0.16)]">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-[18px] border-b border-[rgba(248,243,235,0.16)] py-4"
                >
                  <span className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-muted-2">
                    {t(`beta.${i}.key`)}
                  </span>
                  <span className="text-pretty text-right text-[15.5px] text-bt-bone">
                    {t(`beta.${i}.value`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section id="nosotros" className="scroll-mt-16 bg-bt-paper">
        <div
          className={`${SECTION} flex flex-wrap items-start gap-[clamp(36px,6vw,96px)] py-[clamp(64px,8vw,104px)]`}
        >
          <div className="min-w-[280px] flex-1">
            <p className={`${LABEL} mb-5`}>{t('about.label')}</p>
            <h2 className="text-balance font-bt-heading text-[clamp(30px,3.5vw,46px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-ink">
              {t('about.title')}
            </h2>
          </div>
          <div className="min-w-[300px] max-w-[640px] flex-[1.2]">
            <p className="text-pretty text-[clamp(15px,1.35vw,17.5px)] leading-[1.65] text-bt-brown">
              {t('about.p1a')}
              <strong className="font-semibold">Archlogic</strong>
              {t('about.p1b')}
            </p>
            <p className="mt-4 text-pretty text-[clamp(15px,1.35vw,17.5px)] leading-[1.65] text-bt-brown">
              {t('about.p2')}
            </p>
            <div className="mt-7 flex flex-wrap justify-between gap-3.5 border-t border-bt-rule pt-3.5 font-bt-mono text-[10.5px] tracking-[0.12em] text-bt-muted">
              <span>{t('about.location')}</span>
              <span className="text-bt-orange">{t('about.today')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-16 border-t border-bt-rule bg-bt-paper">
        <div
          className={`${SECTION} flex flex-wrap items-start gap-[clamp(36px,6vw,96px)] py-[clamp(64px,8vw,104px)]`}
        >
          <div className="min-w-[260px] flex-1">
            <p className={`${LABEL} mb-5`}>{t('faq.label')}</p>
            <h2 className="text-balance font-bt-heading text-[clamp(30px,3.5vw,46px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-ink">
              {t('faq.title')}
            </h2>
            <p className="mt-[18px] max-w-[36ch] text-pretty text-[15px] leading-[1.6] text-bt-muted">
              {t('faq.other')}{' '}
              <a
                href={mailtoBeta}
                className="border-b border-bt-muted-2 font-semibold text-bt-ink transition-colors hover:border-bt-orange hover:text-bt-orange"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
          <div className="min-w-[300px] max-w-[720px] flex-[1.4]">
            <div className="border-t border-bt-rule">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="border-b border-bt-rule-2 py-[22px]">
                  <div className="flex items-baseline gap-4">
                    <span className="w-[34px] flex-none font-bt-mono text-[10.5px] tracking-[0.1em] text-bt-orange">
                      P-0{i}
                    </span>
                    <h3 className="text-[16.5px] font-semibold text-bt-ink">{t(`faq.${i}.q`)}</h3>
                  </div>
                  <p className="mt-2.5 text-pretty pl-[50px] text-[14.5px] leading-[1.6] text-bt-muted">
                    {t(`faq.${i}.a`)}
                    {i === 4 && (
                      <>
                        {' '}
                        <Link
                          to="/status"
                          className="border-b border-bt-muted-2 font-semibold text-bt-ink transition-colors hover:border-bt-orange hover:text-bt-orange"
                        >
                          {t('faq.4.link')}
                        </Link>
                      </>
                    )}
                    {i === 5 && (
                      <>
                        {' '}
                        <a
                          href="#demo"
                          className="border-b border-bt-muted-2 font-semibold text-bt-ink transition-colors hover:border-bt-orange hover:text-bt-orange"
                        >
                          {t('faq.5.link')}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section id="cta-final" className="relative overflow-hidden bg-bt-ink">
        <BlueprintGrid fade="top" lineOpacity={0.04} />
        <div className={`${SECTION} relative py-[clamp(80px,11vw,140px)]`}>
          <h2 className="max-w-[16ch] font-bt-display text-[clamp(44px,7.5vw,110px)] font-extrabold uppercase leading-[0.9] tracking-[0.01em] text-bt-bone">
            {t('ctaFinal.line1')} <span className="text-bt-orange">{t('ctaFinal.line2')}</span>
          </h2>
          <div className="mt-[clamp(30px,4vw,44px)] flex flex-wrap items-center gap-[clamp(18px,2.5vw,32px)]">
            <a href={mailtoDemo} className={CTA_PRIMARY} onClick={email('demo', 'final')}>
              {t('cta.demo')}
            </a>
            <a href="#beta" className={CTA_GHOST} onClick={cta('beta', 'final')}>
              {t('cta.beta')}
            </a>
          </div>
          <p className="mt-6 font-bt-mono text-xs tracking-[0.08em] text-bt-muted">{t('ctaFinal.note')}</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-bt-orange bg-bt-ink">
        <div className={`${SECTION} py-[clamp(48px,6vw,72px)]`}>
          <div className="flex flex-wrap items-start justify-between gap-9">
            <div>
              <Link to="/" aria-label="BuildTrack">
                <BuildTrackLogo boxPx={32} textPx={20} />
              </Link>
              <p className="mt-4 font-bt-mono text-[10.5px] tracking-[0.12em] text-bt-muted">
                {t('footer.motto')}
              </p>
            </div>
            <div className="flex flex-wrap gap-[clamp(24px,3.5vw,48px)]">
              <a href="#plataforma" className={NAV_LINK}>
                {t('nav.platform')}
              </a>
              <a href="#app" className={NAV_LINK}>
                {t('nav.app')}
              </a>
              <a href="#demo" className={NAV_LINK}>
                {t('cta.demo')}
              </a>
              <a href="#beta" className={NAV_LINK}>
                {t('footer.beta')}
              </a>
              <Link to="/docs" className={NAV_LINK}>
                {t('nav.docs')}
              </Link>
              <Link to="/status" className={NAV_LINK}>
                {t('footer.status')}
              </Link>
              <Link to="/privacy" className={NAV_LINK}>
                {t('footer.privacy')}
              </Link>
              <Link to="/terms" className={NAV_LINK}>
                {t('footer.terms')}
              </Link>
              <a href={mailtoBeta} className={NAV_LINK}>
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <div className="mt-[clamp(40px,5vw,56px)] flex flex-wrap justify-between gap-3.5 border-t border-[rgba(168,154,135,0.2)] pt-[18px] font-bt-mono text-[10.5px] tracking-[0.1em] text-bt-muted">
            <span>{t('footer.copy')}</span>
            <span>{t('footer.coord')}</span>
          </div>
        </div>
      </footer>

      <StickyBar watch={heroRef} />
      <AssistantLauncher />
      <LogoBuildOverlay markRef={logoMarkRef} onStandInChange={setLogoStandIn} />
    </div>
  );
}
