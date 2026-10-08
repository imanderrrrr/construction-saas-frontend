import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthService } from '../../services/auth';
import { listProjects, listFinanceProjects } from '../../services/projects';
import { getSupervisorProjects } from '../../services/time';
import { drainPages } from '../../lib/paging';
import { MonoSelect } from '../projects/bt';

type ProjectOption = { id: number; name: string };

/** A filter of this screen only. It never changes the application's header. */
export function ScreenProjectFilter({ projects: supplied, value, onChange, role: suppliedRole }: {
  projects?: ProjectOption[]; value: string | number | null; onChange: (value: string) => void;
  role?: 'ADMIN' | 'FINANCE' | 'SUPERVISOR';
}) {
  const { t } = useTranslation('common');
  const project = value == null ? '' : String(value);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(supplied == null);
  const role = suppliedRole ?? AuthService.getCanonicalRole?.() ?? AuthService.getRole?.();
  useEffect(() => {
    if (supplied != null) return;
    let cancelled = false;
    const load = role === 'SUPERVISOR' ? getSupervisorProjects().then(rows => {
      if (!Array.isArray(rows)) throw new Error('Invalid project list');
      return rows;
    }) : drainPages(async (page, size) => {
      const result = await (role === 'FINANCE' ? listFinanceProjects({ page, size }) : listProjects({ page, size }));
      if (!Array.isArray(result.content) || !Number.isInteger(result.totalPages) || result.totalPages < 0) throw new Error('Invalid project page');
      return result;
    });
    load.then(rows => { if (!cancelled) { setProjects(rows); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, supplied]);
  const options = supplied ?? projects;
  const known = options.some(p => String(p.id) === project);
  return <MonoSelect aria-label={t('labels.project')} value={project} onChange={e => onChange(e.target.value)} className="max-w-[250px] min-w-0 py-2">
    <option value="">{supplied == null && loading ? t('workspace.loadingWorksites') : failed ? t('workspace.worksitesUnavailable') : t('labels.allProjects')}</option>
    {project && !known && <option value={project}>{t('workspace.worksiteId', { id: project })}</option>}
    {options.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
  </MonoSelect>;
}
