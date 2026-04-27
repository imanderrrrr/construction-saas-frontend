import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { AuthService } from '../services/auth';

const TIMEZONES = [
  // US Time Zones
  { value: 'America/New_York', label: 'Eastern (UTC-5)' },
  { value: 'America/Chicago', label: 'Central (UTC-6)' },
  { value: 'America/Denver', label: 'Mountain (UTC-7)' },
  { value: 'America/Phoenix', label: 'Arizona (UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Pacific (UTC-8)' },
  { value: 'America/Anchorage', label: 'Alaska (UTC-9)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (UTC-10)' },
  // Latin America
  { value: 'America/Panama', label: 'Panamá (UTC-5)' },
  { value: 'America/Mexico_City', label: 'México (UTC-6)' },
  { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
];

const STORAGE_KEY = 'ofjr_business_timezone';
const DEFAULT_TZ = 'America/Panama';

function shortLabel(tz: string): string {
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

export function TimezoneSwitcher() {
  const { t } = useTranslation('common');
  const [timezone, setTimezone] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_TZ,
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAdmin = AuthService.getCanonicalRole() === 'ADMIN';

  // Fetch the real value from the backend (and cache in localStorage)
  useEffect(() => {
    let cancelled = false;
    api<{ timezone: string }>('/api/v1/settings/timezone')
      .then(res => {
        if (!cancelled) {
          setTimezone(res.timezone);
          localStorage.setItem(STORAGE_KEY, res.timezone);
        }
      })
      .catch(() => {
        // keep whatever we had (localStorage or default)
      });
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (tz: string) => {
    setOpen(false);
    const prev = timezone;
    setTimezone(tz);
    localStorage.setItem(STORAGE_KEY, tz);
    try {
      await api('/api/v1/settings/timezone', {
        method: 'PUT',
        body: JSON.stringify({ timezone: tz }),
      });
    } catch {
      setTimezone(prev);
      localStorage.setItem(STORAGE_KEY, prev);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => isAdmin && setOpen(!open)}
        title={isAdmin ? t('timezone.change') : t('timezone.current', { tz: shortLabel(timezone) })}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#71717A] transition-colors hover:bg-[#FAFAFA] ${
          isAdmin ? 'cursor-pointer' : 'cursor-default opacity-80'
        }`}
      >
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{shortLabel(timezone)}</span>
      </button>

      {open && isAdmin && (
        <div className="absolute left-0 bottom-full mb-1 w-64 bg-white border border-[#D4D4D8] rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[#D4D4D8]">
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">
              {t('timezone.select')}
            </p>
          </div>
          {TIMEZONES.map(tz => (
            <button
              key={tz.value}
              onClick={() => handleSelect(tz.value)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FAFAFA] transition-colors ${
                tz.value === timezone ? 'bg-[#C2410C]/5 text-[#C2410C] font-semibold' : 'text-[#0A0A0A]'
              }`}
            >
              {tz.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
