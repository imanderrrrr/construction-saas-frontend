import { useTranslation } from 'react-i18next';
import { Apple, Camera, HardHat, Smartphone, Timer, WifiOff } from 'lucide-react';

/**
 * "App móvil" band for the public landing. Informational only: the Android
 * app is available (private distribution — NO public download link / store
 * badge), the iPhone build is coming soon. Deliberately not a store CTA.
 */
export function AppSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="app" className="scroll-mt-20 border-t border-[#D4D4D8] bg-[#F4F4F5] py-16 sm:py-24">
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F97316]">{t('app.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t('app.title')}</h2>
          <p className="mt-5 leading-relaxed text-[#71717A]">{t('app.body')}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Android — available (private distribution, no public store link) */}
            <div className="inline-flex h-14 items-center gap-3 rounded-xl border border-[#D4D4D8] bg-white px-5">
              <Smartphone className="h-6 w-6 text-[#0A0A0A]" />
              <span className="flex flex-col text-left leading-tight">
                <span className="text-[11px] text-[#71717A]">{t('app.android')}</span>
                <span className="inline-flex items-center gap-1.5 text-[17px] font-bold text-[#16A34A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                  {t('app.androidStatus')}
                </span>
              </span>
            </div>

            {/* iOS — coming soon */}
            <div
              aria-disabled="true"
              className="inline-flex h-14 select-none items-center gap-3 rounded-xl border border-[#D4D4D8] bg-white px-5 text-[#A1A1AA]"
            >
              <Apple className="h-6 w-6" />
              <span className="flex flex-col text-left leading-tight">
                <span className="text-[11px]">{t('app.ios')}</span>
                <span className="text-[17px] font-bold">{t('app.soon')}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Phone mockup — same visual language as the hero ProductWindow */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-[250px] rounded-[2rem] bg-[#0A0A0A] p-2 shadow-[0_24px_60px_rgba(10,10,10,0.25)]">
            <div className="overflow-hidden rounded-[1.55rem] bg-white">
              <div className="bg-[#0A0A0A] px-4 pb-4 pt-2.5 text-white">
                <div className="mx-auto mb-3 h-1 w-14 rounded-full bg-white/25" />
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F97316]">
                    <HardHat className="h-3.5 w-3.5 text-white" />
                  </span>
                  <span className="text-sm font-bold">
                    Build<span className="text-[#F97316]">Track</span>
                  </span>
                </div>
                <p className="mt-3 text-[11px] tracking-wide text-white/50">{t('mock.label')}</p>
                <p className="text-[15px] font-bold">{t('mock.projectName')}</p>
              </div>
              <div className="space-y-3 p-4">
                <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] text-sm font-semibold text-white">
                  <Timer className="h-4 w-4" />
                  {t('app.mock.clockIn')}
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-[#F4F4F5] p-3">
                    <p className="text-[11px] text-[#71717A]">{t('app.mock.hoursToday')}</p>
                    <p className="text-lg font-bold text-[#0A0A0A]">6.5 h</p>
                  </div>
                  <div className="rounded-lg bg-[#F4F4F5] p-3">
                    <p className="text-[11px] text-[#71717A]">{t('app.mock.evidence')}</p>
                    <p className="flex items-center gap-1.5 text-lg font-bold text-[#0A0A0A]">
                      <Camera className="h-4 w-4 text-[#F97316]" />
                      12
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-[#F4F4F5] px-3 py-2.5">
                  <WifiOff className="h-4 w-4 shrink-0 text-[#F97316]" />
                  <span className="text-xs font-medium text-[#0A0A0A]">{t('app.mock.offline')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
