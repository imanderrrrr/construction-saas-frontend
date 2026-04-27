import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Building2, MapPin, DollarSign, Shield, Loader2,
    AlertCircle, Search, ChevronDown, Plus, X,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { toast } from 'sonner';
import { listClients, type ClientResponse } from '../services/clients';
import { CreateClientDialog } from './CreateClientDialog';
import {
    createProject as apiCreateProject,
    updateProject as apiUpdateProject,
    type ProjectResponse,
    type CreateProjectPayload,
    type UpdateProjectPayload,
} from '../services/projects';
import { ApiError } from '../lib/api';

// TYPES

interface ProjectFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSaved: (project: ProjectResponse) => void;
    /** If provided, the dialog is in "edit" mode */
    editProject?: ProjectResponse | null;
}

interface FormState {
    name: string;
    clientId: number | null;
    costCode: string;
    contractAmount: string; // display string, e.g. "1500000.00"
    address: string;
    latitude: string;
    longitude: string;
    geofenceRadiusMeters: number;
}

const INITIAL_FORM: FormState = {
    name: '',
    clientId: null,
    costCode: '',
    contractAmount: '',
    address: '',
    latitude: '',
    longitude: '',
    geofenceRadiusMeters: 200,
};

const GEOFENCE_MIN = 50;
const GEOFENCE_MAX = 5000;

// HELPERS

