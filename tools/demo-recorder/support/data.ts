// Demo dataset for the landing-page clips.
//
// One fictional company used across every module, so the clips tell a single
// coherent story: the same five projects, clients and crew appear in Proyectos,
// Finanzas, Bitácora and the client portal. Every name is invented on purpose —
// no real client, vendor or person appears in footage that ships on a public
// marketing page.
//
// Money is in cents, matching the API contract.

export const COMPANY = 'Constructora Andes';
export const TIMEZONE = 'America/Chicago';

/** The business "today" the clips are staged around. */
export const TODAY = '2026-09-12';

export const CLIENTS = [
  { id: 1, name: 'Inmobiliaria Vista Hermosa, S.A.', rfc: '4821096-3', contact: 'Lucía Morales',   phone: '(713) 555-0142', email: 'lmorales@vistahermosa.example',  status: 'ACTIVE' as const, activeProjectsCount: 2, completedProjectsCount: 1 },
  { id: 2, name: 'Grupo Corporativo Delta',        rfc: '5510338-K', contact: 'Rodrigo Estrada', phone: '(713) 555-0187', email: 'restrada@gcdelta.example',         status: 'ACTIVE' as const, activeProjectsCount: 1, completedProjectsCount: 0 },
  { id: 3, name: 'Logística del Sur, S.A.',          rfc: '6604172-8', contact: 'Marta Ixcoy',     phone: '(713) 555-0123', email: 'mixcoy@logisticadelsur.example', status: 'ACTIVE' as const, activeProjectsCount: 1, completedProjectsCount: 0 },
  { id: 4, name: 'Hotelera Colonial',                rfc: '7729015-1', contact: 'Diego Arriaga',   phone: '(713) 555-0168', email: 'darriaga@hcolonial.example',     status: 'ACTIVE' as const, activeProjectsCount: 1, completedProjectsCount: 0 },
  { id: 5, name: 'Desarrollos Las Luces',            rfc: '3390884-6', contact: 'Sofía Ramírez',   phone: '(713) 555-0119', email: 'sramirez@lasluces.example',    status: 'ACTIVE' as const, activeProjectsCount: 0, completedProjectsCount: 1 },
].map(c => ({ ...c, createdAt: '2025-11-04T15:20:00Z', updatedAt: '2026-08-28T18:05:00Z' }));

type P = {
  id: number; name: string; status: 'ACTIVE' | 'INACTIVE' | 'CLOSED'; clientId: number; costCode: string;
  original: number; changeOrders: number; costBudget: number; consumed: number; expenses: number;
  invoiced: number; collected: number; address: string; lat: number; lng: number; crew: number[];
};

const RAW: P[] = [
  { id: 1, name: 'Residencial Vista Hermosa II', status: 'ACTIVE', clientId: 1, costCode: 'RVH-II',
    original: 1_850_000_00, changeOrders: 124_500_00, costBudget: 1_720_000_00, consumed: 1_184_500_00, expenses: 462_000_00,
    invoiced: 1_320_000_00, collected: 1_180_000_00,
    address: 'Fondren Rd y Bissonnet St', lat: 29.683500, lng: -95.522100, crew: [3, 4, 5, 6, 7] },
  { id: 2, name: 'Torre Corporativa Delta', status: 'ACTIVE', clientId: 2, costCode: 'TCD-02',
    original: 4_200_000_00, changeOrders: 0, costBudget: 3_880_000_00, consumed: 1_416_000_00, expenses: 523_000_00,
    invoiced: 1_600_000_00, collected: 1_450_000_00,
    address: 'Smith St y Pierce St', lat: 29.752500, lng: -95.373000, crew: [3, 5, 8] },
  { id: 3, name: 'Bodega Industrial del Sur', status: 'ACTIVE', clientId: 3, costCode: 'BIS-03',
    original: 960_000_00, changeOrders: 32_000_00, costBudget: 890_000_00, consumed: 841_000_00, expenses: 319_000_00,
    invoiced: 720_000_00, collected: 540_000_00,
    address: 'Almeda Genoa Rd y Cullen Blvd', lat: 29.609800, lng: -95.342000, crew: [4, 6] },
  { id: 4, name: 'Remodelación Hotel Colonial', status: 'ACTIVE', clientId: 4, costCode: 'RHC-04',
    original: 520_000_00, changeOrders: 68_000_00, costBudget: 510_000_00, consumed: 273_000_00, expenses: 147_000_00,
    invoiced: 300_000_00, collected: 300_000_00,
    address: 'Main St y Prairie St', lat: 29.760800, lng: -95.362700, crew: [7, 8] },
  { id: 6, name: 'Ampliación Colegio San Marcos', status: 'ACTIVE', clientId: 1, costCode: 'ACS-06',
    original: 780_000_00, changeOrders: 0, costBudget: 710_000_00, consumed: 128_000_00, expenses: 54_000_00,
    invoiced: 200_000_00, collected: 120_000_00,
    address: 'Bellaire Blvd y Gessner Rd', lat: 29.705500, lng: -95.544000, crew: [5, 6] },
  { id: 5, name: 'Condominio Las Luces', status: 'CLOSED', clientId: 5, costCode: 'CLL-05',
    original: 2_100_000_00, changeOrders: 0, costBudget: 1_980_000_00, consumed: 1_964_000_00, expenses: 881_000_00,
    invoiced: 2_100_000_00, collected: 2_100_000_00,
    address: 'Westheimer Rd y Kirkwood Rd', lat: 29.737000, lng: -95.587000, crew: [3, 4] },
];

