import type { Page, Route } from '@playwright/test';
import { CLIENTS, COMPANY, PROJECTS, PROJECTS_SUMMARY, TIMEZONE, TODAY, USERS, clientPage, page as pageOf } from './data';

// Network fixtures for the demo clips.
//
// Registered AFTER installHermeticBase, so these win over its catch-all 500.
// Routes are REGEXES on purpose: Playwright's glob syntax treats `?` as a
// single-character wildcard, so `**/projects?**` also swallows `projects/7`.

function json(body: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** `/api/v1/<path>` with an optional query string, anchored at the end. */
function re(path: string): RegExp {
  return new RegExp(`/api/v1/${path}(\\?.*)?$`);
}

const id = (url: string, after: string): number =>
  Number(new URL(url).pathname.split(`${after}/`)[1]?.split('/')[0] ?? 0);

const qp = (url: string, key: string): string | null => new URL(url).searchParams.get(key);

// ── Change orders ───────────────────────────────────────────────────────────
const CHANGE_ORDERS: Record<number, unknown[]> = {
  1: [
    { id: 11, number: 'OC-03', description: 'Cambio de ventanería a vidrio templado 10 mm (torres A y B)', amountCents: 78_400_00, createdBy: 'analucia', createdAt: '2026-07-22T16:10:00Z' },
    { id: 12, number: 'OC-02', description: 'Refuerzo de cimentación en sótano 2 por estudio de suelos', amountCents: 31_600_00, createdBy: 'analucia', createdAt: '2026-05-14T15:40:00Z' },
    { id: 13, number: 'OC-01', description: 'Ampliación de garita y muro perimetral', amountCents: 14_500_00, createdBy: 'analucia', createdAt: '2026-03-08T17:25:00Z' },
  ],
  3: [{ id: 14, number: 'OC-01', description: 'Piso industrial endurecido en área de carga', amountCents: 32_000_00, createdBy: 'analucia', createdAt: '2026-06-30T15:00:00Z' }],
  4: [{ id: 15, number: 'OC-01', description: 'Restauración de artesonado en el salón principal', amountCents: 68_000_00, createdBy: 'analucia', createdAt: '2026-08-05T14:30:00Z' }],
};

// ── Invoices (receivables, amounts in dollars) ──────────────────────────────
const RECEIVABLES = [
  { id: 301, invoiceNumber: 'FAC-2026-041', client: 'Inmobiliaria Vista Hermosa, S.A.', project: 'Residencial Vista Hermosa II', projectId: 1, description: 'Estimación #7 — avance de obra gris torres A y B', issuedDate: '2026-09-01', dueDate: '2026-09-30', subtotal: 186_000, discount: 0, taxRate: 12, tax: 22_320, amount: 208_320, paidAmount: 0, status: 'PENDING' },
  { id: 302, invoiceNumber: 'FAC-2026-040', client: 'Grupo Corporativo Zona 10', project: 'Torre Corporativa Zona 10', projectId: 2, description: 'Estimación #4 — estructura niveles 5 a 8', issuedDate: '2026-08-28', dueDate: '2026-09-27', subtotal: 240_000, discount: 0, taxRate: 12, tax: 28_800, amount: 268_800, paidAmount: 150_000, status: 'PARTIAL' },
  { id: 303, invoiceNumber: 'FAC-2026-039', client: 'Logística del Sur, S.A.', project: 'Bodega Industrial Villa Nueva', projectId: 3, description: 'Estimación #5 — losa y cubierta metálica', issuedDate: '2026-08-20', dueDate: '2026-09-04', subtotal: 96_000, discount: 0, taxRate: 12, tax: 11_520, amount: 107_520, paidAmount: 0, status: 'OVERDUE' },
  { id: 304, invoiceNumber: 'FAC-2026-038', client: 'Hotelera Colonial', project: 'Remodelación Hotel Antigua', projectId: 4, description: 'Estimación #3 — acabados ala sur', issuedDate: '2026-08-12', dueDate: '2026-09-11', subtotal: 64_000, discount: 0, taxRate: 12, tax: 7_680, amount: 71_680, paidAmount: 71_680, status: 'PAID' },
  { id: 305, invoiceNumber: 'FAC-2026-037', client: 'Inmobiliaria Vista Hermosa, S.A.', project: 'Ampliación Colegio San Marcos', projectId: 6, description: 'Anticipo de contrato 20 %', issuedDate: '2026-08-04', dueDate: '2026-08-19', subtotal: 156_000, discount: 0, taxRate: 12, tax: 18_720, amount: 174_720, paidAmount: 174_720, status: 'PAID' },
  { id: 306, invoiceNumber: 'FAC-2026-036', client: 'Grupo Corporativo Zona 10', project: 'Torre Corporativa Zona 10', projectId: 2, description: 'Estimación #3 — sótanos y cisterna', issuedDate: '2026-07-30', dueDate: '2026-08-29', subtotal: 180_000, discount: 0, taxRate: 12, tax: 21_600, amount: 201_600, paidAmount: 201_600, status: 'PAID' },
].map(r => ({
  ...r,
  documentType: 'INVOICE' as const,
  notes: null,
  lineItems: [] as unknown[],
  payments: r.paidAmount > 0 ? [{ id: r.id * 10, date: r.issuedDate, amount: r.paidAmount, method: 'TRANSFER', reference: 'TRF-' + r.id }] : [],
  createdAt: r.issuedDate + 'T15:00:00Z',
  updatedAt: r.issuedDate + 'T15:00:00Z',
}));

// One change-order request waiting for the admin's approval (the queue chip).
const COR_PENDING = [{
  id: 320, documentType: 'CHANGE_ORDER_REQUEST' as const, invoiceNumber: 'OC-2026-004',
  client: 'Inmobiliaria Vista Hermosa, S.A.', project: 'Residencial Vista Hermosa II', projectId: 1,
  description: 'Cambio de ventanería a vidrio templado 10 mm', issuedDate: '2026-09-09', dueDate: '2026-09-24',
  subtotal: 78_400, discount: 0, taxRate: 12, tax: 9_408, amount: 87_808, paidAmount: 0,
  status: 'PENDING_APPROVAL', notes: null, approvedBy: null, approvedAt: null,
  lineItems: [], payments: [], createdAt: '2026-09-09T16:00:00Z', updatedAt: '2026-09-09T16:00:00Z',
}];

// ── Bills (payables, amounts in dollars) ────────────────────────────────────
const PAYABLES = [
  { id: 401, billNumber: 'CP-2026-118', vendor: 'Cementos del Valle', category: 'MATERIALES', project: 'Residencial Vista Hermosa II', projectId: 1, description: '420 sacos de cemento UGC 42.5', receivedDate: '2026-09-03', dueDate: '2026-09-18', amount: 18_480, paidAmount: 0, status: 'PENDING' },
  { id: 402, billNumber: 'CP-2026-117', vendor: 'Aceros Centroamericanos', category: 'MATERIALES', project: 'Torre Corporativa Zona 10', projectId: 2, description: 'Varilla No. 5 y No. 6 — 12 toneladas', receivedDate: '2026-08-29', dueDate: '2026-09-13', amount: 62_400, paidAmount: 30_000, status: 'PARTIAL' },
  { id: 403, billNumber: 'CP-2026-116', vendor: 'Transportes Quetzal', category: 'FLETES', project: 'Bodega Industrial Villa Nueva', projectId: 3, description: 'Acarreo de material selecto — 14 viajes', receivedDate: '2026-08-22', dueDate: '2026-09-06', amount: 8_960, paidAmount: 0, status: 'OVERDUE' },
  { id: 404, billNumber: 'CP-2026-115', vendor: 'Alquiler de Equipo Tikal', category: 'EQUIPO', project: 'Residencial Vista Hermosa II', projectId: 1, description: 'Renta de bomba de concreto — 6 días', receivedDate: '2026-08-18', dueDate: '2026-09-02', amount: 12_600, paidAmount: 12_600, status: 'PAID' },
  { id: 405, billNumber: 'CP-2026-114', vendor: 'Eléctricos GT', category: 'SUBCONTRATO', project: 'Torre Corporativa Zona 10', projectId: 2, description: 'Canalización eléctrica niveles 1 a 4', receivedDate: '2026-08-15', dueDate: '2026-09-14', amount: 46_200, paidAmount: 0, status: 'PENDING' },
  { id: 406, billNumber: 'CP-2026-113', vendor: 'Ferretería La Esperanza', category: 'MATERIALES', project: 'Remodelación Hotel Antigua', projectId: 4, description: 'Herrajes, selladores y pintura base', receivedDate: '2026-08-11', dueDate: '2026-08-26', amount: 5_340, paidAmount: 5_340, status: 'PAID' },
].map(b => ({
  ...b,
  documentType: 'BILL' as const,
  invoiceNumber: null,
  notes: null,
  payments: b.paidAmount > 0 ? [{ id: b.id * 10, date: b.receivedDate, amount: b.paidAmount, method: 'TRANSFER', reference: 'TRF-' + b.id, approvedBy: 'analucia' }] : [],
  createdAt: b.receivedDate + 'T15:00:00Z',
  updatedAt: b.receivedDate + 'T15:00:00Z',
}));

// ── Punch list (project 1) ──────────────────────────────────────────────────
const PUNCH = [
  { id: 501, itemNumber: 3, displayNumber: '#003', origin: 'CLIENT', title: 'Filtración en ventana de sala — apartamento 402', description: 'Entra agua por la esquina inferior derecha cuando llueve fuerte.', location: 'Torre A · Nivel 4 · Apto 402', status: 'READY_FOR_REVIEW', assigneeId: 3, assigneeName: 'Manuel Ramírez', dueDate: '2026-09-15', createdByName: 'Lucía Morales', createdByClient: true, readyAt: '2026-09-11T21:40:00Z', readyNote: 'Se resellló el marco completo y se probó con manguera.', commentCount: 3 },
  { id: 502, itemNumber: 2, displayNumber: '#002', origin: 'INTERNAL', title: 'Repello con desnivel en pasillo del nivel 3', description: 'El maestro reporta desnivel de 8 mm en 4 m.', location: 'Torre A · Nivel 3 · Pasillo', status: 'IN_PROGRESS', assigneeId: 4, assigneeName: 'Estuardo Xoy', dueDate: '2026-09-18', createdByName: 'Julio Castillo', createdByClient: false, commentCount: 1 },
  { id: 503, itemNumber: 1, displayNumber: '#001', origin: 'CLIENT', title: 'Puerta de closet no cierra — apartamento 301', description: null, location: 'Torre A · Nivel 3 · Apto 301', status: 'CLOSED', assigneeId: 5, assigneeName: 'Byron Chávez', dueDate: '2026-09-05', createdByName: 'Lucía Morales', createdByClient: true, closedAt: '2026-09-06T22:15:00Z', closedByName: 'Lucía Morales', closedByClient: true, closeNote: 'Revisado en sitio, quedó bien.', commentCount: 2 },
].map(p => ({
  readyAt: null, readyNote: null, closedAt: null, closedByName: null, closedByClient: false, closeNote: null,
  reopenCount: 0, closableInternally: true, photos: [] as unknown[], events: [] as unknown[], comments: [] as unknown[],
  createdAt: '2026-09-02T16:00:00Z', updatedAt: '2026-09-11T21:40:00Z',
  ...p,
}));

const PUNCH_THREAD: Record<number, unknown[]> = {
  501: [
    { type: 'CREATED', actorName: 'Lucía Morales', byClient: true, note: null, createdAt: '2026-09-02T16:02:00Z' },
    { type: 'ASSIGNED', actorName: 'Julio Castillo', byClient: false, note: 'Manuel Ramírez', createdAt: '2026-09-03T14:20:00Z' },
    { type: 'COMMENT', actorName: 'Manuel Ramírez', byClient: false, note: 'Se detectó sellador vencido en el marco.', createdAt: '2026-09-10T15:05:00Z' },
    { type: 'READY', actorName: 'Manuel Ramírez', byClient: false, note: 'Se resellló el marco completo y se probó con manguera.', createdAt: '2026-09-11T21:40:00Z' },
  ],
};

const PUNCH_COMMENTS: Record<number, unknown[]> = {
  501: [
    { id: 1, authorName: null, byClient: true, body: 'Sigue entrando agua con la lluvia de ayer.', createdAt: '2026-09-08T22:10:00Z' },
    { id: 2, authorName: 'Manuel Ramírez', byClient: false, body: 'Vamos mañana temprano a revisar el sellador.', createdAt: '2026-09-09T13:35:00Z' },
    { id: 3, authorName: 'Manuel Ramírez', byClient: false, body: 'Listo, resellado y probado con manguera. Queda pendiente su revisión.', createdAt: '2026-09-11T21:41:00Z' },
  ],
};

// ── RFIs (project 1) ────────────────────────────────────────────────────────
const RFIS = [
  { id: 601, rfiNumber: 4, displayNumber: 'RFI #004', subject: 'Acabado de gradas en torre B', question: '¿El cliente confirma granito pulido en las gradas de la torre B, o se mantiene el concreto visto del plano A-204?', status: 'OPEN', ballInCourt: 'CLIENT', overdue: false, dueDate: '2026-09-16', costImpact: 'YES', costImpactAmountCents: 18_600_00, scheduleImpact: 'TBD', scheduleImpactDays: null, submittedAt: '2026-09-09T16:30:00Z', responseCount: 1 },
  { id: 602, rfiNumber: 3, displayNumber: 'RFI #003', subject: 'Ubicación de tomas en cocina — tipo 2', question: 'El plano eléctrico y el de mobiliario no coinciden en la altura de las tomas sobre el poyo.', status: 'OPEN', ballInCourt: 'CLIENT', overdue: true, dueDate: '2026-09-08', costImpact: 'NO', costImpactAmountCents: null, scheduleImpact: 'NO', scheduleImpactDays: null, submittedAt: '2026-09-01T15:10:00Z', responseCount: 0 },
  { id: 603, rfiNumber: 2, displayNumber: 'RFI #002', subject: 'Especificación de impermeabilizante en losa', question: '¿Se acepta el sustituto de la misma ficha técnica por desabastecimiento del especificado?', status: 'CLOSED', ballInCourt: 'NONE', overdue: false, dueDate: '2026-08-22', costImpact: 'NO', costImpactAmountCents: null, scheduleImpact: 'YES', scheduleImpactDays: 4, submittedAt: '2026-08-15T14:00:00Z', respondedAt: '2026-08-20T16:20:00Z', closedAt: '2026-08-21T15:00:00Z', closedByName: 'Ana Lucía Pérez', responseCount: 2 },
].map(r => ({
  respondedAt: null, closedAt: null, closedByName: null, officialResponseId: null,
  createdByName: 'Julio Castillo', submittedByName: 'Julio Castillo', closable: false,
  questionPhotos: [] as unknown[], responses: [] as unknown[], events: [] as unknown[],
  createdAt: '2026-08-15T14:00:00Z', updatedAt: '2026-09-09T16:30:00Z',
  ...r,
}));

const RFI_RESPONSES: Record<number, unknown[]> = {
  601: [{ id: 91, authorName: null, byClient: true, body: 'Confirmamos granito pulido. Enviamos la muestra aprobada el lunes.', official: false, photos: [], createdAt: '2026-09-11T22:05:00Z' }],
  603: [
    { id: 92, authorName: null, byClient: true, body: 'Aceptado el sustituto siempre que mantenga la garantía de 10 años.', official: true, photos: [], createdAt: '2026-08-20T16:20:00Z' },
    { id: 93, authorName: 'Julio Castillo', byClient: false, body: 'Garantía confirmada por el proveedor. Se procede.', official: false, photos: [], createdAt: '2026-08-21T14:40:00Z' },
  ],
};

// ── Contract balance history (project 1) ───────────────────────────────────
const CONTRACT_HISTORY: Record<number, unknown[]> = {
  1: [
    { id: 71, changeType: 'PAYABLE_DEDUCTION',  amountCents: -278_000_00, balanceAfterCents:   535_500_00, referenceId: 401, description: 'Materiales y fletes de agosto',        createdAt: '2026-09-05T15:10:00Z' },
    { id: 72, changeType: 'EXPENSE_DEDUCTION',  amountCents: -336_500_00, balanceAfterCents:   813_500_00, referenceId: null, description: 'Gastos aprobados del periodo',        createdAt: '2026-08-14T16:20:00Z' },
    { id: 73, changeType: 'LABOR_PAYMENT',      amountCents: -310_000_00, balanceAfterCents: 1_150_000_00, referenceId: null, description: 'Nómina quincenal de obra',           createdAt: '2026-07-05T17:00:00Z' },
    { id: 74, changeType: 'PAYABLE_DEDUCTION',  amountCents: -260_000_00, balanceAfterCents: 1_410_000_00, referenceId: 402, description: 'Acero de refuerzo y concreto',        createdAt: '2026-05-20T15:45:00Z' },
    { id: 75, changeType: 'INITIAL_ASSIGNMENT', amountCents: 1_720_000_00, balanceAfterCents: 1_720_000_00, referenceId: null, description: 'Presupuesto de costos inicial',      createdAt: '2026-01-15T14:00:00Z' },
  ],
};

export async function installDemoApi(page: Page) {
  // ── Shell ────────────────────────────────────────────────────────────────
  await page.route(re('settings/timezone'), json({ timezone: TIMEZONE }));
  await page.route(re('branding'), json({ organizationName: COMPANY, hasLogo: false }));
  // Plan gate for bitácora / pendientes / consultas / portal.
  await page.route(re('site-logs/feature'), json({ enabled: true }));
  await page.route(re('admin/audit-logs'), json(pageOf([
    { id: 1, username: 'analucia', action: 'INVOICE_APPROVED', entityType: 'RECEIVABLE', entityId: '320', details: 'FAC-2026-041', createdAt: '2026-09-12T14:42:00Z' },
    { id: 2, username: 'jcastillo', action: 'PUNCH_ITEM_READY', entityType: 'PUNCH_ITEM', entityId: '501', details: '#003', createdAt: '2026-09-11T21:40:00Z' },
    { id: 3, username: 'analucia', action: 'CHANGE_ORDER_CREATED', entityType: 'PROJECT', entityId: '1', details: 'OC-03', createdAt: '2026-09-10T16:10:00Z' },
  ], 5)));

  // ── Projects, clients, crew ──────────────────────────────────────────────
  await page.route(re('admin/projects'), route => {
    const url = route.request().url();
    const status = qp(url, 'status');
    const search = (qp(url, 'search') ?? '').toLowerCase();
    let list = PROJECTS;
    if (status) list = list.filter(p => p.status === status);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search));
    return json(pageOf(list, Number(qp(url, 'size') ?? 20)))(route);
  });
  await page.route(re('admin/projects/summary'), json(PROJECTS_SUMMARY));
  await page.route(/\/api\/v1\/admin\/projects\/\d+(\?.*)?$/, route => {
    const p = PROJECTS.find(x => x.id === id(route.request().url(), 'projects'));
    return p ? json(p)(route) : json({ message: 'not found' }, 404)(route);
  });
  await page.route(/\/api\/v1\/admin\/projects\/\d+\/change-orders(\?.*)?$/, route =>
    json(CHANGE_ORDERS[id(route.request().url(), 'projects')] ?? [])(route));

  await page.route(/\/api\/v1\/(admin|finance)\/projects\/\d+\/contract-history(\?.*)?$/, route =>
    json(CONTRACT_HISTORY[id(route.request().url(), 'projects')] ?? [])(route));

  await page.route(re('admin/clients'), route => {
    const status = qp(route.request().url(), 'status');
    const list = status ? CLIENTS.filter(c => c.status === status) : CLIENTS;
    return json(clientPage(list))(route);
  });
  await page.route(re('admin/clients/summary'), json({ total: CLIENTS.length, active: CLIENTS.length, withActiveProjects: 4 }));

  await page.route(re('admin/users'), route => {
    const role = qp(route.request().url(), 'role');
    const list = role ? USERS.filter(u => u.role === role) : USERS;
    return json(pageOf(list, Number(qp(route.request().url(), 'size') ?? 20)))(route);
  });

  // ── Dashboard ────────────────────────────────────────────────────────────
  await page.route(re(`admin/dashboard/money`), json({
    receivablesOverdue: { amountCents: 107_520_00, count: 1, oldestDays: 8 },
    payablesDueSoon: { amountCents: 41_400_00, count: 3 },
    expensesPending: { amountCents: 3_180_00, count: 6 },
  }));
  await page.route(re('admin/dashboard/today'), json({
    workersTotal: 34,
    byProject: [
      { projectId: 1, projectName: 'Residencial Vista Hermosa II', workers: 16 },
      { projectId: 2, projectName: 'Torre Corporativa Zona 10', workers: 11 },
      { projectId: 3, projectName: 'Bodega Industrial Villa Nueva', workers: 7 },
    ],
    pendingApprovalRecords: 5,
    idleActiveProjects: [{ id: 6, name: 'Ampliación Colegio San Marcos' }],
  }));
  await page.route(re('admin/dashboard/budget'), json({
    projects: PROJECTS.filter(p => p.status === 'ACTIVE').map(p => ({
      id: p.id, name: p.name,
      contractCents: p.revisedContractCents,
      consumedCents: p.totalConsumedCents,
      remainingCents: p.remainingBudgetCents,
      consumedPct: Math.round((p.totalConsumedCents / (p.budgetBaseCents || 1)) * 100),
      critical: p.totalConsumedCents / (p.budgetBaseCents || 1) > 0.9,
    })),
    recentChangeOrder: { projectName: 'Residencial Vista Hermosa II', amountCents: 78_400_00, countLast30Days: 2 },
  }));
  await page.route(/\/api\/v1\/admin\/dashboard\/pulse\/\d+(\?.*)?$/, route => {
    const pid = id(route.request().url(), 'pulse');
    const p = PROJECTS.find(x => x.id === pid) ?? PROJECTS[0];
    return json({
      projectId: p.id, projectName: p.name,
      lastSiteLog: { workDate: TODAY, notes: 'Fundición de losa nivel 5 completada; cuadrilla de acabados en torre A.' },
      openPunchItems: 2, openRfis: 2, oldestOpenRfiDays: 11,
      financial: { contractCents: p.revisedContractCents, invoicedCents: p.invoicedCents, collectedCents: p.collectedCents, budgetConsumedPct: Math.round((p.totalConsumedCents / (p.budgetBaseCents || 1)) * 100) },
      workersToday: ['Manuel Ramírez', 'Estuardo Xoy', 'Byron Chávez', 'Kevin Mejía'],
    })(route);
  });

  // ── Finance ──────────────────────────────────────────────────────────────
  await page.route(re('finance/receivables'), route => {
    const url = route.request().url();
    const status = (qp(url, 'status') ?? '').toUpperCase();
    // Mirrors the backend: a query with no status filter excludes the change
    // orders still waiting for approval — the panel says so on screen.
    const list = status
      ? [...COR_PENDING, ...RECEIVABLES].filter(r => r.status === status)
      : RECEIVABLES;
    return json({ content: list, page: 0, size: Number(qp(url, 'size') ?? 20), totalElements: list.length, totalPages: 1 })(route);
  });
  await page.route(re('finance/receivables/clients'), json(CLIENTS.map(c => c.name)));
  await page.route(re('finance/payables'), route =>
    json({ content: PAYABLES, page: 0, size: 200, totalElements: PAYABLES.length, totalPages: 1 })(route));
  await page.route(re('finance/payables/vendors'), json([...new Set(PAYABLES.map(p => p.vendor))]));
  await page.route(re('finance/projects'), json(pageOf(PROJECTS)));

  // ── Expenses (also feeds the Presupuestos breakdown) ─────────────────────
  await page.route(re('admin/expenses/summary'), json({ pending: 6, approved: 128, observed: 2, rejected: 3, totalApprovedCents: 1_312_000_00 }));
  await page.route(re('admin/expenses/report'), json({
    kpis: { totalApprovedCents: 1_312_000_00, avgPerWorkerCents: 4_100_00, expenseCount: 128, topCategory: 'MATERIALES' },
    byProject: PROJECTS.map(p => ({
      projectId: p.id, projectName: p.name, approvedCents: p.approvedExpensesCents,
      pendingCount: 1, observedCount: 0, rejectedCount: 0,
      breakdown: [
        { type: 'MATERIALES', count: 24, totalCents: Math.round(p.approvedExpensesCents * 0.62) },
        { type: 'COMBUSTIBLE', count: 9, totalCents: Math.round(p.approvedExpensesCents * 0.14) },
        { type: 'ALIMENTACION', count: 12, totalCents: Math.round(p.approvedExpensesCents * 0.11) },
        { type: 'OTROS', count: 6, totalCents: Math.round(p.approvedExpensesCents * 0.13) },
      ],
    })),
    byWorker: [],
  }));
  await page.route(re('admin/expenses'), json(pageOf([], 10)));

  // ── Punch list, RFIs, client portal ──────────────────────────────────────
  await page.route(/\/api\/v1\/projects\/\d+\/punch-items(\?.*)?$/, route => {
    const status = qp(route.request().url(), 'status');
    return json(status ? PUNCH.filter(p => p.status === status) : PUNCH)(route);
  });
  await page.route(/\/api\/v1\/punch-items\/\d+(\?.*)?$/, route => {
    const pid = id(route.request().url(), 'punch-items');
    const item = PUNCH.find(p => p.id === pid) ?? PUNCH[0];
    return json({ ...item, events: PUNCH_THREAD[pid] ?? [], comments: PUNCH_COMMENTS[pid] ?? [] })(route);
  });
  await page.route(/\/api\/v1\/punch-items\/\d+\/comments(\?.*)?$/, route =>
    json(PUNCH_COMMENTS[id(route.request().url(), 'punch-items')] ?? [])(route));

  await page.route(/\/api\/v1\/projects\/\d+\/rfis(\?.*)?$/, route => {
    const status = qp(route.request().url(), 'status');
    return json(status ? RFIS.filter(r => r.status === status) : RFIS)(route);
  });
  await page.route(/\/api\/v1\/rfis\/\d+(\?.*)?$/, route => {
    const rid = id(route.request().url(), 'rfis');
    const rfi = RFIS.find(r => r.id === rid) ?? RFIS[0];
    return json({ ...rfi, responses: RFI_RESPONSES[rid] ?? [] })(route);
  });

  await page.route(/\/api\/v1\/projects\/\d+\/client-access(\?.*)?$/, json({
    enabled: true, active: true, pinRequired: true,
    expiresAt: '2026-12-11T06:00:00Z', version: 2,
    clientName: 'Inmobiliaria Vista Hermosa, S.A.', projectOpen: true,
    shareToken: 'demo-vista-hermosa-portal-token',
  }));
}
