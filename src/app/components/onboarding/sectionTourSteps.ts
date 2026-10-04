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
  // The finance panel mounts the same three screens, and each claims a key of
  // its own while in finance mode (lib/tourScope): the copy is keyed, and the
  // admin's sends people to Usuarios to set rates, or speaks of the workers'
  // days — finance has neither. Paying stays (FINANCE confirms payroll), so
  // Nómina gets one more stop, on the two exports in its header. The inbox's
  // last stop is «Crear jornada», for a supervisor who could not punch at all.
  'labor-cost-finanzas': ['kpis', 'filters', 'list'],
  'labor-payroll-finanzas': ['kpis', 'filters', 'list', 'export'],
  'supervisor-hours-finanzas': ['kpis', 'filters', 'queue', 'create-day'],
  projects: ['kpis', 'filters', 'table', 'menu'],
  // Screens inside Proyectos that claim the tour while on screen (see
  // lib/tourScope): the create/edit window and each tab of the ficha. Keyed
  // like sections so the seen-flag, the copy and the banner fallback need no
  // special case. The Pendientes / Consultas stops sit on cards, so with no
  // items only the stable stops survive and an empty tab degrades to the
  // banner — the sheet's stated behaviour for a subventana with nothing to
  // point at.
  'projects-crear': ['identity', 'money', 'address', 'geofence'],
  'projects-ficha-resumen': ['bar', 'map', 'team'],
  'projects-ficha-dinero': ['billing', 'contract', 'co-form', 'history'],
  'projects-ficha-equipo': ['table', 'assign'],
  'projects-ficha-pendientes': ['states', 'origin', 'ready', 'review'],
  'projects-ficha-consultas': ['draft', 'turn', 'impacts', 'official'],
  'projects-ficha-portal': ['link', 'pin', 'expiry'],
  clients: ['add-client', 'search'],
  // The client ficha claims the tour while on screen (same mechanism as the
  // jobsite ficha): the ink bar, the three tabs and the two shortcuts.
  'clients-ficha': ['bar', 'tabs', 'shortcuts'],
  // Finance looks clients up without editing them (ClientsSection readOnly),
  // so the list and the ficha claim keys whose copy says so — and leads to
  // Presupuestos, its way into a client's jobsites.
  'clients-finanzas': ['figures', 'search', 'list'],
  'clients-ficha-finanzas': ['bar', 'tabs', 'shortcuts'],
  // Subcontratistas is split in three, for the same reason Proyectos is:
  // `visibleSteps()` filters once at start-up, so a stop anchored in a tab
  // that is not mounted yet is dropped. With the section opening on the
  // directory, a single eight-stop tour would announce "1 de 4".
  subcontractors: ['tabs', 'kpis', 'filters', 'directory-table'],
  'subcontractors-jobs': ['job-kpis', 'job-filters', 'jobs-table'],
  'subcontractors-ficha': ['job-actions', 'money', 'tabs'],
  // Tareas. The section key stays `schedules` (renaming it would reset every
  // account's "seen it" flag); the two old stops pointed at the project picker
  // and the add button, and the picker is gone. The five anchors are containers
  // that exist in every state of the screen, so none is filtered out at start-up.
  schedules: ['header', 'views', 'filters', 'groups', 'shortcuts'],
  // The Week claims the tour while it is on screen (lib/tourScope), with a
  // hyphen like the other scoped keys.
  'schedules-semana': ['rows', 'nav', 'undated'],
  'tool-inventory': ['header', 'counts', 'filters', 'table'],
  'tool-report': ['state', 'missing', 'filters', 'export'],
  // Facturas joined Cobros (2026-10): its list tour went with it, and «Emitir
  // documento» is a stop of the Cobros tour. The issue window still claims its
  // own tour while it is on screen (lib/tourScope), wherever it is opened
  // from, with a hyphen like the other scoped keys.
  'invoices-emitir': ['type', 'number', 'client-project', 'line-items', 'totals'],
  'invoice-branding': ['logo', 'fields', 'save'],
  budgets: ['header', 'kpis'],
  // Presupuestos' report view claims the tour while it is on screen
  // (lib/tourScope), and it needs TWO keys rather than one: the registry is
  // keyed copy — one wording per key — so finance under the admin key would
  // be told to adjust budgets it cannot touch. The four stops are the same;
  // only the first sentence differs.
  //
  // `reparto` is anchored on the CONTAINER of the breakdown block, not on the
  // comparator inside it: the comparator is not drawn on an empty account, in
  // the error state, or while the breakdown is still loading, and the header
  // rule above is exactly about that.
  'budgets-reporte': ['vista', 'cobro', 'reparto', 'documento'],
  'budgets-reporte-finanzas': ['vista', 'cobro', 'reparto', 'documento'],
  expenses: ['cifras', 'vistas', 'cola', 'acciones'],
  'expense-report': ['corte', 'filtros', 'obras', 'exportar'],
  'office-expenses': ['cifras', 'mes', 'fijos'],
  // Cobrar y Pagar. The two used to be toured with the same three stops
  // (kpis · filters · table), which is precisely what the redesign fixed: each
  // one now points at what is different about it — the direction it moves
  // money, its leading figure, how its list is grouped, and the verb it owns.
  // Every anchor is a container that exists while loading, on an error and on
  // an empty account, so `visibleSteps()` never silently shrinks the tour.
  //
  // `signature` describes the block at the end of an open document, which
  // only exists with a document open. Like the T&M `sign` stop, it borrows a
  // zone that is always there: while no document is open, ReceivablesScreen
  // puts the anchor on a wrapper of the rows (the copy says to open one);
  // with a document open it sits on the block itself, so «Ver cómo» on the
  // invoice-created notice — which opens the document first — rings the
  // real thing. One element carries the anchor at any time.
  'accounts-receivable': ['header', 'new', 'overdue', 'rows', 'views', 'signature'],
  'accounts-payable': ['header', 'week', 'lanes', 'new-bill'],
  // The FINANCE home (components/finance/FinanceOverview). Its own key: the
  // admin's `dashboard` is a different screen.
  'finance-dashboard': ['figures', 'payments', 'expenses', 'shortcuts'],
  audit: ['kpis', 'filters', 'list'],
  // Tiempo y material. `tm-field` doubles as the supervisor panel's tour (its
  // nav key is `tm`, but it mounts the same screen the admin calls `tm-field`)
  // and `tm-office` doubles as the finance panel's (same nav key there). The
  // two ticket-zone stops of each section share their anchor zone via nested
  // wrappers — see the note in TmFieldSection.
  'tm-field': ['pending', 'new', 'list', 'sign', 'states'],
  'tm-office': ['pending', 'queue', 'convert'],
};