export const PROJECTS = RAW.map(p => {
  const revised = p.original + p.changeOrders;
  const base = p.costBudget || revised;
  const client = CLIENTS.find(c => c.id === p.clientId)!;
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    clientId: p.clientId,
    client: { id: client.id, name: client.name },
    costCode: p.costCode,
    originalContractCents: p.original,
    changeOrdersTotalCents: p.changeOrders,
    revisedContractCents: revised,
    contractAmountCents: base - p.consumed,
    approvedExpensesCents: p.expenses,
    totalConsumedCents: p.consumed,
    costBudgetCents: p.costBudget,
    budgetBaseCents: base,
    remainingBudgetCents: base - p.consumed,
    invoicedCents: p.invoiced,
    collectedCents: p.collected,
    outstandingCents: p.invoiced - p.collected,
    address: p.address,
    latitude: p.lat,
    longitude: p.lng,
    geofenceRadiusMeters: 120,
    assignedUserIds: p.crew,
    createdAt: '2026-01-15T14:00:00Z',
    updatedAt: '2026-09-10T21:30:00Z',
  };
});

export const PROJECTS_SUMMARY = {
  total: PROJECTS.length,
  active: PROJECTS.filter(p => p.status === 'ACTIVE').length,
  inactive: 0,
  closed: PROJECTS.filter(p => p.status === 'CLOSED').length,
  incomplete: 0,
  overBudget: 0,
};

export const USERS = [
  { id: 1,  username: 'analucia',  fullName: 'Ana Lucía Pérez',   role: 'ADMIN'         as const, hourlyRate: null },
  { id: 2,  username: 'jcastillo', fullName: 'Julio Castillo',    role: 'SUPERVISOR'    as const, hourlyRate: 9.5 },
  { id: 3,  username: 'mramirez',  fullName: 'Manuel Ramírez',    role: 'WORKER'        as const, hourlyRate: 5.25 },
  { id: 4,  username: 'exoy',      fullName: 'Estuardo Xoy',      role: 'WORKER'        as const, hourlyRate: 5.25 },
  { id: 5,  username: 'bchavez',   fullName: 'Byron Chávez',      role: 'WORKER'        as const, hourlyRate: 4.75 },
  { id: 6,  username: 'kmejia',    fullName: 'Kevin Mejía',       role: 'WORKER'        as const, hourlyRate: 4.75 },
  { id: 7,  username: 'dlopez',    fullName: 'Diego López',       role: 'WORKER'        as const, hourlyRate: 5.0 },
  { id: 8,  username: 'rtzoc',     fullName: 'Ricardo Tzoc',      role: 'SUPERVISOR'    as const, hourlyRate: 9.0 },
  { id: 9,  username: 'gsosa',     fullName: 'Gabriela Sosa',     role: 'WAREHOUSE'     as const, hourlyRate: null },
  { id: 10, username: 'fmorales',  fullName: 'Fernando Morales',  role: 'FINANCE'       as const, hourlyRate: null },
  { id: 11, username: 'electdelta',   fullName: 'Eléctricos Delta',     role: 'SUBCONTRACTOR' as const, hourlyRate: null },
  { id: 12, username: 'vidriosv',  fullName: 'Vidrios del Valle', role: 'SUBCONTRACTOR' as const, hourlyRate: null },
].map(u => ({ ...u, status: 'ACTIVE' as const, updatedAt: '2026-09-01T16:40:00Z' }));

/** Page envelope in the Spring shape the panel expects (`number` = page index). */
export function page<T>(content: T[], size = 20, number = 0) {
  return { content, totalElements: content.length, totalPages: 1, number, size };
}

/** Clients use `page` instead of `number` for the index. */
export function clientPage<T>(content: T[], size = 20) {
  return { content, page: 0, size, totalElements: content.length, totalPages: 1 };
}
