import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, X } from 'lucide-react';

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
 */

const SEEN_VERSION = 'v1';
const seenKey = (username: string | null, section: string) =>
  `bt.sectionintro.${SEEN_VERSION}.${username ?? 'anon'}.${section}`;

/** Sections with authored copy. Kept explicit so a typo'd key fails loudly in review. */
export const INTRO_SECTIONS = new Set([
  'users', 'time-approvals', 'hours', 'labor-cost', 'labor-payroll',
  'projects', 'clients', 'subcontractors', 'schedules', 'tool-inventory', 'tool-report',
  'invoices', 'invoice-branding', 'budgets', 'budget-report',
  'expenses', 'expense-report', 'office-expenses',
  'accounts-receivable', 'accounts-payable', 'audit',
]);

export function SectionIntro({
  section,
  username,
  replayNonce,
}: {
  section: string;
  username: string | null;
  /** Increment (with the section current) to re-show the card on demand. */
  replayNonce: number;
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

  return (
    <div className="mx-4 md:mx-6 mt-4 border border-[#F97316]/30 bg-[#F97316]/5 rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <Compass className="w-5 h-5 text-[#F97316]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0A0A0A]">{t(`admin:sec.${section}.title`)}</p>
        <p className="text-xs text-[#3F3F46] mt-0.5 leading-relaxed">{t(`admin:sec.${section}.body`)}</p>
        <ul className="mt-1.5 space-y-0.5">
          {(['b1', 'b2'] as const).map(b => (
            <li key={b} className="text-xs text-[#52525B] flex items-start gap-1.5">
              <span className="text-[#F97316] mt-px">▸</span>
              <span>{t(`admin:sec.${section}.${b}`)}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={dismiss}
          className="mt-2.5 font-bt-mono text-[10px] uppercase tracking-[0.1em] bg-[#F97316] hover:bg-[#EA580C] text-white px-3 py-1.5 transition-colors">
          {t('admin:sec.gotIt')}
        </button>
      </div>
      <button onClick={dismiss} aria-label={t('admin:sec.close')}
        className="text-[#A1A1AA] hover:text-[#0A0A0A] transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
