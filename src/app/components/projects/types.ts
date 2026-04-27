import type { ProjectStatus } from '../../services/projects';

export type Role = 'ADMIN' | 'SUPERVISOR' | 'WORKER' | 'FINANCE' | 'WAREHOUSE' | 'SUBCONTRACTOR';
export type ProjectView = 'list' | 'details';

export interface Project {
  id: number;
  name: string;
  status: ProjectStatus;
  clientId: number | null;
  clientName: string | null;
  costCode: string | null;
  originalContractCents: number | null;
  changeOrdersTotalCents: number;
  revisedContractCents: number | null;
  contractAmountCents: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  createdAt: string;
  updatedAt?: string;
  assignedUserIds: number[];
}

export interface UserForAssign {
  id: number;
  username: string;
  fullName: string | null;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
}

export const ITEMS_PER_PAGE = 20;