function centsToDollars(cents: number | null | undefined): string {
    if (cents == null) return '';
    return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number | undefined {
    const cleaned = dollars.replace(/[^0-9.]/g, '');
    if (!cleaned) return undefined;
    const num = parseFloat(cleaned);
    if (isNaN(num) || num < 0) return undefined;
    return Math.round(num * 100);
}

function formatUSD(value: string): string {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isValidLat(v: string): boolean {
    if (!v) return true;
    const n = parseFloat(v);
    return !isNaN(n) && n >= -90 && n <= 90;
}

function isValidLng(v: string): boolean {
    if (!v) return true;
    const n = parseFloat(v);
    return !isNaN(n) && n >= -180 && n <= 180;
}

function apiErrorMsg(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'An unexpected error occurred';
}

// CLIENT SELECTOR

function ClientSelector({ value, onChange, disabled, onRequestCreateClient }: {
    value: number | null;
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
    const selectedClient = clients.find(c => c.id === value);

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

    useEffect(() => {
        if (isOpen) fetchClients(search);
    }, [isOpen, search, fetchClients]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-10 px-3 flex items-center justify-between rounded-md border text-sm
          ${disabled ? 'opacity-50 bg-[#FAFAFA] cursor-not-allowed' : 'bg-white hover:border-[#F97316]/40 cursor-pointer'}
          border-[#D4D4D8] text-[#0A0A0A]`}
            >
                <span className={selectedClient ? 'text-[#0A0A0A]' : 'text-[#71717A]'}>
                    {selectedClient ? selectedClient.name : t('projectForm.selectClient')}
                </span>
                <ChevronDown className="w-4 h-4 text-[#71717A]" />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D8] rounded-lg shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-[#F0F2F5]">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#71717A]" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('projectForm.searchClients')}
                                className="w-full h-8 pl-8 pr-3 text-sm bg-[#FAFAFA] border border-[#D4D4D8] rounded-md
                  focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/30"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-36 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
                            </div>
                        ) : clients.length === 0 ? (
                            <div className="py-4 text-center">
                                <p className="text-sm text-[#71717A]">{t('projectForm.noClients')}</p>
                            </div>
                        ) : (
                            clients.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { onChange(c.id, c.name); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[#FAFAFA] transition-colors
                    ${c.id === value ? 'bg-[#F97316]/5 text-[#F97316] font-medium' : 'text-[#0A0A0A]'}`}
                                >
                                    {c.name}
                                </button>
                            ))
                        )}
                    </div>
                    <div className="border-t border-[#F0F2F5] p-1.5 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => { onRequestCreateClient(); setIsOpen(false); }}
                            className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-[#F97316] hover:bg-[#F97316]/5 rounded-md transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />{t('projectForm.createClient')}
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={() => { onChange(null, ''); setIsOpen(false); }}
                                className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                            >
                                {t('projectForm.clearClient')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ADDRESS AUTOCOMPLETE (Nominatim / OpenStreetMap)

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

function AddressAutocomplete({ value, onChange, onSelect, hasCoords, disabled }: {
    value: string;
    onChange: (v: string) => void;
    onSelect: (address: string, lat: string, lng: string) => void;
    /** Whether lat/lng are already set (skips auto-geocode on blur) */
    hasCoords: boolean;
    disabled?: boolean;
}) {
    const { t } = useTranslation('admin');
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    /** Tracks whether the user selected a suggestion (skip auto-geocode on blur) */
    const selectedRef = useRef(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const geocode = useCallback(async (query: string): Promise<NominatimResult | null> => {
        try {
            const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
            const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                headers: { 'Accept-Language': 'es,en' },
            });
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
                const params = new URLSearchParams({
                    q: query,
                    format: 'json',
                    addressdetails: '1',
                    limit: '5',
                });
                const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
                    headers: { 'Accept-Language': 'es,en' },
                });
                if (res.ok) {
                    const data: NominatimResult[] = await res.json();
                    setSuggestions(data);
                    setIsOpen(data.length > 0);
                }
            } catch {
                /* fail silently — user can still type manually */
            } finally {
                setLoading(false);
            }
        }, 400);
    }, []);

    // Auto-geocode on blur if user typed an address but didn't select a suggestion
    const handleBlur = useCallback(async () => {
        if (selectedRef.current || hasCoords || !value || value.trim().length < 5) return;
        const result = await geocode(value);
        if (result) {
            onSelect(value, parseFloat(result.lat).toFixed(6), parseFloat(result.lon).toFixed(6));
        }
    }, [value, hasCoords, geocode, onSelect]);

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Input
                    value={value}
                    onChange={e => { onChange(e.target.value); search(e.target.value); }}
                    onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
                    onBlur={handleBlur}
                    placeholder={t('projectForm.addressPlaceholder')}
                    maxLength={500}
                    className="h-10 border-[#D4D4D8] pr-8"
                    disabled={disabled}
                />
                {loading && <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-[#71717A]" />}
                {!loading && value && (
                    <button
                        type="button"
                        onClick={() => { onChange(''); setSuggestions([]); setIsOpen(false); }}
                        className="absolute right-2.5 top-2.5 text-[#71717A] hover:text-[#0A0A0A]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#D4D4D8] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map(s => (
                        <button
                            key={s.place_id}
                            type="button"
                            onClick={() => {
                                selectedRef.current = true;
                                onSelect(s.display_name, parseFloat(s.lat).toFixed(6), parseFloat(s.lon).toFixed(6));
                                setIsOpen(false);
                                setSuggestions([]);
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#FAFAFA] transition-colors border-b border-[#F0F2F5] last:border-b-0"
                        >
                            <div className="flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-[#F97316] mt-0.5 flex-shrink-0" />
                                <span className="text-[#0A0A0A] leading-snug">{s.display_name}</span>
                            </div>
                        </button>
                    ))}
                    <div className="px-3 py-1.5 text-[9px] text-[#71717A] bg-[#FAFAFA] border-t border-[#F0F2F5]">
                        {t('projectForm.poweredByOSM')}
                    </div>
                </div>
            )}
        </div>
    );
}

// MAP COMPONENT (Leaflet)

function LocationMap({ lat, lng, radius, onLocationChange }: {
    lat: string; lng: string; radius: number;
    onLocationChange: (lat: string, lng: string) => void;
}) {
    const { t } = useTranslation('admin');
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const circleRef = useRef<any>(null);
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [leafletError, setLeafletError] = useState(false);

    // Dynamically load Leaflet CSS and JS
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

        return () => {
            // Keep loaded for future use
        };
    }, []);

    // Initialize map
    useEffect(() => {
        if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
        const L = (window as any).L;

        const defaultLat = lat ? parseFloat(lat) : 20.674;
        const defaultLng = lng ? parseFloat(lng) : -103.338;

        const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        const marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);
        const circle = L.circle([defaultLat, defaultLng], { radius, color: '#F97316', fillOpacity: 0.1 }).addTo(map);

        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            circle.setLatLng(pos);
            onLocationChange(pos.lat.toFixed(6), pos.lng.toFixed(6));
        });

        map.on('click', (e: any) => {
            marker.setLatLng(e.latlng);
            circle.setLatLng(e.latlng);
            onLocationChange(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;

        // Fix tile rendering after dialog animation
        setTimeout(() => map.invalidateSize(), 300);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
            circleRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leafletLoaded]);

    // Sync marker/circle when lat/lng change externally (manual input)
    useEffect(() => {
        if (!markerRef.current || !circleRef.current || !mapInstanceRef.current) return;
        const latN = parseFloat(lat);
        const lngN = parseFloat(lng);
        if (isNaN(latN) || isNaN(lngN)) return;
        if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return;

        const currentPos = markerRef.current.getLatLng();
        if (Math.abs(currentPos.lat - latN) > 0.000001 || Math.abs(currentPos.lng - lngN) > 0.000001) {
            markerRef.current.setLatLng([latN, lngN]);
            circleRef.current.setLatLng([latN, lngN]);
            mapInstanceRef.current.setView([latN, lngN], mapInstanceRef.current.getZoom());
        }
    }, [lat, lng]);

    // Sync circle radius
    useEffect(() => {
        if (circleRef.current) circleRef.current.setRadius(radius);
    }, [radius]);

    if (leafletError) {
        return (
            <div className="w-full h-48 bg-[#FAFAFA] rounded-lg flex items-center justify-center text-sm text-[#71717A]">
                {t('projectForm.mapUnavailable')}
            </div>
        );
    }

    return (
        <div
            ref={mapRef}
            className="w-full h-48 rounded-lg border border-[#D4D4D8] overflow-hidden"
            style={{ zIndex: 0 }}
        />
    );
}

// GEOFENCE SLIDER

function GeofenceSlider({ value, onChange, disabled }: {
    value: number; onChange: (v: number) => void; disabled?: boolean;
}) {
    const percentage = ((value - GEOFENCE_MIN) / (GEOFENCE_MAX - GEOFENCE_MIN)) * 100;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={GEOFENCE_MIN}
                    max={GEOFENCE_MAX}
                    step={10}
                    value={value}
                    onChange={e => onChange(parseInt(e.target.value))}
                    disabled={disabled}
                    className="flex-1 h-2 bg-[#E5E7EB] rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:bg-[#F97316] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md"
                    style={{
                        background: `linear-gradient(to right, #F97316 0%, #F97316 ${percentage}%, #E5E7EB ${percentage}%, #E5E7EB 100%)`,
                    }}
                />
                <div className="flex items-center gap-1">
                    <Input
                        type="number"
                        min={GEOFENCE_MIN}
                        max={GEOFENCE_MAX}
                        value={value}
                        onChange={e => {
                            const v = parseInt(e.target.value);
                            if (!isNaN(v)) onChange(Math.max(GEOFENCE_MIN, Math.min(GEOFENCE_MAX, v)));
                        }}
                        disabled={disabled}
                        className="w-20 h-8 text-sm text-center border-[#D4D4D8]"
                    />
                    <span className="text-xs text-[#71717A]">m</span>
                </div>
            </div>
            <div className="flex justify-between text-[10px] text-[#71717A]">
                <span>50m</span>
                <span>5,000m</span>
            </div>
        </div>
    );
}

// SECTION HEADER

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2 pb-2 border-b border-[#F0F2F5]">
            <div className="w-7 h-7 rounded-md bg-[#F97316]/10 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-[#F97316]" />
            </div>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
        </div>
    );
}

// MAIN DIALOG

export function ProjectFormDialog({ open, onClose, onSaved, editProject }: ProjectFormDialogProps) {
    const { t } = useTranslation(['admin', 'common']);
    const isEdit = !!editProject;
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [clientName, setClientName] = useState('');
    const [nameError, setNameError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [clientCreateOpen, setClientCreateOpen] = useState(false);

    // Populate form when editing
    useEffect(() => {
        if (editProject && open) {
            setForm({
                name: editProject.name,
                clientId: editProject.clientId ?? null,
                costCode: editProject.costCode ?? '',
                contractAmount: centsToDollars(editProject.originalContractCents ?? editProject.contractAmountCents),
                address: editProject.address ?? '',
                latitude: editProject.latitude != null ? String(editProject.latitude) : '',
                longitude: editProject.longitude != null ? String(editProject.longitude) : '',
                geofenceRadiusMeters: editProject.geofenceRadiusMeters ?? 200,
            });
            setClientName(editProject.client?.name ?? '');
        } else if (open) {
            setForm(INITIAL_FORM);
            setClientName('');
        }
        setNameError('');
    }, [editProject, open]);

    const handleClose = () => {
        setForm(INITIAL_FORM);
        setClientName('');
        setNameError('');
        setIsLoading(false);
        onClose();
    };

    const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (key === 'name') setNameError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setNameError(t('admin:projectForm.projectNameRequired')); return; }
        if (!isEdit && !dollarsToCents(form.contractAmount)) { toast.error(t('admin:projectForm.contractAmountRequired')); return; }
        if (!isValidLat(form.latitude)) { toast.error(t('admin:projectForm.invalidLat')); return; }
        if (!isValidLng(form.longitude)) { toast.error(t('admin:projectForm.invalidLng')); return; }

        setIsLoading(true);
        try {
            const cents = dollarsToCents(form.contractAmount);

            if (isEdit && editProject) {
                const payload: UpdateProjectPayload = {};
                if (form.name.trim() !== editProject.name) payload.name = form.name.trim();
                if (form.clientId !== editProject.clientId) payload.clientId = form.clientId ?? undefined;
                if (form.costCode !== (editProject.costCode ?? '')) payload.costCode = form.costCode || undefined;
                if (cents !== (editProject.originalContractCents ?? editProject.contractAmountCents)) payload.contractAmountCents = cents;
                if (form.address !== (editProject.address ?? '')) payload.address = form.address || undefined;
                if (form.latitude && parseFloat(form.latitude) !== editProject.latitude) payload.latitude = parseFloat(form.latitude);
                if (form.longitude && parseFloat(form.longitude) !== editProject.longitude) payload.longitude = parseFloat(form.longitude);
                if (form.geofenceRadiusMeters !== editProject.geofenceRadiusMeters) payload.geofenceRadiusMeters = form.geofenceRadiusMeters;

                const updated = await apiUpdateProject(editProject.id, payload);
                onSaved(updated);
                toast.success(t('admin:projectForm.projectUpdated'), { description: t('admin:projectForm.projectUpdatedDesc', { name: updated.name }) });
            } else {
                const payload: CreateProjectPayload = {
                    name: form.name.trim(),
                    ...(form.clientId && { clientId: form.clientId }),
                    ...(form.costCode && { costCode: form.costCode }),
                    ...(cents != null && { contractAmountCents: cents }),
                    ...(form.address && { address: form.address }),
                    ...(form.latitude && { latitude: parseFloat(form.latitude) }),
                    ...(form.longitude && { longitude: parseFloat(form.longitude) }),
                    ...(form.geofenceRadiusMeters !== 200 && { geofenceRadiusMeters: form.geofenceRadiusMeters }),
                };
                const created = await apiCreateProject(payload);
                onSaved(created);
                toast.success(t('admin:projectForm.projectCreated'), { description: t('admin:projectForm.projectCreatedDesc', { name: created.name }) });
            }
            handleClose();
        } catch (err) {
            const msg = apiErrorMsg(err);
            if (err instanceof ApiError && err.status === 409) {
                toast.error(t('admin:projectForm.conflict'), { description: msg });
            } else if (err instanceof ApiError && err.status === 403) {
                toast.error(t('admin:projectForm.noPermission'), { description: msg });
            } else {
                toast.error(isEdit ? t('admin:projectForm.errorUpdating') : t('admin:projectForm.errorCreating'), { description: msg });
            }
            setIsLoading(false);
        }
    };

    return (
    <>
        <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
            <DialogContent
                className="sm:max-w-2xl bg-white max-h-[90vh] overflow-y-auto"
                onPointerDownOutside={e => e.preventDefault()}
                onInteractOutside={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-[#0A0A0A]">
                        {isEdit ? t('admin:projectForm.editTitle') : t('admin:projectForm.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('admin:projectForm.editDescription', { name: editProject?.name })
                            : t('admin:projectForm.createDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Section 1: Basic Info */}
                    <div className="space-y-4">
                        <SectionHeader icon={Building2} title={t('admin:projectForm.basicInfo')} />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-[#0A0A0A]">
                                    {t('admin:projectForm.projectName')} <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={form.name}
                                    onChange={e => updateField('name', e.target.value)}
                                    placeholder={t('admin:projectForm.projectNamePlaceholder')}
                                    className={`h-10 ${nameError ? 'border-red-400' : 'border-[#D4D4D8]'}`}
                                    disabled={isLoading}
                                />
                                {nameError && (
                                    <p className="flex items-center gap-1 text-xs text-red-600">
                                        <AlertCircle className="w-3 h-3" />{nameError}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectForm.costCode')}</Label>
                                <Input
                                    value={form.costCode}
                                    onChange={e => updateField('costCode', e.target.value.toUpperCase())}
                                    placeholder={t('admin:projectForm.costCodePlaceholder')}
                                    maxLength={30}
                                    className="h-10 border-[#D4D4D8] font-mono uppercase"
                                    disabled={isLoading}
                                />
                                <p className="text-[10px] text-[#71717A]">{t('admin:projectForm.costCodeHint')}</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectForm.client')}</Label>
                            <ClientSelector
                                value={form.clientId}
                                onChange={(id, name) => { updateField('clientId', id); setClientName(name); }}
                                disabled={isLoading}
                                onRequestCreateClient={() => setClientCreateOpen(true)}
                            />
                            {clientName && (
                                <p className="text-xs text-[#71717A]">{t('admin:projectForm.selectedClient', { name: clientName })}</p>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Contract */}
                    <div className="space-y-4">
                        <SectionHeader icon={DollarSign} title={t('admin:projectForm.contract')} />

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectForm.contractAmount')} {!isEdit && <span className="text-red-500">*</span>}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-sm text-[#71717A] font-medium">$</span>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={form.contractAmount}
                                    onChange={e => updateField('contractAmount', e.target.value.replace(/[^0-9.]/g, ''))}
                                    onBlur={() => {
                                        if (form.contractAmount) updateField('contractAmount', formatUSD(form.contractAmount));
                                    }}
                                    placeholder="0.00"
                                    className="h-10 pl-7 border-[#D4D4D8] font-mono"
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-[10px] text-[#71717A]">{t('admin:projectForm.contractHint')}</p>
                        </div>
                    </div>

                    {/* Section 3: Location */}
                    <div className="space-y-4">
                        <SectionHeader icon={MapPin} title={t('admin:projectForm.location')} />

                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium text-[#0A0A0A]">{t('admin:projectForm.address')}</Label>
                            <AddressAutocomplete
                                value={form.address}
                                onChange={v => updateField('address', v)}
                                onSelect={(address, lat, lng) => {
                                    setForm(prev => ({ ...prev, address, latitude: lat, longitude: lng }));
                                }}
                                hasCoords={!!(form.latitude && form.longitude)}
                                disabled={isLoading}
                            />
                            <p className="text-[10px] text-[#71717A]">{t('admin:projectForm.addressHint')}</p>
                        </div>

                        <LocationMap
                            lat={form.latitude}
                            lng={form.longitude}
                            radius={form.geofenceRadiusMeters}
                            onLocationChange={(lat, lng) => {
                                updateField('latitude', lat);
                                updateField('longitude', lng);
                            }}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-[#71717A]">{t('admin:projectForm.latitude')}</Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={form.latitude}
                                    onChange={e => updateField('latitude', e.target.value)}
                                    placeholder="20.674389"
                                    className={`h-9 text-sm font-mono border-[#D4D4D8] ${form.latitude && !isValidLat(form.latitude) ? 'border-red-400' : ''}`}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-[#71717A]">{t('admin:projectForm.longitude')}</Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={form.longitude}
                                    onChange={e => updateField('longitude', e.target.value)}
                                    placeholder="-103.338880"
                                    className={`h-9 text-sm font-mono border-[#D4D4D8] ${form.longitude && !isValidLng(form.longitude) ? 'border-red-400' : ''}`}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-[#71717A]">
                            {t('admin:projectForm.mapHint')}
                        </p>
                    </div>

                    {/* Section 4: Geofence */}
                    <div className="space-y-4">
                        <SectionHeader icon={Shield} title={t('admin:projectForm.geofence')} />
                        <GeofenceSlider
                            value={form.geofenceRadiusMeters}
                            onChange={v => updateField('geofenceRadiusMeters', v)}
                            disabled={isLoading}
                        />
                        <p className="text-[10px] text-[#71717A]">
                            {t('admin:projectForm.geofenceHint')}
                        </p>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="border-[#D4D4D8] text-[#0A0A0A]"
                        >
                            {t('common:buttons.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? t('admin:projectForm.saving') : t('admin:projectForm.creating')}</>
                            ) : (
                                isEdit ? t('admin:projectForm.saveChanges') : t('admin:projectForm.createProject')
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <CreateClientDialog
            open={clientCreateOpen}
            onClose={() => setClientCreateOpen(false)}
            onCreated={(client) => {
                updateField('clientId', client.id);
                setClientName(client.name);
                setClientCreateOpen(false);
            }}
        />
    </>
    );
}
