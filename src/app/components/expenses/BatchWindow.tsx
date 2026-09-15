import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BtModal } from '../bt/windows';
import { PrimaryButton, SecondaryButton } from '../onboarding/chrome';
import { Mono, PaperNote } from '../projects/bt';
import { fmtUSD } from '../projects/helpers';
import { cn } from '../ui/utils';
import {
  getAdminSummary, type BatchApproveResponse, type ExpenseResponse, type ExpenseSummaryResponse,
} from '../../services/expenses';
import type { Filters } from './useExpenseInbox';

/**
 * La aprobación en bloque, honesta.
 *
 * Antes: un botón verde que decía «Aprobar todos los pendientes» con una
 * burbuja que contaba **la página**, mientras el servidor aprobaba **todo el
 * inquilino**; el resultado era un toast de cuatro segundos con «N aprobados»
 * y los que no entraron se quedaban en la cola sin explicación.
 *
 * Ahora: antes de que pase, de qué obras sale el dinero y cuál queda en rojo;
 * y qué queda fuera del filtro, escrito. Después, una ventana que se queda
 * hasta que se cierra, porque trae algo que no se puede perder — qué no entró
 * y por qué. El servidor siempre devolvió `skipped[]`; faltaba leerlo.
 */

interface ProjectSlice {
  projectId: number;
  name: string;
  count: number;
  cents: number;
  /** El saldo que le queda a la obra si el lote entra entero. */
  after: number | null;
}

