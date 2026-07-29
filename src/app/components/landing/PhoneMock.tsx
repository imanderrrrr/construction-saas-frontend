import { useTranslation } from 'react-i18next';

/**
 * The field-app phone in the "Obra móvil" section: a clock-in screen with the
 * geofence drawn as a dashed radius around the site pin, shown offline with
 * work still queued to sync.
 */
export function PhoneMock() {
  const { t } = useTranslation('landing');
  return (
    <div className="flex w-[min(320px,86vw)] flex-col gap-[18px] rounded-[34px] border-[6px] border-bt-brown bg-bt-ink px-[22px] pb-5 pt-[22px] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]">
      <div className="flex justify-between font-bt-mono text-[10px] tracking-[0.08em] text-bt-muted-2">
        <span>06:54</span>
        <span className="text-bt-orange">{t('app.phone.1')}</span>
      </div>

      {/* Geofence: dashed perimeter, inner ring, centre pin, crosshairs */}
      <div className="flex flex-col items-center gap-3.5 py-2.5">
        <div aria-hidden="true" className="relative h-[150px] w-[150px] flex-none">
          <span className="absolute inset-0 block rounded-full border-[1.5px] border-dashed border-[rgba(249,115,22,0.65)]" />
          <span className="absolute inset-[26px] block rounded-full border border-[rgba(248,243,235,0.1)]" />
          <span className="absolute left-1/2 top-1/2 -ml-[5.5px] -mt-[5.5px] block h-[11px] w-[11px] rounded-full bg-bt-orange" />
          <span className="absolute -bottom-1.5 -top-1.5 left-1/2 block w-px bg-[rgba(248,243,235,0.12)]" />
          <span className="absolute -left-1.5 -right-1.5 top-1/2 block h-px bg-[rgba(248,243,235,0.12)]" />
        </div>
        <p className="text-center font-bt-mono text-[9.5px] tracking-[0.1em] text-bt-muted-2">
          {t('app.phone.2')}
        </p>
      </div>

      <div className="flex items-end justify-between gap-2.5">
        <div>
          <p className="text-[14.5px] font-semibold text-bt-bone">J. Ramírez</p>
          <p className="mt-[3px] font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted">
            GT-014 · VISTA HERMOSA
          </p>
        </div>
        <p className="font-bt-mono text-[8.5px] tracking-[0.1em] text-bt-muted-2">{t('app.phone.3')}</p>
      </div>

      <div className="rounded-[2px] bg-bt-orange p-[15px] text-center text-[15px] font-bold text-bt-ink">
        {t('app.phone.4')}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[rgba(248,243,235,0.12)] pt-3">
        <span className="font-bt-mono text-[8.5px] tracking-[0.09em] text-bt-muted">{t('app.phone.5')}</span>
        <span className="font-bt-mono text-[8.5px] tracking-[0.09em] text-bt-bone">{t('app.phone.6')}</span>
      </div>
    </div>
  );
}
