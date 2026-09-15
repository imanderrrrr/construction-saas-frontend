import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono, INPUT } from '../projects/bt';
import { FOCUS_RING, TertiaryButton } from '../onboarding/chrome';
import type { OfficeCategory } from '../../services/officeExpenses';

/**
 * El selector de categoría: busca, y **crea si no existe**.
 *
 * Con una lista que escribe la empresa ya no cabe un desplegable corto: puede
 * haber veinte categorías y la que hace falta puede no estar. Escribir un
 * nombre que no coincide con ninguna ofrece crearla — **para toda la empresa**,
 * no como etiqueta suelta de este gasto, y eso hay que decirlo donde se pulsa.
 *
 * Las archivadas **no se ofrecen**: dejaron de usarse a propósito. Siguen
 * apareciendo en el historial y en el filtro, que es otra cosa.
 */
export function CategoryPicker({ categories, value, draftName, onPick, onDraft, onManage, error }: {
  categories: OfficeCategory[];
  /** La categoría elegida, o null si se va a crear una nueva. */
  value: number | null;
  /** El nombre escrito que todavía no existe. */
  draftName: string;
  onPick: (id: number) => void;
  onDraft: (name: string) => void;
  onManage?: () => void;
  error?: string | null;
}) {
  const { t } = useTranslation('admin');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => categories.filter(c => !c.archived), [categories]);
  const picked = value != null ? categories.find(c => c.id === value) ?? null : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(c => c.name.toLowerCase().includes(q));
  }, [active, query]);

  const exact = useMemo(
    () => active.find(c => c.name.toLowerCase() === query.trim().toLowerCase()) ?? null,
    [active, query],
  );
  const canCreate = query.trim().length > 0 && !exact;
  const tooLong = query.trim().length > NAME_MAX;

  const label = picked?.name ?? (draftName ? t('officeExpenses.categories.willCreate', { name: draftName }) : '');

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-baseline justify-between gap-3">
        <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">
          {t('officeExpenses.form.category')} *
        </Mono>
        {onManage && (
          <TertiaryButton onClick={onManage}>{t('officeExpenses.categories.manage')}</TertiaryButton>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'mt-1.5 w-full h-10 flex items-center justify-between gap-2 border bg-white px-3 text-left',
          error ? 'border-[#B3402A]' : 'border-[#DBD0BB]',
          FOCUS_RING,
        )}
      >
        <span className={cn('font-bt-mono text-[10.5px] uppercase tracking-[0.08em] truncate', label ? 'text-[#0A0A0A]' : 'text-[#A69C8D]')}>
          {label || t('officeExpenses.categories.pick')}
        </span>
        <span className="text-[#8A8175] text-[10px]" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-[#0A0A0A] max-h-[260px] overflow-y-auto">
          <div className="p-2 border-b border-[#E7E1D5]">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('officeExpenses.categories.search')}
              className={INPUT}
              aria-label={t('officeExpenses.categories.search')}
            />
            <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-1.5">
              {tooLong
                ? t('officeExpenses.categories.error.tooLong', { count: query.trim().length, max: NAME_MAX })
                : t('officeExpenses.categories.counter', { count: query.trim().length, max: NAME_MAX })}
            </Mono>
          </div>

          {matches.map(c => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={c.id === value}
              onClick={() => { onPick(c.id); setOpen(false); setQuery(''); }}
              className={cn(
                'w-full text-left px-3 py-2 flex items-baseline justify-between gap-3 hover:bg-[#FBEDE0]',
                c.id === value && 'bg-[#F3EEE4]',
                FOCUS_RING,
              )}
            >
              <span className="text-[12.5px] text-[#0A0A0A] truncate">{c.name}</span>
              <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] flex-shrink-0">
                {t('officeExpenses.categories.uses', { count: c.expenseCount })}
              </Mono>
            </button>
          ))}

          {matches.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-[#5A5346]">
              {t('officeExpenses.categories.noMatch', { count: active.length })}
            </p>
          )}

          {canCreate && !tooLong && (
            <button
              type="button"
              onClick={() => { onDraft(query.trim()); setOpen(false); setQuery(''); }}
              className={cn(
                'w-full text-left px-3 py-2.5 border-t border-[#E7E1D5] bg-[#FBF8F2] hover:bg-[#FBEDE0]',
                FOCUS_RING,
              )}
            >
              <Mono className="block text-[10px] tracking-[0.1em] text-[#C2410C]">
                {t('officeExpenses.categories.create', { name: query.trim() })}
              </Mono>
              <span className="block text-[11.5px] leading-[1.5] text-[#5A5346] mt-1">
                {t('officeExpenses.categories.createHint')}
              </span>
            </button>
          )}
        </div>
      )}

      {error && <p className="text-[11.5px] text-[#B3402A] mt-1.5">{error}</p>}
    </div>
  );
}

const NAME_MAX = 40;