export function BatchWindow({ pending, filters, filterChips, busy, error, result, onClose, onConfirm }: {
  pending: ExpenseResponse[];
  filters: Filters;
  filterChips: string[];
  busy: boolean;
  error: string | null;
  result: BatchApproveResponse | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const [understood, setUnderstood] = useState(false);
  const [company, setCompany] = useState<ExpenseSummaryResponse | null>(null);

  // Cuántos pendientes tiene la empresa entera, para poder decir cuántos deja
  // fuera este filtro. Una llamada, y solo mientras la ventana está abierta.
  useEffect(() => {
    let cancelled = false;
    getAdminSummary().then(s => { if (!cancelled) setCompany(s); }).catch(() => { /* la ventana funciona sin este dato */ });
    return () => { cancelled = true; };
  }, []);

  const slices = useMemo<ProjectSlice[]>(() => {
    const byProject = new Map<number, ProjectSlice>();
    for (const e of pending) {
      const slice = byProject.get(e.projectId) ?? {
        projectId: e.projectId,
        name: e.projectName,
        count: 0,
        cents: 0,
        after: e.projectBudget?.remainingCents ?? null,
      };
      slice.count += 1;
      slice.cents += e.amountCents;
      if (slice.after != null) slice.after -= e.amountCents;
      byProject.set(e.projectId, slice);
    }
    return [...byProject.values()].sort((a, b) => b.cents - a.cents);
  }, [pending]);

  const totalCents = pending.reduce((s, e) => s + e.amountCents, 0);
  const inRed = slices.filter(s => s.after != null && s.after < 0);
  const rest = company ? Math.max(0, company.pendingCount - pending.length) : 0;
  const canConfirm = (inRed.length === 0 || understood) && !busy && pending.length > 0;

  if (result) {
    const approvedCents = totalCents - (result.skipped ?? [])
      .map(s => pending.find(p => p.id === s.expenseId)?.amountCents ?? 0)
      .reduce((a, b) => a + b, 0);
    return (
      <BtModal
        open
        onOpenChange={o => { if (!o) onClose(); }}
        width={560}
        kicker={t('expenses.batch.resultOf', { count: pending.length })}
        title={t('expenses.batch.resultTitle')}
        footer={<div className="flex justify-end"><PrimaryButton onClick={onClose}>{t('expenses.batch.close')}</PrimaryButton></div>}
      >
        <div className="flex items-baseline gap-3 border-b border-[#F0EBE1] pb-3 mb-3.5">
          <span className="font-bt-display font-extrabold text-[32px] leading-none tabular-nums text-[#0A0A0A]">
            {result.approvedCount}
          </span>
          <Mono className="text-[10.5px] tracking-[0.1em] text-[#5A5346]">
            {t('expenses.batch.result', { count: result.approvedCount, amount: fmtUSD(approvedCents) })}
          </Mono>
        </div>

        {(result.skipped ?? []).length > 0 ? (
          <div className="border border-[#C2410C] bg-[#FBEDE0] p-3.5">
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#C2410C]">
              {t('expenses.batch.skipped', { count: result.skipped!.length })}
            </Mono>
            <ul className="mt-2.5 space-y-2">
              {result.skipped!.map(s => {
                const e = pending.find(p => p.id === s.expenseId);
                return (
                  <li key={s.expenseId} className="text-[12.5px] leading-[1.5] text-[#0A0A0A]">
                    <span className="font-semibold">
                      {e ? `${e.workerName ?? e.workerUsername} · ${fmtUSD(e.amountCents)}` : `#${s.expenseId}`}
                    </span>
                    <span className="block text-[#5A5346]">
                      {s.code === 'PROJECT_CLOSED'
                        ? t('expenses.batch.skipped.projectClosed')
                        : t('expenses.batch.skipped.notPending')}
                    </span>
                    <Mono className="block text-[9px] tracking-[0.1em] text-[#A69C8D] mt-0.5">{s.code}</Mono>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-[12.5px] leading-[1.55] text-[#5A5346]">{t('expenses.batch.entered')}.</p>
        )}
      </BtModal>
    );
  }

  return (
    <BtModal
      open
      onOpenChange={o => { if (!o) onClose(); }}
      width={560}
      dismissible={false}
      kicker={t('expenses.batch.subtitle')}
      title={t('expenses.batch.title')}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <SecondaryButton onClick={onClose} disabled={busy}>{t('common:buttons.cancel')}</SecondaryButton>
          <PrimaryButton onClick={onConfirm} disabled={!canConfirm}>
            {t('expenses.batch.confirm', { count: pending.length })}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex items-baseline gap-3 flex-wrap border-b border-[#F0EBE1] pb-3 mb-3.5">
        <span className="font-bt-display font-extrabold text-[32px] leading-none tabular-nums text-[#0A0A0A]">
          {fmtUSD(totalCents)}
        </span>
        <Mono className="text-[10.5px] tracking-[0.1em] text-[#5A5346]">
          {t('expenses.summary.scope', { count: pending.length })} · {t('expenses.batch.scope')}
        </Mono>
      </div>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <Mono className="text-[9px] tracking-[0.12em] text-[#8A8175]">{t('expenses.batch.filterLabel')}</Mono>
          {filterChips.map(chip => (
            <Mono key={chip} className="text-[9px] tracking-[0.08em] text-[#5A5346] border border-[#DBD0BB] px-1.5 py-0.5">{chip}</Mono>
          ))}
        </div>
      )}

      <Mono className="block text-[9.5px] tracking-[0.12em] text-[#8A8175] mb-2">{t('expenses.batch.projects')}</Mono>
      <ul className="border border-[#E7E1D5] divide-y divide-[#F0EBE1] mb-3.5">
        {slices.map(s => {
          const red = s.after != null && s.after < 0;
          return (
            <li key={s.projectId} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="text-[13px] text-[#0A0A0A] truncate">{s.name}</span>
              <span className="flex items-baseline gap-3 flex-none">
                <Mono className="text-[10px] tracking-[0.06em] text-[#A69C8D]">{s.count}</Mono>
                <Mono className="text-[12px] tabular-nums text-[#0A0A0A] normal-case">{fmtUSD(s.cents)}</Mono>
                <Mono className={cn('text-[10px] tracking-[0.04em] normal-case', red ? 'text-[#B3402A] font-semibold' : 'text-[#A69C8D]')}>
                  {s.after != null ? t('expenses.batch.projectAfter', { amount: fmtUSD(s.after) }) : '—'}
                </Mono>
              </span>
            </li>
          );
        })}
      </ul>

      {inRed.length > 0 && (
        <div className="border border-[#B3402A] bg-[#F6E3DE] p-3.5 mb-3.5">
          <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#B3402A]">
            {t('expenses.batch.overdraft', { count: inRed.length })}
          </Mono>
          <p className="text-[12.5px] leading-[1.55] text-[#0A0A0A] mt-1.5">
            {t('expenses.batch.overdraftNote', {
              project: inRed[0].name,
              amount: fmtUSD(Math.abs(inRed[0].after!)),
            })}
          </p>
          <label className="flex items-start gap-2.5 cursor-pointer mt-2.5">
            <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 accent-[#0A0A0A]" />
            <span className="text-[12.5px] leading-[1.5] text-[#0A0A0A]">{t('expenses.batch.overdraftConfirm')}</span>
          </label>
        </div>
      )}

      {/* Lo que este filtro deja fuera, escrito: el lote ya no toca la empresa
          entera, y quien pulsa tiene derecho a saber qué no va a pasar. */}
      {company && rest > 0 && (
        <PaperNote tone="none">
          <span className="text-[12.5px] leading-[1.55] text-[#5A5346]">
            {t('expenses.batch.outOfScope', {
              total: company.pendingCount,
              amount: fmtUSD(company.pendingCents ?? 0),
              rest,
            })}{' '}
            {t('expenses.batch.outOfScopeHint')}
          </span>
        </PaperNote>
      )}

      {error && (
        <PaperNote tone="red" className="mt-3.5">
          <span className="text-[12.5px] text-[#B3402A]">{error}</span>
        </PaperNote>
      )}
    </BtModal>
  );
}
