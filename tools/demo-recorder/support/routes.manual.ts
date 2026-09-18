import type { Page, Route } from '@playwright/test';
import { CLIENTS, COMPANY, PROJECTS, USERS, page as pageOf } from './data';
import type { Lang } from './routes';

// Fixtures for the SALES MANUAL stills — every screen the landing clips never
// needed, which is most of the panel: personnel, tools, supplies, tasks,
// subcontractors, office expenses, time & material, and the supervisor,
// warehouse and worker panels.
//
// Layered ON TOP of installDemoApi (registered after it, so these win where
// they overlap). Same company, same five jobsites and the same crew as the
// clips: a seller who walks the panel module by module has to see one
// business, not eleven unrelated demos.
//
// Dates sit around the capture date rather than data.ts' TODAY, because these
// screens print relative ages ("hace 3 días", "12 días fuera") and a fixture a
// week in the past reads as a system nobody has touched.

const NOW = '2026-09-17';

function json(body: unknown, status = 200) {
  return (route: Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function re(path: string): RegExp {
  return new RegExp(`/api/v1/${path}(\\?.*)?$`);
}

const qp = (url: string, key: string): string | null => new URL(url).searchParams.get(key);

const P = (id: number) => PROJECTS.find(p => p.id === id)!;
const U = (id: number) => USERS.find(u => u.id === id)!;

export async function installManualApi(page: Page, lang: Lang = 'es') {
  const T = (es: string, en: string): string => (lang === 'en' ? en : es);

  // The subscription screen. installHermeticBase answers the billing gate with
  // a period that ends in 2098 and an event id of `evt_e2e` — right for a test,
  // strange on a page a seller shows a client.
  await page.route(re('billing/status'), json({
    billingStatus: 'ACTIVE', planCode: 'PRO', billingInterval: 'MONTHLY',
    currentPeriodStartsAt: '2026-09-01', currentPeriodEndsAt: '2026-10-01',
    isTrialing: false, cancelAtPeriodEnd: false, changePlanAllowed: true,
    lastEventId: 'evt_01k5m2demo', lastEventOccurredAt: '2026-09-01T14:02:00Z',
  }));

  // ── Personnel: QR credentials, time records, hours, payroll ──────────────

  // One credential per user. The modal draws the QR from `token` client-side.
  await page.route(/\/api\/v1\/admin\/users\/\d+\/qr(\?.*)?$/, route => {
    const uid = Number(new URL(route.request().url()).pathname.split('/users/')[1].split('/')[0]);
    const u = U(uid) ?? USERS[2];
    return json({
      userId: u.id, username: u.username, fullName: u.fullName,
      token: `BT-DEMO-${u.username.toUpperCase()}`,
      pinSet: true, issuedAt: '2026-02-03T15:00:00Z', expiresAt: null,
    })(route);
  });

  // Time records — the approvals queue and the worker's own history.
  const ev = (
    id: number, type: string, at: string,
    { lat = 14.558612, lng = -90.476233, dist = 38, status = 'PENDING' } = {},
  ) => ({
    id, type, capturedAtClient: at, capturedAtServer: at,
    lat, lng, locationStatus: dist <= 120 ? 'INSIDE' : 'OUTSIDE', distanceMeters: dist,
    eventApprovalStatus: status, eventReviewComment: null,
    eventReviewerUsername: null, eventReviewedAt: null,
    sourceProjectId: null, sourceProjectName: null,
    disputeStatus: null, disputeReason: null, awardedTransitMinutes: null,
    disputeResolvedBy: null, disputeResolvedAt: null, manualCreatorUsername: null,
  });

  const record = (
    id: number, userId: number, projectId: number, workDate: string,
    { status = 'PENDING', late = false, pending = 4, out = false } = {},
  ) => {
    const u = U(userId); const p = P(projectId);
    return {
      id, workerId: u.id, workerUsername: u.username, workerName: u.fullName,
      projectId: p.id, projectName: p.name,
      projectLatitude: p.latitude, projectLongitude: p.longitude, geofenceRadiusMeters: 120,
      workDate, approvalStatus: status, isLate: late, pendingEventCount: pending,
      events: [
        ev(id * 10 + 1, 'CHECK_IN',    `${workDate}T${late ? '14:41' : '13:52'}:00Z`, { dist: out ? 640 : 41, status }),
        ev(id * 10 + 2, 'LUNCH_START', `${workDate}T18:02:00Z`, { dist: 33, status }),
        ev(id * 10 + 3, 'LUNCH_END',   `${workDate}T19:01:00Z`, { dist: 29, status }),
        ev(id * 10 + 4, 'CHECK_OUT',   `${workDate}T23:06:00Z`, { dist: 52, status }),
      ],
      reviews: status === 'APPROVED'
        ? [{ id, reviewerId: 2, reviewerName: 'Julio Castillo', status: 'APPROVED', comment: null, createdAt: `${workDate}T23:40:00Z` }]
        : [],
      createdAt: `${workDate}T13:52:00Z`, updatedAt: `${workDate}T23:06:00Z`,
    };
  };

  const TIME_RECORDS = [
    record(801, 3, 1, '2026-09-17', { late: true }),
    record(802, 4, 1, '2026-09-17'),
    record(803, 5, 2, '2026-09-17', { out: true }),
    record(804, 6, 1, '2026-09-16'),
    record(805, 7, 4, '2026-09-16', { status: 'APPROVED', pending: 0 }),
    record(806, 3, 1, '2026-09-15', { status: 'APPROVED', pending: 0 }),
    record(807, 8, 2, '2026-09-15', { status: 'APPROVED', pending: 0 }),
    record(808, 4, 3, '2026-09-14', { status: 'OBSERVED', pending: 1 }),
    record(809, 2, 1, '2026-09-17'),
    record(810, 2, 1, '2026-09-16', { status: 'APPROVED', pending: 0 }),
    record(811, 8, 2, '2026-09-17', { late: true }),
  ];

  await page.route(re('time-records'), route => {
    const url = route.request().url();
    const status = qp(url, 'approvalStatus') ?? qp(url, 'status');
    const role = qp(url, 'role');
    let list = TIME_RECORDS;
    if (status) list = list.filter(r => r.approvalStatus === status);
    if (role) list = list.filter(r => U(r.workerId).role === role);
    return json(pageOf(list, Number(qp(url, 'size') ?? 20)))(route);
  });
  await page.route(re('time-records/supervisor'), json(pageOf(TIME_RECORDS.slice(0, 5))));
  await page.route(re('time-records/supervisor/out-of-range-alerts'), json([
    { workerId: 5, workerUsername: 'bchavez', workerName: 'Byron Chávez',
      projectId: 2, projectName: P(2).name, recordId: 803,
      firstOccurredAt: `${NOW}T13:58:00Z`, eventCount: 2,
      unavailableCount: 0, unverifiableCount: 0 },
  ]));

  // The supervisor's notification tray.
  const NOTIFS = [
    { id: 1, type: 'EXPENSE_SUBMITTED', title: T('Gasto nuevo por revisar', 'New expense to review'),
      message: T('Manuel Ramírez registró $1,240.00 en Residencial Vista Hermosa II.', 'Manuel Ramírez logged $1,240.00 on Residencial Vista Hermosa II.'),
      relatedEntityType: 'EXPENSE', relatedEntityId: 501, isRead: false, createdAt: `${NOW}T18:22:00Z`, readAt: null },
    { id: 2, type: 'TIME_OUT_OF_RANGE', title: T('Marcaje fuera del área', 'Punch outside the work area'),
      message: T('Byron Chávez marcó a 640 m de Torre Corporativa Zona 10.', 'Byron Chávez punched 640 m from Torre Corporativa Zona 10.'),
      relatedEntityType: 'TIME_RECORD', relatedEntityId: 803, isRead: false, createdAt: `${NOW}T13:58:00Z`, readAt: null },
    { id: 3, type: 'PUNCH_ITEM_READY', title: T('Pendiente listo para revisión', 'Punch item ready for review'),
      message: T('#003 Filtración en ventana de sala — apartamento 402.', '#003 Leak at the living-room window — unit 402.'),
      relatedEntityType: 'PUNCH_ITEM', relatedEntityId: 501, isRead: true, createdAt: '2026-09-11T21:40:00Z', readAt: '2026-09-12T13:05:00Z' },
  ];
  await page.route(re('supervisor/notifications/unread-count'), json({ count: 2 }));
  await page.route(re('supervisor/notifications'), json({ content: NOTIFS, page: 0, size: 30, totalElements: NOTIFS.length, totalPages: 1 }));
  await page.route(re('time-records/manual/context'), json({ projects: PROJECTS, workers: USERS.filter(u => u.role === 'WORKER') }));

  // Hours report — also the source for Costo de mano de obra and Nómina.
  const dayEntry = (date: string, hours: number, projectId = 1) => ({
    date, projectId, projectName: P(projectId).name,
    clockIn: '07:52', lunchMinutes: 60, clockOut: '17:06',
    totalHours: hours, approvalStatus: 'APPROVED', reviewerName: 'Julio Castillo',
    transitMinutes: null, transitFromProject: null,
  });
  const workerHours = (userId: number, hours: number, days: number, late: number, paid?: string) => {
    const u = U(userId);
    return {
      workerId: u.id, workerName: u.fullName, workerUsername: u.username,
      workerRole: u.role, hourlyRate: u.hourlyRate,
      daysWorked: days, totalDays: 12, totalApprovedHours: hours,
      avgHoursPerDay: Math.round((hours / days) * 10) / 10,
      lateDays: late, absences: 12 - days,
      dailyEntries: ['2026-09-15', '2026-09-16', '2026-09-17'].map(d => dayEntry(d, 8.5)),
      projectedCost: Math.round(hours * (u.hourlyRate ?? 0) * 100) / 100,
      lastPaymentDate: paid ?? null,
      lastPaymentAmountCents: paid ? Math.round(hours * (u.hourlyRate ?? 0) * 100) : null,
      totalTransitHours: 0,
      unpaidApprovedHours: paid ? 0 : hours,
    };
  };
  const HOURS = [
    workerHours(3, 88.5, 11, 2, '2026-09-05'),
    workerHours(4, 84.0, 11, 0),
    workerHours(5, 79.5, 10, 1, '2026-09-05'),
    workerHours(6, 92.0, 12, 0),
    workerHours(7, 76.0, 10, 1),
    workerHours(2, 90.0, 12, 0, '2026-09-05'),
    workerHours(8, 86.5, 11, 0),
  ];
  await page.route(re('admin/hours-report'), route => {
    const role = qp(route.request().url(), 'role');
    const workers = role ? HOURS.filter(w => w.workerRole === role) : HOURS;
    const hrs = workers.reduce((a, w) => a + w.totalApprovedHours, 0);
    return json({
      kpis: {
        totalApprovedHours: Math.round(hrs * 10) / 10,
        avgHoursPerDay: 8.2,
        lateArrivals: workers.reduce((a, w) => a + w.lateDays, 0),
        absentDays: workers.reduce((a, w) => a + w.absences, 0),
        totalLaborCost: Math.round(workers.reduce((a, w) => a + (w.projectedCost ?? 0), 0)),
        totalPendingHours: 34.5,
      },
      workers,
    })(route);
  });
  await page.route(re('admin/payroll/history'), json(pageOf([
    { id: 1, workerId: 3, workerName: 'Manuel Ramírez', paidAt: '2026-09-05T21:00:00Z',
      periodFrom: '2026-08-16', periodTo: '2026-08-31', hours: 92.5, amountCents: 485_63,
      method: 'CHECK', reference: 'CHQ-2841', confirmedBy: 'analucia' },
    { id: 2, workerId: 5, workerName: 'Byron Chávez', paidAt: '2026-09-05T21:00:00Z',
      periodFrom: '2026-08-16', periodTo: '2026-08-31', hours: 88.0, amountCents: 418_00,
      method: 'CHECK', reference: 'CHQ-2842', confirmedBy: 'analucia' },
  ], 10)));

  // ── Projects: tasks, site log, supervisor views ──────────────────────────

  const task = (
    id: number, projectId: number, title: string, status: string,
    { priority = 'MEDIUM', assignee = 3, due = '2026-09-19', comments = 0, photos = 0 } = {},
  ) => {
    const u = U(assignee);
    return {
      id, projectId, projectName: P(projectId).name, title, description: null,
      status, priority, assignedToId: u.id, assignedToName: u.fullName,
      startDate: '2026-09-15', dueDate: due, sortOrder: id,
      createdById: 2, createdByName: 'Julio Castillo',
      createdAt: '2026-09-14T15:00:00Z', updatedAt: '2026-09-17T14:20:00Z',
      stepSince: '2026-09-16T15:00:00Z',
      commentCount: comments, photoCount: photos, documentCount: 0, historyCount: 3,
    };
  };
  const TASKS = [
    task(901, 1, T('Fundición de losa — nivel 6, torre A', 'Slab pour — level 6, tower A'), 'IN_PROGRESS', { priority: 'HIGH', assignee: 3, comments: 2, photos: 4 }),
    task(902, 1, T('Armado de columnas eje 4-7', 'Column rebar, gridlines 4-7'), 'TODO', { assignee: 4, due: '2026-09-22' }),
    task(903, 1, T('Instalación de ventanería torre B', 'Window install, tower B'), 'TODO', { priority: 'URGENT', assignee: 6, due: '2026-09-18' }),
    task(904, 2, T('Canalización eléctrica nivel 3', 'Electrical conduit, level 3'), 'REVIEW', { assignee: 5, comments: 1, photos: 2 }),
    task(905, 2, T('Prueba hidrostática de cisterna', 'Cistern hydrostatic test'), 'DONE', { assignee: 8, due: '2026-09-15' }),
    task(906, 3, T('Montaje de cubierta metálica — tramo 2', 'Metal roof assembly — bay 2'), 'IN_PROGRESS', { priority: 'HIGH', assignee: 4, photos: 3 }),
    task(907, 4, T('Restauración de artesonado — salón principal', 'Coffered ceiling restoration — main hall'), 'IN_PROGRESS', { assignee: 7, due: '2026-09-25', comments: 3 }),
    task(908, 6, T('Replanteo de aulas y trazo de cimentación', 'Classroom layout and foundation staking'), 'TODO', { assignee: 6, due: '2026-09-20' }),
  ];
  const taskPage = (list: unknown[]) => ({ content: list, page: 0, size: 50, totalElements: list.length, totalPages: 1 });
  const taskFilter = (url: string) => {
    const pid = qp(url, 'projectId');
    const status = qp(url, 'status');
    let list = TASKS;
    if (pid) list = list.filter(t => t.projectId === Number(pid));
    if (status) list = list.filter(t => t.status === status);
    return list;
  };
  const TASK_SUMMARY = {
    open: 7, overdue: 1, dueToday: 2, thisWeek: 5, noDates: 0, unassigned: 0,
    closedThisWeek: 3,
    openByProject: { [P(1).name]: 3, [P(2).name]: 1, [P(3).name]: 1, [P(4).name]: 1, [P(6).name]: 1 },
    openByAssignee: { 'Manuel Ramírez': 1, 'Estuardo Xoy': 2, 'Byron Chávez': 1, 'Kevin Mejía': 2, 'Diego López': 1 },
  };
  for (const base of ['admin/tasks', 'supervisor/tasks']) {
    await page.route(re(`${base}/summary`), json(TASK_SUMMARY));
    await page.route(re(base), route => json(taskPage(taskFilter(route.request().url())))(route));
  }

  // Bitácora de obra.
  const SITE_LOG = {
    id: 701, projectId: 1, projectName: P(1).name, partida: T('Estructura', 'Structure'),
    workDate: NOW, authorId: 2, authorName: 'Julio Castillo', status: 'PUBLISHED',
    weather: 'NUBLADO', temperatureC: 23,
    notes: T(
      'Se completó la fundición de losa del nivel 6 en torre A (48 m³). Cuadrilla de acabados avanzó en repello de pasillos del nivel 3. El proveedor de ventanería confirmó entrega para el lunes.',
      'Level 6 slab pour completed in tower A (48 m³). The finishing crew moved on to plastering the level 3 corridors. The window supplier confirmed delivery for Monday.',
    ),
    attendance: [3, 4, 5, 6, 7].map((uid, i) => ({
      id: 7100 + i, workerId: uid, name: U(uid).fullName, role: U(uid).role,
      source: 'TIME_RECORD', checkInTime: `${NOW}T${i === 0 ? '13:41' : '12:52'}:00Z`,
    })),
    tasksDone: [
      { id: 7201, kanbanTaskId: 901, description: T('Fundición de losa — nivel 6, torre A', 'Slab pour — level 6, tower A'), partida: T('Estructura', 'Structure') },
      { id: 7202, kanbanTaskId: null, description: T('Repello de pasillos nivel 3', 'Level 3 corridor plastering'), partida: T('Acabados', 'Finishes') },
    ],
    photos: [], createdAt: `${NOW}T23:10:00Z`, updatedAt: `${NOW}T23:10:00Z`,
  };
  await page.route(/\/api\/v1\/projects\/\d+\/site-logs\/attendance-suggestion(\?.*)?$/, json({
    attendance: [3, 4, 5, 6, 7].map(uid => ({ workerId: uid, name: U(uid).fullName, role: U(uid).role, checkInTime: `${NOW}T12:52:00Z` })),
    doneTasks: [{ kanbanTaskId: 901, title: SITE_LOG.tasksDone[0].description, partida: SITE_LOG.tasksDone[0].partida }],
  }));
  await page.route(/\/api\/v1\/projects\/\d+\/site-logs(\?.*)?$/, route => {
    const url = route.request().url();
    if (qp(url, 'date')) return json(SITE_LOG)(route);
    return json(pageOf([
      { id: 701, workDate: NOW, status: 'PUBLISHED', weather: 'NUBLADO', attendanceCount: 5, tasksDoneCount: 2, photoCount: 0 },
      { id: 700, workDate: '2026-09-16', status: 'PUBLISHED', weather: 'LLUVIA', attendanceCount: 5, tasksDoneCount: 3, photoCount: 2 },
      { id: 699, workDate: '2026-09-15', status: 'PUBLISHED', weather: 'SOLEADO', attendanceCount: 6, tasksDoneCount: 2, photoCount: 1 },
    ], 10))(route);
  });
  await page.route(/\/api\/v1\/site-logs\/\d+(\?.*)?$/, json(SITE_LOG));

  // Supervisor panel.
  const dashUser = (uid: number) => ({ id: U(uid).id, username: U(uid).username, fullName: U(uid).fullName, role: U(uid).role });
  await page.route(re('supervisor/dashboard'), json({
    assignedProjects: 4, activeProjects: 4, closedProjects: 1,
    pendingApprovals: 5, pendingApprovalsToday: 3,
    projects: [1, 2, 3, 4].map(id => ({
      id, name: P(id).name, status: 'ACTIVE',
      members: P(id).assignedUserIds.length,
      contractAmountCents: P(id).revisedContractCents,
      assignedUsers: P(id).assignedUserIds.map(dashUser),
    })),
  }));
  await page.route(re('supervisor/dashboard/projects'), json([1, 2, 3, 4].map(id => ({
    id, name: P(id).name, status: 'ACTIVE',
    contractAmountCents: P(id).revisedContractCents,
    hoursThisWeek: [112, 78, 54, 36][id - 1] ?? 40,
    approvedRecordsThisWeek: [14, 9, 6, 4][id - 1] ?? 4,
    pendingRecordsThisWeek: [3, 1, 1, 0][id - 1] ?? 0,
    teamTotal: P(id).assignedUserIds.length, teamActiveToday: Math.max(1, P(id).assignedUserIds.length - 1),
    lastActivityAt: `${NOW}T23:06:00Z`,
    assignedUsers: P(id).assignedUserIds.map(dashUser),
  }))));

  // ── Subcontractors ───────────────────────────────────────────────────────
  await page.route(re('admin/subcontractors/summary'), json({
    activeSubcontractors: 2, openJobs: 3, balanceDueCents: 94_600_00,
    totalJobs: 7, jobsInReview: 1, jobsOverdue: 1,
    invoicesToReview: 1, invoicesToPayCount: 2,
    invoicesToPayCents: 94_600_00, paidThisMonthCents: 38_400_00,
  }));
  await page.route(re('admin/subcontractors/directory'), json({
    content: [
      { subcontractorId: 11, fullName: 'Eléctricos GT', username: 'electgt', email: 'ventas@electricosgt.example',
        status: 'ACTIVE', totalJobs: 4, openJobs: 2, overdueJobs: 1, invoicesToPay: 1, balanceCents: 46_200_00 },
      { subcontractorId: 12, fullName: 'Vidrios del Valle', username: 'vidriosv', email: 'contacto@vidriosdelvalle.example',
        status: 'ACTIVE', totalJobs: 3, openJobs: 1, overdueJobs: 0, invoicesToPay: 1, balanceCents: 48_400_00 },
    ], page: 0, size: 20, totalElements: 2, totalPages: 1,
  }));
  const SUB_JOBS = [
    { id: 61, subcontractorId: 11, subcontractorName: 'Eléctricos GT', projectId: 2, projectName: P(2).name,
      title: T('Canalización eléctrica niveles 1 a 4', 'Electrical conduit, levels 1 to 4'), description: null,
      status: 'IN_REVIEW', agreedAmountCents: 46_200_00, dueDate: '2026-09-12',
      assignedAt: '2026-08-04T15:00:00Z', startedAt: '2026-08-06T14:00:00Z', submittedAt: '2026-09-14T22:10:00Z',
      approvedAt: null, closedAt: null, createdAt: '2026-08-04T15:00:00Z', updatedAt: '2026-09-14T22:10:00Z',
      evidenceCount: 6, observationCount: 1, isOverdue: true },
    { id: 62, subcontractorId: 12, subcontractorName: 'Vidrios del Valle', projectId: 1, projectName: P(1).name,
      title: T('Ventanería de vidrio templado 10 mm — torres A y B', 'Tempered glass 10 mm windows — towers A and B'), description: null,
      status: 'IN_PROGRESS', agreedAmountCents: 78_400_00, dueDate: '2026-10-03',
      assignedAt: '2026-08-28T15:00:00Z', startedAt: '2026-09-02T14:00:00Z', submittedAt: null,
      approvedAt: null, closedAt: null, createdAt: '2026-08-28T15:00:00Z', updatedAt: '2026-09-16T16:00:00Z',
      evidenceCount: 3, observationCount: 0, isOverdue: false },
    { id: 63, subcontractorId: 11, subcontractorName: 'Eléctricos GT', projectId: 4, projectName: P(4).name,
      title: T('Iluminación de fachada y salón principal', 'Facade and main hall lighting'), description: null,
      status: 'APPROVED', agreedAmountCents: 38_400_00, dueDate: '2026-08-30',
      assignedAt: '2026-07-14T15:00:00Z', startedAt: '2026-07-16T14:00:00Z', submittedAt: '2026-08-27T21:00:00Z',
      approvedAt: '2026-08-29T16:00:00Z', closedAt: null, createdAt: '2026-07-14T15:00:00Z', updatedAt: '2026-08-29T16:00:00Z',
      evidenceCount: 9, observationCount: 0, isOverdue: false },
  ];
  await page.route(re('admin/subcontractors/jobs'), json({ content: SUB_JOBS, page: 0, size: 20, totalElements: SUB_JOBS.length, totalPages: 1 }));
  await page.route(re('admin/subcontractors/invoices'), json({
    content: [
      { id: 71, jobId: 61, jobTitle: SUB_JOBS[0].title, projectName: P(2).name, subcontractorId: 11,
        subcontractorName: 'Eléctricos GT', amountCents: 46_200_00, invoiceNumber: 'EGT-0442',
        description: null, status: 'IN_REVIEW', hasFile: true, fileContentType: 'application/pdf',
        reviewerId: null, reviewerName: null, reviewerComment: null, reviewedAt: null, paidAt: null,
        createdAt: '2026-09-14T22:12:00Z' },
      { id: 72, jobId: 63, jobTitle: SUB_JOBS[2].title, projectName: P(4).name, subcontractorId: 11,
        subcontractorName: 'Eléctricos GT', amountCents: 38_400_00, invoiceNumber: 'EGT-0431',
        description: null, status: 'PAID', hasFile: true, fileContentType: 'application/pdf',
        reviewerId: 1, reviewerName: 'Ana Lucía Pérez', reviewerComment: null,
        reviewedAt: '2026-08-30T16:00:00Z', paidAt: '2026-09-02T17:00:00Z', createdAt: '2026-08-27T21:05:00Z' },
    ], page: 0, size: 20, totalElements: 2, totalPages: 1,
  }));

  // ── Tools and supplies ───────────────────────────────────────────────────
  const TOOL_CATS = {
    power: T('ELÉCTRICA', 'POWER'), meas: T('MEDICIÓN', 'MEASURING'),
    manual: T('MANUAL', 'HAND'), safety: T('SEGURIDAD', 'SAFETY'),
  };
  const tool = (
    id: number, code: string, name: string, category: string, status: string,
    { worker = null as number | null, projectId = null as number | null, days = 0 } = {},
  ) => ({
    id, code, name, category, status,
    assignedTo: worker ? U(worker).fullName : null, assignedToId: worker,
    projectName: projectId ? P(projectId).name : null, projectId,
    lastActivity: days ? `${T('hace', '')} ${days} ${T('días', 'days ago')}`.trim() : T('Hoy', 'Today'),
    lastActivityAt: `2026-09-${String(17 - days).padStart(2, '0')}T15:00:00Z`,
    dateRegistered: '2026-02-11', notes: null, history: [],
  });
  const TOOLS = [
    tool(101, 'HER-0114', T('Rotomartillo Bosch GBH 2-26', 'Bosch GBH 2-26 rotary hammer'), TOOL_CATS.power, 'ASSIGNED', { worker: 3, projectId: 1, days: 3 }),
    tool(102, 'HER-0115', T('Rotomartillo Bosch GBH 2-26', 'Bosch GBH 2-26 rotary hammer'), TOOL_CATS.power, 'AVAILABLE'),
    tool(103, 'HER-0207', T('Nivel láser autonivelante', 'Self-levelling laser level'), TOOL_CATS.meas, 'ASSIGNED', { worker: 2, projectId: 1, days: 12 }),
    tool(104, 'HER-0208', T('Estación total', 'Total station'), TOOL_CATS.meas, 'PENDING_ACCEPTANCE', { worker: 8, projectId: 2, days: 1 }),
    tool(105, 'HER-0311', T('Cortadora de concreto', 'Concrete saw'), TOOL_CATS.power, 'IN_REVIEW', { worker: 4, projectId: 3, days: 6 }),
    tool(106, 'HER-0312', T('Vibrador de concreto', 'Concrete vibrator'), TOOL_CATS.power, 'ASSIGNED', { worker: 6, projectId: 1, days: 2 }),
    tool(107, 'HER-0420', T('Andamio modular — cuerpo', 'Modular scaffold — section'), TOOL_CATS.manual, 'AVAILABLE'),
    tool(108, 'HER-0501', T('Arnés de seguridad', 'Safety harness'), TOOL_CATS.safety, 'ASSIGNED', { worker: 7, projectId: 4, days: 9 }),
    tool(109, 'HER-0502', T('Arnés de seguridad', 'Safety harness'), TOOL_CATS.safety, 'DAMAGED', { days: 4 }),
    tool(110, 'HER-0613', T('Compactadora de plato', 'Plate compactor'), TOOL_CATS.power, 'LOST', { worker: 5, projectId: 2, days: 21 }),
  ];
  const TOOL_SUMMARY = {
    total: TOOLS.length, available: 2, assigned: 5, pendingAcceptance: 1,
    inReview: 1, damaged: 1, lost: 1,
  };
  const toolFilter = (url: string) => {
    const status = qp(url, 'status'); const cat = qp(url, 'category');
    const search = (qp(url, 'search') ?? '').toLowerCase();
    let list = TOOLS;
    if (status) list = list.filter(t => t.status === status);
    if (cat) list = list.filter(t => t.category === cat);
    if (search) list = list.filter(t => `${t.code} ${t.name}`.toLowerCase().includes(search));
    return list;
  };
  for (const base of ['admin/tools', 'warehouse/tools']) {
    await page.route(re(`${base}/summary`), json(TOOL_SUMMARY));
    await page.route(re(base), route => {
      const list = toolFilter(route.request().url());
      return json({ content: list, page: 0, size: 50, totalElements: list.length, totalPages: 1 })(route);
    });
  }

  const CONSUMABLES = [
    { id: 201, code: 'INS-0031', name: T('Cemento UGC 42.5 — saco 42.5 kg', 'General-use cement 42.5 — 42.5 kg bag'), category: T('MATERIALES', 'MATERIALS'), unit: T('saco', 'bag'), currentStock: 184, minimumStock: 120, status: 'IN_STOCK', lastRestocked: '2026-09-15', notes: null },
    { id: 202, code: 'INS-0044', name: T('Varilla No. 4 legítima — 6 m', 'Grade-60 #4 rebar — 6 m'), category: T('MATERIALES', 'MATERIALS'), unit: T('unidad', 'unit'), currentStock: 96, minimumStock: 150, status: 'LOW_STOCK', lastRestocked: '2026-09-09', notes: null },
    { id: 203, code: 'INS-0102', name: T('Alambre de amarre — rollo 25 kg', 'Tie wire — 25 kg coil'), category: T('MATERIALES', 'MATERIALS'), unit: T('rollo', 'coil'), currentStock: 0, minimumStock: 8, status: 'OUT_OF_STOCK', lastRestocked: '2026-08-28', notes: null },
    { id: 204, code: 'INS-0210', name: T('Guantes de cuero — par', 'Leather gloves — pair'), category: T('SEGURIDAD', 'SAFETY'), unit: T('par', 'pair'), currentStock: 42, minimumStock: 20, status: 'IN_STOCK', lastRestocked: '2026-09-11', notes: null },
    { id: 205, code: 'INS-0211', name: T('Casco de seguridad', 'Hard hat'), category: T('SEGURIDAD', 'SAFETY'), unit: T('unidad', 'unit'), currentStock: 17, minimumStock: 15, status: 'IN_STOCK', lastRestocked: '2026-09-04', notes: null },
    { id: 206, code: 'INS-0320', name: T('Disco de corte 7" — metal', '7" cutting disc — metal'), category: T('CONSUMIBLES', 'CONSUMABLES'), unit: T('unidad', 'unit'), currentStock: 11, minimumStock: 25, status: 'LOW_STOCK', lastRestocked: '2026-09-02', notes: null },
  ];
  const CONSUMABLE_SUMMARY = { total: 6, inStock: 3, lowStock: 2, outOfStock: 1 };
  // Shapes differ per endpoint and the screens notice: the stock list is a
  // bare array, `search` is paged, and mixing them draws a table of zeroes.
  for (const base of ['warehouse/consumables', 'admin/consumables']) {
    await page.route(re(`${base}/summary`), json(CONSUMABLE_SUMMARY));
    await page.route(re(`${base}/search`), json({ content: CONSUMABLES, page: 0, size: 50, totalElements: CONSUMABLES.length, totalPages: 1 }));
    await page.route(re(base), json(CONSUMABLES));
  }

  const DISPATCHES = [
    { id: 301, consumableCode: 'INS-0031', consumableName: CONSUMABLES[0].name, unit: CONSUMABLES[0].unit, quantity: 60, project: P(1).name, projectId: 1, requestedBy: 'Julio Castillo', requestedById: 2, date: NOW, notes: T('Fundición losa nivel 6', 'Level 6 slab pour') },
    { id: 302, consumableCode: 'INS-0044', consumableName: CONSUMABLES[1].name, unit: CONSUMABLES[1].unit, quantity: 120, project: P(2).name, projectId: 2, requestedBy: 'Ricardo Tzoc', requestedById: 8, date: '2026-09-16', notes: null },
    { id: 303, consumableCode: 'INS-0210', consumableName: CONSUMABLES[3].name, unit: CONSUMABLES[3].unit, quantity: 12, project: P(3).name, projectId: 3, requestedBy: 'Julio Castillo', requestedById: 2, date: '2026-09-15', notes: null },
  ];
  await page.route(re('warehouse/dispatches'), json({ content: DISPATCHES, page: 0, size: 50, totalElements: DISPATCHES.length, totalPages: 1 }));
  await page.route(re('warehouse/consumables/dispatches'), json({ content: DISPATCHES, page: 0, size: 50, totalElements: DISPATCHES.length, totalPages: 1 }));

  const ASSIGNMENTS = TOOLS.filter(t => t.assignedToId).map((t, i) => ({
    id: 400 + i, toolCode: t.code, toolName: t.name, category: t.category, status: t.status,
    worker: t.assignedTo!, workerId: t.assignedToId!, assignedDate: `2026-09-${String(17 - (i + 1) * 2).padStart(2, '0')}`,
    project: t.projectName!, projectId: t.projectId!, daysOut: (i + 1) * 2,
  }));
  await page.route(re('warehouse/assignments/summary'), json({ activeAssignments: ASSIGNMENTS.length, assignedToday: 1, returnedToday: 2, pendingAcceptance: 1 }));
  await page.route(re('warehouse/assignments/log'), json({ content: ASSIGNMENTS.map((a, i) => ({
    id: 500 + i, date: a.assignedDate, toolCode: a.toolCode, toolName: a.toolName,
    action: i % 2 ? T('DEVOLUCIÓN', 'RETURN') : T('ASIGNACIÓN', 'ASSIGNMENT'),
    worker: a.worker, project: a.project, condition: T('BUENO', 'GOOD'), notes: '',
  })), page: 0, size: 50, totalElements: ASSIGNMENTS.length, totalPages: 1 }));
  await page.route(re('warehouse/assignments/active'), json(ASSIGNMENTS));
  await page.route(re('warehouse/assignments'), json({ content: ASSIGNMENTS, page: 0, size: 50, totalElements: ASSIGNMENTS.length, totalPages: 1 }));
  await page.route(re('warehouse/history'), json({ content: ASSIGNMENTS.map((a, i) => ({
    id: 600 + i, date: a.assignedDate, time: '07:15', action: i % 2 ? T('DEVOLUCIÓN', 'RETURN') : T('ASIGNACIÓN', 'ASSIGNMENT'),
    worker: a.worker, project: a.project, toolCode: a.toolCode, toolName: a.toolName, notes: null,
  })), page: 0, size: 50, totalElements: ASSIGNMENTS.length, totalPages: 1 }));
  await page.route(re('warehouse/tools/history'), json({ content: ASSIGNMENTS.map((a, i) => ({
    id: 600 + i, date: a.assignedDate, time: '07:15', action: i % 2 ? T('DEVOLUCIÓN', 'RETURN') : T('ASIGNACIÓN', 'ASSIGNMENT'),
    worker: a.worker, project: a.project, toolCode: a.toolCode, toolName: a.toolName, notes: null,
  })), page: 0, size: 50, totalElements: ASSIGNMENTS.length, totalPages: 1 }));
  await page.route(re('warehouse/dashboard'), json({
    kpis: { totalTools: TOOLS.length, availableTools: 2, assignedTools: 5, needsAttention: 3, consumableItems: 6, lowStockAlerts: 3 },
    recentActivity: ASSIGNMENTS.slice(0, 5).map((a, i) => ({
      id: 700 + i, date: a.assignedDate, code: a.toolCode, tool: a.toolName,
      action: i % 2 ? T('DEVOLUCIÓN', 'RETURN') : T('ASIGNACIÓN', 'ASSIGNMENT'),
      worker: a.worker, notes: '',
    })),
    lowStockAlerts: CONSUMABLES.filter(c => c.status !== 'IN_STOCK').map(c => ({
      code: c.code, name: c.name, stock: c.currentStock, min: c.minimumStock, unit: c.unit, status: c.status,
    })),
  }));

  // Tool report.
  await page.route(re('admin/reports/tools/missing'), json({
    content: [
      { toolId: 110, code: 'HER-0613', name: TOOLS[9].name, category: TOOL_CATS.power, status: 'LOST',
        worker: 'Byron Chávez', project: P(2).name, outSince: '2026-08-27', daysOut: 21, unsigned: true },
      { toolId: 103, code: 'HER-0207', name: TOOLS[2].name, category: TOOL_CATS.meas, status: 'ASSIGNED',
        worker: 'Julio Castillo', project: P(1).name, outSince: '2026-09-05', daysOut: 12, unsigned: false },
      { toolId: 108, code: 'HER-0501', name: TOOLS[7].name, category: TOOL_CATS.safety, status: 'ASSIGNED',
        worker: 'Diego López', project: P(4).name, outSince: '2026-09-08', daysOut: 9, unsigned: true },
    ], page: 0, size: 20, totalElements: 3, totalPages: 1,
  }));
  await page.route(re('admin/reports/tools'), json({
    computedAt: `${NOW}T15:00:00Z`, totalInCompany: TOOLS.length, total: TOOLS.length,
    byStatus: [
      { status: 'ASSIGNED', count: 5 }, { status: 'AVAILABLE', count: 2 },
      { status: 'PENDING_ACCEPTANCE', count: 1 }, { status: 'IN_REVIEW', count: 1 },
      { status: 'DAMAGED', count: 1 }, { status: 'LOST', count: 1 },
    ],
    byCategory: [
      { category: TOOL_CATS.power, count: 5, out: 3 },
      { category: TOOL_CATS.meas, count: 2, out: 2 },
      { category: TOOL_CATS.safety, count: 2, out: 1 },
      { category: TOOL_CATS.manual, count: 1, out: 0 },
    ],
    outOfWarehouse: 6, avgDaysOut: 8.8,
    missing: { total: 3, unsigned: 2, overdue: 1, oldestDays: 21 },
    byProject: [
      { projectId: 1, project: P(1).name, out: 3, unsigned: 0 },
      { projectId: 2, project: P(2).name, out: 2, unsigned: 1 },
      { projectId: 4, project: P(4).name, out: 1, unsigned: 1 },
    ],
    byWorker: [
      { workerId: 5, worker: 'Byron Chávez', out: 1, unsigned: 1, oldestDays: 21 },
      { workerId: 2, worker: 'Julio Castillo', out: 1, unsigned: 0, oldestDays: 12 },
      { workerId: 7, worker: 'Diego López', out: 1, unsigned: 1, oldestDays: 9 },
      { workerId: 3, worker: 'Manuel Ramírez', out: 1, unsigned: 0, oldestDays: 3 },
    ],
    supplies: {
      total: 6, inStock: 3, lowStock: 2, outOfStock: 1, dispatches: 3,
      topUsed: [
        { consumableId: 201, code: 'INS-0031', name: CONSUMABLES[0].name, unit: CONSUMABLES[0].unit, quantity: 60 },
        { consumableId: 202, code: 'INS-0044', name: CONSUMABLES[1].name, unit: CONSUMABLES[1].unit, quantity: 120 },
        { consumableId: 204, code: 'INS-0210', name: CONSUMABLES[3].name, unit: CONSUMABLES[3].unit, quantity: 12 },
      ],
    },
  }));

  // ── Time & material ──────────────────────────────────────────────────────
  const tmTicket = (
    id: number, number: string, projectId: number, description: string, status: string,
    { hours = 18, rate = 9.5, material = 640, days = 2, signed = false, converted = false } = {},
  ) => {
    const labor = hours * rate;
    return {
      id, ticketNumber: number, projectId, projectName: P(projectId).name, description, notes: null,
      workDate: `2026-09-${String(17 - days).padStart(2, '0')}`, workerCount: 4,
      hours, hourlyRate: rate, material, labor, total: labor + material,
      status, convertible: status === 'SIGNED', editable: status === 'DRAFT',
      signatureRequestId: signed ? 900 + id : null,
      signatureRequestedAt: signed ? `2026-09-${String(17 - days).padStart(2, '0')}T22:00:00Z` : null,
      signedAt: signed ? `2026-09-${String(16 - days).padStart(2, '0')}T15:20:00Z` : null,
      signerName: signed ? 'Lucía Morales' : null,
      signerTitle: signed ? T('Superintendente de obra', 'Site superintendent') : null,
      declinedAt: null, declineReason: null,
      documentHash: signed ? 'a3f1c9e27b04' : null,
      signUrl: signed ? null : `https://buildtrackfield.com/sign/demo-${id}`,
      changeOrderId: converted ? 11 : null,
      convertedAt: converted ? '2026-09-15T16:00:00Z' : null,
      convertedBy: converted ? 'analucia' : null,
      createdBy: 'jcastillo', createdAt: `2026-09-${String(17 - days).padStart(2, '0')}T21:40:00Z`,
      ageDays: days,
    };
  };
  const TM = [
    tmTicket(41, 'TM-2026-041', 1, T('Demolición de muro no previsto en sótano 2', 'Unforeseen wall demolition in basement 2'), 'SIGNED', { days: 2, signed: true }),
    tmTicket(40, 'TM-2026-040', 2, T('Bombeo de agua freática — 3 turnos', 'Groundwater pumping — 3 shifts'), 'PENDING_SIGNATURE', { days: 4, hours: 24, material: 0 }),
    tmTicket(39, 'TM-2026-039', 1, T('Retiro de escombro extra tras lluvia', 'Extra debris removal after rain'), 'DRAFT', { days: 6, hours: 9, material: 180 }),
    tmTicket(38, 'TM-2026-038', 3, T('Relleno adicional por hallazgo de suelo blando', 'Extra fill after soft-soil finding'), 'CONVERTED', { days: 9, hours: 32, material: 2_400, signed: true, converted: true }),
  ];
  const tmPending = {
    ticketCount: 2, totalPending: TM[0].total + TM[1].total,
    oldestAgeDays: 4, tickets: [TM[0], TM[1]],
  };
  for (const base of ['supervisor/tm-tickets', 'admin/tm-tickets']) {
    await page.route(re(`${base}/pending`), json(tmPending));
    await page.route(re(base), route => {
      const status = qp(route.request().url(), 'status');
      return json(status ? TM.filter(t => t.status === status) : TM)(route);
    });
  }

  // ── Money: invoice template, office expenses, payables summary ───────────
  await page.route(re('settings/invoice-branding'), json({
    configured: true, companyName: COMPANY,
    contactName: 'Ana Lucía Pérez',
    address: T('7a Avenida 12-34, Zona 9, Ciudad de Guatemala', '7a Avenida 12-34, Zona 9, Guatemala City'),
    email: 'facturacion@constructoraandes.example', phone: '+502 2334-7788', hasLogo: false,
  }));

  const OFFICE_CATS = [
    { id: 1, name: T('Alquiler de oficina', 'Office rent'), seeded: true, archived: false, expenseCount: 12, yearToDateCents: 108_000_00 },
    { id: 2, name: T('Servicios (luz, agua, internet)', 'Utilities (power, water, internet)'), seeded: true, archived: false, expenseCount: 27, yearToDateCents: 41_300_00 },
    { id: 3, name: T('Software y licencias', 'Software and licences'), seeded: true, archived: false, expenseCount: 9, yearToDateCents: 18_600_00 },
    { id: 4, name: T('Contabilidad y legal', 'Accounting and legal'), seeded: true, archived: false, expenseCount: 8, yearToDateCents: 32_000_00 },
    { id: 5, name: T('Papelería', 'Stationery'), seeded: true, archived: false, expenseCount: 14, yearToDateCents: 6_400_00 },
  ];
  const OFFICE = [
    { id: 11, description: T('Alquiler de oficina — septiembre', 'Office rent — September'), categoryId: 1, amountCents: 9_000_00, purchaseDate: '2026-09-01', recurring: true },
    { id: 12, description: T('Internet dedicado 200 Mbps', 'Dedicated 200 Mbps internet'), categoryId: 2, amountCents: 1_150_00, purchaseDate: '2026-09-03', recurring: true },
    { id: 13, description: T('Energía eléctrica — agosto', 'Electricity — August'), categoryId: 2, amountCents: 2_380_00, purchaseDate: '2026-09-08', recurring: true },
    { id: 14, description: T('Honorarios contables — septiembre', 'Accounting fees — September'), categoryId: 4, amountCents: 4_000_00, purchaseDate: '2026-09-10', recurring: true },
    { id: 15, description: T('Licencias de software de dibujo (3 puestos)', 'Drafting software licences (3 seats)'), categoryId: 3, amountCents: 2_070_00, purchaseDate: '2026-09-12', recurring: false },
    { id: 16, description: T('Papelería y tóner', 'Stationery and toner'), categoryId: 5, amountCents: 480_00, purchaseDate: '2026-09-15', recurring: false },
  ].map(o => {
    const cat = OFFICE_CATS.find(c => c.id === o.categoryId)!;
    return {
      ...o, category: 'OTHER', categoryName: cat.name, categoryArchived: false,
      amount: o.amountCents / 100, purchasedBy: 'Ana Lucía Pérez', purchasedByUserId: 1,
      notes: null, recurringDay: o.recurring ? Number(o.purchaseDate.slice(-2)) : null,
      recurringOfId: null, receipt: null,
      createdAt: `${o.purchaseDate}T16:00:00Z`, updatedAt: `${o.purchaseDate}T16:00:00Z`,
    };
  });
  await page.route(re('admin/office-expenses/categories'), json(OFFICE_CATS));
  await page.route(re('admin/office-expenses/summary'), json({
    periodCents: OFFICE.reduce((a, o) => a + o.amountCents, 0), periodCount: OFFICE.length,
    monthCents: OFFICE.reduce((a, o) => a + o.amountCents, 0), monthCount: OFFICE.length,
    previousMonthCents: 18_640_00, yearToDateCents: 206_300_00,
    byCategory: OFFICE_CATS.map(c => ({
      categoryId: c.id, categoryName: c.name,
      totalCents: OFFICE.filter(o => o.categoryId === c.id).reduce((a, o) => a + o.amountCents, 0),
      count: OFFICE.filter(o => o.categoryId === c.id).length,
    })),
    recurringMissing: [], recurringSettledCount: 4, recurringExpectedCents: 16_530_00,
  }));
  await page.route(re('admin/office-expenses'), json({ content: OFFICE, page: 0, size: 20, totalElements: OFFICE.length, totalPages: 1 }));

  await page.route(re('finance/payables/summary'), json({
    dueThisWeekCents: 64_680_00, dueThisWeekCount: 2,
    overdueCents: 8_960_00, overdueCount: 1,
    outstandingCents: 106_040_00, outstandingCount: 4,
    paidThisMonthCents: 17_940_00, paidThisMonthCount: 2,
    asOf: NOW,
  }));

  // ── Expenses: the queue, the worker's own, the supervisor's review ───────
  const expense = (
    id: number, userId: number, projectId: number, type: string, cents: number,
    date: string, description: string, status: string,
  ) => {
    const u = U(userId); const p = P(projectId);
    return {
      id, workerId: u.id, workerName: u.fullName, workerUsername: u.username,
      projectId: p.id, projectName: p.name, expenseType: type, amountCents: cents,
      expenseDate: date, description, status,
      receiptUrl: null, reviewerId: status === 'PENDING' ? null : 2,
      reviewerName: status === 'PENDING' ? null : 'Julio Castillo',
      reviewerComment: status === 'OBSERVED' ? T('Falta la foto del recibo.', 'The receipt photo is missing.') : null,
      reviewedAt: status === 'PENDING' ? null : `${date}T22:00:00Z`,
      resubmittedAt: null,
      createdAt: `${date}T18:20:00Z`, updatedAt: `${date}T18:20:00Z`,
      budgetWarning: null,
      projectBudget: {
        baseCents: p.budgetBaseCents, consumedCents: p.totalConsumedCents, remainingCents: p.remainingBudgetCents,
      },
    };
  };
  const MATERIALS = T('MATERIALES', 'MATERIALS');
  const FUEL = T('COMBUSTIBLE', 'FUEL');
  const MEALS = T('ALIMENTACIÓN', 'MEALS');
  const EXPENSES = [
    expense(501, 3, 1, MATERIALS, 1_240_00, '2026-09-17', T('12 sacos de cemento — compra de emergencia', '12 bags of cement — emergency purchase'), 'PENDING'),
    expense(502, 4, 1, FUEL, 320_00, '2026-09-17', T('Diésel para planta eléctrica', 'Diesel for the generator'), 'PENDING'),
    expense(503, 6, 2, MEALS, 186_00, '2026-09-16', T('Almuerzo de cuadrilla — fundición nocturna', 'Crew lunch — night pour'), 'PENDING'),
    expense(504, 5, 3, MATERIALS, 640_00, '2026-09-16', T('Alambre de amarre y clavos', 'Tie wire and nails'), 'PENDING'),
    expense(505, 7, 4, FUEL, 410_00, '2026-09-15', T('Combustible de camioneta — viajes a Antigua', 'Truck fuel — Antigua trips'), 'OBSERVED'),
    expense(506, 3, 1, MATERIALS, 2_180_00, '2026-09-14', T('Impermeabilizante para losa', 'Slab waterproofing'), 'APPROVED'),
    expense(507, 4, 1, MEALS, 240_00, '2026-09-12', T('Refacción de cuadrilla', 'Crew snack'), 'APPROVED'),
    expense(508, 6, 6, MATERIALS, 980_00, '2026-09-11', T('Cal hidratada y arena', 'Hydrated lime and sand'), 'APPROVED'),
  ];
  const expenseSummary = (list: typeof EXPENSES) => ({
    totalSubmitted: list.length,
    totalApprovedCents: list.filter(e => e.status === 'APPROVED').reduce((a, e) => a + e.amountCents, 0),
    pendingCount: list.filter(e => e.status === 'PENDING').length,
    observedCount: list.filter(e => e.status === 'OBSERVED').length,
    rejectedCount: 0,
    approvedCount: list.filter(e => e.status === 'APPROVED').length,
    pendingCents: list.filter(e => e.status === 'PENDING').reduce((a, e) => a + e.amountCents, 0),
    observedCents: list.filter(e => e.status === 'OBSERVED').reduce((a, e) => a + e.amountCents, 0),
    rejectedCents: 0,
  });
  const expenseFilter = (url: string, list = EXPENSES) => {
    const status = qp(url, 'status');
    return status ? list.filter(e => e.status === status) : list;
  };
  for (const base of ['admin/expenses', 'supervisor/expenses', 'finance/expenses']) {
    await page.route(re(`${base}/summary`), route => json(expenseSummary(expenseFilter(route.request().url())))(route));
    await page.route(re(base), route => {
      const list = expenseFilter(route.request().url());
      return json({ content: list, page: 0, size: 20, totalElements: list.length, totalPages: 1 })(route);
    });
  }

  // The whole expense report. installDemoApi answers this endpoint with the
  // three fields the Presupuestos breakdown reads; the report SCREEN also
  // wants `trend`, `byCategory` and `workerTotals`, and crashed without them.
  const catSlice = (type: string, share: number, count: number) => ({
    type, count, totalCents: Math.round(1_312_000_00 * share),
  });
  const EXPENSE_REPORT = {
    generatedAt: `${NOW}T15:00:00Z`,
    kpis: {
      totalApprovedCents: 1_312_000_00, projectCount: 5,
      pendingCents: 2_386_00, pendingCount: 4,
      observedCents: 410_00, observedCount: 1,
      rejectedCents: 180_00, rejectedCount: 1,
      notPayableCents: 590_00,
      topCategory: MATERIALS, topCategoryCents: Math.round(1_312_000_00 * 0.62),
      expenseCount: 128, avgPerWorkerCents: 4_100_00,
    },
    byProject: PROJECTS.map(p => ({
      projectId: p.id, projectName: p.name,
      approvedCents: p.approvedExpensesCents,
      pendingCents: p.id === 1 ? 1_560_00 : 0,
      observedCents: p.id === 4 ? 410_00 : 0,
      rejectedCents: 0,
      pendingCount: p.id === 1 ? 2 : 0,
      observedCount: p.id === 4 ? 1 : 0,
      rejectedCount: 0,
      costBudgetCents: p.costBudgetCents,
      breakdown: [
        { type: MATERIALS, count: 24, totalCents: Math.round(p.approvedExpensesCents * 0.62) },
        { type: FUEL, count: 9, totalCents: Math.round(p.approvedExpensesCents * 0.14) },
        { type: MEALS, count: 12, totalCents: Math.round(p.approvedExpensesCents * 0.11) },
        { type: T('OTROS', 'OTHER'), count: 6, totalCents: Math.round(p.approvedExpensesCents * 0.13) },
      ],
    })),
    byCategory: [
      catSlice(MATERIALS, 0.62, 61), catSlice(FUEL, 0.14, 24),
      catSlice(MEALS, 0.11, 28), catSlice(T('OTROS', 'OTHER'), 0.13, 15),
    ],
    trend: {
      months: [
        { month: '2026-06', approvedCents: 198_400_00, partial: false, daysCounted: 30, daysInMonth: 30 },
        { month: '2026-07', approvedCents: 241_900_00, partial: false, daysCounted: 31, daysInMonth: 31 },
        { month: '2026-08', approvedCents: 263_500_00, partial: false, daysCounted: 31, daysInMonth: 31 },
        { month: '2026-09', approvedCents: 144_200_00, partial: true, daysCounted: 17, daysInMonth: 30 },
      ],
      previousWindow: { dateFrom: '2026-08-01', dateTo: '2026-08-17', approvedCents: 131_800_00 },
    },
    byWorker: [3, 4, 5, 6, 7].map((uid, i) => ({
      workerId: uid, workerName: U(uid).fullName, workerUsername: U(uid).username,
      submittedCount: 28 - i * 3, approvedCount: 24 - i * 3,
      pendingCount: i < 2 ? 1 : 0, observedCount: i === 4 ? 1 : 0, rejectedCount: 0,
      totalApprovedCents: [412_000_00, 318_000_00, 264_000_00, 201_000_00, 117_000_00][i],
    })),
    workerTotals: {
      workerCount: 5, submittedCount: 110, approvedCount: 98,
      pendingCount: 2, observedCount: 1, rejectedCount: 1,
      totalApprovedCents: 1_312_000_00,
    },
  };
  for (const base of ['admin/expenses/report', 'finance/expenses/report']) {
    await page.route(re(base), json(EXPENSE_REPORT));
  }

  // ── The worker's own panel ───────────────────────────────────────────────
  const MINE = EXPENSES.filter(e => e.workerId === 3);
  await page.route(re('worker/expenses/summary'), json(expenseSummary(MINE)));
  await page.route(re('worker/expenses'), route => {
    const list = expenseFilter(route.request().url(), MINE);
    return json({ content: list, page: 0, size: 20, totalElements: list.length, totalPages: 1 })(route);
  });
  await page.route(re('worker/my-state'), json({ '1': 'WORKING' }));
  await page.route(re('worker/my-projects'), json(PROJECTS.filter(p => p.assignedUserIds.includes(3)).map(p => ({
    id: p.id, name: p.name, address: p.address,
    latitude: p.latitude, longitude: p.longitude, geofenceRadiusMeters: p.geofenceRadiusMeters,
  }))));
  await page.route(re('worker/my-summary'), json({
    hoursThisWeek: 26.5, approvedHoursThisWeek: 18.0,
    pendingApprovals: 2, lateArrivalsThisWeek: 1, daysWorkedThisWeek: 3,
  }));
  await page.route(re('worker/time-records'), json(TIME_RECORDS.filter(r => r.workerId === 3)));
  await page.route(re('worker/tools/summary'), json(TOOL_SUMMARY));
  await page.route(re('worker/tools'), json(ASSIGNMENTS.filter(a => a.workerId === 3)));

  // ── Supervisor's team tools ──────────────────────────────────────────────
  await page.route(re('supervisor/tools/summary'), json(TOOL_SUMMARY));
  await page.route(re('supervisor/tools'), json(ASSIGNMENTS));

  // ── Client portal (the token the seller opens in front of the client) ────
  await page.route(re('client-view/session'), json({
    sessionToken: 'demo-client-session', projectId: 1, projectName: P(1).name,
    clientName: CLIENTS[0].name, expiresAt: '2026-12-11T06:00:00Z',
  }));
}
