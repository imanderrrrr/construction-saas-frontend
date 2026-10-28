import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/** Constant-size controls, including a direct jump for very large histories. */
export function RecordPagination({ current, total, onPage }: { current: number; total: number; onPage: (page: number) => void }) {
  const { t } = useTranslation('common');
  const inputId = useId();
  if (total <= 1) return null;
  const go = (page: number) => onPage(Math.max(1, Math.min(total, page)));
  const button = 'min-h-11 min-w-11 px-3 border border-[#DBD0BB] text-xs font-medium hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-600 disabled:opacity-30';
  return <nav aria-label={t('pagination.label')} className="flex flex-wrap items-center justify-center gap-2 py-6">
    <button type="button" className={button} onClick={() => go(current - 1)} disabled={current <= 1}>{t('buttons.prev')}</button>
    <form className="flex items-center gap-2 text-xs" onSubmit={event => {
      event.preventDefault();
      const input = event.currentTarget.elements.namedItem('page') as HTMLInputElement;
      if (input.validity.valid) go(Number(input.value));
    }}>
      <label className="sr-only" htmlFor={inputId}>{t('pagination.page')}</label>
      <input key={current} id={inputId} name="page" type="number" inputMode="numeric" min={1} max={total} defaultValue={current} required className="w-16 min-h-11 border border-[#DBD0BB] bg-white px-2 text-center" />
      <span aria-live="polite">/ {total}</span>
      <button type="submit" className={button}>{t('pagination.go')}</button>
    </form>
    <button type="button" className={button} onClick={() => go(current + 1)} disabled={current >= total}>{t('buttons.next')}</button>
  </nav>;
}
