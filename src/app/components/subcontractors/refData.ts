import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserDTO } from '../../services/users';
import { projectCatalog, userCatalog } from '../../services/catalogs';

/**
 * The two lists the section fills its selectors with: the users who can be
 * given a job, and the jobsites a job can be given on.
 *
 * Loaded once for the whole section rather than per window, because the same
 * two lists feed the Trabajos filters and the assign window, and a second
 * fetch on opening the window is a visible pause on a form.
 *
 * Both are whole catalogs, walked page by page (AUD-055). They used to ask
 * for 200 rows, which the server silently cut to its page cap of 100, so the
 * 101st subcontractor or jobsite was neither in the filters nor in the assign
 * window. The walk has a safety bound and `truncated` says when it stopped.
 *
 * Deactivated users and closed jobsites are included on purpose: the server
 * accepts a job on either, and hiding them here would only make the filter
 * unable to reach jobs that already exist against them.
 */

export interface SimpleProject { id: number; name: string }

export interface CatalogCount { total: number; truncated: boolean }

export interface RefData {
  subcontractors: UserDTO[];
  projects: SimpleProject[];
  state: 'loading' | 'ready' | 'failed';
  /** Each list's own count, and whether its walk stopped at the safety bound. */
  catalogs?: { subcontractors: CatalogCount; projects: CatalogCount };
  reload: () => void;
}

export function useRefData(): RefData {
  const [subcontractors, setSubcontractors] = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [catalogs, setCatalogs] = useState<RefData['catalogs']>();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = ++generation.current;
    setState('loading');
    Promise.all([
      userCatalog({ role: 'SUBCONTRACTOR' }),
      projectCatalog({ role: 'ADMIN' }),
    ])
      .then(([users, projectList]) => {
        if (mine !== generation.current) return;
        setSubcontractors(users.items);
        setProjects(projectList.items.map(p => ({ id: p.id, name: p.name })));
        setCatalogs({
          subcontractors: { total: users.total, truncated: users.truncated },
          projects: { total: projectList.total, truncated: projectList.truncated },
        });
        setState('ready');
      })
      .catch(() => { if (mine === generation.current) setState('failed'); });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { subcontractors, projects, state, catalogs, reload: load };
}
