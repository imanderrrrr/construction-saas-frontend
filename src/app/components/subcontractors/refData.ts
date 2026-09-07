import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { listUsers, type UserDTO } from '../../services/users';
import type { PageResponse } from '../../services/subcontractors';

/**
 * The two lists the section fills its selectors with: the users who can be
 * given a job, and the jobsites a job can be given on.
 *
 * Loaded once for the whole section rather than per window, because the same
 * two lists feed the Trabajos filters and the assign window, and a second
 * fetch on opening the window is a visible pause on a form.
 *
 * Both are capped at 200 by the server. That cap is silent, and it is the
 * reason the assign window says where subcontractors come from instead of
 * pretending the list is exhaustive.
 *
 * Deactivated users and closed jobsites are included on purpose: the server
 * accepts a job on either, and hiding them here would only make the filter
 * unable to reach jobs that already exist against them.
 */

export interface SimpleProject { id: number; name: string }

export interface RefData {
  subcontractors: UserDTO[];
  projects: SimpleProject[];
  state: 'loading' | 'ready' | 'failed';
  reload: () => void;
}

const CAP = 200;

export function useRefData(): RefData {
  const [subcontractors, setSubcontractors] = useState<UserDTO[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const load = useCallback(() => {
    setState('loading');
    Promise.all([
      listUsers({ role: 'SUBCONTRACTOR', size: CAP }),
      api<PageResponse<SimpleProject>>(`/api/v1/admin/projects?size=${CAP}`),
    ])
      .then(([users, projectPage]) => {
        setSubcontractors(users.content);
        setProjects(projectPage.content);
        setState('ready');
      })
      .catch(() => setState('failed'));
  }, []);

  useEffect(() => { load(); }, [load]);

  return { subcontractors, projects, state, reload: load };
}
