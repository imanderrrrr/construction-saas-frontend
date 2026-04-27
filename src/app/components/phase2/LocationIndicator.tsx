import { MapPin, AlertTriangle, WifiOff, ShieldAlert, Loader2, Navigation, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LocationStatus } from '../../types';

/** Extended status that includes pre-prompt and detecting states. */
type DisplayStatus = LocationStatus | 'detecting' | 'AWAITING_PERMISSION';

interface LocationIndicatorProps {
  status: DisplayStatus;
  coords?: { lat: number; lng: number };
  onRequestPermission?: () => void;
}

const STYLE_CONFIG: Record<DisplayStatus, {
  bg: string; border: string;
  icon: typeof MapPin; iconColor: string; iconBg: string;
  spinning: boolean;
  titleKey: string;
  subtitleKey: string | null;
  ctaKey: string | null;
}> = {
  AWAITING_PERMISSION: {
    bg: 'bg-blue-50', border: 'border-blue-200',
    icon: Navigation, iconColor: 'text-blue-600', iconBg: 'bg-blue-100',
    spinning: false,
    titleKey: 'location.awaitingPermission',
    subtitleKey: 'location.awaitingPermissionHint',
    ctaKey: 'location.grantAccess',
  },
  detecting: {
    bg: 'bg-[#FAFAFA]', border: 'border-[#D4D4D8]',
    icon: Loader2, iconColor: 'text-[#71717A]', iconBg: 'bg-[#D4D4D8]/30',
    spinning: true,
    titleKey: 'location.detecting',
    subtitleKey: 'location.detectingHint',
    ctaKey: null,
  },
  OK: {
    bg: 'bg-emerald-50', border: 'border-emerald-200',
    icon: MapPin, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-100',
    spinning: false,
    titleKey: 'location.detected',
    subtitleKey: null,
    ctaKey: null,
  },
  NO_PERMISSION: {
    bg: 'bg-amber-50', border: 'border-amber-200',
    icon: ShieldAlert, iconColor: 'text-amber-600', iconBg: 'bg-amber-100',
    spinning: false,
    titleKey: 'location.denied',
    subtitleKey: 'location.deniedHintManual',
    ctaKey: 'location.reloadPage',
  },
  UNAVAILABLE: {
    bg: 'bg-[#FAFAFA]', border: 'border-[#D4D4D8]',
    icon: WifiOff, iconColor: 'text-[#71717A]', iconBg: 'bg-[#D4D4D8]/30',
    spinning: false,
    titleKey: 'location.unavailable',
    subtitleKey: 'location.unavailableHint',
    ctaKey: null,
  },
  OUT_OF_RANGE: {
    bg: 'bg-red-50', border: 'border-red-200',
    icon: AlertTriangle, iconColor: 'text-red-600', iconBg: 'bg-red-100',
    spinning: false,
    titleKey: 'location.outsideArea',
    subtitleKey: 'location.outsideAreaHint',
    ctaKey: null,
  },
  NO_GEOFENCE: {
    bg: 'bg-[#FAFAFA]', border: 'border-[#D4D4D8]',
    icon: MapPin, iconColor: 'text-[#71717A]', iconBg: 'bg-[#D4D4D8]/30',
    spinning: false,
    titleKey: 'location.noGeofence',
    subtitleKey: 'location.noGeofenceHint',
    ctaKey: null,
  },
};

/** Format a coordinate pair, using N/S and E/W correctly. */
function fmtCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

export function LocationIndicator({ status, coords, onRequestPermission }: LocationIndicatorProps) {
  const { t } = useTranslation('time');
  const c = STYLE_CONFIG[status];
  const IconComp = c.icon;

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${c.bg} ${c.border}`}>
      <div className={`w-8 h-8 ${c.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <IconComp className={`w-4 h-4 ${c.iconColor} ${c.spinning ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${c.iconColor}`}>{t(c.titleKey)}</p>
        {status === 'OK' && coords ? (
          <p className="text-xs text-emerald-600 mt-0.5 font-mono">
            {fmtCoords(coords.lat, coords.lng)}
          </p>
        ) : c.subtitleKey ? (
          <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed">{t(c.subtitleKey)}</p>
        ) : null}
        {c.ctaKey && status === 'NO_PERMISSION' && (
          <button onClick={() => window.location.reload()}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            <RefreshCw className="w-3 h-3" />{t(c.ctaKey)}
          </button>
        )}
        {c.ctaKey && status === 'AWAITING_PERMISSION' && onRequestPermission && (
          <button onClick={onRequestPermission}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Navigation className="w-3 h-3" />{t(c.ctaKey)}
          </button>
        )}
      </div>
    </div>
  );
}
