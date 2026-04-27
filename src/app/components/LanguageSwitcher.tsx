import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language.startsWith('es');

  const toggle = () => {
    i18n.changeLanguage(isSpanish ? 'en' : 'es');
  };

  return (
    <button
      onClick={toggle}
      title={isSpanish ? 'Switch to English' : 'Cambiar a Español'}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors border border-[#D4D4D8]"
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{isSpanish ? 'ES' : 'EN'}</span>
    </button>
  );
}
