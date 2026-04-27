// OFJR Construction — Project status helpers (single source of truth)

import type { EntityStatus } from '../types';

/**
 * Returns true if the project (or its status) represents a CLOSED state.
 * Use this helper everywhere instead of duplicating `status === 'CLOSED'`.
 */
export function isProjectClosed(
  projectOrStatus: { status: EntityStatus } | EntityStatus | null | undefined,
): boolean {
  if (!projectOrStatus) return false;
  const status =
    typeof projectOrStatus === 'string' ? projectOrStatus : projectOrStatus.status;
  return status === 'CLOSED';
}

/**
 * Shared project list used across multiple forms (expenses, inventory, tools).
 * Each entry carries a status so the UI can block actions on CLOSED projects.
 */
export interface ProjectOption {
  name: string;
  status: EntityStatus;
}

export const SHARED_PROJECTS: ProjectOption[] = [
  { name: 'Downtown Plaza',    status: 'ACTIVE' },
  { name: 'Highway Bridge',    status: 'ACTIVE' },
  { name: 'Office Renovation', status: 'ACTIVE' },
  { name: 'Harbor Expansion',  status: 'CLOSED' },
];

/** User-facing message when a project is closed */
export const CLOSED_PROJECT_MSG = 'This project is closed. No new records or modifications are allowed.';

/** Short tooltip text for disabled buttons */
export const CLOSED_TOOLTIP = 'Project closed';
