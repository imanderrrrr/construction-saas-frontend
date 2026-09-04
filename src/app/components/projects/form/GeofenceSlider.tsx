import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/utils';
import { FieldLabel, INPUT, INPUT_MONO, Mono } from '../bt';

export const GEOFENCE_MIN = 50;
export const GEOFENCE_MAX = 5000;

/** Radius of the geofence: a 4 px slider with an ink square thumb, a 96 px number box and the scale. */
export function GeofenceSlider({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const { t } = useTranslation('admin');
  const pct = ((value - GEOFENCE_MIN) / (GEOFENCE_MAX - GEOFENCE_MIN)) * 100;
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-2">
        <FieldLabel htmlFor="project-geofence" className="mb-0">{t('projectForm.geofence')}</FieldLabel>
        <div className="flex items-center gap-[7px]">
          <input
            id="project-geofence"
            type="number"
            inputMode="numeric"
            min={GEOFENCE_MIN}
            max={GEOFENCE_MAX}
            step={10}
            value={value}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(Math.max(GEOFENCE_MIN, Math.min(GEOFENCE_MAX, v))); }}
            disabled={disabled}
            className={cn(INPUT, INPUT_MONO, 'w-24 h-[34px] text-right text-[13px] px-2.5')}
          />
          <Mono className="text-[11px] normal-case text-[#5A5346]">m</Mono>
        </div>
      </div>
      <input
        type="range"
        aria-label={t('projectForm.geofence')}
        min={GEOFENCE_MIN}
        max={GEOFENCE_MAX}
        step={10}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="bt-range"
        style={{ background: `linear-gradient(to right, #F97316 0%, #F97316 ${pct}%, #DBD0BB ${pct}%, #DBD0BB 100%)` }}
      />
      <div className="flex justify-between mt-[5px]">
        <Mono className="text-[9.5px] tracking-[0.06em] text-[#B4A992]">50 m</Mono>
        <Mono className="text-[9.5px] tracking-[0.06em] text-[#B4A992]">5,000 m</Mono>
      </div>
      <p className="text-[12px] leading-[1.5] text-[#5A5346] mt-[9px]">
        {t('projectForm.geofenceNote')} <b className="font-semibold text-[#0A0A0A]">{t('projectForm.geofenceNoteStrong')}</b>
      </p>
    </div>
  );
}
