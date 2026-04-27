import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from './types';

export function IncompleteBanner({ project }: { project: Project }) {
  const { t } = useTranslation('admin');
  if (project.status === 'CLOSED') return null;
  const missing: string[] = [];
  if (!project.clientId) missing.push(t('projectBanner.clientNotAssigned'));
  if (!project.costCode) missing.push(t('projectBanner.costCodeNotSet'));
  if (project.originalContractCents == null || project.originalContractCents <= 0) missing.push(t('projectBanner.contractNotDefined'));
  if (missing.length === 0) return null;
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-900">{t('projectBanner.title')}</p>
        <ul className="mt-1 space-y-0.5">
          {missing.map(m => (
            <li key={m} className="text-xs text-amber-700 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-amber-400" />{m}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-amber-600 mt-1">{t('projectBanner.description')}</p>
      </div>
    </div>
  );
}
