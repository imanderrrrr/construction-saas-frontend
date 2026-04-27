import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, FolderCog, Plus, Pencil, Trash2, Map, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from './ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';

// Types

interface Override {
  id: string;
  project: string;
  startTime: string;   // "07:00"
  lunch: string;       // "45 min"
  radius: number;
}

interface OverrideForm {
  project: string;
  startTime: string;
  lunch: string;
  radius: number;
}

// Constants

const PROJECTS = ['Downtown Plaza', 'Highway Bridge', 'Office Renovation', 'Harbor Expansion'];

const LUNCH_OPTIONS = [
  { value: '30 min', labelKey: 'admin:schedule.lunch30' },
  { value: '45 min', labelKey: 'admin:schedule.lunch45' },
  { value: '60 min', labelKey: 'admin:schedule.lunch60' },
];

const EMPTY_FORM: OverrideForm = {
  project: '', startTime: '08:00', lunch: '60 min', radius: 200,
};

// Mock data
// TODO: GET/POST /api/v1/admin/schedule-overrides

const INITIAL_OVERRIDES: Override[] = [
  { id: '1', project: 'Downtown Plaza',  startTime: '07:00', lunch: '45 min', radius: 300 },
  { id: '2', project: 'Highway Bridge',  startTime: '06:30', lunch: '30 min', radius: 500 },
];

// Helpers

/** "07:00" → locale-aware time string (e.g. "7:00 AM" in en, "7:00" in es) */
function displayTime(input: string, locale = 'en-US'): string {
  if (!input) return '—';
  const [h, m] = input.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// Section card wrapper

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
      <div className="flex items-start gap-3 px-6 py-5 border-b border-[#D4D4D8]">
        <div className="w-9 h-9 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4.5 h-4.5 text-[#F97316]" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#71717A] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// Field wrapper

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">{label}</label>
      {children}
      {helper && <p className="text-xs text-[#71717A]">{helper}</p>}
    </div>
  );
}

// Shared input style

const inputCls =
  'h-9 w-full rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors';

// Main component

