import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../LanguageSwitcher';
import { track } from '../../lib/analytics';
import { BuildTrackLogo } from './BuildTrackLogo';

/**
 * The landing's navigation: the section and page links, the menu that holds
 * them on a phone, and the bar that follows the reader once the hero is gone.
 *
 * Below `lg` the links do not fit on one line (they used to wrap into two rows
 * on a phone), so they fold into a menu button. The sticky bar exists because
 * the page is long: past the hero, "Agenda una demo" was nowhere in sight.
 */

export const NAV_LINK = 'text-sm font-medium text-bt-muted-2 transition-colors hover:text-bt-bone';
const SIGN_IN =
  'rounded-[2px] border border-[rgba(168,154,135,0.45)] px-[18px] py-2 text-sm font-medium text-bt-bone transition-colors hover:border-bt-orange hover:text-bt-orange';
const DEMO_BUTTON =
  'inline-block whitespace-nowrap rounded-[2px] bg-bt-orange px-4 py-2 text-sm font-bold tracking-[-0.01em] text-bt-ink transition-colors hover:bg-bt-orange-hover';
const MENU_LINK =
  'border-b border-[rgba(168,154,135,0.2)] py-3.5 text-base font-medium text-bt-bone transition-colors hover:text-bt-orange';

/** Section anchors and public pages, in reading order. "Precios" goes to the demo section — there is no price list. */
export function NavLinks({ className, onNavigate }: { className: string; onNavigate?: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <>
      <a href="#plataforma" className={className} onClick={onNavigate}>
        {t('nav.platform')}
      </a>
      <a href="#app" className={className} onClick={onNavigate}>
        {t('nav.app')}
      </a>
      <Link to="/docs" className={className} onClick={onNavigate}>
        {t('nav.docs')}
      </Link>
      <Link to="/status" className={className} onClick={onNavigate}>
        {t('nav.status')}
      </Link>
      <a href="#demo" className={className} onClick={onNavigate}>
        {t('nav.pricing')}
      </a>
    </>
  );
}

export function SignInLink({ place }: { place: string }) {
  const { t } = useTranslation('landing');
  return (
    <Link to="/login" className={SIGN_IN} onClick={() => track('cta_click', { cta: 'sign_in', place })}>
      {t('nav.signIn')}
    </Link>
  );
}

function DemoButton({ place, onClick }: { place: string; onClick?: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <a
      href="#demo"
      className={DEMO_BUTTON}
      onClick={() => {
        track('cta_click', { cta: 'demo', place });
        onClick?.();
      }}
    >
      {t('cta.demo')}
    </a>
  );
}

/**
 * The phone's menu: a button that drops the links, the language switch and the
 * sign-in under the bar it sits in. Closes on a link, Esc, or a tap outside.
 */
export function MobileMenu({ className = '', place }: { className?: string; place: string }) {
  const { t } = useTranslation('landing');
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={className}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(open ? 'nav.closeMenu' : 'nav.openMenu')}
        onClick={() => setOpen((was) => !was)}
        className="flex h-11 w-11 items-center justify-center rounded-[2px] border border-[rgba(168,154,135,0.45)] text-bt-bone transition-colors hover:border-bt-orange hover:text-bt-orange"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          {open ? (
            <path d="M4 4 L16 16 M16 4 L4 16" fill="none" stroke="currentColor" strokeWidth="1.8" />
          ) : (
            <path d="M3 5.5 H17 M3 10 H17 M3 14.5 H17" fill="none" stroke="currentColor" strokeWidth="1.8" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-30 border-b-2 border-bt-orange bg-bt-ink px-[clamp(22px,5vw,64px)] pb-6 shadow-[0_24px_40px_-24px_rgba(23,19,15,0.8)]"
        >
          <div className="flex flex-col">
            <NavLinks className={MENU_LINK} onNavigate={close} />
            <Link
              to="/login"
              className={MENU_LINK}
              onClick={() => {
                track('cta_click', { cta: 'sign_in', place });
                close();
              }}
            >
              {t('nav.signIn')}
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <LanguageSwitcher variant="public" />
            <DemoButton place={`${place}-menu`} onClick={close} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A slim bar pinned to the top once `watch` (the hero) has scrolled away, so
 * the demo button is always one tap off. Hidden bars are `invisible`, which
 * also takes them out of the tab order and the accessibility tree.
 */
export function StickyBar({ watch }: { watch: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation('landing');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const hero = watch.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), {
      rootMargin: '-72px 0px 0px 0px',
    });
    io.observe(hero);
    return () => io.disconnect();
  }, [watch]);

  return (
    <div
      data-sticky-bar
      data-shown={shown ? 'true' : 'false'}
      className={`fixed inset-x-0 top-0 z-30 border-b-2 border-bt-orange bg-bt-ink transition-[transform,visibility] duration-300 motion-reduce:transition-none ${
        shown ? 'visible translate-y-0' : 'invisible -translate-y-full'
      }`}
    >
      <nav
        aria-label={t('nav.sticky')}
        className="relative mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-[clamp(22px,5vw,64px)] py-2.5"
      >
        <Link to="/" aria-label="BuildTrack">
          <BuildTrackLogo boxPx={26} textPx={16} />
        </Link>
        <div className="flex items-center gap-[clamp(14px,2vw,26px)] max-lg:hidden">
          <NavLinks className={NAV_LINK} />
          <SignInLink place="sticky" />
          <DemoButton place="sticky" />
        </div>
        <div className="flex items-center gap-3 lg:hidden">
          <DemoButton place="sticky" />
          <MobileMenu place="sticky" />
        </div>
      </nav>
    </div>
  );
}
