import { useTranslation } from 'react-i18next';

export function CustodyStatus({ status }: { status: string }) {
  const { t } = useTranslation('worker');
  return <span className="inline-flex max-w-full whitespace-normal rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 [overflow-wrap:anywhere]">{t(`tools.status.${status}`, { defaultValue: t('tools.status.UNKNOWN') })}</span>;
}
