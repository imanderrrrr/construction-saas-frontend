import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Calendar, ChevronDown, AlertCircle, CheckCircle,
  RefreshCw, Loader2, Clock, MapPin, AlertTriangle, Car, X,
} from 'lucide-react';
import { getStoredRole } from '../lib/api';
import { Button } from './ui/button';
import { TimePunchButton, PunchState } from './phase2/TimePunchButton';
import { LocationIndicator } from './phase2/LocationIndicator';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import {
  TimeEventType, TIME_EVENT_SEQUENCE, LocationStatus, WorkerProject,
  type WorkerState,
} from '../types';
import { isProjectClosed } from '../helpers/project-utils';
import { ClosedProjectBanner } from './ClosedProjectBanner';
import {
  getMyProjects, createTimeEvent, getMyRecords, haversineMeters,
  getWorkerState, cancelTransit, disputeTransit,
  type TimeEventResponse, type TimeRecordResponse,
} from '../services/time';

// --- Types ---------------------------------------------------------------

type ActionState = 'idle' | 'confirming' | 'submitting' | 'success' | 'error';

/** Extended status includes 'detecting' (loading) and 'AWAITING_PERMISSION' (needs user gesture). */
type GeoDisplayStatus = LocationStatus | 'detecting' | 'AWAITING_PERMISSION';

interface GeoState {
  status: GeoDisplayStatus;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  hasPermission: boolean;
  /** true once the browser has been explicitly asked via a user gesture */
  permissionRequested: boolean;
}

// --- Punch type config ---------------------------------------------------

const PUNCH_CONFIRM_KEYS: Record<string, { title: string; desc: string }> = {
  CHECK_IN:    { title: 'punch.confirmCheckIn',    desc: 'punch.aboutToCheckIn'    },
  LUNCH_START: { title: 'punch.confirmStartLunch',  desc: 'punch.aboutToStartLunch' },
  LUNCH_END:   { title: 'punch.confirmEndLunch',    desc: 'punch.aboutToEndLunch'   },
  CHECK_OUT:   { title: 'punch.confirmCheckOut',     desc: 'punch.aboutToCheckOut'   },
  IN_TRANSIT:  { title: 'punch.confirmInTransit',    desc: 'punch.transitPromptDesc' },
};

// --- Helpers -------------------------------------------------------------

