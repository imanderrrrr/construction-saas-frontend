import { textPreview } from '../../../shared/textPolicy';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';

/** Admission limits do not rewrite history. Keep its preview short and full text opt-in. */
export function TextValue({ value, className = '' }: { value: string; className?: string }) {
  const { t } = useTranslation('common');
  if (value.length <= 25) return <span className={cn(className, 'block min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]')}>{value}</span>;
  const preview = textPreview(value);
  return <details className={cn(className, 'min-w-0 max-w-full overflow-visible whitespace-normal')}>
    <summary className="cursor-pointer focus-visible:outline-2 [overflow-wrap:anywhere]">
      <span>{preview}</span> <span className="text-[10px] underline">{t('text.showFull')}</span>
    </summary>
    <div tabIndex={0} role="region" aria-label={t('text.full')} className="max-h-48 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] py-1 focus-visible:outline-2">{value}</div>
  </details>;
}
