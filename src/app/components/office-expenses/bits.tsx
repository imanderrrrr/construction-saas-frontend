import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../ui/utils';
import { Mono } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { moneyRound, pct } from '../budgets/bits';
import { FOCUS_RING, TertiaryButton } from '../onboarding/chrome';
import type { OfficeCategorySlice, OfficeExpense } from '../../services/officeExpenses';

/** `$2,247` — las cifras grandes, donde los centavos son ruido. */
export function bigMoney(cents: number): string {
  return moneyRound(cents / 100);
}

/**
 * La celda vacía: **nunca un guion**.
 *
 * «Sin anotar» cuando no hay comprador, «sin comprobante» cuando no hay
 * archivo, «sin notas» cuando no hay nota. Un guion no dice qué falta.
 */
export function Absent({ children }: { children: React.ReactNode }) {
  return <Mono className="text-[9px] tracking-[0.08em] text-[#A69C8D] normal-case">{children}</Mono>;
}

/** `SEPTIEMBRE 2026` — el mes escrito, que es la unidad de esta pantalla. */
export function monthTitle(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, 1))
      .toLocaleDateString(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return month; }
}

/** `AGOSTO` — el nombre suelto, para los botones de al lado. */
export function monthName(month: string, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(lang, { month: 'long', timeZone: 'UTC' });
  } catch { return month; }
}

/** `11 SEP` — la fecha de compra en la fila. */
export function shortDate(iso: string, lang: string): string {
  try {
    return new Date(`${iso}T12:00:00Z`)
      .toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .replace(/\./g, '')
      .toUpperCase();
  } catch { return iso; }
}

/**
 * La navegación por mes.
 *
 * Sustituye a dos campos de fecha vacíos: lo que se paga todos los meses se
 * mira mes a mes. El mes siguiente se deshabilita cuando ya es el futuro — no
 * hay gastos que ver ahí y ofrecerlo invita a creer que sí.
 */
export function MonthNav({ month, lang, isCurrent, onShift, onFreeRange }: {
  month: string;
  lang: string;
  isCurrent: boolean;
  onShift: (delta: number) => void;
  onFreeRange: () => void;
}) {
  const { t } = useTranslation('admin');
  const prev = shiftLabel(month, -1, lang);
  const next = shiftLabel(month, 1, lang);
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Step onClick={() => onShift(-1)} label={prev} side="prev" />
      <div className="text-center min-w-[180px]">
        <span className="block font-bt-display font-extrabold uppercase text-[22px] leading-none text-[#0A0A0A]">
          {monthTitle(month, lang)}
        </span>
        {isCurrent && (
          <Mono className="block text-[9px] tracking-[0.08em] text-[#8A8175] mt-1">
            {t('officeExpenses.month.current')}
          </Mono>
        )}
      </div>
      <Step onClick={() => onShift(1)} label={next} side="next" disabled={isCurrent} />
      <TertiaryButton onClick={onFreeRange}>{t('officeExpenses.month.freeRange')}</TertiaryButton>
    </div>
  );
}

function shiftLabel(month: string, delta: number, lang: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return monthName(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, lang);
}

function Step({ onClick, label, side, disabled = false }: {
  onClick: () => void;
  label: string;
  side: 'prev' | 'next';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-2.5 py-2 border border-[#DBD0BB] bg-[#FAF7F0]',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'text-[#5A5346] hover:border-[#F97316] hover:text-[#C2410C]',
        FOCUS_RING,
      )}
    >
      {side === 'prev' && <ChevronLeft className="w-3 h-3" strokeWidth={2.4} aria-hidden="true" />}
      {label}
      {side === 'next' && <ChevronRight className="w-3 h-3" strokeWidth={2.4} aria-hidden="true" />}
    </button>
  );
}

/**
 * En qué se fue el mes.
 *
 * Seis barras como máximo, ordenadas por monto; la séptima y siguientes se
 * suman en «otras N categorías». Con una lista libre puede haber veinte, y una
 * barra por cada una no contesta nada. El color sale de una escala fija **por
 * posición**, así que crear una categoría no inventa un tono.
 */
const SCALE = ['#0A0A0A', '#F97316', '#5A5346', '#8A8175', '#B4A992', '#DBD0BB'];
const MAX_BARS = 6;

