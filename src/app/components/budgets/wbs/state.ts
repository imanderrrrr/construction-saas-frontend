import { moneyInputCents } from '../../../lib/moneyInput';
import { LINE_ITEM_CATEGORIES, type CreateLineItemPayload, type LineItemVarianceStatus } from '../../../services/budgetLineItems';

export function varianceStatus(consumptionPct: number): LineItemVarianceStatus {
  if (consumptionPct >= 100) return 'OVER_BUDGET';
  return consumptionPct >= 85 ? 'WARNING' : 'OK';
}

/** A zero budget with actual spend is also a leak. */
export function varianceFromSpend(spentCents: number, revisedBudgetCents: number): LineItemVarianceStatus {
  if (revisedBudgetCents <= 0) return spentCents > 0 ? 'OVER_BUDGET' : 'OK';
  return varianceStatus(spentCents / revisedBudgetCents * 100);
}

export class WbsImportError extends Error {
  constructor(public readonly row: number, public readonly reason: 'columns' | 'required' | 'category' | 'amount' | 'duplicate' | 'quote' | 'empty' | 'limit') {
    super(`${row}: ${reason}`);
  }
}

/** Supports quoted CSV, semicolon exports and tab-separated Excel paste. */
export function parseWbsImport(text: string): CreateLineItemPayload[] {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) throw new WbsImportError(0, 'empty');
  const firstLine = source.split(/\r?\n/, 1)[0];
  const counts: Record<string, number> = { '\t': 0, ';': 0, ',': 0 };
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    if (firstLine[i] === '"') {
      if (inQuotes && firstLine[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && firstLine[i] in counts) counts[firstLine[i]]++;
  }
  const delimiter = ['\t', ';', ','].sort((a, b) => counts[b] - counts[a])[0];
  const rows: string[][] = [];
  let cells: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      cells.push(cell.trim()); if (cells.some(Boolean)) rows.push(cells); cells = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new WbsImportError(rows.length + 1, 'quote');
  cells.push(cell.trim()); if (cells.some(Boolean)) rows.push(cells);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const header = ['CODE', 'CODIGO'].includes(normalize(rows[0]?.[0] ?? ''));
  const inputRows = header ? rows.slice(1) : rows;
  if (inputRows.length > 500) throw new WbsImportError(501, 'limit');
  const codes = new Set<string>();
  let totalCents = 0;
  const aliases: Record<string, typeof LINE_ITEM_CATEGORIES[number]> = {
    'MANO DE OBRA': 'LABOR', SUBCONTRATO: 'SUBCONTRACTOR', SUBCONTRATISTA: 'SUBCONTRACTOR',
    MATERIALES: 'MATERIAL', EQUIPO: 'EQUIPMENT', MAQUINARIA: 'EQUIPMENT',
  };
  const items = inputRows.map((values, index) => {
    const row = index + (header ? 2 : 1);
    if (values.length !== 4) throw new WbsImportError(row, 'columns');
    const [code, name, rawCategory, amount] = values;
    if (!code || !name || code.length > 50 || name.length > 255) throw new WbsImportError(row, 'required');
    const categoryText = normalize(rawCategory || 'GENERAL');
    const category = aliases[categoryText] ?? categoryText;
    if (!LINE_ITEM_CATEGORIES.includes(category as typeof LINE_ITEM_CATEGORIES[number])) throw new WbsImportError(row, 'category');
    const dollars = amount.replace(/^\$\s*/, '');
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(dollars)) throw new WbsImportError(row, 'amount');
    const originalBudgetCents = moneyInputCents(dollars.replace(/,/g, ''));
    if (originalBudgetCents == null) throw new WbsImportError(row, 'amount');
    totalCents += originalBudgetCents;
    if (!Number.isSafeInteger(totalCents)) throw new WbsImportError(row, 'amount');
    if (codes.has(code)) throw new WbsImportError(row, 'duplicate');
    codes.add(code);
    return { code, name, category: category as typeof LINE_ITEM_CATEGORIES[number], originalBudgetCents };
  });
  if (!items.length) throw new WbsImportError(0, 'empty');
  return items;
}
