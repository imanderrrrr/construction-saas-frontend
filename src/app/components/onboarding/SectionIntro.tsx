import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { CloseButton, PrimaryButton } from './chrome';

/**
 * Per-section purpose card: the first time a user opens a section, a slim
 * dismissible banner explains what the section is FOR and what to use it for.
 * Non-blocking (no dimmer) — it sits above the section content.
 *
 * The topbar "?" replays the intro of the section on screen (the dashboard
 * keeps its richer welcome + spotlight tour instead).
 *
 * Copy lives in admin.json under `sec.<key>.title|body|b1|b2`. A section
 * without copy simply never shows a card.
 *
 * Look (Claude Design "Onboarding BuildTrack", 2026-09): paper card with a
 * 3 px orange left edge, compass in an ink square, mono kicker, display title.
 * On phones the icon, kicker and close share one header row and the button
 * spans the width; on desktop the close sits top-right and the button
 * bottom-right, in their own column.
 */

const SEEN_VERSION = 'v1';
const seenKey = (username: string | null, section: string) =>
  `bt.sectionintro.${SEEN_VERSION}.${username ?? 'anon'}.${section}`;

/** Sections with authored copy. Kept explicit so a typo'd key fails loudly in review. */
export const INTRO_SECTIONS = new Set([
  'users', 'time-approvals', 'hours', 'labor-cost', 'labor-payroll',
  'projects', 'clients', 'subcontractors', 'schedules', 'tool-inventory', 'tool-report',
  // The screens inside Proyectos that claim the tour (lib/tourScope) — the
  // banner is their voice on phones and on a tab with nothing to point at.
  'projects-crear', 'projects-ficha-resumen', 'projects-ficha-dinero', 'projects-ficha-equipo',
  'projects-ficha-pendientes', 'projects-ficha-consultas', 'projects-ficha-portal',
  'invoices', 'invoice-branding', 'budgets', 'budget-report',
  'expenses', 'expense-report', 'office-expenses',
  'accounts-receivable', 'accounts-payable', 'audit',
  // The two halves of T&M — the banner is their mobile/fallback voice; the
  // desktop tour lives in SECTION_TOUR_STEPS under the same keys.
  'tm-field', 'tm-office',
]);

export function SectionIntro({
  section,
  username,
  replayNonce,
  sectionLabel,
}: {
  section: string;
  username: string | null;
  /** Increment (with the section current) to re-show the card on demand. */
  replayNonce: number;
  /** The section's display title, for the kicker ("Guía de sección · Usuarios"). */
  sectionLabel?: string;
}) {
  const { t } = useTranslation(['admin']);
  const [visible, setVisible] = useState(false);

  // First visit per section.
  useEffect(() => {
    if (!INTRO_SECTIONS.has(section)) { setVisible(false); return; }
    try {
      setVisible(localStorage.getItem(seenKey(username, section)) === null);
    } catch {
      setVisible(false);
    }
  }, [section, username]);

  // "?" replay for the current section.
  useEffect(() => {
    if (replayNonce > 0 && INTRO_SECTIONS.has(section)) setVisible(true);
  }, [replayNonce, section]);

  const dismiss = () => {
    try { localStorage.setItem(seenKey(username, section), new Date().toISOString()); } catch { /* private mode */ }
    setVisible(false);
  };

  if (!visible || !INTRO_SECTIONS.has(section)) return null;

  const icon = (
    <span className="w-8 h-8 bg-[#0A0A0A] flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <Compass className="w-4 h-4 text-[#F97316]" strokeWidth={1.9} />
    </span>
  );
  const kicker = t('admin:sec.kicker');

  return (
    <div className="mx-4 md:mx-6 mt-4 bg-[#FAF7F0] border border-[#DBD0BB] border-l-[3px] border-l-[#F97316] p-4 pl-[17px] md:py-[18px] md:pr-[18px] md:pl-5 md:flex md:items-stretch md:gap-[18px]">
      {/* Desktop: the icon is its own column. */}
      <div className="hidden md:block">{icon}</div>

      <div className="flex-1 min-w-0">
        {/* Phone header: icon + two-line kicker, close at the right. */}
        <div className="flex items-start justify-between gap-3 md:hidden">
          <div className="flex items-center gap-[11px]">
            {icon}
            <span className="font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#8A8175] leading-snug">
              {kicker}
              {sectionLabel && (<><br />{sectionLabel}</>)}
            </span>
          </div>
          <CloseButton onClick={dismiss} aria-label={t('admin:sec.close')} className="w-8 h-8" />
        </div>

        <p className="hidden md:block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8175]">
          {kicker}{sectionLabel && ` · ${sectionLabel}`}
        </p>
        <h3 className="font-bt-display font-extrabold uppercase text-[28px] md:text-[30px] leading-none tracking-[0.01em] text-[#0A0A0A] mt-3.5 md:mt-2">
          {t(`admin:sec.${section}.title`)}
        </h3>
        <p className="text-sm leading-[1.6] text-[#5A5346] mt-[9px] md:max-w-[720px]">
          {t(`admin:sec.${section}.body`)}
        </p>
        <ul className="mt-3.5 space-y-2 md:space-y-[7px]">
          {(['b1', 'b2'] as const).map(b => (
            <li key={b} className="flex items-baseline gap-2.5">
              <span className="font-bt-mono text-[11px] text-[#F97316] flex-shrink-0" aria-hidden="true">▸</span>
              <span className="text-[13.5px] leading-normal text-[#5A5346]">{t(`admin:sec.${section}.${b}`)}</span>
            </li>
          ))}
        </ul>

        <PrimaryButton onClick={dismiss} className="md:hidden w-full mt-[18px] py-3.5">
          {t('admin:sec.gotIt')}
        </PrimaryButton>
      </div>

      {/* Desktop: close on top, the action at the bottom, in their own column. */}
      <div className="hidden md:flex flex-col items-end justify-between flex-shrink-0 gap-3.5">
        <CloseButton onClick={dismiss} aria-label={t('admin:sec.close')} />
        <PrimaryButton onClick={dismiss}>{t('admin:sec.gotIt')}</PrimaryButton>
      </div>
    </div>
  );
}
