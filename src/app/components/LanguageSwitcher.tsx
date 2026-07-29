import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGS = ['es', 'en'] as const;

type Variant = 'app' | 'public';

/**
 * ES / EN switcher.
 *
 * Two looks, one component — this is mounted in ~14 places across the
 * authenticated app (AppShell, Login, Signup, the dashboards, billing), so the
 * default `app` variant must keep its existing globe-toggle appearance.
 *
 * `public` renders the segmented ES|EN control the landing / docs / status
 * design calls for: both languages always visible, the active one filled
 * orange. Either way the choice is persisted by i18next's language detector
 * (localStorage), so it follows the reader across every page.
 */
export function LanguageSwitcher({ variant = 'app' }: { variant?: Variant } = {}) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language.startsWith('es');

  if (variant === 'public') {
    return (
      <span
        role="group"
        aria-label="Idioma / Language"
        className="inline-flex overflow-hidden rounded-[2px] border border-[rgba(168,154,135,0.45)]"
      >
        {LANGS.map((lng) => {
          const active = lng === 'es' ? isSpanish : !isSpanish;
          return (
            <button
              key={lng}
              type="button"
              aria-pressed={active}
              onClick={() => i18n.changeLanguage(lng)}
              className={`cursor-pointer border-none px-2.5 py-1.5 font-bt-mono text-[10.5px] tracking-[0.08em] transition-colors ${
                active ? 'bg-bt-orange text-bt-ink' : 'bg-transparent text-bt-muted-2 hover:text-bt-bone'
              }`}
            >
              {lng.toUpperCase()}
            </button>
          );
        })}
      </span>
    );
  }

  return (
    <button
      onClick={() => i18n.changeLanguage(isSpanish ? 'en' : 'es')}
      title={isSpanish ? 'Switch to English' : 'Cambiar a Español'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors border border-[#D4D4D8]"
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{isSpanish ? 'ES' : 'EN'}</span>
    </button>
  );
}
