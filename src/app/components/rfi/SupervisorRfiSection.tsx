import { useEffect, useState } from 'react';
import { getSupervisorProjects } from '../../services/time';
import { RfiList, type RfiProject } from './RfiList';

/**
 * Supervisor host for the RFI module: loads the supervisor's assigned
 * projects and renders the shared internal RFI view (backend re-checks the
 * per-project assignment on every call).
 */
export function SupervisorRfiSection() {
  const [projects, setProjects] = useState<RfiProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSupervisorProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => { if (!cancelled) setProjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
  }
  return <RfiList projects={projects} />;
}