export function CategoryBars({ slices, totalCents, lang, onOpenAll }: {
  slices: OfficeCategorySlice[];
  totalCents: number;
  lang: string;
  onOpenAll?: () => void;
}) {
  const { t } = useTranslation('admin');
  if (slices.length === 0 || totalCents === 0) return null;

  const head = slices.slice(0, MAX_BARS);
  const tail = slices.slice(MAX_BARS);
  const tailCents = tail.reduce((s, c) => s + c.totalCents, 0);
  const only = slices.length === 1;

  return (
    <div className="px-[18px] pb-3.5">
      <div className="flex h-4 w-full overflow-hidden border border-[#E7E1D5]">
        {head.map((c, i) => (
          <div
            key={c.categoryId ?? `none-${i}`}
            style={{ width: `${(c.totalCents / totalCents) * 100}%`, background: SCALE[i] }}
            title={c.categoryName ?? undefined}
          />
        ))}
        {tailCents > 0 && (
          <div
            style={{
              width: `${(tailCents / totalCents) * 100}%`,
              // La trama de arena es SIEMPRE «otras N»: se reconoce sin leyenda
              // y sobrevive a una fotocopia en blanco y negro.
              backgroundImage: 'repeating-linear-gradient(135deg, #DBD0BB 0 3px, #F3EEE4 3px 7px)',
            }}
          />
        )}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-[7px] sm:grid-cols-2">
        {head.map((c, i) => (
          <li key={c.categoryId ?? `none-${i}`} className="flex items-baseline gap-2.5">
            <span className="w-2.5 h-2.5 flex-shrink-0 mt-[3px]" style={{ background: SCALE[i] }} aria-hidden="true" />
            <span className="text-[12.5px] text-[#0A0A0A] truncate flex-1">
              {c.categoryName ?? t('officeExpenses.byCategory.uncategorised')}
            </span>
            <Amount>{bigMoney(c.totalCents)}</Amount>
            {!only && (
              <Mono className="text-[10px] text-[#8A8175] tabular-nums w-[44px] text-right">
                {pct((c.totalCents / totalCents) * 100, lang)} %
              </Mono>
            )}
          </li>
        ))}
        {tailCents > 0 && (
          <li className="flex items-baseline gap-2.5">
            <span
              className="w-2.5 h-2.5 flex-shrink-0 mt-[3px]"
              style={{ backgroundImage: 'repeating-linear-gradient(135deg, #DBD0BB 0 2px, #F3EEE4 2px 5px)' }}
              aria-hidden="true"
            />
            <span className="text-[12.5px] text-[#5A5346] truncate flex-1">
              {t('officeExpenses.byCategory.others', { count: tail.length })}
            </span>
            <Amount>{bigMoney(tailCents)}</Amount>
            {onOpenAll && <TertiaryButton onClick={onOpenAll}>{t('officeExpenses.byCategory.seeAll')}</TertiaryButton>}
          </li>
        )}
      </ul>
    </div>
  );
}

/** El comprobante en la fila: qué es y cómo verlo, o que no hay. */
export function ReceiptCell({ expense, onView }: { expense: OfficeExpense; onView: () => void }) {
  const { t } = useTranslation('admin');
  if (!expense.receipt) return <Absent>{t('officeExpenses.receipt.none')}</Absent>;
  const isPdf = expense.receipt.contentType === 'application/pdf';
  const Icon = isPdf ? FileText : ImageIcon;
  return (
    <button
      type="button"
      onClick={onView}
      className={cn('flex items-center gap-1.5 text-left group', FOCUS_RING)}
      title={expense.receipt.filename ?? undefined}
    >
      <Icon className="w-3.5 h-3.5 text-[#5A5346] flex-shrink-0" strokeWidth={2} aria-hidden="true" />
      <Mono className="text-[9px] tracking-[0.08em] text-[#5A5346] group-hover:text-[#C2410C]">
        {isPdf ? t('officeExpenses.receipt.pdf') : t('officeExpenses.receipt.photo')}
      </Mono>
    </button>
  );
}

/** «Mensual»: el marcador de un gasto que entra en los fijos. */
export function RecurringChip() {
  const { t } = useTranslation('admin');
  return (
    <Mono className="text-[8.5px] tracking-[0.1em] border border-[#DBD0BB] bg-[#F3EEE4] text-[#5A5346] px-1.5 py-[2px]">
      {t('officeExpenses.recurring.flag')}
    </Mono>
  );
}