function fmtDate(date: Date | string, lng = 'es') {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = lng === 'es' ? 'es-GT' : 'en-US';
  return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso: string, lng = 'es') {
  const locale = lng === 'es' ? 'es-GT' : 'en-US';
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function todayYMD() {
  const d = new Date();
  // Use local date (not UTC) to match the backend's business-timezone work date.
  // toISOString() returns UTC which can be a day ahead after ~7 PM local time.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --- Main Component ------------------------------------------------------

export function WorkerTime({ username }: { username: string }) {
  const { t, i18n } = useTranslation('time');
  // -- Projects & selection
  const [projects, setProjects]             = useState<WorkerProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<WorkerProject | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // -- Day state (derived from today's record)
  const [todayRecord, setTodayRecord] = useState<TimeRecordResponse | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  // -- Geolocation
  const [geo, setGeo] = useState<GeoState>({
    status: 'detecting', lat: null, lng: null, distanceMeters: null, hasPermission: false, permissionRequested: false,
  });
  const watchIdRef = useRef<number | null>(null);
  const leftGeofenceAlertShown = useRef(false);

  // -- Punch action
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [pendingType, setPendingType] = useState<TimeEventType | null>(null);
  const [lastSuccessType, setLastSuccessType] = useState<TimeEventType | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  // -- Auto check-in flag
  const autoCheckedIn = useRef(false);

  // -- Worker state
  const [workerState, setWorkerState] = useState<WorkerState>('OFF_DUTY');

  // -- Transit
  const [showTransitPrompt, setShowTransitPrompt] = useState(false);
  const [transitDestination, setTransitDestination] = useState<WorkerProject | null>(null);
  const [transitSubmitting, setTransitSubmitting] = useState(false);
  const [cancellingTransit, setCancellingTransit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCustomReason, setCancelCustomReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // === Derived state ====================================================
  const recorded: Partial<Record<TimeEventType, string>> = {};
  // Lookup of reviewed events (status != PENDING) keyed by event type
  const eventReviews: Partial<Record<TimeEventType, {
    status: 'APPROVED' | 'OBSERVED' | 'REJECTED';
    comment: string | null;
    reviewer: string | null;
  }>> = {};
  if (todayRecord) {
    for (const ev of todayRecord.events) {
      recorded[ev.type] = ev.capturedAtClient;
      if (ev.eventApprovalStatus !== 'PENDING') {
        eventReviews[ev.type] = {
          status: ev.eventApprovalStatus,
          comment: ev.eventReviewComment,
          reviewer: ev.eventReviewerUsername,
        };
      }
    }
  }
  const isDayComplete = !!recorded.CHECK_OUT;
  const projectClosed = selectedProject ? isProjectClosed(selectedProject) : false;

  // Location is mandatory — block punch actions when permission is denied or not yet granted.
  // Allow punching when we have a GPS fix OR when GPS is temporarily unavailable (flaky signal).
  const locationReady = geo.status === 'OK' || geo.status === 'OUT_OF_RANGE' || geo.status === 'NO_GEOFENCE' || geo.status === 'UNAVAILABLE';
  const locationBlocked = !locationReady && geo.status !== 'detecting';

  // Check for IN_TRANSIT event in today's record (destination project)
  const transitEvent = todayRecord?.events.find(e => e.type === 'IN_TRANSIT') ?? null;
  const hasTransitWithoutCheckIn = !!transitEvent && !recorded.CHECK_IN;

  const nextType = projectClosed || isDayComplete
    ? null
    : (TIME_EVENT_SEQUENCE.find(t => !recorded[t]) ?? null);

  // === Fetch assigned projects on mount ==================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMyProjects();
        if (cancelled) return;
        setProjects(data);
        const active = data.filter(p => p.status === 'ACTIVE');
        if (active.length > 0) setSelectedProject(active[0]);
        else if (data.length > 0) setSelectedProject(data[0]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('time:toast.loadProjectsError', 'Failed to load projects'));
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // === Fetch today's record when project changes =========================
  // `silent` skips the loading spinner — used for background refreshes
  // after an optimistic update so the punch grid stays visible.
  // `preserveOptimistic` prevents overwriting todayRecord with null
  // when the server hasn't committed the new event yet.
  const fetchTodayRecord = useCallback(async (
    projectId: number,
    { preserveOptimistic = false, silent = false }: { preserveOptimistic?: boolean; silent?: boolean } = {},
  ): Promise<TimeRecordResponse | null> => {
    if (!silent) setLoadingRecord(true);
    try {
      const today = todayYMD();
      const records = await getMyRecords({ dateFrom: today, dateTo: today, projectId });
      const rec = records.find(r => r.workDate === today && r.projectId === projectId) ?? null;
      if (rec) {
        setTodayRecord(rec);
      } else if (!preserveOptimistic) {
        setTodayRecord(null);
      }
      // else: keep the optimistic record in place
      return rec;
    } catch (err) {
      if (!preserveOptimistic) {
        setTodayRecord(null);
      }
      return null;
    } finally {
      if (!silent) setLoadingRecord(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchTodayRecord(selectedProject.id);
      autoCheckedIn.current = false;
      leftGeofenceAlertShown.current = false;
    }
  }, [selectedProject, fetchTodayRecord]);

  // === Worker state polling ==============================================
  const fetchWorkerState = useCallback(async () => {
    try {
      const { state } = await getWorkerState();
      setWorkerState(state);
    } catch {
      // If endpoint not available, fall back to OFF_DUTY
    }
  }, []);

  // Poll worker state AND today's record every 30s so cross-device
  // punches (e.g. mobile ↔ web) are reflected without manual refresh.
  // Uses a ref flag to skip ticks when a previous poll is still in-flight,
  // preventing request pile-up on slow networks.
  const pollingRef = useRef(false);
  useEffect(() => {
    fetchWorkerState();
    const interval = setInterval(async () => {
      if (pollingRef.current) return; // skip if previous poll still running
      if (getStoredRole() !== 'WORKER') return; // guard: skip if role changed
      pollingRef.current = true;
      try {
        await fetchWorkerState();
        if (selectedProject) await fetchTodayRecord(selectedProject.id, { silent: true });
      } finally {
        pollingRef.current = false;
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchWorkerState, selectedProject, fetchTodayRecord]);

  // === Geolocation helpers ================================================

  /** Compute geo status from a position + the selected project. */
  const computeGeoFromPosition = useCallback((pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let distance: number | null = null;
    let status: LocationStatus;

    if (selectedProject?.latitude != null && selectedProject?.longitude != null) {
      distance = haversineMeters(lat, lng, selectedProject.latitude, selectedProject.longitude);
      status = distance <= selectedProject.geofenceRadiusMeters ? 'OK' : 'OUT_OF_RANGE';
    } else {
      status = 'NO_GEOFENCE';
    }

    setGeo({ status, lat, lng, distanceMeters: distance, hasPermission: true, permissionRequested: true });
  }, [selectedProject]);

  /** Start the watchPosition watcher. Call only after permission is granted. */
  const startWatcher = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setGeo(prev => ({ ...prev, status: 'detecting', permissionRequested: true }));

    const id = navigator.geolocation.watchPosition(
      (pos) => computeGeoFromPosition(pos),
      async (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Check actual permission state to distinguish:
          // - 'denied' (permanent, user checked "remember") → NO_PERMISSION
          // - 'prompt' (temporary denial, can re-ask) → AWAITING_PERMISSION
          let realState: PermissionState | null = null;
          try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            realState = perm.state;
          } catch { /* ignore */ }

          if (realState === 'prompt') {
            setGeo(prev => ({ ...prev, status: 'AWAITING_PERMISSION', hasPermission: false, permissionRequested: true }));
          } else {
            setGeo(prev => ({ ...prev, status: 'NO_PERMISSION', hasPermission: false, permissionRequested: true }));
          }
        } else {
          // TIMEOUT or POSITION_UNAVAILABLE — keep trying, don't give up
          setGeo(prev => ({ ...prev, status: 'UNAVAILABLE', permissionRequested: true }));
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
    );
    watchIdRef.current = id;
  }, [computeGeoFromPosition]);

  // === Geolocation watcher ===============================================
  // Uses Permissions API to detect state before calling watchPosition.
  // Safari/iOS requires a user gesture to show the permission prompt, so
  // if the state is 'prompt' we show an explicit button instead of calling
  // watchPosition from useEffect (which Safari silently ignores).
  useEffect(() => {
    // No geolocation support (e.g. HTTP context)
    if (!window.isSecureContext || !navigator.geolocation) {
      setGeo({ status: 'UNAVAILABLE', lat: null, lng: null, distanceMeters: null, hasPermission: false, permissionRequested: false });
      return;
    }

    let cancelled = false;
    let permStatusRef: PermissionStatus | null = null;
    let onPermChange: (() => void) | null = null;

    (async () => {
      // Check current permission state via Permissions API (supported in all modern browsers)
      let permState: PermissionState | null = null;
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        permState = result.state;
        permStatusRef = result;

        // Listen for changes (e.g. user grants permission from browser settings)
        onPermChange = () => {
          if (cancelled) return;
          if (result.state === 'granted') {
            startWatcher();
          } else if (result.state === 'denied') {
            setGeo(prev => ({ ...prev, status: 'NO_PERMISSION', hasPermission: false }));
          }
        };
        result.addEventListener('change', onPermChange);
      } catch {
        // Permissions API not supported (some older Safari) — fall through
      }

      if (cancelled) return;

      if (permState === 'granted') {
        // Already granted — start immediately (no user gesture needed)
        startWatcher();
      } else if (permState === 'denied') {
        // Permanently denied — show instructions
        setGeo(prev => ({ ...prev, status: 'NO_PERMISSION', hasPermission: false, permissionRequested: true }));
      } else {
        // 'prompt' or unknown — show a button so the user taps (user gesture)
        // This is critical for Safari/iOS which requires a gesture.
        setGeo(prev => ({ ...prev, status: 'AWAITING_PERMISSION', permissionRequested: false }));
      }
    })();

    return () => {
      cancelled = true;
      if (permStatusRef && onPermChange) {
        permStatusRef.removeEventListener('change', onPermChange);
      }
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [startWatcher]);

  // === Re-check permission when user returns to the tab ===================
  // (e.g. after changing location settings in the browser)
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      if (geo.status !== 'NO_PERMISSION' && geo.status !== 'AWAITING_PERMISSION') return;
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'granted') {
          startWatcher();
        }
      } catch { /* ignore */ }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [geo.status, startWatcher]);

  // === Auto check-in when inside geofence ================================
  useEffect(() => {
    if (
      geo.status === 'OK' &&
      !autoCheckedIn.current &&
      !loadingRecord &&
      selectedProject &&
      !projectClosed &&
      nextType === 'CHECK_IN' &&
      actionState === 'idle'
    ) {
      autoCheckedIn.current = true;
      setPendingType('CHECK_IN');
      setActionState('confirming');
    }
  }, [geo.status, selectedProject, projectClosed, nextType, actionState, loadingRecord]);

  // === Alert when worker leaves geofence (after check-in) ================
  useEffect(() => {
    if (
      geo.status === 'OUT_OF_RANGE' &&
      recorded.CHECK_IN &&
      !isDayComplete &&
      !leftGeofenceAlertShown.current
    ) {
      leftGeofenceAlertShown.current = true;
    }
    if (geo.status === 'OK') {
      leftGeofenceAlertShown.current = false;
    }
  }, [geo.status, recorded.CHECK_IN, isDayComplete]);

  // === Refresh project data periodically (pick up geofence changes) =====
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getMyProjects();
        setProjects(data);
        // Update selectedProject if its geofence data changed
        if (selectedProject) {
          const updated = data.find(p => p.id === selectedProject.id);
          if (updated && (
            updated.latitude !== selectedProject.latitude ||
            updated.longitude !== selectedProject.longitude ||
            updated.geofenceRadiusMeters !== selectedProject.geofenceRadiusMeters
          )) {
            setSelectedProject(updated);
          }
        }
      } catch { /* silent */ }
    }, 60_000); // every 60s
    return () => clearInterval(interval);
  }, [selectedProject]);

  // === Punch handlers ====================================================
  function handlePunchClick(type: TimeEventType) {
    if (locationBlocked) {
      toast.error(t('punch.locationRequired'));
      return;
    }
    setPendingType(type);
    setActionState('confirming');
  }

  /** Optimistically add an event to the local todayRecord so the UI updates
   *  immediately (button goes to "done", next one unlocks) even when
   *  fetchTodayRecord fails due to auth / network issues. */
  function optimisticAddEvent(
    type: TimeEventType,
    capturedAtClient: string,
    response: TimeEventResponse,
  ) {
    setTodayRecord(prev => {
      const newEvent = {
        id: response.eventId,
        type,
        capturedAtClient,
        capturedAtServer: response.serverCapturedAt,
        lat: geo.lat,
        lng: geo.lng,
        locationStatus: response.locationStatus,
        eventApprovalStatus: 'PENDING' as const,
        eventReviewComment: null,
        eventReviewerUsername: null,
        eventReviewedAt: null,
      };
      if (prev) {
        return { ...prev, events: [...prev.events, newEvent] };
      }
      // No record existed yet — create a minimal one
      return {
        id: response.recordId,
        workerId: 0,
        workerUsername: username,
        workerName: null,
        projectId: selectedProject!.id,
        projectName: selectedProject!.name,
        workDate: todayYMD(),
        approvalStatus: 'PENDING' as const,
        isLate: false,
        pendingEventCount: 1,
        events: [newEvent],
        reviews: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async function handleConfirm() {
    if (!pendingType || !selectedProject) return;
    const punchType = pendingType;
    const capturedAtClient = new Date().toISOString();
    setActionState('submitting');
    setErrorMsg(null);
    try {
      const response = await createTimeEvent({
        projectId: selectedProject.id,
        type: punchType,
        capturedAtClient,
        lat: geo.lat,
        lng: geo.lng,
        hasLocationPermission: geo.hasPermission,
      });
      // 1) Optimistic update — instant UI feedback
      optimisticAddEvent(punchType, capturedAtClient, response);
      setLastSuccessType(punchType);
      setActionState('success');
      // 2) Background refresh for full server data (non-blocking).
      //    silent: true   → don't show loading spinner (keeps punch grid visible)
      //    preserveOptimistic: true → if the server hasn't committed yet,
      //                               keep the optimistic todayRecord instead of wiping it.
      fetchTodayRecord(selectedProject.id, { preserveOptimistic: true, silent: true }).catch(() => {});
      setTimeout(() => {
        setActionState('idle');
        // After CHECK_OUT, offer transit to another project
        if (punchType === 'CHECK_OUT') {
          const otherActive = projects.filter(p => p.id !== selectedProject!.id && p.status === 'ACTIVE');
          if (otherActive.length > 0) {
            setTimeout(() => setShowTransitPrompt(true), 300);
          }
        }
      }, 2500);
    } catch (err: any) {
      // On 409 the event likely already exists on the server.
      // Try to refresh the record so the UI reflects the real state.
      if (selectedProject) {
        try { await fetchTodayRecord(selectedProject.id); } catch { /* ignore */ }
      }
      setErrorMsg(err?.message ?? 'Could not save punch');
      setActionState('error');
    }
    setPendingType(null);
  }

  function handleCancel() {
    setPendingType(null);
    setActionState('idle');
    setErrorMsg(null);
  }

  async function handleTransitConfirm() {
    if (!transitDestination || !selectedProject) return;
    setTransitSubmitting(true);
    setErrorMsg(null);
    try {
      await createTimeEvent({
        projectId: transitDestination.id,
        type: 'IN_TRANSIT',
        capturedAtClient: new Date().toISOString(),
        lat: geo.lat,
        lng: geo.lng,
        hasLocationPermission: geo.hasPermission,
        sourceProjectId: selectedProject.id,
      });
      setShowTransitPrompt(false);
      setTransitDestination(null);
      setWorkerState('IN_TRANSIT');
      // Auto-switch to destination project
      setSelectedProject(transitDestination);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not start transit');
    } finally {
      setTransitSubmitting(false);
    }
  }

  const effectiveCancelReason = cancelReason === 'OTHER' ? cancelCustomReason.trim() : cancelReason;

  async function handleCancelTransitConfirmed() {
    if (!effectiveCancelReason) return;
    setCancellingTransit(true);
    try {
      await cancelTransit(effectiveCancelReason);
      setWorkerState('OFF_DUTY');
      setShowCancelConfirm(false);
      setCancelReason('');
      setCancelCustomReason('');
      if (selectedProject) await fetchTodayRecord(selectedProject.id);
      fetchWorkerState();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not cancel transit');
    } finally {
      setCancellingTransit(false);
    }
  }

  async function handleDisputeTransit() {
    if (disputeReason.trim().length < 10) {
      setErrorMsg(t('punch.disputeReasonMinLength'));
      return;
    }
    setSubmittingDispute(true);
    try {
      await disputeTransit(disputeReason.trim());
      setShowDisputeForm(false);
      setDisputeReason('');
      setWorkerState('OFF_DUTY');
      if (selectedProject) await fetchTodayRecord(selectedProject.id);
      fetchWorkerState();
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not submit dispute');
    } finally {
      setSubmittingDispute(false);
    }
  }

  function getPunchState(type: TimeEventType): PunchState {
    if (recorded[type]) return 'done';
    if (actionState === 'submitting' && pendingType === type) return 'loading';
    if (type === nextType) return 'next';
    return 'upcoming';
  }

  // === Loading state =====================================================
  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
        <span className="text-sm text-[#71717A]">{t('punch.loadingProjects')}</span>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-3">
        <div className="w-14 h-14 bg-[#FAFAFA] rounded-2xl flex items-center justify-center mx-auto">
          <MapPin className="w-7 h-7 text-[#71717A]" />
        </div>
        <p className="text-base font-semibold text-[#0A0A0A]">{t('punch.selectProject')}</p>
        <p className="text-sm text-[#71717A] max-w-xs mx-auto">
          {t('punch.projectClosedDesc')}
        </p>
      </div>
    );
  }

  // === Render ============================================================
  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('punch.title')}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="w-3.5 h-3.5 text-[#71717A]" />
            <span className="text-sm text-[#71717A]">{fmtDate(new Date(), i18n.language)}</span>
          </div>
        </div>
        <span className="text-[11px] font-semibold font-mono px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full self-start">
          {t('punch.workerLabel')} &middot; {username}
        </span>
      </div>

      {/* Success banner */}
      {actionState === 'success' && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-900">{lastSuccessType ? t(`punch.success.${lastSuccessType}`) : t('punch.confirmCheckIn')}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{t('location.detected')}</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {actionState === 'error' && (
        <div className="flex items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900">{t('punch.outsideGeofence')}</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMsg || t('punch.locationDenied')}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleCancel}
            className="border-red-200 text-red-700 hover:bg-red-50 gap-2 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />{t('buttons.retry', { ns: 'common' })}
          </Button>
        </div>
      )}

      {/* Geofence leaving alert */}
      {leftGeofenceAlertShown.current && geo.status === 'OUT_OF_RANGE' && recorded.CHECK_IN && !isDayComplete && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-pulse">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">{t('punch.outsideGeofence')}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('punch.outsideGeofenceMsg', { distance: geo.distanceMeters != null ? `${Math.round(geo.distanceMeters)}m` : '\u2014', allowed: selectedProject?.geofenceRadiusMeters ?? 200 })}
            </p>
          </div>
        </div>
      )}

      {/* Project selector */}
      <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
        <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider mb-3">{t('punch.selectProject')}</p>
        <div className="relative">
          <button type="button" onClick={() => setShowProjectPicker(p => !p)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#D4D4D8] hover:border-[#F97316]/40 bg-[#FAFAFA] hover:bg-white transition-all text-left">
            <div>
              <p className="text-sm font-semibold text-[#0A0A0A]">{selectedProject?.name}</p>
              {projectClosed
                ? <p className="text-xs text-red-600 mt-0.5">&#x1F512; {t('punch.projectClosedLabel')}</p>
                : <p className="text-xs text-emerald-600 mt-0.5">&#x25CF; {t('punch.projectActive')}</p>}
            </div>
            <ChevronDown className={`w-4 h-4 text-[#71717A] flex-shrink-0 transition-transform ${showProjectPicker ? 'rotate-180' : ''}`} />
          </button>
          {showProjectPicker && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#D4D4D8] rounded-xl shadow-xl z-10 overflow-hidden">
              {projects.map(p => {
                const closed = p.status === 'CLOSED';
                return (
                  <button key={p.id} type="button"
                    onClick={() => { setSelectedProject(p); setShowProjectPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors ${p.id === selectedProject?.id ? 'bg-[#F97316]/5' : ''}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${closed ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    <span className="text-sm text-[#0A0A0A]">{p.name}</span>
                    {closed && <span className="text-[10px] font-semibold text-red-600">{t('punch.projectClosedLabel')}</span>}
                    {p.id === selectedProject?.id && <span className="ml-auto text-[10px] font-semibold text-[#F97316]">{t('punch.projectSelected')}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Closed project banner */}
      {projectClosed && (
        <ClosedProjectBanner message={t('punch.closedProjectMsg')} />
      )}

      {/* Location indicator */}
      <LocationIndicator
        status={geo.status}
        coords={geo.lat != null && geo.lng != null ? { lat: geo.lat, lng: geo.lng } : undefined}
        onRequestPermission={async () => {
          if (!navigator.geolocation) return;
          // Check actual permission state before calling watchPosition.
          // If already denied, the browser will NOT re-prompt — we need to
          // reload so the Permissions API picks up any settings change.
          try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            if (perm.state === 'denied') {
              window.location.reload();
              return;
            }
          } catch { /* Permissions API not supported — fall through */ }
          startWatcher();
        }}
      />

      {/* Loading indicator for today's record */}
      {loadingRecord && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
          <span className="text-xs text-[#71717A]">{t('punch.loadingRecord')}</span>
        </div>
      )}

      {/* In-transit banner */}
      {hasTransitWithoutCheckIn && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">
                {t('punch.inTransitTo', { project: selectedProject?.name })}
              </p>
              {transitEvent?.sourceProjectName && (
                <p className="text-xs text-blue-600 mt-0.5">
                  {t('punch.transitFrom', { project: transitEvent.sourceProjectName })}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-blue-700">{t('punch.transitActiveDesc')}</p>

          {/* Dispute pending indicator */}
          {transitEvent?.disputeStatus === 'PENDING' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">{t('punch.disputePending')}</p>
                <p className="text-xs text-amber-700 mt-0.5">{t('punch.disputePendingDesc')}</p>
              </div>
            </div>
          )}

          {/* Dispute resolved indicator */}
          {transitEvent?.disputeStatus === 'RESOLVED' && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">{t('punch.disputeResolved')}</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {t('punch.disputeResolvedDesc', { minutes: transitEvent.awardedTransitMinutes ?? 0 })}
                </p>
              </div>
            </div>
          )}

          {/* Dispute form (inline) */}
          {showDisputeForm && !transitEvent?.disputeStatus && (
            <div className="space-y-2 p-3 bg-white border border-amber-200 rounded-xl">
              <p className="text-xs text-[#71717A]">{t('punch.disputeTransitDesc')}</p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#0A0A0A]">
                  {t('punch.disputeReasonLabel')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={disputeReason}
                  onChange={e => setDisputeReason(e.target.value)}
                  placeholder={t('punch.disputeReasonPlaceholder')}
                  className={`w-full text-sm border rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] ${
                    disputeReason.length > 0 && disputeReason.trim().length < 10
                      ? 'border-red-400'
                      : 'border-[#D4D4D8]'
                  }`}
                />
                {disputeReason.trim().length < 10 && disputeReason.length > 0 && (
                  <p className="text-[10px] text-red-500">
                    {t('punch.disputeReasonCharsRemaining', { count: 10 - disputeReason.trim().length })}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => { setShowDisputeForm(false); setDisputeReason(''); }}
                  className="border-[#D4D4D8] text-[#0A0A0A]"
                >
                  {t('buttons.cancel', { ns: 'common' })}
                </Button>
                <Button
                  type="button" size="sm"
                  onClick={handleDisputeTransit}
                  disabled={submittingDispute || disputeReason.trim().length < 10}
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                >
                  {submittingDispute
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('punch.submittingDispute')}</>
                    : <><AlertTriangle className="w-3.5 h-3.5" />{t('punch.disputeTransit')}</>}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!transitEvent?.disputeStatus && !showDisputeForm && (
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setShowCancelConfirm(true)}
                className="border-blue-200 text-blue-700 hover:bg-blue-100 gap-2"
              >
                <X className="w-3.5 h-3.5" />{t('punch.cancelTransit')}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setShowDisputeForm(true)}
                className="border-amber-200 text-amber-700 hover:bg-amber-100 gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5" />{t('punch.disputeTransit')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main content: day complete or punch grid */}
      {!loadingRecord && isDayComplete ? (
        <div className="space-y-4">
          {/* Day complete card */}
          <div className="bg-white rounded-xl border border-emerald-200 p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-[#0A0A0A] mb-1">{t('punch.dayComplete')}</p>
            <p className="text-sm text-[#71717A] max-w-xs">{t('punch.dayCompleteDesc')}</p>
            {/* Dynamic review progress */}
            {(() => {
              const reviewedCount = Object.keys(eventReviews).length;
              const totalCount = todayRecord?.events.length ?? TIME_EVENT_SEQUENCE.length;
              if (reviewedCount === 0) {
                return (
                  <div className="mt-4 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#71717A]" />
                    <span className="text-xs text-[#71717A]">{t('punch.awaitingSupervisor')}</span>
                  </div>
                );
              }
              const allReviewed = reviewedCount >= totalCount;
              return (
                <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-xs text-sky-700 font-medium">
                      {allReviewed ? t('punch.allPunchesReviewed') : t('punch.punchesReviewed', { reviewed: reviewedCount, total: totalCount })}
                    </span>
                  </div>
                  <div className="w-full bg-[#FAFAFA] rounded-full h-1.5">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(reviewedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Inline transit option — persistent fallback if the dialog was dismissed */}
          {workerState !== 'IN_TRANSIT' && projects.filter(p => p.id !== selectedProject?.id && p.status === 'ACTIVE').length > 0 && (
            <button
              type="button"
              onClick={() => setShowTransitPrompt(true)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-[#D4D4D8] hover:border-[#F97316]/40 hover:bg-[#F97316]/5 transition-all text-left group"
            >
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                <Car className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0A0A0A]">{t('punch.transitPromptTitle')}</p>
                <p className="text-xs text-[#71717A] mt-0.5">{t('punch.transitInlineDesc')}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[#71717A] -rotate-90 flex-shrink-0" />
            </button>
          )}
        </div>
      ) : !loadingRecord && (
        <>
          {/* Location-blocked overlay */}
          {locationBlocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">{t('punch.locationRequiredTitle')}</p>
                <p className="text-xs text-red-700 mt-1 max-w-xs leading-relaxed">{t('punch.locationRequiredDesc')}</p>
              </div>
              {geo.status === 'AWAITING_PERMISSION' && (
                <button
                  onClick={() => { if (navigator.geolocation) startWatcher(); }}
                  className="mt-1 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />{t('location.grantAccess')}
                </button>
              )}
            </div>
          )}

          {/* Punch grid */}
          <div className={`bg-white rounded-xl border border-[#D4D4D8] p-5 ${locationBlocked ? 'opacity-40 pointer-events-none select-none' : ''}`}>
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider mb-4">{t('punch.checkIn')}</p>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {TIME_EVENT_SEQUENCE.map(type => (
                <TimePunchButton
                  key={type}
                  type={type}
                  state={getPunchState(type)}
                  capturedAt={recorded[type]}
                  onClick={() => handlePunchClick(type)}
                />
              ))}
            </div>
          </div>

          {/* Big CTA button */}
          {nextType && actionState !== 'success' && (
            <Button type="button"
              onClick={() => handlePunchClick(nextType)}
              disabled={actionState === 'submitting' || locationBlocked}
              className={`w-full h-14 text-base rounded-xl gap-3 shadow-lg transition-all ${
                locationBlocked
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-[#F97316] hover:bg-[#C2410C] text-white shadow-[#F97316]/20'
              }`}>
              {actionState === 'submitting'
                ? <><Loader2 className="w-5 h-5 animate-spin" />{t('punch.savingPunch')}</>
                : locationBlocked
                  ? <><MapPin className="w-5 h-5" />{t('punch.locationRequired')}</>
                  : <>{t('punch.punchAction', { type: nextType.replace('_', ' ') })}</>}
            </Button>
          )}
        </>
      )}

      {/* Punch history (today) */}
      {(Object.keys(recorded).length > 0 || transitEvent) && (
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50">
            <p className="text-sm font-semibold text-[#0A0A0A]">{t('punch.title')}</p>
          </div>
          <div className="p-5 space-y-0.5">
            {/* Transit event (if present) */}
            {transitEvent && (
              <div className="flex items-center justify-between py-2.5 border-b border-[#FAFAFA]">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-sm font-mono font-medium text-[#0A0A0A]">{t('punch.inTransit')}</span>
                  {transitEvent.sourceProjectName && (
                    <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                      {transitEvent.sourceProjectName}
                    </span>
                  )}
                </div>
                <span className="text-sm text-[#71717A]">{fmtTime(transitEvent.capturedAtClient, i18n.language)}</span>
              </div>
            )}
            {TIME_EVENT_SEQUENCE.filter(t => recorded[t]).map(type => {
              const review = eventReviews[type];
              const dotColor = !review
                ? 'bg-[#C5CBD4]'
                : review.status === 'APPROVED'
                  ? 'bg-emerald-500'
                  : review.status === 'OBSERVED'
                    ? 'bg-[#F97316]'
                    : 'bg-red-500'; // REJECTED
              return (
                <div key={type} className="flex items-center justify-between py-2.5 border-b border-[#FAFAFA] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className="text-sm font-mono font-medium text-[#0A0A0A]">{type.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {review && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                        review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        review.status === 'OBSERVED' ? 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {review.status === 'APPROVED' ? t('punch.statusApproved') : review.status === 'OBSERVED' ? t('punch.statusObserved') : t('punch.statusRejected')}
                      </span>
                    )}
                    <span className="text-sm text-[#71717A]">{fmtTime(recorded[type]!, i18n.language)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transit destination prompt */}
      <Dialog open={showTransitPrompt} onOpenChange={o => { if (!o) { setShowTransitPrompt(false); setTransitDestination(null); } }}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('punch.transitPromptTitle')}</DialogTitle>
            <DialogDescription>{t('punch.transitPromptDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {projects
              .filter(p => p.id !== selectedProject?.id && p.status === 'ACTIVE')
              .map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTransitDestination(p)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                    transitDestination?.id === p.id
                      ? 'border-[#F97316] bg-[#F97316]/5'
                      : 'border-[#D4D4D8] hover:border-[#F97316]/40 bg-white'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-sm text-[#0A0A0A]">{p.name}</span>
                  {transitDestination?.id === p.id && (
                    <CheckCircle className="w-4 h-4 text-[#F97316] ml-auto" />
                  )}
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button
              type="button" variant="outline"
              onClick={() => { setShowTransitPrompt(false); setTransitDestination(null); }}
              className="border-[#D4D4D8] text-[#0A0A0A]"
            >
              {t('punch.noThanks')}
            </Button>
            <Button
              type="button"
              onClick={handleTransitConfirm}
              disabled={!transitDestination || transitSubmitting}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white gap-2"
            >
              {transitSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('punch.startTransit')}</>
                : <><Car className="w-4 h-4" />{t('punch.startTransit')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel transit confirmation modal */}
      <Dialog open={showCancelConfirm} onOpenChange={o => { if (!o) { setShowCancelConfirm(false); setCancelReason(''); setCancelCustomReason(''); } }}>
        <DialogContent className="sm:max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t('punch.cancelTransitConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('punch.cancelTransitConfirmDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Left: predefined reasons */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">{t('punch.cancelReasonLabel')}</p>
              {(['VEHICLE_ISSUE', 'WEATHER', 'PERSONAL_EMERGENCY', 'REASSIGNED', 'PROJECT_CANCELLED', 'OTHER'] as const).map(key => (
                <button key={key} type="button"
                  onClick={() => setCancelReason(key)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    cancelReason === key
                      ? 'border-[#F97316] bg-[#F97316]/5 text-[#F97316] font-medium'
                      : 'border-[#D4D4D8] hover:border-[#F97316]/40 text-[#0A0A0A]'
                  }`}>
                  {t(`punch.cancelReason.${key}`)}
                </button>
              ))}
            </div>
            {/* Right: custom reason + warnings */}
            <div className="space-y-4">
              {cancelReason === 'OTHER' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#0A0A0A]">{t('punch.cancelCustomReasonLabel')}</label>
                  <textarea
                    value={cancelCustomReason}
                    onChange={e => setCancelCustomReason(e.target.value)}
                    placeholder={t('punch.cancelCustomReasonPlaceholder')}
                    className="w-full text-sm border border-[#D4D4D8] rounded-lg p-2.5 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316]"
                  />
                </div>
              )}
              {/* Warning: hours not paid */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{t('punch.cancelTransitNoPay')}</p>
              </div>
              {/* Info: supervisor notified */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">{t('punch.cancelTransitNotify')}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setShowCancelConfirm(false); setCancelReason(''); setCancelCustomReason(''); }}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button type="button" onClick={handleCancelTransitConfirmed}
              disabled={cancellingTransit || !effectiveCancelReason}
              className="bg-red-500 hover:bg-red-600 text-white gap-2">
              {cancellingTransit
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t('punch.cancelTransit')}</>
                : <><X className="w-4 h-4" />{t('punch.cancelTransit')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal */}
      <Dialog open={actionState === 'confirming' && !!pendingType} onOpenChange={o => { if (!o) handleCancel(); }}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0A0A0A]">{t(PUNCH_CONFIRM_KEYS[pendingType ?? 'CHECK_IN']?.title ?? 'punch.confirmCheckIn')}</DialogTitle>
            <DialogDescription>
              {t(PUNCH_CONFIRM_KEYS[pendingType ?? 'CHECK_IN']?.desc ?? 'punch.aboutToCheckIn')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-[#FAFAFA] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717A]">{t('punch.actionLabel')}</span>
                <span className="text-sm font-mono font-semibold text-[#0A0A0A]">{pendingType ? t(`punchButton.${pendingType}`) : ''}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717A]">{t('labels.project', { ns: 'common' })}</span>
                <span className="text-xs text-[#0A0A0A] truncate max-w-[160px]">{selectedProject?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717A]">{t('punch.timeLabel')}</span>
                <span className="text-sm font-mono text-[#0A0A0A]">{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717A]">{t('punch.locationLabel')}</span>
                <span className={`text-xs font-semibold ${
                  geo.status === 'OK' ? 'text-emerald-600'
                    : geo.status === 'OUT_OF_RANGE' ? 'text-red-600'
                    : 'text-amber-600'
                }`}>
                  {geo.status === 'detecting' ? t('location.detecting')
                    : geo.status === 'OK' ? t('location.detected')
                    : geo.status === 'OUT_OF_RANGE' ? t('location.outsideArea')
                    : geo.status === 'NO_PERMISSION' || geo.status === 'AWAITING_PERMISSION' ? t('location.denied')
                    : geo.status === 'NO_GEOFENCE' ? t('location.noGeofence')
                    : t('location.unavailable')}
                </span>
              </div>
              {geo.distanceMeters != null && (
                <div className="flex items-center justify-between">
                <span className="text-xs text-[#71717A]">{t('punch.outsideGeofence')}</span>
                  <span className="text-xs font-mono text-[#0A0A0A]">{Math.round(geo.distanceMeters)}m / {selectedProject?.geofenceRadiusMeters ?? 200}m</span>
                </div>
              )}
            </div>
            {geo.status === 'OUT_OF_RANGE' && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{t('punch.outsideAreaWarning')}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}
              className="border-[#D4D4D8] text-[#0A0A0A]">{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button type="button" onClick={handleConfirm}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white">{t('buttons.confirm', { ns: 'common' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
