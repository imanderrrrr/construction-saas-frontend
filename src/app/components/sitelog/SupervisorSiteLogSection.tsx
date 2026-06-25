import { useEffect, useState } from 'react';
import { getSupervisorProjects } from '../../services/time';
import { SiteLog } from './SiteLog';

/**
 * Supervisor host for the bitácora module: loads the supervisor's assigned
 * projects and renders the editable site-log module. Supervisors can create and
 * edit logs (canEdit), per the security model.
 */
export function SupervisorSiteLogSection() {
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupervisorProjects()
      .then((list) => { if (!cancelled) setProjects(list.map((p) => ({ id: p.id, name: p.name }))); })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
  }
  return <SiteLog projects={projects} canEdit />;
}