export function ScheduleSettings() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  // Card 1: Work schedule
  const [startTime,     setStartTime]     = useState('08:00');
  const [lunchDuration, setLunchDuration] = useState('60 min');
  const [gracePeriod,   setGracePeriod]   = useState(5);
  const [lateThreshold, setLateThreshold] = useState(15);

  function handleSaveSchedule() {
    // TODO: PUT /api/v1/admin/schedule-config
    toast.success(t('admin:schedule.toastScheduleSaved'), {
      description: `Start: ${displayTime(startTime, i18n.language)} · Grace: ${gracePeriod} min · Late after: ${lateThreshold} min`,
    });
  }

  // Card 2: Geolocation
  const [geoEnabled, setGeoEnabled] = useState(true);
  const [geoRadius,  setGeoRadius]  = useState(200);

  function handleSaveGeo() {
    // TODO: PUT /api/v1/admin/geolocation-config
    toast.success(t('admin:schedule.toastGeoSaved'), {
      description: geoEnabled
        ? `Enabled · Radius: ${geoRadius} m`
        : t('admin:schedule.toastGeoDisabled'),
    });
  }

  // Card 3: Project overrides
  const [overrides,  setOverrides]  = useState<Override[]>(INITIAL_OVERRIDES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [form,       setForm]       = useState<OverrideForm>(EMPTY_FORM);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(o: Override) {
    setEditingId(o.id);
    setForm({ project: o.project, startTime: o.startTime, lunch: o.lunch, radius: o.radius });
    setDialogOpen(true);
  }

  function handleRemove(id: string) {
    const name = overrides.find(o => o.id === id)?.project ?? '';
    setOverrides(prev => prev.filter(o => o.id !== id));
    toast.success(t('admin:schedule.toastOverrideRemoved'));
  }

  function handleSaveOverride() {
    if (!form.project) return;
    if (editingId) {
      // TODO: PUT /api/v1/admin/schedule-overrides/{editingId}
      setOverrides(prev =>
        prev.map(o => o.id === editingId ? { ...o, ...form } : o),
      );
      toast.success(t('admin:schedule.toastOverrideUpdated', { project: form.project }));
    } else {
      // TODO: POST /api/v1/admin/schedule-overrides
      setOverrides(prev => [
        ...prev,
        { id: String(Date.now()), ...form },
      ]);
      toast.success(t('admin:schedule.toastOverrideAdded', { project: form.project }));
    }
    setDialogOpen(false);
  }

  const canSaveOverride = form.project.length > 0;

  // Render
  return (
    <div className="space-y-6 max-w-3xl">

      {/* Page header */}
      <div>
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:schedule.title')}</h2>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('admin:section.schedules.subtitle')}</p>
      </div>

      {/* Card 1: Default Work Schedule */}
      <SectionCard
        icon={Clock}
        title={t('admin:schedule.defaultSchedule')}
        subtitle={t('admin:schedule.baseScheduleSubtitle')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Start time */}
          <Field label={t('admin:schedule.expectedStartTime')}>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className={inputCls}
            />
          </Field>

          {/* Lunch duration */}
          <Field label={t('admin:schedule.lunchBreakDuration')}>
            <Select value={lunchDuration} onValueChange={setLunchDuration}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LUNCH_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                ))}n              </SelectContent>
            </Select>
          </Field>

          {/* Grace period */}
          <Field
            label={t('admin:schedule.gracePeriod')}
            helper={t('admin:schedule.gracePeriodHelper')}
          >
            <input
              type="number"
              min={0} max={60}
              value={gracePeriod}
              onChange={e => setGracePeriod(Number(e.target.value))}
              className={inputCls}
            />
          </Field>

          {/* Late threshold */}
          <Field
            label={t('admin:schedule.lateAfter')}
            helper={t('admin:schedule.lateAfterHelper')}
          >
            <input
              type="number"
              min={0} max={120}
              value={lateThreshold}
              onChange={e => setLateThreshold(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex justify-end pt-4 border-t border-[#FAFAFA]">
          <Button
            onClick={handleSaveSchedule}
            className="bg-[#F97316] hover:bg-[#C2410C] text-white text-xs gap-2 h-9 px-5"
          >
            <Save className="w-3.5 h-3.5" />
            {t('admin:schedule.saveSchedule')}
          </Button>
        </div>
      </SectionCard>

      {/* Card 2: Geolocation Settings */}
      <SectionCard
        icon={MapPin}
        title={t('admin:schedule.geolocation')}
        subtitle={t('admin:schedule.geoSubtitle')}
      >
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 bg-[#FAFAFA] rounded-xl border border-[#D4D4D8] mb-5">
          <div>
            <p className="text-sm font-semibold text-[#0A0A0A]">{t('admin:schedule.enableGeoClockIn')}</p>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              {t('admin:schedule.enableGeoDesc')}
            </p>
          </div>
          <Switch
            checked={geoEnabled}
            onCheckedChange={setGeoEnabled}
            className="data-[state=checked]:bg-[#F97316]"
          />
        </div>

        {/* Conditional fields — only visible when enabled */}
        {geoEnabled && (
          <div className="space-y-5">
            <Field label={t('admin:schedule.allowedRadius')}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50} max={5000} step={50}
                  value={geoRadius}
                  onChange={e => setGeoRadius(Number(e.target.value))}
                  className={`${inputCls} flex-1`}
                />
                <span className="text-sm text-[#71717A] whitespace-nowrap">{t('admin:schedule.meters')}</span>
              </div>
            </Field>

            {/* Map placeholder */}
            <div className="h-48 bg-[#FAFAFA] border border-dashed border-[#D4D4D8] rounded-xl flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 bg-white rounded-full border border-[#D4D4D8] flex items-center justify-center">
                <Map className="w-5 h-5 text-[#D4D4D8]" />
              </div>
              <p className="text-sm text-[#71717A]">{t('admin:schedule.mapPreview')}</p>
              <p className="text-[11px] text-[#D4D4D8]">{t('admin:schedule.mapPreviewSubtitle')}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-5 border-t border-[#FAFAFA] mt-5">
          <Button
            onClick={handleSaveGeo}
            className="bg-[#F97316] hover:bg-[#C2410C] text-white text-xs gap-2 h-9 px-5"
          >
            <Save className="w-3.5 h-3.5" />
            {t('admin:schedule.saveGeolocation')}
          </Button>
        </div>
      </SectionCard>

      {/* Card 3: Per-Project Overrides */}
      <SectionCard
        icon={FolderCog}
        title={t('admin:schedule.perProjectTitle')}
        subtitle={t('admin:schedule.perProjectSubtitle')}
      >
        {/* Table */}
        <div className="rounded-lg border border-[#D4D4D8] overflow-hidden mb-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAFAFA] hover:bg-[#FAFAFA]">
                {[t('admin:schedule.table.project'), t('admin:schedule.table.startTime'), t('admin:schedule.table.lunch'), t('admin:schedule.table.radius'), t('admin:schedule.table.actions')].map(h => (
                  <TableHead key={h} className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wider">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-sm text-[#71717A]">
                    {t('admin:schedule.noOverridesAdd')}
                  </TableCell>
                </TableRow>
              ) : (
                overrides.map(o => (
                  <TableRow key={o.id} className="border-b border-[#D4D4D8]/50 hover:bg-[#FAFAFA]/40 transition-colors">
                    <TableCell className="py-3">
                      <span className="text-sm font-medium text-[#0A0A0A]">{o.project}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-sm text-[#0A0A0A]">{displayTime(o.startTime, i18n.language)}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="text-sm text-[#0A0A0A]">{o.lunch}</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <span className="font-mono text-sm text-[#0A0A0A]">{o.radius} m</span>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(o)}
                          title="Edit"
                          className="w-8 h-8 flex items-center justify-center rounded-full text-[#F97316] hover:bg-[#F97316]/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(o.id)}
                          title="Remove"
                          className="w-8 h-8 flex items-center justify-center rounded-full text-[#d4183d] hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={openAdd}
          className="border-[#D4D4D8] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#F97316] text-xs gap-2 h-9"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('admin:schedule.addOverride')}
        </Button>
      </SectionCard>

      {/* Dialog: Add / Edit Override */}
      <Dialog open={dialogOpen} onOpenChange={o => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#0A0A0A]">
              {editingId ? t('admin:schedule.editOverride') : t('admin:schedule.addOverride')}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#71717A]">
              {t('admin:schedule.dialogDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Project */}
            <Field label={t('admin:schedule.table.project')}>
              <Select value={form.project} onValueChange={v => setForm(f => ({ ...f, project: v }))}>
                <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                  <SelectValue placeholder={t('admin:schedule.selectProject')} />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Start time */}
            <Field label={t('admin:schedule.startTime')}>
              <input
                type="time"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className={inputCls}
              />
            </Field>

            {/* Lunch duration */}
            <Field label={t('admin:schedule.lunchBreakDuration')}>
              <Select value={form.lunch} onValueChange={v => setForm(f => ({ ...f, lunch: v }))}>
                <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LUNCH_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Radius */}
            <Field label={t('admin:schedule.allowedRadius')}>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={50} max={5000} step={50}
                  value={form.radius}
                  onChange={e => setForm(f => ({ ...f, radius: Number(e.target.value) }))}
                  className={`${inputCls} flex-1`}
                />
                <span className="text-sm text-[#71717A]">{t('admin:schedule.meters')}</span>
              </div>
            </Field>
          </div>

          <DialogFooter>
            <Button
              variant="outline" size="sm"
              onClick={() => setDialogOpen(false)}
              className="border-[#D4D4D8] text-[#71717A] hover:text-[#0A0A0A] text-xs"
            >
              {t('common:buttons.cancel')}
            </Button>
            <Button
              size="sm"
              disabled={!canSaveOverride}
              onClick={handleSaveOverride}
              className="bg-[#F97316] hover:bg-[#C2410C] text-white text-xs gap-1.5 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
              {editingId ? t('admin:schedule.update') : t('admin:schedule.addOverride')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
