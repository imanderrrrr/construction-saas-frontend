import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { FieldHint, INPUT, INPUT_ERROR, Mono } from '../projects/bt';

/**
 * A picker that asks the server instead of holding a truncated list.
 *
 * The two dropdowns this replaces were plain `<select>`s over one unpaginated
 * fetch: clients came back 50 at a time and jobsites 100 (the server clamps
 * `size` to 100 — asking for 500 returns 100), with no search and no paging
 * and no sign that anything had been left out. A company with 62 clients
 * could not invoice twelve of them; the only escape was the "Other" option,
 * which stores a loose name and breaks the link to the client's record.
 *
 * Options that exist but cannot be used are still shown, greyed, with the
 * reason — a jobsite missing from the list is indistinguishable from a
 * jobsite that was never created.
 */

export interface PickerOption {
  id: string;
  label: string;
  /** Second line: cost code, client, whatever identifies it. */
  sub?: string | null;
  /** Present = the option cannot be picked, and this says why. */
  blocked?: string | null;
}

export function SearchSelect({
  value, label, placeholder, hint, error, disabled, emptyText, minChars = 0,
  onChange, fetchOptions, testId, footer,
}: {
  value: PickerOption | null;
  label: string;
  placeholder: string;
  hint?: string;
  error?: boolean;
  disabled?: boolean;
  emptyText: string;
  /** Wait for this many characters before asking the server. */
  minChars?: number;
  onChange: (option: PickerOption | null) => void;
  fetchOptions: (query: string) => Promise<PickerOption[]>;
  testId?: string;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation(['finance', 'common']);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    if (debounced.length < minChars) { setOptions([]); return; }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchOptions(debounced)
      .then(list => { if (!cancelled) { setOptions(list); setActive(0); } })
      .catch(() => { if (!cancelled) { setOptions([]); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, debounced, minChars, fetchOptions]);

  // Clicking anywhere else closes the list without changing the choice.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const selectable = useMemo(() => options.filter(o => !o.blocked), [options]);

  const pick = (option: PickerOption) => {
    if (option.blocked) return;
    onChange(option);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive(i => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        return Math.max(0, Math.min(selectable.length - 1, next));
      });
      return;
    }
    if (e.key === 'Enter' && open && selectable[active]) {
      e.preventDefault();
      pick(selectable[active]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={listId}
          className="block font-bt-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5A5346] mb-1.5"
        >
          {label}<span className="text-[#F97316]"> *</span>
        </label>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => { onChange(null); setQuery(''); }}
            className={cn('font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#8A8175] hover:text-[#C2410C] mb-1.5', FOCUS_RING)}
          >
            {t('common:buttons.clear', 'Limpiar')}
          </button>
        )}
      </div>

      {value ? (
        <div className={cn(
          'flex items-center justify-between gap-2 border bg-white px-3 h-10',
          error ? 'border-[#F97316]' : 'border-[#DBD0BB]',
          disabled && 'bg-[#F3EEE4]',
        )}>
          <span className="min-w-0 truncate text-[13.5px] text-[#0A0A0A]" data-testid={testId ? `${testId}-value` : undefined}>
            {value.label}
          </span>
          {!disabled && (
            <button
              type="button"
              aria-label={t('common:buttons.change', 'Cambiar')}
              onClick={() => { onChange(null); setOpen(true); setQuery(''); }}
              className={cn('w-6 h-6 flex items-center justify-center border border-[#DBD0BB] text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C] flex-shrink-0', FOCUS_RING)}
            >
              <X className="w-3 h-3" strokeWidth={2.4} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#A69C8D] absolute left-[11px] top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={listId}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            data-testid={testId}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={onKeyDown}
            className={cn(INPUT, 'pl-8', error && INPUT_ERROR)}
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A69C8D] absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
      )}

      {hint && <FieldHint className="normal-case tracking-normal text-[11.5px] text-[#8A8175]">{hint}</FieldHint>}

      {open && !value && (
        <div className="absolute z-30 left-0 right-0 mt-1 max-h-[280px] overflow-y-auto border border-[#CDBFA6] bg-white shadow-[0_16px_48px_rgba(23,19,15,0.3)]">
          {debounced.length < minChars ? (
            <div className="px-3.5 py-3"><Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('finance:invoice.picker.typeMore', { count: minChars })}</Mono></div>
          ) : failed ? (
            <div className="px-3.5 py-3 text-[12.5px] text-[#B3402A]">{t('finance:invoice.picker.failed')}</div>
          ) : loading && options.length === 0 ? (
            <div className="px-3.5 py-3"><Mono className="text-[10px] tracking-[0.08em] text-[#8A8175]">{t('finance:invoice.picker.searching')}</Mono></div>
          ) : options.length === 0 ? (
            <div className="px-3.5 py-3 text-[12.5px] text-[#8A8175]">{emptyText}</div>
          ) : (
            options.map(option => {
              const index = selectable.indexOf(option);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!!option.blocked}
                  onClick={() => pick(option)}
                  onMouseEnter={() => index >= 0 && setActive(index)}
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 border-b border-[#F0EBE1] last:border-b-0 border-l-2 border-l-transparent',
                    option.blocked
                      ? 'bg-[#F3EEE4] cursor-not-allowed'
                      : cn('hover:bg-[#FBF8F2] hover:border-l-[#F97316]', index === active && 'bg-[#FBF8F2] border-l-[#F97316]'),
                    FOCUS_RING,
                  )}
                >
                  <div className={cn('text-[13.5px] truncate', option.blocked ? 'text-[#8A8175]' : 'text-[#0A0A0A]')}>{option.label}</div>
                  {option.blocked
                    ? <Mono className="block text-[9.5px] tracking-[0.08em] text-[#B3402A] mt-[3px]">{option.blocked}</Mono>
                    : option.sub && <Mono className="block text-[10px] tracking-[0.05em] text-[#A69C8D] mt-[3px] truncate">{option.sub}</Mono>}
                </button>
              );
            })
          )}
          {footer && <div className="border-t border-[#EDE7DB] bg-[#FBF8F2] px-3.5 py-2.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}
