import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listProjects, listFinanceProjects } from '../../services/projects';
import { getSupervisorProjects } from '../../services/time';
import { drainPages } from '../../lib/paging';
import { useProjectFilter } from '../../workspace/WorkspaceState';
import type { CanonicalRole } from '../../types';

export function WorkspaceProjectPicker({ role }: { role: CanonicalRole }) {
  const { t } = useTranslation('common');
  const [project, setProject] = useProjectFilter<string>('');
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = role === 'SUPERVISOR' ? getSupervisorProjects()
      : drainPages((page, size) => role === 'FINANCE' ? listFinanceProjects({ page, size }) : listProjects({ page, size }));
    load.then(rows => { if (!cancelled) { setProjects(rows); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role]);
  const known = projects.some(p => String(p.id) === project);
  return <label className="flex items-center gap-2 text-sm text-[#5A5346] min-w-0">
    <span className="hidden lg:inline shrink-0">{t('workspace.worksite')}</span>
    <select aria-label={t('workspace.worksite')} value={project} onChange={e => setProject(e.target.value)}
      className="max-w-[250px] min-w-0 border border-[#DBD0BB] bg-white px-2.5 py-2 text-sm text-[#0A0A0A] focus-visible:outline-2 focus-visible:outline-[#F97316]">
      <option value="">{loading ? t('workspace.loadingWorksites') : failed ? t('workspace.worksitesUnavailable') : t('workspace.allWorksites')}</option>
      {project && !known && <option value={project}>{t('workspace.worksiteId', { id: project })}</option>}
      {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
    </select>
  </label>;
}
