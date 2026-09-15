// BuildTrack — Gastos de oficina: lo que la empresa paga fuera de obra.
//
// Dos cosas que este módulo hace distinto de como lo hacía:
//
//   · el dinero viaja en CENTAVOS, como en el resto del sistema. El campo
//     `amount` en dólares se queda en la respuesta porque es lo que lee el
//     panel que está en producción, pero la pantalla nueva usa `amountCents`:
//     convertir a dólares y volver pierde un centavo en cuanto alguien escribe
//     un monto con tres decimales;
//   · las categorías son FILAS que escribe la empresa, no un enum del
//     producto, así que sus nombres NO se traducen: son texto del usuario.

import { api } from '../lib/api';
import { getBaseUrl } from '../lib/api';

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface OfficeReceipt {
  filename: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
}

export interface OfficeExpense {
  id: number;
  description: string;
  /** El enum viejo. Lo sigue mandando el servidor; la pantalla nueva no lo usa. */
  category: string;
  categoryId: number | null;
  /** El nombre que escribió la empresa. No se traduce. */
  categoryName: string | null;
  categoryArchived: boolean;
  /** Dólares. Lo lee el panel viejo; aquí se usa `amountCents`. */
  amount: number;
  amountCents: number;
  purchaseDate: string;
  purchasedBy: string | null;
  purchasedByUserId: number | null;
  notes: string | null;
  recurring: boolean;
  recurringDay: number | null;
  /** Nulo es «sin comprobante», que es un estado y no un error. */
  receipt: OfficeReceipt | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeCategory {
  id: number;
  name: string;
  /** De las nueve del arranque. No cambia nada: solo se puede decir. */
  seeded: boolean;
  archived: boolean;
  /** Gastos que la usan, de siempre. Es lo que separa archivar de borrar. */
  expenseCount: number;
  yearToDateCents: number;
}

export interface OfficeCategorySlice {
  categoryId: number | null;
  categoryName: string | null;
  totalCents: number;
  count: number;
}

export interface OfficeRecurringItem {
  templateId: number;
  description: string;
  categoryId: number | null;
  categoryName: string | null;
  lastAmountCents: number;
  recurringDay: number | null;
  lastPurchaseDate: string;
}

export interface OfficeExpenseSummary {
  periodCents: number;
  periodCount: number;
  monthCents: number;
  monthCount: number;
  previousMonthCents: number;
  yearToDateCents: number;
  byCategory: OfficeCategorySlice[];
  /** Fijos que este mes todavía no se registraron. Vacío cuando no falta nada. */
  recurringMissing: OfficeRecurringItem[];
  recurringSettledCount: number;
  recurringExpectedCents: number;
}

export interface OfficeExpenseFilters {
  categoryId?: number;
  from?: string;
  to?: string;
  purchasedByUserId?: number;
  search?: string;
}

function qs(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== 'all') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

const BASE = '/api/v1/admin/office-expenses';

// ── Gastos ───────────────────────────────────────────

export function listOfficeExpenses(
  params: OfficeExpenseFilters & { page?: number; size?: number } = {},
): Promise<PageResponse<OfficeExpense>> {
  return api<PageResponse<OfficeExpense>>(`${BASE}${qs({ ...params })}`);
}

/**
 * Las cifras del período, del mes, del mes anterior y del año, el reparto por
 * categoría y los fijos que faltan. **Nada de esto se calcula en el navegador**
 * — que es lo único que esta pantalla sabía hacer hasta ahora.
 */
export function getOfficeExpenseSummary(params: OfficeExpenseFilters = {}): Promise<OfficeExpenseSummary> {
  return api<OfficeExpenseSummary>(`${BASE}/summary${qs({ ...params })}`);
}

export function getOfficeExpense(id: number): Promise<OfficeExpense> {
  return api<OfficeExpense>(`${BASE}/${id}`);
}

export interface OfficeExpenseInput {
  description: string;
  /** Una que ya existe. */
  categoryId?: number;
  /** Una nueva, escrita en el selector. Se crea para toda la empresa. */
  categoryName?: string;
  amountCents: number;
  purchaseDate: string;
  purchasedBy?: string;
  purchasedByUserId?: number;
  notes?: string;
  recurring?: boolean;
  recurringDay?: number;
  /** El fijo del que este gasto es la instancia de este mes. */
  recurringOfId?: number;
}

export function createOfficeExpense(data: OfficeExpenseInput): Promise<OfficeExpense> {
  return api<OfficeExpense>(BASE, { method: 'POST', body: JSON.stringify(data) });
}

export function updateOfficeExpense(id: number, data: Partial<OfficeExpenseInput>): Promise<OfficeExpense> {
  return api<OfficeExpense>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

/**
 * Da de baja el gasto. **No lo borra.**
 *
 * Sale de la lista y de todos los totales, pero la fila se queda con quién la
 * dio de baja y cuándo: es dinero. Antes se borraba de verdad y el servidor no
 * escribía ninguna entrada de auditoría.
 */
export function deleteOfficeExpense(id: number): Promise<void> {
  return api<void>(`${BASE}/${id}`, { method: 'DELETE' });
}

// ── Categorías, que las escribe la empresa ───────────

export function listOfficeCategories(): Promise<OfficeCategory[]> {
  return api<OfficeCategory[]>(`${BASE}/categories`);
}

export function createOfficeCategory(name: string): Promise<OfficeCategory> {
  return api<OfficeCategory>(`${BASE}/categories`, { method: 'POST', body: JSON.stringify({ name }) });
}

/** Renombrar cambia el nombre en TODOS los gastos pasados. */
export function renameOfficeCategory(id: number, name: string): Promise<OfficeCategory> {
  return api<OfficeCategory>(`${BASE}/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export function archiveOfficeCategory(id: number): Promise<OfficeCategory> {
  return api<OfficeCategory>(`${BASE}/categories/${id}/archive`, { method: 'POST' });
}

export function restoreOfficeCategory(id: number): Promise<OfficeCategory> {
  return api<OfficeCategory>(`${BASE}/categories/${id}/restore`, { method: 'POST' });
}

/** Solo cuando no la usa ningún gasto. Con gastos detrás, el servidor responde 409. */
export function deleteOfficeCategory(id: number): Promise<void> {
  return api<void>(`${BASE}/categories/${id}`, { method: 'DELETE' });
}

// ── El comprobante ───────────────────────────────────

export async function uploadOfficeReceipt(id: number, file: File): Promise<OfficeExpense> {
  const body = new FormData();
  body.append('file', file);
  // Sin `Content-Type`: el navegador tiene que poner el boundary del multipart,
  // y escribirlo a mano rompe la subida sin decir por qué.
  const res = await fetch(`${getBaseUrl()}${BASE}/${id}/receipt`, {
    method: 'POST',
    credentials: 'include',
    body,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.message ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<OfficeExpense>;
}

export function removeOfficeReceipt(id: number): Promise<OfficeExpense> {
  return api<OfficeExpense>(`${BASE}/${id}/receipt`, { method: 'DELETE' });
}

/** La URL del comprobante. Se pide con la cookie de sesión, como los recibos de obra. */
export function officeReceiptUrl(id: number): string {
  return `${getBaseUrl()}${BASE}/${id}/receipt`;
}
