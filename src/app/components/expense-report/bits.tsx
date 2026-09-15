import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { moneyRound, pct } from '../budgets/bits';
import { FOCUS_RING } from '../onboarding/chrome';
import type { TrendMonth, TypeBreakdown } from '../../services/expenses';

/** Los siete tipos del enum, en el orden en que los nombra el panel. */
export const EXPENSE_TYPES = [
  'MATERIALS', 'FUEL', 'TOOLS', 'PER_DIEM', 'MINOR_PURCHASES', 'TRANSPORTATION', 'OTHER',
] as const;

/** `$1.505.000` — las cifras grandes, donde los centavos son ruido. */
export function bigMoney(cents: number): string {
  return moneyRound(cents / 100);
}

/**
 * Una celda sin cifra lleva un guion en mono tenue, nunca un cero.
 *
 * Un `$0,00` en la columna «rechazado» se lee como una cifra medida; el guion
 * dice lo que pasa de verdad, que es que no hubo nada.
 */
export function Dash() {
  return <Mono className="text-[11px] text-[#A69C8D]">—</Mono>;
}

/**
 * Cuánto del presupuesto de costos se llevó el gasto de este rango.
 *
 * Sustituye a «Total neto», que imprimía otra vez `row.approved`: la misma
 * cifra en dos columnas, en las seis filas. Una obra **sin** presupuesto
 * configurado lo dice con palabras: un 0 % con su barra vacía se lee como una
 * obra que no ha gastado nada de lo planificado, y es una obra de la que no
 * sabemos qué se planificó.
 */
export function ExecutionBar({ approvedCents, budgetCents, lang }: {
  approvedCents: number;
  budgetCents: number | null;
  lang: string;
}) {
  const { t } = useTranslation('admin');
  if (budgetCents == null || budgetCents <= 0) {
    return (
      <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] text-right block">
        {t('expenseReport.noBudget')}
      </Mono>
    );
  }
  const share = (approvedCents / budgetCents) * 100;
  const over = share > 100;
  return (
    <div className="text-right">
      <Mono className={cn('text-[11px] tabular-nums normal-case', over ? 'text-[#B3402A] font-semibold' : 'text-[#5A5346]')}>
        {t('expenseReport.ofBudget', { percent: `${pct(share, lang)} %`, budget: bigMoney(budgetCents) })}
      </Mono>
      <div className="h-[7px] mt-[5px] flex bg-[#F3EEE4] border border-[#E7E1D5]">
        <div
          className={cn('h-full', over ? 'bg-[#B3402A]' : 'bg-[#F97316]')}
          style={{ width: `${Math.min(Math.max(share, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Un monto que todavía no es gasto, y el puente a la bandeja.
 *
 * Eran dos pantallas que no se hablaban: para saber qué eran esos $2.410
 * pendientes había que ir a Gastos y volver a poner la obra y el estado a mano.
 */
export function StateCell({ cents, count, onOpen, tone = 'ink' }: {
  cents: number;
  count: number;
  onOpen?: () => void;
  tone?: 'ink' | 'orange';
}) {
  const { t } = useTranslation('admin');
  if (cents === 0 && count === 0) return <div className="text-right"><Dash /></div>;
  const amount = <Amount tone={tone === 'orange' ? 'orange' : 'ink'}>{bigMoney(cents)}</Amount>;
  return (
    <div className="text-right">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn('block w-full text-right hover:underline decoration-[#F97316] underline-offset-2', FOCUS_RING)}
          title={t('expenseReport.openInbox')}
        >
          {amount}
        </button>
      ) : amount}
      <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-[2px]">
        {t('expenseReport.state.count', { count })}
      </Mono>
    </div>
  );
}

/**
 * En qué se fue el dinero, de toda la empresa.
 *
 * El reparto por tipo existía solo dentro de cada obra, así que la pregunta
 * que da nombre a la pantalla se contestaba abriendo las cinco filas y sumando
 * a mano.
 */
export function CategoryList({ categories, totalCents, lang, compact = false }: {
  categories: TypeBreakdown[];
  totalCents: number;
  lang: string;
  compact?: boolean;
}) {
  const { t } = useTranslation('admin');
  if (categories.length === 0) {
    return (
      <p className="text-[12.5px] text-[#A69C8D] px-[18px] py-3">{t('expenseReport.byCategory.empty')}</p>
    );
  }
  const missing = EXPENSE_TYPES.filter(k => !categories.some(c => c.type === k));
  return (
    <div className="px-[18px] pb-3">
      <ul className="space-y-[9px]">
        {categories.map(c => {
          const share = totalCents > 0 ? (c.totalCents / totalCents) * 100 : 0;
          return (
            <li key={c.type}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-[#0A0A0A] truncate">{t(`expenses.type.${c.type}`, { defaultValue: c.type })}</span>
                <div className="flex items-baseline gap-2.5 flex-shrink-0">
                  <Amount>{bigMoney(c.totalCents)}</Amount>
                  <Mono className="text-[10px] text-[#8A8175] tabular-nums w-[46px] text-right">{pct(share, lang)} %</Mono>
                </div>
              </div>
              <div className="h-[6px] mt-[4px] flex bg-[#F3EEE4]">
                <div className="h-full bg-[#0A0A0A]" style={{ width: `${Math.min(share, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {!compact && missing.length > 0 && (
        <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-3">
          {t('expenseReport.byCategory.missing', {
            types: missing.map(k => t(`expenses.type.${k}`, { defaultValue: k })).join(', '),
          })}
        </Mono>
      )}
    </div>
  );
}

/** `SEPT` — la etiqueta bajo una barra de la serie. */
export function monthLabel(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleDateString(lang, { month: 'short', timeZone: 'UTC' })
      .replace('.', '')
      .toUpperCase();
  } catch { return month; }
}

/** `septiembre` — el mes nombrado dentro de una frase. */
export function monthName(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang, { month: 'long', timeZone: 'UTC' });
  } catch { return month; }
}

