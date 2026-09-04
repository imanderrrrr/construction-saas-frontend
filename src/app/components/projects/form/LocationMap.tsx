import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinOff } from 'lucide-react';
import { cn } from '../../ui/utils';
import { FOCUS_RING } from '../../onboarding/chrome';
import { Mono } from '../bt';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Leaflet map of the project window (tiles from OpenStreetMap, library loaded
 * on demand from the CDN). Draws the square orange pin and the geofence
 * circle; click or drag sets the coordinates. Square zoom buttons replace
 * Leaflet's rounded control so the map speaks the panel's language.
 */
export function LocationMap({ lat, lng, radius, onLocationChange, className, readOnly = false, stamp: stampOverride, zoom: initialZoom = 14 }: {
  lat: string; lng: string; radius: number;
  onLocationChange?: (lat: string, lng: string) => void;
  className?: string;
  /** The ficha's map: pin fixed, no click-to-move; the stamp says so. */
  readOnly?: boolean;
  /** Replaces the `lat · lng · geocerca` stamp at the bottom-left. */
  stamp?: string;
  zoom?: number;
}) {
  const { t } = useTranslation('admin');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [leafletError, setLeafletError] = useState(false);

  // Load Leaflet CSS + JS once.
  useEffect(() => {
    if ((window as any).L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    script.onerror = () => setLeafletError(true);
    document.head.appendChild(script);
  }, []);

  // Initialise the map once the library is there.
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    const defaultLat = lat ? parseFloat(lat) : 20.674;
    const defaultLng = lng ? parseFloat(lng) : -103.338;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([defaultLat, defaultLng], initialZoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    const icon = L.divIcon({ className: 'bt-map-pin', iconSize: [18, 18], iconAnchor: [9, 9] });
    const marker = L.marker([defaultLat, defaultLng], { draggable: !readOnly, icon }).addTo(map);
    const circle = L.circle([defaultLat, defaultLng], { radius, color: '#F97316', weight: 2, fillColor: '#F97316', fillOpacity: 0.14 }).addTo(map);

    if (!readOnly) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
        onLocationChange?.(pos.lat.toFixed(6), pos.lng.toFixed(6));
      });
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        onLocationChange?.(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
      });
    }

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;
    setTimeout(() => map.invalidateSize(), 300);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletLoaded]);

  // Follow the typed coordinates.
  useEffect(() => {
    if (!markerRef.current || !circleRef.current || !mapInstanceRef.current) return;
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN) || latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - latN) > 0.000001 || Math.abs(current.lng - lngN) > 0.000001) {
      markerRef.current.setLatLng([latN, lngN]);
      circleRef.current.setLatLng([latN, lngN]);
      mapInstanceRef.current.setView([latN, lngN], mapInstanceRef.current.getZoom());
    }
  }, [lat, lng]);

  useEffect(() => { if (circleRef.current) circleRef.current.setRadius(radius); }, [radius]);

  if (leafletError) {
    return (
      <div className={cn('bg-[#FAF7F0] border border-[#DBD0BB] flex flex-col items-center justify-center gap-3 text-center px-6 py-8', className)}>
        <span className="w-9 h-9 bg-[#0A0A0A] flex items-center justify-center"><MapPinOff className="w-[18px] h-[18px] text-[#F97316]" strokeWidth={1.9} /></span>
        <div className="font-bt-display font-extrabold uppercase text-[26px] leading-none text-[#0A0A0A]">{t('projectForm.mapUnavailableTitle')}</div>
        <p className="text-[13px] text-[#5A5346] leading-[1.5] max-w-[300px]">{t('projectForm.mapUnavailableHint')}</p>
      </div>
    );
  }

  const zoom = (delta: number) => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + delta);
  const stamp = lat && lng ? `${lat} · ${lng} · ` : '';

  return (
    <div className={cn('relative border border-[#CDBFA6] bg-[#EDE5D6] overflow-hidden', className)}>
      <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 0 }} />
      <Mono className="absolute left-3 top-3 z-[1] text-[9px] tracking-[0.12em] text-[#5A5346] bg-[#FAF7F0] border border-[#DBD0BB] px-2 py-[5px]">{t('projectForm.mapTag')}</Mono>
      <div className="absolute right-3 top-3 z-[1] flex flex-col">
        <button type="button" onClick={() => zoom(1)} aria-label="+" className={cn('w-7 h-7 border border-[#DBD0BB] bg-[#FAF7F0] font-bt-mono text-[14px] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}>+</button>
        <button type="button" onClick={() => zoom(-1)} aria-label="−" className={cn('w-7 h-7 border border-t-0 border-[#DBD0BB] bg-[#FAF7F0] font-bt-mono text-[14px] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C]', FOCUS_RING)}>−</button>
      </div>
      <Mono className="absolute left-3 bottom-3 z-[1] text-[9px] tracking-[0.08em] text-[#5A5346] bg-[#FAF7F0] border border-[#DBD0BB] px-2 py-[5px] max-w-[calc(100%-24px)] truncate">
        {stampOverride ?? <>{stamp}{t('projectForm.geofenceStamp', { meters: radius.toLocaleString('en-US') })}</>}
      </Mono>
    </div>
  );
}
