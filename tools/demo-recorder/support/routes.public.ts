import type { Page, Route } from '@playwright/test';
import { CLIENTS, COMPANY, PROJECTS } from './data';
import type { Lang } from './routes';

// Fixtures for the pages that live OUTSIDE the panel — the ones a client or a
// subcontractor opens from a link, with no BuildTrack account: the project
// portal, the signature page, and the public site.
//
// These pages authenticate with a token in the URL, so nothing here depends on
// the session cookie the panel fixtures rely on.

const P1 = PROJECTS[0];
const CLIENT = CLIENTS[0];

function json(body: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const re = (path: string) => new RegExp(`/api/v1/${path}(\\?.*)?$`);

export async function installPublicApi(page: Page, lang: Lang = 'es') {
  const T = (es: string, en: string): string => (lang === 'en' ? en : es);

  // ── The client's portal ──────────────────────────────────────────────────
  await page.route(re('client-view/session'), json({
    sessionToken: 'demo-portal-session',
    expiresAt: '2026-12-11T06:00:00Z',
    project: { projectName: P1.name, clientName: CLIENT.name, address: P1.address },
  }));

  await page.route(re('client-view/site-logs'), json({
    content: [
      {
        workDate: '2026-09-17', weather: 'NUBLADO', temperatureC: 23,
        notes: T(
          'Se completó la fundición de losa del nivel 6 en torre A. La cuadrilla de acabados avanzó en el repello de los pasillos del nivel 3.',
          'Level 6 slab pour completed in tower A. The finishing crew moved on to plastering the level 3 corridors.',
        ),
        attendance: [{ name: 'Manuel Ramírez' }, { name: 'Estuardo Xoy' }, { name: 'Byron Chávez' }, { name: 'Kevin Mejía' }, { name: 'Diego López' }],
        tasksDone: [
          { description: T('Fundición de losa — nivel 6, torre A', 'Slab pour — level 6, tower A') },
          { description: T('Repello de pasillos nivel 3', 'Level 3 corridor plastering') },
        ],
        photos: [], createdAt: '2026-09-17T23:10:00Z', updatedAt: '2026-09-17T23:10:00Z',
      },
      {
        workDate: '2026-09-16', weather: 'LLUVIA', temperatureC: 19,
        notes: T(
          'Media jornada por lluvia fuerte desde mediodía. Se protegió el acero expuesto de la torre B.',
          'Half a day: heavy rain from midday. Exposed rebar in tower B was covered.',
        ),
        attendance: [{ name: 'Manuel Ramírez' }, { name: 'Estuardo Xoy' }, { name: 'Kevin Mejía' }],
        tasksDone: [{ description: T('Protección de acero expuesto — torre B', 'Exposed rebar protection — tower B') }],
        photos: [], createdAt: '2026-09-16T22:40:00Z', updatedAt: '2026-09-16T22:40:00Z',
      },
    ],
    page: 0, size: 20, totalElements: 2, totalPages: 1,
  }));

  await page.route(re('client-view/punch-items'), json({
    content: [
      {
        id: 501, itemNumber: 3, displayNumber: '#003',
        title: T('Filtración en ventana de sala — apartamento 402', 'Leak at the living-room window — unit 402'),
        description: T('Entra agua por la esquina inferior derecha cuando llueve fuerte.', 'Water comes in at the bottom right corner in heavy rain.'),
        location: T('Torre A · Nivel 4 · Apto 402', 'Tower A · Level 4 · Unit 402'),
        status: 'READY_FOR_REVIEW', createdAt: '2026-09-02T16:00:00Z',
        readyAt: '2026-09-11T21:40:00Z',
        readyNote: T('Se resellló el marco completo y se probó con manguera.', 'The whole frame was resealed and hose-tested.'),
        closedAt: null, closedByCompany: false, closeNote: null, lastRejectNote: null,
        canReview: true, commentCount: 3, photos: [],
      },
      {
        id: 502, itemNumber: 2, displayNumber: '#002',
        title: T('Repello con desnivel en pasillo del nivel 3', 'Uneven plaster in the level 3 corridor'),
        description: null, location: T('Torre A · Nivel 3 · Pasillo', 'Tower A · Level 3 · Corridor'),
        status: 'IN_PROGRESS', createdAt: '2026-09-04T16:00:00Z',
        readyAt: null, readyNote: null, closedAt: null, closedByCompany: false,
        closeNote: null, lastRejectNote: null, canReview: false, commentCount: 1, photos: [],
      },
      {
        id: 503, itemNumber: 1, displayNumber: '#001',
        title: T('Puerta de closet no cierra — apartamento 301', 'Closet door will not close — unit 301'),
        description: null, location: T('Torre A · Nivel 3 · Apto 301', 'Tower A · Level 3 · Unit 301'),
        status: 'CLOSED', createdAt: '2026-08-28T16:00:00Z',
        readyAt: '2026-09-05T20:00:00Z', readyNote: null,
        closedAt: '2026-09-06T22:15:00Z', closedByCompany: false,
        closeNote: T('Revisado en sitio, quedó bien.', 'Checked on site, all good.'),
        lastRejectNote: null, canReview: false, commentCount: 2, photos: [],
      },
    ],
    page: 0, size: 20, totalElements: 3, totalPages: 1,
  }));
  await page.route(/\/api\/v1\/client-view\/punch-items\/\d+\/comments(\?.*)?$/, json([
    { id: 1, byClient: true, body: T('Sigue entrando agua con la lluvia de ayer.', 'Water still came in with yesterday’s rain.'), createdAt: '2026-09-08T22:10:00Z' },
    { id: 2, byClient: false, body: T('Vamos mañana temprano a revisar el sellador.', 'We will check the sealant first thing tomorrow.'), createdAt: '2026-09-09T13:35:00Z' },
    { id: 3, byClient: false, body: T('Listo, resellado y probado con manguera. Queda pendiente su revisión.', 'Done — resealed and hose-tested. Waiting on your review.'), createdAt: '2026-09-11T21:41:00Z' },
  ]));

  await page.route(re('client-view/rfis'), json({
    content: [
      {
        id: 601, rfiNumber: 4, displayNumber: 'RFI #004',
        subject: T('Acabado de gradas en torre B', 'Stair finish in tower B'),
        question: T('¿El cliente confirma granito pulido en las gradas de la torre B, o se mantiene el concreto visto del plano A-204?', 'Does the client confirm polished granite on the tower B stairs, or does the exposed concrete on drawing A-204 stand?'),
        status: 'OPEN', awaitingClient: true, dueDate: '2026-09-19', overdue: false,
        canRespond: true, sentAt: '2026-09-09T16:30:00Z', respondedAt: null, closedAt: null,
        officialResponseId: null, responseCount: 1, questionPhotos: [],
      },
      {
        id: 602, rfiNumber: 3, displayNumber: 'RFI #003',
        subject: T('Ubicación de tomas en cocina — tipo 2', 'Outlet locations in the type 2 kitchen'),
        question: T('El plano eléctrico y el de mobiliario no coinciden en la altura de las tomas sobre el poyo.', 'The electrical and millwork drawings disagree on outlet height above the counter.'),
        status: 'OPEN', awaitingClient: true, dueDate: '2026-09-08', overdue: true,
        canRespond: true, sentAt: '2026-09-01T15:10:00Z', respondedAt: null, closedAt: null,
        officialResponseId: null, responseCount: 0, questionPhotos: [],
      },
      {
        id: 603, rfiNumber: 2, displayNumber: 'RFI #002',
        subject: T('Especificación de impermeabilizante en losa', 'Waterproofing spec on the slab'),
        question: T('¿Se acepta el sustituto de la misma ficha técnica por desabastecimiento del especificado?', 'Is an equivalent-spec substitute acceptable, given the specified product is out of stock?'),
        status: 'CLOSED', awaitingClient: false, dueDate: '2026-08-22', overdue: false,
        canRespond: false, sentAt: '2026-08-15T14:00:00Z', respondedAt: '2026-08-20T16:20:00Z',
        closedAt: '2026-08-21T15:00:00Z', officialResponseId: 92, responseCount: 2, questionPhotos: [],
      },
    ],
    page: 0, size: 20, totalElements: 3, totalPages: 1,
  }));
  await page.route(/\/api\/v1\/client-view\/rfis\/\d+\/responses(\?.*)?$/, json([
    { id: 91, byClient: true, body: T('Confirmamos granito pulido. Enviamos la muestra aprobada el lunes.', 'Polished granite confirmed. We will send the approved sample on Monday.'), official: false, photos: [], createdAt: '2026-09-11T22:05:00Z' },
  ]));

  // ── The signature page ───────────────────────────────────────────────────
  const line = (description: string, quantity: number, unitPriceCents: number) => ({
    description, quantity, unitPriceCents, subtotalCents: quantity * unitPriceCents,
  });
  const items = [
    line(T('Obra gris torres A y B — avance del período (m²)', 'Structural work, towers A and B — progress this period (m²)'), 1, 148_000_00),
    line(T('Instalaciones hidrosanitarias — niveles 4 a 6', 'Plumbing — levels 4 to 6'), 1, 26_000_00),
    line(T('Dirección técnica y supervisión del período', 'Technical direction and supervision for the period'), 1, 12_000_00),
  ];
  const subtotal = items.reduce((a, i) => a + i.subtotalCents, 0);
  await page.route(re('sign/session'), json({
    sessionToken: 'demo-sign-session', expiresInMinutes: 60,
    document: {
      documentKind: 'INVOICE', documentNumber: 'FAC-2026-041',
      companyName: COMPANY, clientName: CLIENT.name, projectName: P1.name,
      description: T('Estimación #7 — avance de obra gris torres A y B', 'Progress billing #7 — structural work, towers A and B'),
      issuedDate: '2026-09-01', dueDate: '2026-09-30',
      lineItems: items,
      subtotalCents: subtotal, discountCents: 0, taxRate: '12',
      taxCents: Math.round(subtotal * 0.12), totalCents: Math.round(subtotal * 1.12),
      currency: 'USD', notes: null,
      documentHash: 'a3f1c9e27b04d85f', expiresAt: '2026-09-24T06:00:00Z',
    },
  }));

  // ── The public site ──────────────────────────────────────────────────────

  // The status page does not read our API: it probes the backend's actuator
  // health directly, at an absolute URL. Left alone it reports "cannot check
  // from here", which is true of a laptop and useless in a manual.
  await page.route('**/actuator/health', json({ status: 'UP' }));

  // The invitation link an admin sends a new user. Without this the page draws
  // its expired state, which is the one screen nobody wants to be shown.
  await page.route(/\/api\/v1\/auth\/invitations\/[^/]+$/, json({
    role: 'WORKER', tenantName: COMPANY, tenantSlug: 'andes',
    invitedByName: 'Ana Lucía Pérez', expiresAt: '2026-09-24T06:00:00Z',
  }));
}
