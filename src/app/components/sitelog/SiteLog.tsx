// OFJR Construction — Bitácora de obra (site log) module
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertCircle, Calendar, Camera, Check, ChevronLeft, Cloud, CloudDrizzle, CloudFog,
  CloudLightning, CloudSun, Loader2, NotebookPen, Plus, RefreshCw, Save,
  Send, Sun, Tag, UserPlus, Users, X, type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { businessToday } from '../../helpers/dateTime';
import { ApiError } from '../../lib/api';
import { AuthImage } from './AuthImage';
import { PhotoLightbox } from './PhotoLightbox';
import {
  deleteSiteLogPhoto, getSiteLogByDate, getSiteLogHistory, getSiteLogSuggestion, saveSiteLog,
  uploadSiteLogPhoto,
  type AttendanceSource, type SiteLogPayload, type SiteLogResponse, type SiteLogStatus,
  type SiteLogSuggestion, type SiteLogSummary, type Weather,
} from '../../services/siteLog';

interface SiteLogProps {
  /** Projects the current user can write a site log for. */
  projects: { id: number; name: string }[];
  /** SUPERVISOR/ADMIN can create/edit; FINANCE is read-only. */
  canEdit: boolean;
}

const WEATHER_ORDER: Weather[] = ['SOLEADO', 'NUBLADO', 'LLUVIA', 'TORMENTA', 'NIEBLA'];
const WEATHER_ICON: Record<Weather, LucideIcon> = {
  SOLEADO: Sun, NUBLADO: CloudSun, LLUVIA: CloudDrizzle, TORMENTA: CloudLightning, NIEBLA: CloudFog,
};
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

