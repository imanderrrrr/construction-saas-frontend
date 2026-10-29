import i18n from '../../i18n';

export function warehouseDate(iso: string, short = false): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, {
    month: 'short', day: 'numeric', ...(short ? {} : { year: 'numeric' }),
  });
}
