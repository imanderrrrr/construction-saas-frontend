import type { ComponentType } from 'react';
import {
  HardHat,
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Timer,
  Package,
  Wallet,
  Lock,
} from 'lucide-react';

type IconType = ComponentType<{ className?: string }>;

const NAV: { icon: IconType; label: string; active?: boolean }[] = [
  { icon: LayoutDashboard, label: 'Inicio' },
  { icon: FolderKanban, label: 'Proyectos' },
  { icon: ClipboardList, label: 'Bitácora de obra', active: true },
  { icon: Timer, label: 'Tiempo' },
  { icon: Package, label: 'Almacén' },
  { icon: Wallet, label: 'Finanzas' },
];

const STATS = [
  { label: 'Avance de obra', value: '68%', pct: 68, color: '#F97316' },
  { label: 'Presupuesto', value: '62%', pct: 62, color: '#0A0A0A' },
  { label: 'Asistencia hoy', value: '94%', pct: 94, color: '#16A34A' },
];

const BARS = [42, 64, 54, 82, 48, 72, 58];

/** Static product preview shown in the hero — a BuildTrack app window. */
export function ProductWindow() {
  return (
    <div className="w-full max-w-[1000px] overflow-hidden rounded-2xl border border-[#D4D4D8] bg-white shadow-[0_26px_64px_rgba(10,10,10,0.16)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-[#D4D4D8] bg-[#F4F4F5] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex flex-1 justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#D4D4D8] bg-white px-11 py-1">
            <Lock className="h-3 w-3 text-[#71717A]" />
            <span className="text-xs text-[#71717A]">app.buildtrack.com</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-[212px] shrink-0 space-y-0.5 bg-[#0A0A0A] p-4">
          <div className="mb-3 flex items-center gap-2 px-1 py-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F97316]">
              <HardHat className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="text-[15px] font-bold text-white">BuildTrack</span>
          </div>
          {NAV.map((n) => (
            <div
              key={n.label}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 ${
                n.active ? 'bg-[#F97316]/15' : ''
              }`}
            >
              <n.icon className={`h-[17px] w-[17px] ${n.active ? 'text-[#F97316]' : 'text-[#A1A1AA]'}`} />
              <span
                className={`text-sm ${
                  n.active ? 'font-semibold text-[#F97316]' : 'font-medium text-[#A1A1AA]'
                }`}
              >
                {n.label}
              </span>
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="flex-1 space-y-[18px] p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-wide text-[#F97316]">BITÁCORA · HOY</p>
              <p className="text-[22px] font-bold text-[#0A0A0A]">Torre Vista del Mar</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F4F5] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
              <span className="text-xs font-semibold text-[#0A0A0A]">Etapa 3 · 47 obreros</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="space-y-2.5 rounded-md bg-[#F4F4F5] p-3.5">
                <p className="text-xs text-[#71717A]">{s.label}</p>
                <p className="text-[23px] font-bold text-[#0A0A0A]">{s.value}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#D4D4D8]">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-md bg-[#F4F4F5] p-4">
            <p className="text-[13px] font-semibold text-[#0A0A0A]">Horas registradas · esta semana</p>
            <div className="flex h-[88px] items-end gap-3">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${h}%`, background: i === 3 ? '#F97316' : 'rgba(249,115,22,0.25)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
