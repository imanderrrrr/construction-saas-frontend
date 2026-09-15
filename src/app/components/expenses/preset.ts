/**
 * El puente entre el Reporte de gastos y la bandeja.
 *
 * Eran dos pantallas que no se hablaban: ver «$2.410 pendientes» en una obra
 * del informe y querer revisarlos significaba ir a Gastos y volver a poner a
 * mano la obra, el estado y el rango.
 *
 * `onNavigate(section)` solo lleva el nombre de la sección, así que el recorte
 * viaja por `sessionStorage` y **se consume una sola vez**: si se quedara,
 * volver a Gastos por el menú tres días después reabriría un filtro que nadie
 * pidió. Es sessionStorage y no localStorage por lo mismo — el recorte muere
 * con la pestaña.
 */

const KEY = 'bt.expenses.preset';

export interface InboxPreset {
  projectId?: number;
  workerId?: number;
  status?: 'PENDING' | 'OBSERVED' | 'REJECTED' | 'APPROVED';
  dateFrom?: string;
  dateTo?: string;
}

export function writeInboxPreset(preset: InboxPreset): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(preset));
  } catch {
    // Sin almacenamiento, la bandeja abre con su filtro por defecto. Se pierde
    // el recorte, no la navegación.
  }
}

/** Lo lee y lo borra. Llamar una vez, al montar la bandeja. */
export function takeInboxPreset(): InboxPreset | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as InboxPreset;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
