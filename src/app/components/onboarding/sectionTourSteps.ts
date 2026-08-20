/**
 * Tour stops per section, in visit order.
 *
 * Each key `k` under section `s` must have:
 *   - an anchor in the section's JSX: `data-tour="sec.<s>.<k>"`
 *   - copy in admin.json (en + es): `sec.<s>.step.<k>.title` and `.body`
 *
 * A section absent from this map keeps the old non-blocking banner, so the
 * rollout is section-by-section with no half-states: no entry → today's
 * behaviour, entry → guided tour.
 *
 * Keep the stops few and representative (3–5). The goal is orientation, not
 * an exhaustive walk of every control — the dashboard tour learned this the
 * hard way and settled on six.
 *
 * Anchors deliberately avoid elements that only exist with data (pagination,
 * populated tables, second tabs): `visibleSteps()` drops a missing anchor, so
 * a conditional stop would silently shrink the tour on a fresh account, and
 * "1 de 4" becoming "1 de 1" reads as a bug. Anchor the stable container and
 * describe what appears inside it instead.
 */
export const SECTION_TOUR_STEPS: Record<string, string[]> = {
  users: ['new-user', 'kpis', 'filters', 'roster'],
  'time-approvals': ['kpis', 'filters', 'queue'],
  hours: ['kpis', 'filters', 'list'],
  'labor-cost': ['kpis', 'filters', 'list'],
  'labor-payroll': ['kpis', 'filters', 'list'],
  projects: ['create', 'filters', 'table'],
  clients: ['add-client', 'search'],
  subcontractors: ['tabs', 'job-kpis', 'job-filters', 'jobs-table'],
  schedules: ['project-picker', 'add-task'],
  'tool-inventory': ['tabs', 'kpis', 'filters', 'table'],
  'tool-report': ['export', 'filters', 'kpis', 'by-status'],
  invoices: ['doc-type', 'client-project', 'line-items', 'totals'],
  'invoice-branding': ['logo', 'fields', 'save'],
  budgets: ['header', 'kpis'],
  'budget-report': ['export', 'filters', 'kpis', 'budget-vs-actual'],
  expenses: ['approve-all', 'kpis', 'filters', 'table'],
  'expense-report': ['export', 'filters', 'kpis', 'by-project'],
  'office-expenses': ['kpis', 'new-expense', 'filters'],
  'accounts-receivable': ['kpis', 'filters', 'table'],
  'accounts-payable': ['new-bill', 'kpis', 'filters', 'table'],
  audit: ['kpis', 'filters', 'list'],
  // Tiempo y material. `tm-field` doubles as the supervisor panel's tour (its
  // nav key is `tm`, but it mounts the same screen the admin calls `tm-field`)
  // and `tm-office` doubles as the finance panel's (same nav key there). The
  // two ticket-zone stops of each section share their anchor zone via nested
  // wrappers — see the note in TmFieldSection.
  'tm-field': ['pending', 'new', 'list', 'sign', 'states'],
  'tm-office': ['pending', 'queue', 'convert'],
};