/**
 * Desde cuándo sube.
 *
 * Un informe de gastos sin serie temporal no deja ver el rubro que se disparó.
 * El mes en curso va rayado y dice por cuántos días va: una barra a medias que
 * no avisa de que lo es se lee como una caída.
 */
export function TrendStrip({ months, lang }: { months: TrendMonth[]; lang: string }) {
  const { t } = useTranslation('admin');
  if (months.length === 0) return null;
  const max = Math.max(...months.map(m => m.approvedCents), 1);
  return (
    <div className="px-[18px] pb-3">
      <div className="flex items-end gap-2 h-[92px]">
        {months.map(m => (
          <div key={m.month} className="flex-1 flex flex-col justify-end items-stretch gap-1.5 min-w-0">
            <Mono className="block text-[9.5px] tabular-nums text-[#0A0A0A] text-center truncate">
              {bigMoney(m.approvedCents)}
            </Mono>
            <div
              className={cn('w-full', m.partial ? 'bg-[#F3EEE4] border border-[#F97316]' : 'bg-[#0A0A0A]')}
              style={{
                height: `${Math.max((m.approvedCents / max) * 52, 2)}px`,
                // La rayada sobrevive a una fotocopia: el color no puede ser el
                // único que distinga un mes a medias de uno cerrado.
                ...(m.partial
                  ? { backgroundImage: 'repeating-linear-gradient(45deg, #F97316 0 2px, transparent 2px 5px)' }
                  : {}),
              }}
              aria-hidden="true"
            />
            <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175] text-center">
              {monthLabel(m.month, lang)}
            </Mono>
          </div>
        ))}
      </div>
      {months.some(m => m.partial) && (
        <Mono className="block text-[9px] tracking-[0.08em] text-[#A69C8D] mt-2.5">
          {t('expenseReport.trend.partial', {
            month: monthName(months[months.length - 1].month, lang),
            days: months[months.length - 1].daysCounted,
            total: months[months.length - 1].daysInMonth,
          })}
        </Mono>
      )}
    </div>
  );
}

/** El encabezado de una tabla: mono, mayúsculas, alineado como su columna. */
export function Head({ children, right = false, className }: {
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <Mono className={cn('text-[9px] tracking-[0.1em] text-[#8A8175]', right && 'text-right', className)}>
      {children}
    </Mono>
  );
}
