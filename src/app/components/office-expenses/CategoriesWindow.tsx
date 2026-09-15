import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';
import { BtModal } from '../bt/windows';
import { Mono, INPUT, PaperNote } from '../projects/bt';
import { Amount } from '../budgets/ui';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import type { OfficeCategory } from '../../services/officeExpenses';
import { bigMoney } from './bits';

const NAME_MAX = 40;

/**
 * Las categorías las administra la empresa.
 *
 * Tres reglas que la ventana tiene que dejar claras al pulsar, no en un
 * manual:
 *
 * - **renombrar cambia el nombre en todos los gastos pasados** — la categoría
 *   es una fila, no una copia por gasto — pero no toca los informes ya
 *   exportados, que son archivos;
 * - una categoría **con gastos no se puede borrar**: el botón queda apagado y
 *   dice por qué. Se archiva, y el historial no se toca;
 * - una categoría **sin ningún gasto** se borra sin más ventana: nada depende
 *   de ella.
 */
export function CategoriesWindow({
  open, categories, busy, error, onClose, onCreate, onRename, onArchive, onRestore, onDelete,
}: {
  open: boolean;
  categories: OfficeCategory[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onArchive: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');
  const [draft, setDraft] = useState('');
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmArchive, setConfirmArchive] = useState<OfficeCategory | null>(null);

  const active = categories.filter(c => !c.archived).sort((a, b) => b.yearToDateCents - a.yearToDateCents);
  const archived = categories.filter(c => c.archived);
  const tooLong = draft.trim().length > NAME_MAX;
  const duplicate = categories.some(c => c.name.toLowerCase() === draft.trim().toLowerCase());

  return (
    <BtModal
      open={open}
      onOpenChange={o => { if (!o && !busy) onClose(); }}
      width={560}
      closeDisabled={busy}
      kicker={t('officeExpenses.title')}
      title={t('officeExpenses.categories.windowTitle')}
      footer={
        <div className="flex items-center justify-end">
          <SecondaryButton onClick={onClose} disabled={busy}>{t('officeExpenses.categories.done')}</SecondaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <PaperNote>{t('officeExpenses.categories.renameWarning')}</PaperNote>

        {error && (
          <div className="bg-white border border-[#E7E1D5] border-l-[3px] border-l-[#B3402A] px-3.5 py-2.5">
            <p className="text-[12.5px] text-[#B3402A]">{error}</p>
          </div>
        )}

        <div className="border border-[#E7E1D5]">
          <div className="grid grid-cols-[1fr_54px_92px_auto] gap-2.5 px-3 py-2 bg-[#FBF8F2] border-b border-[#E7E1D5]">
            <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175]">{t('officeExpenses.categories.column')}</Mono>
            <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175] text-right">{t('officeExpenses.categories.count')}</Mono>
            <Mono className="text-[9px] tracking-[0.1em] text-[#8A8175] text-right">{t('officeExpenses.categories.year')}</Mono>
            <span />
          </div>

          {active.map(c => (
            <div key={c.id} className="border-b border-[#F0EBE1] last:border-b-0 px-3 py-2.5">
              {renaming === c.id ? (
                <div className="flex items-end gap-2">
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    className={INPUT}
                    maxLength={NAME_MAX}
                    aria-label={t('officeExpenses.categories.rename')}
                  />
                  <PrimaryButton
                    onClick={() => { onRename(c.id, renameDraft.trim()); setRenaming(null); }}
                    disabled={busy || renameDraft.trim() === '' || renameDraft.trim().length > NAME_MAX}
                  >
                    {t('officeExpenses.categories.saveName')}
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setRenaming(null)}>{t('officeExpenses.form.cancel')}</SecondaryButton>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_54px_92px_auto] gap-2.5 items-baseline">
                  <div className="min-w-0">
                    <span className="text-[13px] text-[#0A0A0A] truncate">{c.name}</span>
                    <Mono className="block text-[8.5px] tracking-[0.1em] text-[#A69C8D] mt-[2px]">
                      {c.seeded ? t('officeExpenses.categories.seeded') : t('officeExpenses.categories.own')}
                    </Mono>
                  </div>
                  <Mono className="text-[11px] text-[#5A5346] tabular-nums text-right">{c.expenseCount}</Mono>
                  <Amount>{bigMoney(c.yearToDateCents)}</Amount>
                  <div className="flex items-center gap-2 justify-end">
                    <TertiaryButton onClick={() => { setRenaming(c.id); setRenameDraft(c.name); }}>
                      {t('officeExpenses.categories.rename')}
                    </TertiaryButton>
                    <TertiaryButton onClick={() => setConfirmArchive(c)}>
                      {t('officeExpenses.categories.archive')}
                    </TertiaryButton>
                    {c.expenseCount === 0 ? (
                      <button
                        type="button"
                        onClick={() => onDelete(c.id)}
                        disabled={busy}
                        className={cn(
                          'font-bt-mono text-[9.5px] uppercase tracking-[0.1em] text-[#B3402A] underline underline-offset-2',
                          FOCUS_RING,
                        )}
                      >
                        {t('officeExpenses.categories.delete')}
                      </button>
                    ) : (
                      <Mono
                        className="text-[9px] tracking-[0.08em] text-[#A69C8D] cursor-not-allowed"
                        // El botón apagado explica por qué lo está: borrarla
                        // dejaría sin nombre a los meses en que se usó.
                        {...{ title: t('officeExpenses.categories.cannotDelete', { count: c.expenseCount }) }}
                      >
                        {t('officeExpenses.categories.delete')}
                      </Mono>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {archived.length > 0 && (
          <div>
            <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] mb-1.5">
              {t('officeExpenses.categories.archivedGroup', { count: archived.length })}
            </Mono>
            <div className="border border-[#E7E1D5]">
              {archived.map(c => (
                <div key={c.id} className="flex items-baseline justify-between gap-3 px-3 py-2.5 border-b border-[#F0EBE1] last:border-b-0">
                  <span className="text-[12.5px] text-[#5A5346] truncate">{c.name}</span>
                  <Mono className="text-[10px] text-[#A69C8D] tabular-nums flex-shrink-0">
                    {t('officeExpenses.categories.uses', { count: c.expenseCount })}
                  </Mono>
                  <TertiaryButton onClick={() => onRestore(c.id)}>{t('officeExpenses.categories.restore')}</TertiaryButton>
                </div>
              ))}
            </div>
            <p className="text-[11.5px] leading-[1.5] text-[#A69C8D] mt-2">
              {t('officeExpenses.categories.archivedHint')}
            </p>
          </div>
        )}

        <div className="border-t border-[#E7E1D5] pt-3.5">
          <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">
            {t('officeExpenses.categories.newTitle')}
          </Mono>
          <div className="mt-1.5 flex items-end gap-2">
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className={INPUT}
              placeholder={t('officeExpenses.categories.newPlaceholder')}
              aria-label={t('officeExpenses.categories.newTitle')}
            />
            <PrimaryButton
              onClick={() => { onCreate(draft.trim()); setDraft(''); }}
              disabled={busy || draft.trim() === '' || tooLong || duplicate}
            >
              {t('officeExpenses.categories.createPlain')}
            </PrimaryButton>
          </div>
          <Mono className="block text-[9px] tracking-[0.08em] mt-1.5 text-[#A69C8D]">
            {duplicate
              ? t('officeExpenses.categories.error.duplicate', { name: draft.trim() })
              : tooLong
                ? t('officeExpenses.categories.error.tooLong', { count: draft.trim().length, max: NAME_MAX })
                : t('officeExpenses.categories.newHint', { max: NAME_MAX })}
          </Mono>
        </div>
      </div>

      {confirmArchive && (
        <div className="mt-4 border border-[#DBD0BB] bg-[#F3EEE4] px-3.5 py-3 space-y-2.5">
          <p className="text-[12.5px] leading-[1.55] text-[#0A0A0A]">
            {t('officeExpenses.categories.archiveConfirm', {
              name: confirmArchive.name,
              count: confirmArchive.expenseCount,
            })}
          </p>
          <div className="flex items-center gap-2.5">
            <PrimaryButton
              onClick={() => { onArchive(confirmArchive.id); setConfirmArchive(null); }}
              disabled={busy}
            >
              {t('officeExpenses.categories.archive')}
            </PrimaryButton>
            <SecondaryButton onClick={() => setConfirmArchive(null)}>{t('officeExpenses.form.cancel')}</SecondaryButton>
          </div>
        </div>
      )}
    </BtModal>
  );
}