interface DraftAttendance {
  key: string;
  workerId: number | null;
  name: string;
  role: string | null;
  source: AttendanceSource;
  checkInTime: string | null;
  present: boolean;
}
interface DraftTask {
  key: string;
  kanbanTaskId: number | null;
  description: string;
  partida: string | null;
  done: boolean;
}
interface Draft {
  weather: Weather | '';
  temperatureC: string;
  notes: string;
  attendance: DraftAttendance[];
  tasksDone: DraftTask[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}
function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const inputCls =
  'h-10 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors placeholder:text-[#71717A] disabled:bg-[#FAFAFA] disabled:text-[#71717A]';

export function SiteLog({ projects, canEdit }: SiteLogProps) {
  const { t } = useTranslation(['siteLog', 'common']);

  const [projectId, setProjectId] = useState<number | null>(projects[0]?.id ?? null);
  const [date, setDate] = useState<string>(() => businessToday());
  const [view, setView] = useState<'day' | 'history'>('day');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<SiteLogResponse | null>(null);
  const [suggestion, setSuggestion] = useState<SiteLogSuggestion | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [manualName, setManualName] = useState('');
  const [freeTask, setFreeTask] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [history, setHistory] = useState<SiteLogSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const keyCounter = useRef(0);
  const newKey = () => `k${keyCounter.current++}`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const buildDraft = useCallback(
    (loaded: SiteLogResponse | null, sug: SiteLogSuggestion | null): Draft => {
      const attendance: DraftAttendance[] = [];
      const seenWorkers = new Set<number>();
      if (loaded) {
        for (const a of loaded.attendance) {
          if (a.workerId != null) seenWorkers.add(a.workerId);
          attendance.push({
            key: newKey(), workerId: a.workerId, name: a.name, role: a.role,
            source: a.source, checkInTime: a.checkInTime, present: true,
          });
        }
      }
      for (const s of sug?.attendance ?? []) {
        if (seenWorkers.has(s.workerId)) continue;
        attendance.push({
          key: newKey(), workerId: s.workerId, name: s.name, role: s.role,
          source: 'AUTO', checkInTime: s.checkInTime, present: true,
        });
      }

      const tasksDone: DraftTask[] = [];
      const seenTasks = new Set<number>();
      if (loaded) {
        for (const td of loaded.tasksDone) {
          if (td.kanbanTaskId != null) seenTasks.add(td.kanbanTaskId);
          tasksDone.push({
            key: newKey(), kanbanTaskId: td.kanbanTaskId, description: td.description,
            partida: td.partida, done: true,
          });
        }
      }
      for (const s of sug?.doneTasks ?? []) {
        if (seenTasks.has(s.kanbanTaskId)) continue;
        // Suggested DONE tasks already present in the log are checked above; the
        // remainder are offered (checked when creating fresh, pending when editing).
        tasksDone.push({
          key: newKey(), kanbanTaskId: s.kanbanTaskId, description: s.title,
          partida: s.partida, done: loaded === null,
        });
      }

      return {
        weather: loaded?.weather ?? '',
        temperatureC: loaded?.temperatureC != null ? String(loaded.temperatureC) : '',
        notes: loaded?.notes ?? '',
        attendance,
        tasksDone,
      };
    },
    // newKey is stable (ref-based)
    [],
  );

  // Guarded load: a `cancelled` flag (the codebase convention) prevents a slow
  // response for a previous project/date from clobbering the current selection.
  // `refreshKey` lets the error-state retry button re-run the load.
  useEffect(() => {
    if (projectId == null) {
      setLoading(false);
      setLog(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLightboxIndex(null);
    void (async () => {
      try {
        const [loaded, sug] = await Promise.all([
          getSiteLogByDate(projectId, date),
          getSiteLogSuggestion(projectId, date).catch(() => null), // suggestion is best-effort
        ]);
        if (cancelled) return;
        setLog(loaded);
        setSuggestion(sug);
        setDraft(buildDraft(loaded, sug));
        setDirty(false);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : t('siteLog:error.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, date, refreshKey, buildDraft, t]);

  // ──────────────────────────── draft mutations ────────────────────────────

  function patchDraft(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }
  function toggleAttendance(key: string) {
    setDraft((d) => ({ ...d, attendance: d.attendance.map((a) => (a.key === key ? { ...a, present: !a.present } : a)) }));
    setDirty(true);
  }
  function removeAttendance(key: string) {
    setDraft((d) => ({ ...d, attendance: d.attendance.filter((a) => a.key !== key) }));
    setDirty(true);
  }
  function addManualAttendance() {
    const name = manualName.trim();
    if (!name) return;
    setDraft((d) => ({
      ...d,
      attendance: [...d.attendance, { key: newKey(), workerId: null, name, role: null, source: 'MANUAL', checkInTime: null, present: true }],
    }));
    setManualName('');
    setDirty(true);
  }
  function applySuggestedCrew() {
    if (!suggestion) return;
    setDraft((d) => {
      const present = new Set(d.attendance.filter((a) => a.workerId != null).map((a) => a.workerId));
      const additions = suggestion.attendance
        .filter((s) => !present.has(s.workerId))
        .map<DraftAttendance>((s) => ({ key: newKey(), workerId: s.workerId, name: s.name, role: s.role, source: 'AUTO', checkInTime: s.checkInTime, present: true }));
      return { ...d, attendance: [...d.attendance, ...additions] };
    });
    setDirty(true);
  }
  function toggleTask(key: string) {
    setDraft((d) => ({ ...d, tasksDone: d.tasksDone.map((tk) => (tk.key === key ? { ...tk, done: !tk.done } : tk)) }));
    setDirty(true);
  }
  function removeTask(key: string) {
    setDraft((d) => ({ ...d, tasksDone: d.tasksDone.filter((tk) => tk.key !== key) }));
    setDirty(true);
  }
  function addFreeTask() {
    const description = freeTask.trim();
    if (!description) return;
    setDraft((d) => ({
      ...d,
      tasksDone: [...d.tasksDone, { key: newKey(), kanbanTaskId: null, description, partida: selectedProject ? (log?.partida ?? null) : null, done: true }],
    }));
    setFreeTask('');
    setDirty(true);
  }

  // ──────────────────────────── persistence ────────────────────────────

  function buildPayload(status: SiteLogStatus): SiteLogPayload {
    const temp = draft.temperatureC.trim();
    return {
      workDate: date,
      weather: draft.weather === '' ? null : draft.weather,
      temperatureC: temp === '' ? null : Number(temp),
      notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
      status,
      attendance: draft.attendance
        .filter((a) => a.present && (a.workerId != null || a.name.trim() !== ''))
        .map((a) => ({
          workerId: a.workerId,
          name: a.workerId != null ? null : a.name.trim(),
          source: a.source,
          checkInTime: a.checkInTime,
        })),
      tasksDone: draft.tasksDone
        .filter((tk) => tk.done && (tk.kanbanTaskId != null || tk.description.trim() !== ''))
        .map((tk) => ({
          kanbanTaskId: tk.kanbanTaskId,
          description: tk.kanbanTaskId != null ? null : tk.description.trim(),
        })),
    };
  }

  async function handleSave(status: SiteLogStatus): Promise<SiteLogResponse | null> {
    if (projectId == null) return null;
    setSaving(true);
    try {
      const saved = await saveSiteLog(projectId, buildPayload(status));
      setLog(saved);
      setDraft(buildDraft(saved, suggestion));
      setDirty(false);
      toast.success(status === 'PUBLISHED' ? t('siteLog:toast.published') : t('siteLog:toast.saved'));
      return saved;
    } catch (err) {
      toast.error(t('siteLog:toast.saveError'), { description: err instanceof ApiError ? err.message : undefined });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0 || !log) return;
    const siteLogId = log.id;
    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) { toast.error(t('siteLog:photos.invalidType')); continue; }
        if (file.size > MAX_PHOTO_BYTES) { toast.error(t('siteLog:photos.tooLarge')); continue; }
        // Commit each successful upload to state immediately so a later failure
        // in the batch can't discard photos the backend already persisted.
        const updated = await uploadSiteLogPhoto(siteLogId, file);
        setLog(updated);
        uploaded += 1;
      }
      if (uploaded > 0) toast.success(t('siteLog:toast.photoUploaded'));
    } catch (err) {
      toast.error(t('siteLog:toast.photoError'), { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!log) return;
    try {
      await deleteSiteLogPhoto(log.id, photoId);
      const remaining = log.photos.filter((p) => p.id !== photoId);
      setLog({ ...log, photos: remaining });
      setLightboxIndex((idx) => {
        if (idx == null) return null;
        if (remaining.length === 0) return null;
        return Math.min(idx, remaining.length - 1);
      });
      toast.success(t('siteLog:toast.photoDeleted'));
    } catch (err) {
      toast.error(t('siteLog:toast.photoDeleteError'), { description: err instanceof ApiError ? err.message : undefined });
    }
  }

  // ──────────────────────────── history ────────────────────────────

  const openHistory = useCallback(async () => {
    if (projectId == null) return;
    setView('history');
    setHistoryLoading(true);
    try {
      const page = await getSiteLogHistory(projectId, 0, 30);
      setHistory(page.content);
    } catch (err) {
      toast.error(t('siteLog:error.loadFailed'), { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId, t]);

  // ──────────────────────────── derived ────────────────────────────

  const presentCount = draft.attendance.filter((a) => a.present).length;
  const doneCount = draft.tasksDone.filter((tk) => tk.done).length;
  const photoCount = log?.photos.length ?? 0;
  const WeatherIcon = draft.weather ? WEATHER_ICON[draft.weather] : Cloud;

  // ──────────────────────────── render ────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">
      <Header
        t={t}
        projects={projects}
        projectId={projectId}
        onProjectChange={(id) => { setProjectId(id); setView('day'); }}
        date={date}
        onDateChange={(d) => { setDate(d); setView('day'); }}
        residentName={log?.authorName ?? null}
        status={log?.status ?? null}
        dirty={dirty}
        canEdit={canEdit}
        showActions={view === 'day' && log != null}
        saving={saving}
        onSaveDraft={() => handleSave('DRAFT')}
        onPublish={() => handleSave('PUBLISHED')}
      />

      {view === 'history' ? (
        <HistoryView
          t={t}
          loading={historyLoading}
          items={history}
          onBack={() => setView('day')}
          onOpen={(d) => { setDate(d); setView('day'); }}
        />
      ) : projectId == null ? (
        <SelectProjectState t={t} />
      ) : loading ? (
        <SiteLogSkeleton />
      ) : error ? (
        <ErrorState t={t} message={error} onRetry={() => setRefreshKey((k) => k + 1)} />
      ) : log == null ? (
        <EmptyState t={t} canEdit={canEdit} saving={saving} onCreate={() => handleSave('DRAFT')} onViewPrevious={openHistory} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={WeatherIcon}
              label={t('siteLog:stat.weather')}
              value={draft.weather ? t(`siteLog:weather.${draft.weather}`) : t('siteLog:weather.none')}
              subtitle={draft.temperatureC ? t('siteLog:stat.weather.subtitle', { temp: draft.temperatureC }) : t('siteLog:stat.weather.noTemp')}
            />
            <StatCard
              icon={Users}
              label={t('siteLog:stat.attendance')}
              value={t('siteLog:stat.attendance.value', { present: presentCount, total: draft.attendance.length })}
              subtitle={t('siteLog:stat.attendance.subtitle')}
            />
            <StatCard
              icon={Check}
              label={t('siteLog:stat.tasks')}
              value={doneCount}
              subtitle={t('siteLog:stat.tasks.subtitle')}
            />
            <StatCard
              icon={Camera}
              label={t('siteLog:stat.photos')}
              value={photoCount}
              subtitle={t('siteLog:stat.photos.subtitle')}
            />
          </div>

          {/* Weather + temperature editor (compact) */}
          {canEdit && (
            <div className="bg-white rounded-xl border border-[#D4D4D8] p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#0A0A0A]">{t('siteLog:weather.label')}</span>
                  <select
                    className={inputCls}
                    value={draft.weather}
                    onChange={(e) => patchDraft({ weather: e.target.value as Weather | '' })}
                  >
                    <option value="">{t('siteLog:weather.placeholder')}</option>
                    {WEATHER_ORDER.map((w) => (
                      <option key={w} value={w}>{t(`siteLog:weather.${w}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-[#0A0A0A]">{t('siteLog:temperature.label')}</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={draft.temperatureC}
                    placeholder={t('siteLog:temperature.placeholder')}
                    onChange={(e) => patchDraft({ temperatureC: e.target.value })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Attendance */}
          <Card title={t('siteLog:attendance.title')} subtitle={t('siteLog:attendance.subtitle')} icon={Users}>
            {canEdit && suggestion && suggestion.attendance.length > 0 && (
              <button
                type="button"
                onClick={applySuggestedCrew}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:text-[#C2410C] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t('siteLog:attendance.applySuggestion')}
              </button>
            )}
            {draft.attendance.length === 0 ? (
              <p className="text-sm text-[#71717A] py-2">{t('siteLog:attendance.empty')}</p>
            ) : (
              <div className="space-y-2">
                {draft.attendance.map((a) => {
                  const time = formatTime(a.checkInTime);
                  return (
                    <div key={a.key} className="flex items-center gap-3 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] px-3 py-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {initials(a.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0A0A0A] truncate">{a.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#71717A]">
                          <span>{a.role ? a.role : t('siteLog:attendance.role.unknown')}</span>
                          <span>·</span>
                          <span>{time ? t('siteLog:attendance.checkInAt', { time }) : t('siteLog:attendance.noCheckIn')}</span>
                        </div>
                      </div>
                      {a.source === 'AUTO' && (
                        <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
                          {t('siteLog:attendance.auto')}
                        </span>
                      )}
                      {a.present && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {t('siteLog:attendance.present')}
                        </span>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(a.key)}
                            title={t('siteLog:attendance.present')}
                            className={cn(
                              'w-7 h-7 rounded-md flex items-center justify-center border transition-colors',
                              a.present ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-[#D4D4D8] text-[#71717A] hover:bg-white',
                            )}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAttendance(a.key)}
                            title={t('siteLog:actions.remove')}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[#71717A] hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {canEdit && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  className={inputCls}
                  value={manualName}
                  placeholder={t('siteLog:attendance.namePlaceholder')}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualAttendance(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addManualAttendance} className="gap-1.5 border-[#D4D4D8] shrink-0">
                  <UserPlus className="w-4 h-4" />
                  {t('siteLog:attendance.add')}
                </Button>
              </div>
            )}
          </Card>

          {/* Tasks done */}
          <Card title={t('siteLog:tasks.title')} subtitle={t('siteLog:tasks.subtitle')} icon={Check}>
            {draft.tasksDone.length === 0 ? (
              <p className="text-sm text-[#71717A] py-2">{t('siteLog:tasks.empty')}</p>
            ) : (
              <div className="space-y-2">
                {draft.tasksDone.map((tk) => (
                  <div key={tk.key} className="flex items-center gap-3 rounded-lg border border-[#D4D4D8] bg-[#FAFAFA] px-3 py-2.5">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleTask(tk.key)}
                      className={cn(
                        'w-5 h-5 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors',
                        tk.done ? 'bg-[#F97316] border-[#F97316] text-white' : 'bg-white border-[#D4D4D8] text-transparent',
                        canEdit ? 'cursor-pointer' : 'cursor-default',
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', tk.done ? 'text-[#0A0A0A]' : 'text-[#71717A]')}>{tk.description}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#71717A] border border-[#D4D4D8]">
                      <Tag className="w-3 h-3" />
                      {tk.partida ?? t('siteLog:tasks.noPartida')}
                    </span>
                    {!tk.done && (
                      <span className="hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        {t('siteLog:tasks.pending')}
                      </span>
                    )}
                    {canEdit && tk.kanbanTaskId == null && (
                      <button
                        type="button"
                        onClick={() => removeTask(tk.key)}
                        title={t('siteLog:actions.remove')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#71717A] hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  className={inputCls}
                  value={freeTask}
                  placeholder={t('siteLog:tasks.freePlaceholder')}
                  onChange={(e) => setFreeTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFreeTask(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addFreeTask} className="gap-1.5 border-[#D4D4D8] shrink-0">
                  <Plus className="w-4 h-4" />
                  {t('siteLog:tasks.addFree')}
                </Button>
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card title={t('siteLog:notes.title')} icon={NotebookPen}>
            {canEdit ? (
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-[#D4D4D8] bg-white p-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors placeholder:text-[#71717A] resize-y"
                value={draft.notes}
                placeholder={t('siteLog:notes.placeholder')}
                onChange={(e) => patchDraft({ notes: e.target.value })}
              />
            ) : (
              <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{draft.notes.trim() || t('siteLog:notes.empty')}</p>
            )}
          </Card>

          {/* Photos */}
          <Card title={t('siteLog:photos.title')} subtitle={t('siteLog:photos.subtitle')} icon={Camera}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(log.photos ?? []).map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="group relative aspect-square rounded-lg overflow-hidden border border-[#D4D4D8] hover:border-[#F97316] transition-colors"
                >
                  <AuthImage siteLogId={log.id} photoId={p.id} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                  {p.caption && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-2 py-1 truncate text-left">
                      {p.caption}
                    </span>
                  )}
                </button>
              ))}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-[#D4D4D8] hover:border-[#F97316] hover:bg-[#F97316]/5 transition-colors flex flex-col items-center justify-center gap-2 text-[#71717A] disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" /> : <Plus className="w-6 h-6" />}
                  <span className="text-xs font-medium">{uploading ? t('siteLog:photos.uploading') : t('siteLog:photos.add')}</span>
                </button>
              )}
            </div>
            {!canEdit && (log.photos ?? []).length === 0 && (
              <p className="text-sm text-[#71717A] py-2">{t('siteLog:photos.empty')}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoFiles(e.target.files)}
            />
          </Card>
        </>
      )}

      {lightboxIndex != null && log && log.photos[lightboxIndex] && (
        <PhotoLightbox
          photos={log.photos}
          siteLogId={log.id}
          index={lightboxIndex}
          canDelete={canEdit}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDelete={handleDeletePhoto}
        />
      )}
    </div>
  );
}

// ──────────────────────────── sub-components ────────────────────────────

type TFn = ReturnType<typeof useTranslation>['t'];

function emptyDraft(): Draft {
  return { weather: '', temperatureC: '', notes: '', attendance: [], tasksDone: [] };
}

function Header({
  t, projects, projectId, onProjectChange, date, onDateChange, residentName, status,
  dirty, canEdit, showActions, saving, onSaveDraft, onPublish,
}: {
  t: TFn;
  projects: { id: number; name: string }[];
  projectId: number | null;
  onProjectChange: (id: number) => void;
  date: string;
  onDateChange: (d: string) => void;
  residentName: string | null;
  status: SiteLogStatus | null;
  dirty: boolean;
  canEdit: boolean;
  showActions: boolean;
  saving: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 min-w-[200px]">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('siteLog:header.project')}</span>
          <select
            className={inputCls}
            value={projectId ?? ''}
            disabled={projects.length === 0}
            onChange={(e) => onProjectChange(Number(e.target.value))}
          >
            {projects.length === 0 && <option value="">{t('siteLog:header.noProjects')}</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('siteLog:header.date')}</span>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717A] pointer-events-none" />
            <input
              type="date"
              className={cn(inputCls, 'pl-9')}
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
        </label>
        <div className="flex flex-col gap-1 pb-1">
          {residentName && <span className="text-xs text-[#71717A]">{t('siteLog:header.resident', { name: residentName })}</span>}
          <div className="flex items-center gap-2">
            {status && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full', status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-amber-500')} />
                {t(`siteLog:status.${status}`)}
              </span>
            )}
            {dirty && <span className="text-[10px] text-[#71717A]">· {t('siteLog:header.unsaved')}</span>}
          </div>
        </div>
      </div>

      {canEdit && showActions && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onSaveDraft} disabled={saving} className="gap-2 border-[#D4D4D8]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('siteLog:actions.saveDraft')}
          </Button>
          <Button type="button" onClick={onPublish} disabled={saving} className="gap-2 bg-[#F97316] hover:bg-[#C2410C] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('siteLog:actions.publish')}
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subtitle }: { icon: LucideIcon; label: string; value: string | number; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#D4D4D8]">
      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316]" />
      </div>
      <p className="text-lg sm:text-xl font-bold text-[#0A0A0A] truncate">{value}</p>
      <p className="text-xs sm:text-sm text-[#71717A] truncate">{label}</p>
      <p className="text-[10px] sm:text-xs text-[#71717A] mt-1 truncate">{subtitle}</p>
    </div>
  );
}

function Card({ title, subtitle, icon: Icon, children }: { title: string; subtitle?: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[#F97316]" />
        <h3 className="text-base font-semibold text-[#0A0A0A]">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-[#71717A] mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function SelectProjectState({ t }: { t: TFn }) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
        <NotebookPen className="w-7 h-7 text-[#D4D4D8]" />
      </div>
      <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('siteLog:empty.selectProjectTitle')}</p>
      <p className="text-xs text-[#71717A]">{t('siteLog:empty.selectProjectSubtitle')}</p>
    </div>
  );
}

function EmptyState({ t, canEdit, saving, onCreate, onViewPrevious }: { t: TFn; canEdit: boolean; saving: boolean; onCreate: () => void; onViewPrevious: () => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-[#F97316]/10 rounded-full flex items-center justify-center mb-4">
        <NotebookPen className="w-8 h-8 text-[#F97316]" />
      </div>
      <p className="text-base font-semibold text-[#0A0A0A] mb-1">{t('siteLog:empty.title')}</p>
      <p className="text-sm text-[#71717A] mb-5 max-w-md">{t('siteLog:empty.subtitle')}</p>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {canEdit && (
          <Button type="button" onClick={onCreate} disabled={saving} className="gap-2 bg-[#F97316] hover:bg-[#C2410C] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t('siteLog:empty.create')}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onViewPrevious} className="gap-2 border-[#D4D4D8]">
          <ChevronLeft className="w-4 h-4" />
          {t('siteLog:empty.viewPrevious')}
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ t, message, onRetry }: { t: TFn; message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-900">{t('siteLog:error.title')}</p>
          <p className="text-xs text-red-600 mt-0.5">{message}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
        <RefreshCw className="w-3.5 h-3.5" />
        {t('common:buttons.retry')}
      </Button>
    </div>
  );
}

function SiteLogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 sm:p-5 border border-[#D4D4D8]">
            <div className="w-10 h-10 bg-[#F4F4F5] rounded-lg animate-pulse mb-3" />
            <div className="h-5 w-16 bg-[#F4F4F5] rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-[#F4F4F5] rounded animate-pulse" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[#D4D4D8] p-4 sm:p-6">
          <div className="h-4 w-40 bg-[#F4F4F5] rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-12 bg-[#F4F4F5] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryView({ t, loading, items, onBack, onOpen }: { t: TFn; loading: boolean; items: SiteLogSummary[]; onBack: () => void; onOpen: (date: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-[#D4D4D8]">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-[#F97316] hover:text-[#C2410C] transition-colors">
          <ChevronLeft className="w-4 h-4" />
          {t('siteLog:history.back')}
        </button>
        <span className="ml-1 text-sm font-semibold text-[#0A0A0A]">· {t('siteLog:history.title')}</span>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-[#F4F4F5] rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <NotebookPen className="w-7 h-7 text-[#D4D4D8]" />
          </div>
          <p className="text-sm text-[#71717A]">{t('siteLog:history.empty')}</p>
        </div>
      ) : (
        <div className="divide-y divide-[#D4D4D8]/60">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.workDate)}
              className="w-full flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-[#FAFAFA] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 text-[#71717A] flex-shrink-0" />
                <span className="text-sm font-medium text-[#0A0A0A]">{item.workDate}</span>
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  item.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
                )}>
                  {t(`siteLog:status.${item.status}`)}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-[#71717A]">
                <span>{t('siteLog:history.attendance', { count: item.attendanceCount })}</span>
                <span>{t('siteLog:history.tasks', { count: item.tasksDoneCount })}</span>
                <span>{t('siteLog:history.photos', { count: item.photoCount })}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
