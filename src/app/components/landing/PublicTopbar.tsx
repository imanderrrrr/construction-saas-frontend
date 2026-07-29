import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../LanguageSwitcher';
import { BuildTrackLogo } from './BuildTrackLogo';

/**
 * The dark topbar shared by the Docs and Status pages: wordmark, the page's
 * own technical label, then the ES/EN switcher and whatever links the page
 * passes as children.
 */
export function PublicTopbar({
  label,
  containerClass,
  children,
}: {
  /** Mono label after the wordmark, e.g. "DOCUMENTACIÓN · BT-DOC". */
  label: string;
  /** Width + padding, so each page can match its own content column. */
  containerClass: string;
  /** Right-hand links, after the language switcher. */
  children?: ReactNode;
}) {
  const { t } = useTranslation('landing');
  return (
    <nav aria-label={t('nav.menu')} className="border-b-2 border-bt-orange bg-bt-ink">
      <div className={`${containerClass} flex flex-wrap items-center justify-between gap-5 py-4`}>
        <div className="flex flex-wrap items-center gap-[18px]">
          <Link to="/" aria-label="BuildTrack">
            <BuildTrackLogo boxPx={28} textPx={17} />
          </Link>
          <span className="border-l border-[rgba(168,154,135,0.3)] pl-[18px] font-bt-mono text-[10px] tracking-[0.14em] text-bt-muted">
            {label}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-[22px]">
          <LanguageSwitcher variant="public" />
          {children}
        </div>
      </div>
    </nav>
  );
}

/** A muted topbar link (the secondary destination). */
export function TopbarLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13.5px] font-medium text-bt-muted-2 transition-colors hover:text-bt-bone">
      {children}
    </Link>
  );
}

/** The "back to site" link — brighter, since it's the way out. */
export function TopbarBackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[13.5px] font-medium text-bt-bone transition-colors hover:text-bt-orange">
      {children}
    </Link>
  );
}
