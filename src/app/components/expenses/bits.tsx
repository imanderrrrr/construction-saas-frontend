import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { fmtUSD } from '../projects/helpers';

/**
 * Piezas de la bandeja de gastos (Claude Design «Gastos BuildTrack», 09.2026).
 *
 * Lo que no está aquí es porque ya existe: las cifras de cabecera, el
 * conmutador de vistas, el esqueleto y el fallo de carga se reutilizan de
 * Presupuestos, y las ventanas de `bt/windows`. Aquí viven las cuatro cosas que
 * esta pantalla tiene y ninguna otra: el estado de un gasto, el recibo (o su
 * ausencia), el saldo de la obra a la que le va a restar, y la espera.
 */

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'OBSERVED' | 'REJECTED';

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  // El verde es un estado, nunca un botón: este chip es el único de la pantalla.
  APPROVED: 'border-[#2E7D4F] bg-[#E7F0E9] text-[#2E7D4F]',
  // Naranja porque vuelve al trabajador, no porque sea una alarma.
  OBSERVED: 'border-[#C2410C] bg-[#FBEDE0] text-[#C2410C]',
  // Rojo es lo que no se deshace.
  REJECTED: 'border-[#B3402A] bg-[#F6E3DE] text-[#B3402A]',
  PENDING: 'border-[#DBD0BB] bg-[#F3EEE4] text-[#5A5346]',
};

export function StatusChip({ status }: { status: ExpenseStatus }) {
  const { t } = useTranslation('admin');
  return (
    <span
      className={cn(
        'inline-flex items-center border px-[7px] py-[3px] font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap',
        STATUS_STYLE[status],
      )}
    >
      {t(`expenses.status.${status.toLowerCase()}`)}
    </span>
  );
}

/** «Reenviado»: el gasto ya pasó por tus manos y el trabajador hizo lo pedido. */
export function ResubmittedChip() {
  const { t } = useTranslation('admin');
  return (
    <span className="inline-flex items-center border border-[#C2410C] px-[7px] py-[3px] font-bt-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] whitespace-nowrap">
      {t('expenses.resubmitted')}
    </span>
  );
}

/**
 * El recibo, o su ausencia.
 *
 * «Sin foto» es un chip de BORDE, no de relleno: es una ausencia, no una
 * alarma — y hay gastos legítimos sin ticket, así que aprobar no se bloquea.
 * Antes la tabla ponía botón de recibo en todas las filas y en estas abría un
 * visor que fallaba.
 */
export function ReceiptCell({ url, onOpen, size = 40 }: {
  url: string | null | undefined;
  onOpen: () => void;
  size?: number;
}) {
  const { t } = useTranslation('admin');
  if (!url) {
    return (
      <span
        className="flex items-center justify-center border border-dashed border-[#DBD0BB] bg-[#FBF8F2] font-bt-mono text-[8px] font-semibold uppercase leading-[1.15] tracking-[0.06em] text-[#A69C8D] text-center px-1"
        style={{ width: size, height: size }}
      >
        {t('expenses.receipt.none')}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onOpen(); }}
      title={t('expenses.receipt.view')}
      aria-label={t('expenses.receipt.view')}
      className="border border-[#DBD0BB] bg-[#FBF8F2] hover:border-[#F97316] transition-colors overflow-hidden"
      style={{ width: size, height: size }}
    >
      <ReceiptThumb url={url} />
    </button>
  );
}

/** La miniatura real, pedida con la cookie de sesión (no vale un <img src>). */
function ReceiptThumb({ url }: { url: string }) {
  const src = useAuthedImage(url);
  if (!src) return <span className="block h-full w-full bt-skeleton" />;
  return <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />;
}

/** Descarga la imagen con credenciales y devuelve un blob URL, o null. */
export function useAuthedImage(url: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    let revoke: string | null = null;
    let cancelled = false;
    fetch(url, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(blob => {
        if (cancelled) return;
        revoke = URL.createObjectURL(blob);
        setSrc(revoke);
      })
      .catch(() => { /* la fila no se rompe: queda el esqueleto */ });
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [url]);
  return src;
}

/**
 * El saldo de la obra a la que este gasto le va a restar.
 *
 * Es el dato que decide la aprobación y hasta ahora no estaba en ninguna
 * pantalla de gastos. En rojo cuando ya está en negativo, naranja al límite.
 */
export function BalanceCell({ project, budget }: {
  project: string;
  budget?: { baseCents: number | null; consumedCents: number | null; remainingCents: number | null } | null;
}) {
  const { t } = useTranslation('admin');
  const remaining = budget?.remainingCents ?? null;
  const base = budget?.baseCents ?? null;
  const consumed = budget?.consumedCents ?? null;
  const pct = base && base > 0 && consumed != null ? (consumed / base) * 100 : null;
  const tone = remaining != null && remaining < 0 ? 'red' : pct != null && pct >= 90 ? 'orange' : 'quiet';

  return (
    <div className="min-w-0">
      <div className="text-[13px] text-[#0A0A0A] truncate">{project}</div>
      <Mono
        className={cn(
          'block text-[9.5px] tracking-[0.06em] mt-0.5 truncate',
          tone === 'red' && 'text-[#B3402A] font-semibold',
          tone === 'orange' && 'text-[#C2410C] font-semibold',
          tone === 'quiet' && 'text-[#A69C8D]',
        )}
      >
        {remaining == null
          ? t('expenses.projectNoBudget')
          : `${t('expenses.projectBalance', { amount: fmtUSD(remaining) })}${pct != null ? ` · ${pct.toFixed(1).replace('.', ',')} %` : ''}`}
      </Mono>
    </div>
  );
}

/**
 * Desde cuándo espera. Se cuenta desde el reenvío cuando lo hubo: un gasto
 * corregido no lleva esperando desde que se registró la primera versión.
 */
export function ageInDays(expense: { createdAt: string; resubmittedAt?: string | null }): number {
  const from = new Date(expense.resubmittedAt ?? expense.createdAt).getTime();
  return Math.max(0, Math.floor((Date.now() - from) / 86_400_000));
}

export function AgeCell({ days }: { days: number }) {
  const { t } = useTranslation('admin');
  return (
    <Mono className={cn('text-[10px] tracking-[0.06em]', days >= 5 ? 'text-[#C2410C] font-semibold' : 'text-[#A69C8D]')}>
      {days === 0 ? t('expenses.ageToday') : t('expenses.age', { count: days })}
    </Mono>
  );
}

/** Celda vacía: «—» en mono tenue. Nunca un guion en cursiva, nunca un cero. */
export function Dash() {
  return <Mono className="text-[11px] text-[#A69C8D]">—</Mono>;
}

export function TypeLabel({ type }: { type: string }) {
  const { t } = useTranslation('admin');
  return <span className="text-[13px] text-[#5A5346]">{t(`expenses.type.${type}`, { defaultValue: type })}</span>;
}

/** Iniciales del trabajador, cuadradas y en tinta — nada de círculos de color. */
export function WorkerBadge({ name, note }: { name: string; note?: ReactNode }) {
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="flex-none w-7 h-7 bg-[#0A0A0A] text-[#F5F1E8] font-bt-mono text-[10px] font-semibold flex items-center justify-center">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-[#0A0A0A] truncate">{name}</div>
        {note}
      </div>
    </div>
  );
}
