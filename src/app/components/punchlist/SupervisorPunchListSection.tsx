import { useEffect, useState } from 'react';
import { getSupervisorProjects } from '../../services/time';
import { PunchList, type PunchProject } from './PunchList';

/**
 * Supervisor host for the punch-list module: loads the supervisor's assigned
 * projects (with their assigned users as assignee candidates — WORKER /
 * SUPERVISOR / SUBCONTRACTOR handled server-side) and renders the shared
 * internal punch-list view.
 */
export function SupervisorPunchListSection() {
  const [projects, setProjects] = useState<PunchProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupervisorProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list.map((p) => ({
          id: p.id,
          name: p.name,
          assignees: p.assignedUsers.map((u) => ({ id: u.id, name: u.fullName ?? `#${u.id}` })),
        })));
      })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
  }
  return <PunchList projects={projects} />;
}
