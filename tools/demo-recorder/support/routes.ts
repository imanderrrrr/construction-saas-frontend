import type { Page, Route } from '@playwright/test';
import { CLIENTS, COMPANY, PROJECTS, PROJECTS_SUMMARY, TIMEZONE, TODAY, USERS, clientPage, page as pageOf } from './data';

// Network fixtures for the demo clips.
//
// Registered AFTER installHermeticBase, so these win over its catch-all 500.
// Routes are REGEXES on purpose: Playwright's glob syntax treats `?` as a
// single-character wildcard, so `**/projects?**` also swallows `projects/7`.
//
// Every fixture is built for ONE language. The chrome follows the panel's own
// i18n, but the CONTENT is ours — an English clip whose punch items and RFIs
// are written in Spanish is exactly the mismatch these clips exist to avoid.
// Proper nouns (jobsites, clients, people, addresses) stay as they are: a
// Guatemalan builder does not rename its projects for an English reader.

export type Lang = 'es' | 'en';

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

export function installDemoApi(page: Page, lang: Lang = 'es') {
  /** Pick the string for the language being recorded. */
  const T = (es: string, en: string): string => (lang === 'en' ? en : es);

  // ── Change orders ─────────────────────────────────────────────────────────
  const CHANGE_ORDERS: Record<number, unknown[]> = {
    1: [
      { id: 11, number: 'OC-03', description: T('Cambio de ventanería a vidrio templado 10 mm (torres A y B)', 'Window change to 10 mm tempered glass (towers A and B)'), amountCents: 78_400_00, createdBy: 'analucia', createdAt: '2026-07-22T16:10:00Z' },
      { id: 12, number: 'OC-02', description: T('Refuerzo de cimentación en sótano 2 por estudio de suelos', 'Foundation reinforcement on basement 2 after the soil report'), amountCents: 31_600_00, createdBy: 'analucia', createdAt: '2026-05-14T15:40:00Z' },
      { id: 13, number: 'OC-01', description: T('Ampliación de garita y muro perimetral', 'Gatehouse extension and perimeter wall'), amountCents: 14_500_00, createdBy: 'analucia', createdAt: '2026-03-08T17:25:00Z' },
    ],
    3: [{ id: 14, number: 'OC-01', description: T('Piso industrial endurecido en área de carga', 'Hardened industrial floor in the loading area'), amountCents: 32_000_00, createdBy: 'analucia', createdAt: '2026-06-30T15:00:00Z' }],
    4: [{ id: 15, number: 'OC-01', description: T('Restauración de artesonado en el salón principal', 'Coffered ceiling restoration in the main hall'), amountCents: 68_000_00, createdBy: 'analucia', createdAt: '2026-08-05T14:30:00Z' }],
  };

  // ── Contract balance history (project 1) ──────────────────────────────────
  const CONTRACT_HISTORY: Record<number, unknown[]> = {
    1: [
      { id: 71, changeType: 'PAYABLE_DEDUCTION',  amountCents: -278_000_00, balanceAfterCents:   535_500_00, referenceId: 401, description: T('Materiales y fletes de agosto', 'August materials and freight'),   createdAt: '2026-09-05T15:10:00Z' },
      { id: 72, changeType: 'EXPENSE_DEDUCTION',  amountCents: -336_500_00, balanceAfterCents:   813_500_00, referenceId: null, description: T('Gastos aprobados del periodo', 'Approved expenses for the period'), createdAt: '2026-08-14T16:20:00Z' },
      { id: 73, changeType: 'LABOR_PAYMENT',      amountCents: -310_000_00, balanceAfterCents: 1_150_000_00, referenceId: null, description: T('Nómina quincenal de obra', 'Biweekly site payroll'),               createdAt: '2026-07-05T17:00:00Z' },
      { id: 74, changeType: 'PAYABLE_DEDUCTION',  amountCents: -260_000_00, balanceAfterCents: 1_410_000_00, referenceId: 402, description: T('Acero de refuerzo y concreto', 'Rebar and concrete'),                createdAt: '2026-05-20T15:45:00Z' },
      { id: 75, changeType: 'INITIAL_ASSIGNMENT', amountCents: 1_720_000_00, balanceAfterCents: 1_720_000_00, referenceId: null, description: T('Presupuesto de costos inicial', 'Initial cost budget'),            createdAt: '2026-01-15T14:00:00Z' },
    ],
  };

  // ── Invoices (receivables, amounts in dollars) ────────────────────────────
  const RECEIVABLES = [
    { id: 301, invoiceNumber: 'FAC-2026-041', client: 'Inmobiliaria Vista Hermosa, S.A.', project: 'Residencial Vista Hermosa II', projectId: 1, description: T('Estimación #7 — avance de obra gris torres A y B', 'Progress billing #7 — structural work, towers A and B'), issuedDate: '2026-09-01', dueDate: '2026-09-30', subtotal: 186_000, discount: 0, taxRate: 12, tax: 22_320, amount: 208_320, paidAmount: 0, status: 'PENDING' },
    { id: 302, invoiceNumber: 'FAC-2026-040', client: 'Grupo Corporativo Zona 10', project: 'Torre Corporativa Zona 10', projectId: 2, description: T('Estimación #4 — estructura niveles 5 a 8', 'Progress billing #4 — structure, levels 5 to 8'), issuedDate: '2026-08-28', dueDate: '2026-09-27', subtotal: 240_000, discount: 0, taxRate: 12, tax: 28_800, amount: 268_800, paidAmount: 150_000, status: 'PARTIAL' },
    { id: 303, invoiceNumber: 'FAC-2026-039', client: 'Logística del Sur, S.A.', project: 'Bodega Industrial Villa Nueva', projectId: 3, description: T('Estimación #5 — losa y cubierta metálica', 'Progress billing #5 — slab and metal roof'), issuedDate: '2026-08-20', dueDate: '2026-09-04', subtotal: 96_000, discount: 0, taxRate: 12, tax: 11_520, amount: 107_520, paidAmount: 0, status: 'OVERDUE' },
    { id: 304, invoiceNumber: 'FAC-2026-038', client: 'Hotelera Colonial', project: 'Remodelación Hotel Antigua', projectId: 4, description: T('Estimación #3 — acabados ala sur', 'Progress billing #3 — south wing finishes'), issuedDate: '2026-08-12', dueDate: '2026-09-11', subtotal: 64_000, discount: 0, taxRate: 12, tax: 7_680, amount: 71_680, paidAmount: 71_680, status: 'PAID' },
    { id: 305, invoiceNumber: 'FAC-2026-037', client: 'Inmobiliaria Vista Hermosa, S.A.', project: 'Ampliación Colegio San Marcos', projectId: 6, description: T('Anticipo de contrato 20 %', '20% contract advance'), issuedDate: '2026-08-04', dueDate: '2026-08-19', subtotal: 156_000, discount: 0, taxRate: 12, tax: 18_720, amount: 174_720, paidAmount: 174_720, status: 'PAID' },
    { id: 306, invoiceNumber: 'FAC-2026-036', client: 'Grupo Corporativo Zona 10', project: 'Torre Corporativa Zona 10', projectId: 2, description: T('Estimación #3 — sótanos y cisterna', 'Progress billing #3 — basements and cistern'), issuedDate: '2026-07-30', dueDate: '2026-08-29', subtotal: 180_000, discount: 0, taxRate: 12, tax: 21_600, amount: 201_600, paidAmount: 201_600, status: 'PAID' },
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
    description: T('Cambio de ventanería a vidrio templado 10 mm', 'Window change to 10 mm tempered glass'),
    issuedDate: '2026-09-09', dueDate: '2026-09-24',
    subtotal: 78_400, discount: 0, taxRate: 12, tax: 9_408, amount: 87_808, paidAmount: 0,
    status: 'PENDING_APPROVAL', notes: null, approvedBy: null, approvedAt: null,
    lineItems: [], payments: [], createdAt: '2026-09-09T16:00:00Z', updatedAt: '2026-09-09T16:00:00Z',
  }];

  // ── Bills (payables, amounts in dollars) ──────────────────────────────────
  const PAYABLES = [
    { id: 401, billNumber: 'CP-2026-118', vendor: 'Cementos del Valle', category: T('MATERIALES', 'MATERIALS'), project: 'Residencial Vista Hermosa II', projectId: 1, description: T('420 sacos de cemento UGC 42.5', '420 bags of 42.5 general-use cement'), receivedDate: '2026-09-03', dueDate: '2026-09-18', amount: 18_480, paidAmount: 0, status: 'PENDING' },
    { id: 402, billNumber: 'CP-2026-117', vendor: 'Aceros Centroamericanos', category: T('MATERIALES', 'MATERIALS'), project: 'Torre Corporativa Zona 10', projectId: 2, description: T('Varilla No. 5 y No. 6 — 12 toneladas', '#5 and #6 rebar — 12 tons'), receivedDate: '2026-08-29', dueDate: '2026-09-13', amount: 62_400, paidAmount: 30_000, status: 'PARTIAL' },
    { id: 403, billNumber: 'CP-2026-116', vendor: 'Transportes Quetzal', category: T('FLETES', 'FREIGHT'), project: 'Bodega Industrial Villa Nueva', projectId: 3, description: T('Acarreo de material selecto — 14 viajes', 'Select fill haulage — 14 loads'), receivedDate: '2026-08-22', dueDate: '2026-09-06', amount: 8_960, paidAmount: 0, status: 'OVERDUE' },
    { id: 404, billNumber: 'CP-2026-115', vendor: 'Alquiler de Equipo Tikal', category: T('EQUIPO', 'EQUIPMENT'), project: 'Residencial Vista Hermosa II', projectId: 1, description: T('Renta de bomba de concreto — 6 días', 'Concrete pump rental — 6 days'), receivedDate: '2026-08-18', dueDate: '2026-09-02', amount: 12_600, paidAmount: 12_600, status: 'PAID' },
    { id: 405, billNumber: 'CP-2026-114', vendor: 'Eléctricos GT', category: T('SUBCONTRATO', 'SUBCONTRACT'), project: 'Torre Corporativa Zona 10', projectId: 2, description: T('Canalización eléctrica niveles 1 a 4', 'Electrical conduit, levels 1 to 4'), receivedDate: '2026-08-15', dueDate: '2026-09-14', amount: 46_200, paidAmount: 0, status: 'PENDING' },
    { id: 406, billNumber: 'CP-2026-113', vendor: 'Ferretería La Esperanza', category: T('MATERIALES', 'MATERIALS'), project: 'Remodelación Hotel Antigua', projectId: 4, description: T('Herrajes, selladores y pintura base', 'Hardware, sealants and primer'), receivedDate: '2026-08-11', dueDate: '2026-08-26', amount: 5_340, paidAmount: 5_340, status: 'PAID' },
  ].map(b => ({
    ...b,
    documentType: 'BILL' as const,
    invoiceNumber: null,
    notes: null,
    payments: b.paidAmount > 0 ? [{ id: b.id * 10, date: b.receivedDate, amount: b.paidAmount, method: 'TRANSFER', reference: 'TRF-' + b.id, approvedBy: 'analucia' }] : [],
    createdAt: b.receivedDate + 'T15:00:00Z',
    updatedAt: b.receivedDate + 'T15:00:00Z',
  }));

  // ── Punch list (project 1) ────────────────────────────────────────────────
  const PUNCH = [
    { id: 501, itemNumber: 3, displayNumber: '#003', origin: 'CLIENT', title: T('Filtración en ventana de sala — apartamento 402', 'Leak at the living-room window — unit 402'), description: T('Entra agua por la esquina inferior derecha cuando llueve fuerte.', 'Water comes in at the bottom right corner in heavy rain.'), location: T('Torre A · Nivel 4 · Apto 402', 'Tower A · Level 4 · Unit 402'), status: 'READY_FOR_REVIEW', assigneeId: 3, assigneeName: 'Manuel Ramírez', dueDate: '2026-09-15', createdByName: 'Lucía Morales', createdByClient: true, readyAt: '2026-09-11T21:40:00Z', readyNote: T('Se resellló el marco completo y se probó con manguera.', 'The whole frame was resealed and hose-tested.'), commentCount: 3 },
    { id: 502, itemNumber: 2, displayNumber: '#002', origin: 'INTERNAL', title: T('Repello con desnivel en pasillo del nivel 3', 'Uneven plaster in the level 3 corridor'), description: T('El maestro reporta desnivel de 8 mm en 4 m.', 'The foreman reports an 8 mm deviation over 4 m.'), location: T('Torre A · Nivel 3 · Pasillo', 'Tower A · Level 3 · Corridor'), status: 'IN_PROGRESS', assigneeId: 4, assigneeName: 'Estuardo Xoy', dueDate: '2026-09-18', createdByName: 'Julio Castillo', createdByClient: false, commentCount: 1 },
    { id: 503, itemNumber: 1, displayNumber: '#001', origin: 'CLIENT', title: T('Puerta de closet no cierra — apartamento 301', 'Closet door will not close — unit 301'), description: null, location: T('Torre A · Nivel 3 · Apto 301', 'Tower A · Level 3 · Unit 301'), status: 'CLOSED', assigneeId: 5, assigneeName: 'Byron Chávez', dueDate: '2026-09-05', createdByName: 'Lucía Morales', createdByClient: true, closedAt: '2026-09-06T22:15:00Z', closedByName: 'Lucía Morales', closedByClient: true, closeNote: T('Revisado en sitio, quedó bien.', 'Checked on site, all good.'), commentCount: 2 },
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
      { type: 'COMMENT', actorName: 'Manuel Ramírez', byClient: false, note: T('Se detectó sellador vencido en el marco.', 'Found expired sealant in the frame.'), createdAt: '2026-09-10T15:05:00Z' },
      { type: 'READY', actorName: 'Manuel Ramírez', byClient: false, note: T('Se resellló el marco completo y se probó con manguera.', 'The whole frame was resealed and hose-tested.'), createdAt: '2026-09-11T21:40:00Z' },
    ],
  };

  const PUNCH_COMMENTS: Record<number, unknown[]> = {
    501: [
      { id: 1, authorName: null, byClient: true, body: T('Sigue entrando agua con la lluvia de ayer.', 'Water still came in with yesterday’s rain.'), createdAt: '2026-09-08T22:10:00Z' },
      { id: 2, authorName: 'Manuel Ramírez', byClient: false, body: T('Vamos mañana temprano a revisar el sellador.', 'We will check the sealant first thing tomorrow.'), createdAt: '2026-09-09T13:35:00Z' },
      { id: 3, authorName: 'Manuel Ramírez', byClient: false, body: T('Listo, resellado y probado con manguera. Queda pendiente su revisión.', 'Done — resealed and hose-tested. Waiting on your review.'), createdAt: '2026-09-11T21:41:00Z' },
    ],
  };

  // ── RFIs (project 1) ──────────────────────────────────────────────────────
  const RFIS = [
    { id: 601, rfiNumber: 4, displayNumber: 'RFI #004', subject: T('Acabado de gradas en torre B', 'Stair finish in tower B'), question: T('¿El cliente confirma granito pulido en las gradas de la torre B, o se mantiene el concreto visto del plano A-204?', 'Does the client confirm polished granite on the tower B stairs, or does the exposed concrete on drawing A-204 stand?'), status: 'OPEN', ballInCourt: 'CLIENT', overdue: false, dueDate: '2026-09-16', costImpact: 'YES', costImpactAmountCents: 18_600_00, scheduleImpact: 'TBD', scheduleImpactDays: null, submittedAt: '2026-09-09T16:30:00Z', responseCount: 1 },
    { id: 602, rfiNumber: 3, displayNumber: 'RFI #003', subject: T('Ubicación de tomas en cocina — tipo 2', 'Outlet locations in the type 2 kitchen'), question: T('El plano eléctrico y el de mobiliario no coinciden en la altura de las tomas sobre el poyo.', 'The electrical and millwork drawings disagree on outlet height above the counter.'), status: 'OPEN', ballInCourt: 'CLIENT', overdue: true, dueDate: '2026-09-08', costImpact: 'NO', costImpactAmountCents: null, scheduleImpact: 'NO', scheduleImpactDays: null, submittedAt: '2026-09-01T15:10:00Z', responseCount: 0 },
    { id: 603, rfiNumber: 2, displayNumber: 'RFI #002', subject: T('Especificación de impermeabilizante en losa', 'Waterproofing spec on the slab'), question: T('¿Se acepta el sustituto de la misma ficha técnica por desabastecimiento del especificado?', 'Is an equivalent-spec substitute acceptable, given the specified product is out of stock?'), status: 'CLOSED', ballInCourt: 'NONE', overdue: false, dueDate: '2026-08-22', costImpact: 'NO', costImpactAmountCents: null, scheduleImpact: 'YES', scheduleImpactDays: 4, submittedAt: '2026-08-15T14:00:00Z', respondedAt: '2026-08-20T16:20:00Z', closedAt: '2026-08-21T15:00:00Z', closedByName: 'Ana Lucía Pérez', responseCount: 2 },
  ].map(r => ({
    respondedAt: null, closedAt: null, closedByName: null, officialResponseId: null,
    createdByName: 'Julio Castillo', submittedByName: 'Julio Castillo', closable: false,
    questionPhotos: [] as unknown[], responses: [] as unknown[], events: [] as unknown[],
    createdAt: '2026-08-15T14:00:00Z', updatedAt: '2026-09-09T16:30:00Z',
    ...r,
  }));

  const RFI_RESPONSES: Record<number, unknown[]> = {
    601: [{ id: 91, authorName: null, byClient: true, body: T('Confirmamos granito pulido. Enviamos la muestra aprobada el lunes.', 'Polished granite confirmed. We will send the approved sample on Monday.'), official: false, photos: [], createdAt: '2026-09-11T22:05:00Z' }],
    603: [
      { id: 92, authorName: null, byClient: true, body: T('Aceptado el sustituto siempre que mantenga la garantía de 10 años.', 'Substitute accepted as long as the 10-year warranty holds.'), official: true, photos: [], createdAt: '2026-08-20T16:20:00Z' },
      { id: 93, authorName: 'Julio Castillo', byClient: false, body: T('Garantía confirmada por el proveedor. Se procede.', 'Warranty confirmed by the supplier. Proceeding.'), official: false, photos: [], createdAt: '2026-08-21T14:40:00Z' },
    ],
  };

  // ── Worker expenses (Todos los gastos) ────────────────────────────────────
  const EXPENSES = [
    { id: 901, workerId: 3, workerName: 'Manuel Ramírez', workerUsername: 'mramirez', projectId: 1, projectName: 'Residencial Vista Hermosa II', expenseType: 'MATERIALS',       amountCents: 1_240_00, expenseDate: '2026-09-11', description: T('Cemento y arena para el repello del nivel 3', 'Cement and sand for the level 3 plaster'), status: 'PENDING',  receiptUrl: '/api/v1/expenses/901/receipt', reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null },
    { id: 902, workerId: 4, workerName: 'Estuardo Xoy',   workerUsername: 'exoy',     projectId: 1, projectName: 'Residencial Vista Hermosa II', expenseType: 'FUEL',            amountCents:   380_00, expenseDate: '2026-09-11', description: T('Diésel para la bomba de concreto', 'Diesel for the concrete pump'), status: 'PENDING',  receiptUrl: null, reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null },
    { id: 903, workerId: 5, workerName: 'Byron Chávez',   workerUsername: 'bchavez',  projectId: 2, projectName: 'Torre Corporativa Zona 10',    expenseType: 'PER_DIEM',        amountCents:   210_00, expenseDate: '2026-09-10', description: T('Almuerzo de cuadrilla, turno extendido', 'Crew lunch, extended shift'), status: 'PENDING',  receiptUrl: '/api/v1/expenses/903/receipt', reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null },
    { id: 904, workerId: 6, workerName: 'Kevin Mejía',    workerUsername: 'kmejia',   projectId: 3, projectName: 'Bodega Industrial Villa Nueva', expenseType: 'TRANSPORTATION',  amountCents:   150_00, expenseDate: '2026-09-09', description: T('Flete de herramienta a bodega', 'Tool haulage to the warehouse'), status: 'OBSERVED', receiptUrl: '/api/v1/expenses/904/receipt', reviewerId: 1, reviewerName: 'Ana Lucía Pérez', reviewerComment: T('Falta la foto legible de la factura; el monto no se lee.', 'The invoice photo is not legible; the amount cannot be read.'), reviewedAt: '2026-09-09T22:10:00Z' },
    { id: 905, workerId: 3, workerName: 'Manuel Ramírez', workerUsername: 'mramirez', projectId: 1, projectName: 'Residencial Vista Hermosa II', expenseType: 'TOOLS',           amountCents:   890_00, expenseDate: '2026-09-08', description: T('Discos de corte y brocas', 'Cutting discs and drill bits'), status: 'APPROVED', receiptUrl: '/api/v1/expenses/905/receipt', reviewerId: 1, reviewerName: 'Ana Lucía Pérez', reviewerComment: null, reviewedAt: '2026-09-08T20:05:00Z' },
    { id: 906, workerId: 7, workerName: 'Diego López',    workerUsername: 'dlopez',   projectId: 4, projectName: 'Remodelación Hotel Antigua',    expenseType: 'MINOR_PURCHASES', amountCents:   460_00, expenseDate: '2026-09-05', description: T('Silicón, guantes y lija', 'Silicone, gloves and sandpaper'), status: 'APPROVED', receiptUrl: '/api/v1/expenses/906/receipt', reviewerId: 1, reviewerName: 'Ana Lucía Pérez', reviewerComment: T('Aprobado con nota: dividir por obra la próxima vez.', 'Approved with a note: split it per jobsite next time.'), reviewedAt: '2026-09-05T21:40:00Z' },
    { id: 907, workerId: 5, workerName: 'Byron Chávez',   workerUsername: 'bchavez',  projectId: 2, projectName: 'Torre Corporativa Zona 10',    expenseType: 'OTHER',           amountCents: 2_100_00, expenseDate: '2026-09-03', description: T('Reparación de andamio (sin factura)', 'Scaffold repair (no invoice)'), status: 'REJECTED', receiptUrl: null, reviewerId: 1, reviewerName: 'Ana Lucía Pérez', reviewerComment: T('Sin comprobante y fuera de presupuesto de la obra.', 'No receipt, and outside the jobsite budget.'), reviewedAt: '2026-09-03T23:15:00Z' },
  ].map(e => ({ ...e, createdAt: e.expenseDate + 'T15:00:00Z', updatedAt: e.expenseDate + 'T15:00:00Z' }));

  // ── Office expenses ──────────────────────────────────────────────────────
  const OFFICE = [
    { id: 801, description: T('Resmas de papel y tóner', 'Paper reams and toner'),               category: 'office_supplies', amount: 148.5, purchaseDate: '2026-09-11', purchasedBy: 'Ana Lucía Pérez',  notes: T('Para la impresora de planos', 'For the plan printer') },
    { id: 802, description: T('Garrafones de agua (oficina)', 'Water jugs (office)'),             category: 'food_beverages',  amount: 96.0,  purchaseDate: '2026-09-09', purchasedBy: 'Gabriela Sosa',    notes: null },
    { id: 803, description: T('Laptop para la asistente de proyectos', 'Laptop for the projects assistant'), category: 'tech_equipment', amount: 1_240.0, purchaseDate: '2026-09-05', purchasedBy: 'Ana Lucía Pérez', notes: T('Reemplaza la que se dañó en agosto', 'Replaces the one that broke in August') },
    { id: 804, description: T('Energía eléctrica — agosto', 'Electricity — August'),              category: 'utilities',       amount: 412.75, purchaseDate: '2026-09-03', purchasedBy: null,               notes: null },
    { id: 805, description: T('Servicio de limpieza mensual', 'Monthly cleaning service'),        category: 'cleaning',        amount: 350.0, purchaseDate: '2026-09-01', purchasedBy: 'Gabriela Sosa',    notes: null },
    { id: 806, description: T('Sillas para la sala de juntas', 'Chairs for the meeting room'),    category: 'furniture',       amount: 780.0, purchaseDate: '2026-08-28', purchasedBy: 'Ana Lucía Pérez',  notes: null },
  ].map(o => ({ ...o, createdAt: o.purchaseDate + 'T15:00:00Z', updatedAt: o.purchaseDate + 'T15:00:00Z' }));

  return install();

  async function install() {
    // ── Shell ──────────────────────────────────────────────────────────────
    await page.route(re('settings/timezone'), json({ timezone: TIMEZONE }));
    await page.route(re('branding'), json({ organizationName: COMPANY, hasLogo: false }));
    // Plan gate for bitácora / pendientes / consultas / portal.
    await page.route(re('site-logs/feature'), json({ enabled: true }));
    await page.route(re('admin/audit-logs'), json(pageOf([
      { id: 1, username: 'analucia', action: 'INVOICE_APPROVED', entityType: 'RECEIVABLE', entityId: '320', details: 'FAC-2026-041', createdAt: '2026-09-12T14:42:00Z' },
      { id: 2, username: 'jcastillo', action: 'PUNCH_ITEM_READY', entityType: 'PUNCH_ITEM', entityId: '501', details: '#003', createdAt: '2026-09-11T21:40:00Z' },
      { id: 3, username: 'analucia', action: 'CHANGE_ORDER_CREATED', entityType: 'PROJECT', entityId: '1', details: 'OC-03', createdAt: '2026-09-10T16:10:00Z' },
    ], 5)));

    // ── Projects, clients, crew ────────────────────────────────────────────
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

    // ── Dashboard ──────────────────────────────────────────────────────────
    await page.route(re('admin/dashboard/money'), json({
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
        lastSiteLog: { workDate: TODAY, notes: T('Fundición de losa nivel 5 completada; cuadrilla de acabados en torre A.', 'Level 5 slab pour completed; finishing crew in tower A.') },
        openPunchItems: 2, openRfis: 2, oldestOpenRfiDays: 11,
        financial: { contractCents: p.revisedContractCents, invoicedCents: p.invoicedCents, collectedCents: p.collectedCents, budgetConsumedPct: Math.round((p.totalConsumedCents / (p.budgetBaseCents || 1)) * 100) },
        workersToday: ['Manuel Ramírez', 'Estuardo Xoy', 'Byron Chávez', 'Kevin Mejía'],
      })(route);
    });

    // ── Finance ────────────────────────────────────────────────────────────
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

    // ── Expenses (also feeds the Presupuestos breakdown) ───────────────────
    await page.route(re('admin/expenses/summary'), json({ totalSubmitted: 128, totalApprovedCents: 1_312_000_00, pendingCount: 3, observedCount: 1, rejectedCount: 1 }));
    await page.route(re('admin/expenses/report'), json({
      kpis: { totalApprovedCents: 1_312_000_00, avgPerWorkerCents: 4_100_00, expenseCount: 128, topCategory: 'MATERIALS' },
      byProject: PROJECTS.map(p => ({
        projectId: p.id, projectName: p.name, approvedCents: p.approvedExpensesCents,
        pendingCount: 1, observedCount: 0, rejectedCount: 0,
        breakdown: [
          { type: 'MATERIALS', count: 24, totalCents: Math.round(p.approvedExpensesCents * 0.62) },
          { type: 'FUEL', count: 9, totalCents: Math.round(p.approvedExpensesCents * 0.14) },
          { type: 'PER_DIEM', count: 12, totalCents: Math.round(p.approvedExpensesCents * 0.11) },
          { type: 'TOOLS', count: 6, totalCents: Math.round(p.approvedExpensesCents * 0.13) },
        ],
      })),
      byWorker: USERS.filter(u => u.role === 'WORKER').map((u, i) => ({
        workerId: u.id, workerName: u.fullName, workerUsername: u.username,
        submittedCount: 18 - i * 3, approvedCount: 14 - i * 2, pendingCount: i === 0 ? 2 : 1,
        observedCount: i === 1 ? 1 : 0, rejectedCount: i === 3 ? 1 : 0,
        totalApprovedCents: (46_200_00 - i * 7_400_00),
      })),
    }));
    await page.route(re('admin/expenses'), route => {
      const url = route.request().url();
      const status = qp(url, 'status');
      const type = qp(url, 'type');
      const projectId = qp(url, 'projectId');
      const workerId = qp(url, 'workerId');
      let list = EXPENSES;
      if (status) list = list.filter(e => e.status === status);
      if (type) list = list.filter(e => e.expenseType === type);
      if (projectId) list = list.filter(e => e.projectId === Number(projectId));
      if (workerId) list = list.filter(e => e.workerId === Number(workerId));
      return json({ content: list, page: 0, size: 10, totalElements: list.length, totalPages: 1 })(route);
    });
    await page.route(re('finance/expenses'), route =>
      json({ content: EXPENSES.filter(e => e.status === 'APPROVED'), page: 0, size: 10, totalElements: 2, totalPages: 1 })(route));

    // ── Office expenses ──────────────────────────────────────────────────
    await page.route(re('admin/office-expenses'), route => {
      const url = route.request().url();
      const cat = qp(url, 'category');
      const search = (qp(url, 'search') ?? '').toLowerCase();
      let list = OFFICE;
      if (cat) list = list.filter(o => o.category === cat);
      if (search) list = list.filter(o => o.description.toLowerCase().includes(search));
      return json({ content: list, page: 0, size: 10, totalElements: list.length, totalPages: 1 })(route);
    });

    // ── Punch list, RFIs, client portal ────────────────────────────────────
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
}
