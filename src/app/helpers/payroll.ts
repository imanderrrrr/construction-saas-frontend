// OFJR Construction — Payroll math (shared by the on-screen reports and the
// PDF / Excel exports).
//
// Backend field semantics (do NOT conflate these):
//   • totalApprovedHours — ALL approved hours in the period (already-paid +
//     unpaid). Good for "hours worked" analytics, WRONG for "what we owe now".
//   • unpaidApprovedHours / projectedCost / kpis.totalLaborCost — only the hours
//     that have NOT been paid yet (reset to 0 after a payment is confirmed).
//
// Paying a worker from `totalApprovedHours × hourlyRate` double-pays hours that
// were already settled in a previous run, and the per-row figure no longer
// reconciles with the report TOTAL (which is built from kpis.totalLaborCost,
// i.e. unpaid only). Every payroll row must therefore be costed from the unpaid
// hours, exactly like LaborPayrollReport / LaborCostReport render on screen.
import type { WorkerHoursSummary } from '../services/time';

/**
 * Hours still owed to a worker for this payroll run. Prefers the backend's
 * `unpaidApprovedHours`; falls back to `totalApprovedHours` only when the
 * backend did not supply the unpaid figure (older payloads).
 */
export function unpaidApprovedHours(w: WorkerHoursSummary): number {
  return w.unpaidApprovedHours ?? w.totalApprovedHours;
}

/**
 * Money owed to a worker for this payroll run — i.e. unpaid approved hours ×
 * hourly rate. Mirrors the on-screen reports: prefer the backend `projectedCost`
 * (already net of paid hours), otherwise derive it from the unpaid hours.
 * Returns `null` when the worker has no hourly rate (rendered as "N/A").
 *
 * Summing this across all workers yields `kpis.totalLaborCost`, so an export's
 * per-row pay reconciles with its own TOTAL footer.
 */
export function workerRowPay(w: WorkerHoursSummary): number | null {
  if (w.projectedCost != null) return w.projectedCost;
  if (w.hourlyRate == null) return null;
  return unpaidApprovedHours(w) * w.hourlyRate;
}
