/**
 * The browser-built PDF and Excel, kept alive on purpose.
 *
 * The redesign moves this document to the server — the sheet's own boards 09
 * to 11 draw a letterhead, two languages with their own number and date
 * formats, and a scope note in the footer, none of which a jsPDF call in a tab
 * is going to produce. Until `POST /budgets/report/export` exists, the export
 * button keeps working exactly as it did, with one correction that costs
 * nothing: it passes the real tenant name.
 *
 * That default was `'OFJR Construction'` — the pilot customer — and every
 * document this panel exports has been going out signed with it, because no
 * caller has ever passed `companyName`.
 *
 * Two of the columns it wants are figures the screen has retired. They are
 * built HERE rather than in the screen so nothing revives them on the way
 * back:
 *
 *  - `deviation` was `|execution − 100|` labelled "under plan": a jobsite that
 *    had spent a third of its budget read "-66.7 % under plan". The document
 *    keeps its column until the server-side one replaces it; the screen does
 *    not.
 *  - `estimatedDays` extrapolated from the day the jobsite was created with a
 *    floor of one day. It leaves the paper too: this document goes to a bank,
 *    and a made-up countdown is worse there than a blank.
 */

import type { ProjectExpenseRow } from '../../services/expenses';
import {
  exportBudgetExcel, exportBudgetPdf,
  type AlertExportRow, type BudgetExportRow,
} from '../../helpers/exportBudgetReport';
import { execPct, type BudgetRow } from './bits';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** The legacy document's own deviation label, computed only for the document. */
function deviationLabel(t: Translate, pct: number, consumed: number): string {
  const away = Math.round(Math.abs(pct - 100) * 10) / 10;
  if (pct > 100) return t('admin:budgetReport.deviation.severeOver', { pct: away });
  if (pct >= 85) return t('admin:budgetReport.deviation.moderateOver', { pct: away });
  if (pct < 50 && consumed > 0) return t('admin:budgetReport.deviation.under', { pct: away });
  return t('admin:budgetReport.deviation.onTrack', { pct: away });
}

export async function exportLegacyBudgetDocument({ format, rows, expenseRows, companyName, t }: {
  format: 'pdf' | 'excel';
  /** Already filtered and sorted: the document carries what the screen shows. */
  rows: BudgetRow[];
  expenseRows: Map<number, ProjectExpenseRow>;
  companyName: string | null;
  t: Translate;
}): Promise<void> {
  if (rows.length === 0) return;

  const exportRows: BudgetExportRow[] = rows.map(row => {
    const pct = execPct(row);
    const breakdown = (expenseRows.get(row.id)?.breakdown ?? []).map(entry => {
      const amount = entry.totalCents / 100;
      return {
        type: entry.type.toLowerCase().replace(/_/g, '-'),
        label: entry.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        amount,
        pct: row.consumed > 0 ? Math.round((amount / row.consumed) * 1000) / 10 : 0,
      };
    });
    return {
      project: row.name,
      totalBudget: row.base,
      consumed: row.consumed,
      available: row.base - row.consumed,
      executionPct: pct,
      deviation: deviationLabel(t, pct, row.consumed),
      status: row.closed ? 'Closed' : 'Active',
      collected: row.collected,
      outstanding: row.outstanding,
      breakdown,
    };
  });

  const alerts: AlertExportRow[] = rows
    .filter(row => execPct(row) >= 70)
    .sort((a, b) => execPct(b) - execPct(a))
    .map(row => ({
      project: row.name,
      pct: execPct(row),
      level: execPct(row) >= 90 ? 'critical' : 'warning',
      remaining: row.base - row.consumed,
      estimatedDays: null,
    }));

  const totalBudget = rows.reduce((sum, row) => sum + row.base, 0);
  const totalConsumed = rows.reduce((sum, row) => sum + row.consumed, 0);
  const params = {
    rows: exportRows,
    alerts,
    kpis: {
      totalBudget,
      totalConsumed,
      totalAvailable: totalBudget - totalConsumed,
      projectsOver90: rows.filter(row => execPct(row) >= 90).length,
    },
    // Only when the tenant actually has a name: the helper's own default is
    // the pilot customer's, and an empty string would print a blank masthead.
    ...(companyName ? { companyName } : {}),
  };

  if (format === 'excel') await exportBudgetExcel(params);
  else exportBudgetPdf(params);
}
