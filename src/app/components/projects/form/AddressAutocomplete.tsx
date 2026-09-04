import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin, X } from 'lucide-react';
import { cn } from '../../ui/utils';
import { INPUT } from '../bt';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Address field with OpenStreetMap (Nominatim) suggestions. The list drops
 * over whatever is below (the map), it never pushes the layout; picking a
 * suggestion fills the coordinates, and leaving the field with a typed
 * address that was never picked geocodes it once as a courtesy.
 */
export function AddressAutocomplete({ value, onChange, onSelect, hasCoords, disabled, id }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (address: string, lat: string, lng: string) => void;
  /** Whether lat/lng are already set (skips auto-geocode on blur) */
  hasCoords: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useTranslation('admin');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const selectedRef = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const geocode = useCallback(async (query: string): Promise<NominatimResult | null> => {
    try {
      const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'es,en' } });
      if (res.ok) {
        const data: NominatimResult[] = await res.json();
        return data[0] ?? null;
      }
    } catch { /* silent */ }
    return null;
  }, []);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) { setSuggestions([]); setIsOpen(false); return; }
    selectedRef.current = false;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, format: 'json', addressdetails: '1', limit: '5' });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'es,en' } });
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setSuggestions(data);
          setIsOpen(data.length > 0);
        }
      } catch {
        /* fail silently — the user can still type manually */
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleBlur = useCallback(async () => {
    if (selectedRef.current || hasCoords || !value || value.trim().length < 5) return;
    const result = await geocode(value);
    if (result) onSelect(value, parseFloat(result.lat).toFixed(6), parseFloat(result.lon).toFixed(6));
  }, [value, hasCoords, geocode, onSelect]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={e => { onChange(e.target.value); search(e.target.value); }}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          onBlur={handleBlur}
          placeholder={t('projectForm.addressPlaceholder')}
          maxLength={300}
          disabled={disabled}
          className={cn(INPUT, 'pr-9 text-[13.5px]')}
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#8A8175]" />}
        {!loading && value && !disabled && (
          <button type="button" onClick={() => { onChange(''); setSuggestions([]); setIsOpen(false); }} aria-label={t('projectForm.clearClient')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8175] hover:text-[#0A0A0A]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-[#DBD0BB] border-t-0 shadow-[0_12px_28px_-18px_rgba(23,19,15,0.4)] max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              type="button"
              onClick={() => {
                selectedRef.current = true;
                onSelect(s.display_name, parseFloat(s.lat).toFixed(6), parseFloat(s.lon).toFixed(6));
                setIsOpen(false);
                setSuggestions([]);
              }}
              className={cn('w-full text-left flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-[#F3EEE4]', i < suggestions.length - 1 && 'border-b border-[#F0EBE1]')}
            >
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#F97316]" strokeWidth={2} />
              <span className="text-[12.5px] leading-[1.4] text-[#0A0A0A]">{s.display_name}</span>
            </button>
          ))}
          <div className="font-bt-mono text-[9px] uppercase tracking-[0.1em] text-[#B4A992] px-3 py-[7px] border-t border-[#F0EBE1] bg-[#FBF8F2]">
            {t('projectForm.poweredByOSM')}
          </div>
        </div>
      )}
    </div>
  );
}
