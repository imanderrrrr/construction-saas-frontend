import type { CanonicalRole } from '../types';

export type WorkspaceRole = Exclude<CanonicalRole, 'SUBCONTRACTOR'>;

/** Public web locations. API paths and the published mobile contract are independent. */
export const WORKSPACE_PATHS: Record<WorkspaceRole, Record<string, string>> = {
  ADMIN: {
    dashboard: '/admin/dashboard', projects: '/admin/obras', clients: '/admin/clientes',
    subcontractors: '/admin/subcontratistas', schedules: '/admin/tareas', 'tm-field': '/admin/tiempo-material',
    users: '/admin/equipo', 'time-approvals': '/admin/jornadas',
    budgets: '/admin/presupuestos', expenses: '/admin/gastos', 'office-expenses': '/admin/gastos-oficina',
    'accounts-receivable': '/admin/cobros', 'accounts-payable': '/admin/pagos',
    'labor-payroll': '/admin/nomina', 'tm-office': '/admin/cambios',
    'tool-inventory': '/admin/inventario', 'tool-report': '/admin/informes/inventario',
    hours: '/admin/informes/horas', 'labor-cost': '/admin/informes/costos',
    'expense-report': '/admin/informes/gastos', 'invoice-branding': '/admin/configuracion/documentos',
    audit: '/admin/configuracion/actividad', billing: '/admin/configuracion/suscripcion',
    quickbooks: '/admin/configuracion/quickbooks', invoices: '/admin/documentos',
  },
  FINANCE: {
    dashboard: '/finance/dashboard', clients: '/finance/clients',
    'accounts-receivable': '/finance/receivables', 'accounts-payable': '/finance/payables',
    budgets: '/finance/budgets', 'approved-expenses': '/finance/expenses',
    'labor-cost': '/finance/labor-cost', 'labor-payroll': '/finance/payroll',
    'supervisor-hours': '/finance/supervisor-hours', 'tm-office': '/finance/change-orders',
    'expense-report': '/finance/reports/expenses', invoices: '/finance/documents',
  },
  SUPERVISOR: {
    dashboard: '/supervisor/dashboard', projects: '/supervisor/obras', 'task-board': '/supervisor/tareas',
    'site-log': '/supervisor/bitacora', 'punch-list': '/supervisor/pendientes', rfi: '/supervisor/consultas',
    tm: '/supervisor/tiempo-material', 'my-time': '/supervisor/jornada',
    'time-approvals': '/supervisor/time-approvals', 'expense-reviews': '/supervisor/gastos',
    'team-tools': '/supervisor/herramientas',
  },
  WORKER: {
    time: '/worker/time', dashboard: '/worker/dashboard', 'my-hours': '/worker/horas',
    'my-expenses': '/worker/gastos', 'new-expense': '/worker/gastos/nuevo', 'my-tools': '/worker/herramientas',
  },
  WAREHOUSE: {
    dashboard: '/warehouse/dashboard', 'tool-inventory': '/warehouse/inventory',
    assignments: '/warehouse/asignaciones', 'tool-history': '/warehouse/movimientos',
    consumables: '/warehouse/materiales', 'consumable-dispatch': '/warehouse/materiales/despachar',
  },
};

export function resolveSection(role: WorkspaceRole, section: string): string {
  if (role === 'WORKER' && section === 'dashboard') return 'time';
  if (section === 'budget-report' || section === 'project-financials') return 'budgets';
  if (role === 'FINANCE' && section === 'projects') return 'budgets';
  if (role === 'FINANCE' && section === 'expenses') return 'approved-expenses';
  return section;
}

export function sectionForPath(role: WorkspaceRole, path: string): string | undefined {
  return Object.entries(WORKSPACE_PATHS[role]).find(([, value]) => value === path)?.[0];
}

export function workspaceStorageKey(role: string, username: string, kind: string): string {
  const tenant = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('bt_tenant='))?.slice('bt_tenant='.length) ?? 'default';
  return `bt.workspace.v1.${encodeURIComponent(tenant)}.${encodeURIComponent(username)}.${role}.${kind}`;
}
