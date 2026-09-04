import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { listClients, type ClientResponse } from '../../../services/clients';
import { FIELD_LIMITS } from '../../../../shared/fieldLimits';
import { cn } from '../../ui/utils';
import { FOCUS_RING, SecondaryButton, TertiaryButton } from '../../onboarding/chrome';

/**
 * Client picker of the project window: a square select-like button that opens
 * a searchable list, with "Crear cliente" beside it and "Limpiar" once a
 * client is chosen — the three controls the 02-CREAR artboard draws in a row.
 */
export function ClientSelector({ value, valueName, onChange, disabled, onRequestCreateClient }: {
  value: number | null;
  /** Name to show while the list has not loaded (edit mode). */
  valueName?: string;
  onChange: (id: number | null, name: string) => void;
  disabled?: boolean;
  onRequestCreateClient: () => void;
}) {
  const { t } = useTranslation('admin');
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = clients.find(c => c.id === value);
  const label = selected?.name ?? (value != null ? valueName : undefined);

  const fetchClients = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const page = await listClients(q || undefined, 'ACTIVE', 0, 50);
      setClients(page.content);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) fetchClients(search); }, [isOpen, search, fetchClients]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2 items-center flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={cn(
            'flex-1 min-w-[220px] max-w-[360px] h-10 px-3 flex items-center justify-between border bg-white text-sm text-left',
            disabled ? 'border-[#DBD0BB] bg-[#F3EEE4] text-[#8A8175] cursor-not-allowed' : 'border-[#DBD0BB] hover:border-[#F97316] cursor-pointer',
            FOCUS_RING,
          )}
        >
          <span className={cn('truncate', label ? 'text-[#0A0A0A]' : 'text-[#A69C8D]')}>{label || t('projectForm.selectClient')}</span>
          <ChevronDown className="w-[13px] h-[13px] text-[#8A8175] flex-shrink-0" strokeWidth={2.2} />
        </button>
        <SecondaryButton onClick={() => { onRequestCreateClient(); setIsOpen(false); }} disabled={disabled} className="h-10 text-[10px] px-[13px] bg-[#FAF7F0]">
          {t('projectForm.createClient')}
        </SecondaryButton>
        {value != null && !disabled && (
          <TertiaryButton onClick={() => { onChange(null, ''); setIsOpen(false); }} className="text-[10px] px-1">
            {t('projectForm.clearClient')}
          </TertiaryButton>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-w-[360px] bg-white border border-[#DBD0BB] shadow-[0_12px_28px_-18px_rgba(23,19,15,0.4)]">
          <div className="p-2 border-b border-[#F0EBE1]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69C8D]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('projectForm.searchClients')}
                maxLength={FIELD_LIMITS.SEARCH}
                className={cn('w-full h-8 pl-8 pr-3 text-sm bg-[#FAF7F0] border border-[#DBD0BB] outline-none focus:border-[#F97316]', FOCUS_RING)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto" role="listbox">
            {loading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[#F97316]" /></div>
            ) : clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#8A8175]">{t('projectForm.noClients')}</p>
            ) : clients.map(c => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === value}
                onClick={() => { onChange(c.id, c.name); setIsOpen(false); setSearch(''); }}
                className={cn('w-full text-left px-3 py-2 text-sm border-l-2 transition-colors hover:bg-[#F3EEE4]', c.id === value ? 'border-l-[#F97316] bg-[#FBEDE0] text-[#0A0A0A] font-semibold' : 'border-l-transparent text-[#0A0A0A]')}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
