import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { stage, openSection } from './support/stage';
import { installManualApi } from './support/routes.manual';
import { hideCursor } from './support/cursor';
import type { Lang } from './support/routes';

// Stills for the SALES MANUAL — one screenshot per module, every panel, over
// the same invented company the landing clips use.
//
// Separate from clips.rec.ts on purpose. A clip is choreography: it moves,
// so it needs a pointer and in/out points. A still is one frame of a screen
// that has finished loading, and the manual needs one of EVERY module — the
// point of the document is that a seller can name and show all of it.
//
// Nothing here is dressed except what stage.ts already documents.
//
//   npx playwright test --config=tools/demo-recorder/recorder.config.ts shots.rec.ts
//   → tools/demo-recorder/.shots/manual/<lang>/<panel>.<key>.png

const LANGS: Lang[] = (process.env.SHOT_LANGS?.split(',') as Lang[]) ?? ['es'];
const OUT = 'tools/demo-recorder/.shots/manual';

type Shot = {
  /** File stem: `<panel>.<key>`. */
  key: string;
  /** Sidebar label, per language — how the panel names the module on screen. */
  label?: Record<Lang, string>;
  /** Admin only: the nav button carries a stable tour id, so use it. */
  tour?: string;
  /** A route of its own rather than a section of the dashboard. */
  route?: string;
  /** Extra beats once the section is on screen. */
  after?: (page: Page, lang: Lang) => Promise<void>;
  /** Wait for this to exist before the shot. */
  ready?: string;
};

type Panel = {
  role: string; username: string; dashboard: string;
  shots: Shot[];
};

const L = (es: string, en: string) => ({ es, en });

/** Click a sidebar entry by the label the panel prints on it. */
async function navByLabel(page: Page, label: string) {
  const nav = page.locator('aside').first();
  const byTitle = nav.locator(`button[title="${label}"]`);
  const target = (await byTitle.count())
    ? byTitle.first()
    : nav.getByRole('button', { name: label, exact: true }).first();
  await target.click();
}

async function settle(page: Page, ready?: string) {
  if (ready) await page.waitForSelector(ready, { timeout: 12_000 }).catch(() => {});
  // Give the section's own fetches, skeletons and count-ups time to land.
  await page.waitForTimeout(2600);
  await hideCursor(page);
}

/** The lazy-chunk error boundary. Under the dev server it fires now and then. */
async function brokeChunk(page: Page): Promise<boolean> {
  return page.getByText('Failed to load section').isVisible().catch(() => false);
}

/**
 * What the module says about itself, saved next to the frame.
 *
 * The manual describes every screen in prose, and prose written from memory of
 * a screenshot invents labels. This is the screen's own words.
 */
async function mainText(page: Page): Promise<string> {
  return page.locator('main').first().innerText().catch(() => '');
}

const PANELS: Panel[] = [
  {
    role: 'ADMIN', username: 'analucia', dashboard: '/admin/dashboard',
    shots: [
      { key: 'admin.dashboard',           tour: 'dashboard' },
      { key: 'admin.audit',               tour: 'audit' },
      { key: 'admin.users',               tour: 'users' },
      { key: 'admin.time-approvals',      tour: 'time-approvals' },
      { key: 'admin.hours',               tour: 'hours' },
      { key: 'admin.labor-cost',          tour: 'labor-cost' },
      { key: 'admin.labor-payroll',       tour: 'labor-payroll' },
      { key: 'admin.projects',            tour: 'projects' },
      { key: 'admin.clients',             tour: 'clients' },
      { key: 'admin.subcontractors',      tour: 'subcontractors' },
      { key: 'admin.schedules',           tour: 'schedules' },
      { key: 'admin.tool-inventory',      tour: 'tool-inventory' },
      { key: 'admin.tool-report',         tour: 'tool-report' },
      { key: 'admin.tm-field',            tour: 'tm-field' },
      { key: 'admin.invoices',            tour: 'invoices' },
      { key: 'admin.invoice-branding',    tour: 'invoice-branding' },
      { key: 'admin.budgets',             tour: 'budgets' },
      {
        key: 'admin.budgets-report', tour: 'budgets',
        after: async page => { await page.locator('#bt-budgets-tab-report').click(); },
      },
      { key: 'admin.expenses',            tour: 'expenses' },
      { key: 'admin.expense-report',      tour: 'expense-report' },
      { key: 'admin.office-expenses',     tour: 'office-expenses' },
      { key: 'admin.accounts-receivable', tour: 'accounts-receivable' },
      { key: 'admin.accounts-payable',    tour: 'accounts-payable' },
      { key: 'admin.tm-office',           tour: 'tm-office' },
      { key: 'admin.billing',             route: '/admin/billing' },
      // The project file: five tabs, each its own conversation in a demo.
      ...(['resumen', 'dinero', 'equipo', 'pendientes', 'consultas', 'portal'] as const).map((tab, i) => ({
        key: `admin.project-${tab}`, tour: 'projects',
        after: async (page: Page) => {
          await page.getByText('Residencial Vista Hermosa II').first().click();
          await page.waitForSelector('[role="tab"]');
          await page.waitForTimeout(900);
          const tabs = page.getByRole('tab');
          await tabs.nth(i).click();
        },
      })),
    ],
  },
  {
    role: 'FINANCE', username: 'fmorales', dashboard: '/finance/dashboard',
    shots: [
      { key: 'finance.dashboard' },
      { key: 'finance.invoices',            label: L('Facturas', 'Invoices') },
      { key: 'finance.accounts-receivable', label: L('Cuentas por Cobrar', 'Accounts Receivable') },
      { key: 'finance.accounts-payable',    label: L('Cuentas por Pagar', 'Accounts Payable') },
      { key: 'finance.tm-office',           label: L('Tiempo y material', 'Time & material') },
      { key: 'finance.approved-expenses',   label: L('Gastos Aprobados', 'Approved Expenses') },
      { key: 'finance.expense-report',      label: L('Reporte de Gastos', 'Expense Report') },
      { key: 'finance.budgets',             label: L('Presupuestos', 'Budgets') },
      { key: 'finance.project-financials',  label: L('Finanzas de Proyecto', 'Project Financials') },
      { key: 'finance.labor-cost',          label: L('Costo de Mano de Obra', 'Labor Cost') },
      { key: 'finance.labor-payroll',       label: L('Nómina', 'Labor Payroll') },
      { key: 'finance.supervisor-hours',    label: L('Horas de Supervisores', 'Supervisor Hours') },
    ],
  },
  {
    role: 'SUPERVISOR', username: 'jcastillo', dashboard: '/supervisor/dashboard',
    shots: [
      { key: 'supervisor.dashboard' },
      { key: 'supervisor.projects',        label: L('Mis Proyectos', 'My Projects') },
      { key: 'supervisor.task-board',      label: L('Tablero de Tareas', 'Task Board') },
      { key: 'supervisor.site-log',        label: L('Bitácora', 'Site log') },
      { key: 'supervisor.punch-list',      label: L('Pendientes', 'Punch list') },
      { key: 'supervisor.rfi',             label: L('Consultas', 'RFIs') },
      { key: 'supervisor.tm',              label: L('Tiempo y material', 'Time & material') },
      { key: 'supervisor.my-time',         label: L('Marcar Tiempo', 'Punch Clock') },
      { key: 'supervisor.time-approvals',  label: L('Aprobación de Horas', 'Time Approvals') },
      { key: 'supervisor.expense-reviews', label: L('Revisión de Gastos', 'Expense Reviews') },
      { key: 'supervisor.team-tools',      label: L('Herramientas del Equipo', 'Team Tools') },
    ],
  },
  {
    role: 'WAREHOUSE', username: 'gsosa', dashboard: '/warehouse/dashboard',
    shots: [
      { key: 'warehouse.dashboard' },
      { key: 'warehouse.tool-inventory',      label: L('Inventario de Herramientas', 'Tool Inventory') },
      { key: 'warehouse.assignments',         label: L('Asignaciones', 'Assignments') },
      { key: 'warehouse.tool-history',        label: L('Historial de Herramientas', 'Tool History') },
      { key: 'warehouse.consumables',         label: L('Stock de Consumibles', 'Consumable Stock') },
      { key: 'warehouse.consumable-dispatch', label: L('Despachar Insumos', 'Dispatch Supply') },
    ],
  },
  {
    role: 'WORKER', username: 'mramirez', dashboard: '/worker/dashboard',
    shots: [
      { key: 'worker.dashboard' },
      { key: 'worker.time',        label: L('Reloj de Tiempo', 'Time Clock') },
      { key: 'worker.my-hours',    label: L('Mis Horas', 'My Hours') },
      { key: 'worker.new-expense', label: L('Nuevo Gasto', 'New Expense') },
      { key: 'worker.my-expenses', label: L('Mis Gastos', 'My Expenses') },
      { key: 'worker.my-tools',    label: L('Mis Herramientas', 'My Tools') },
    ],
  },
];

for (const lang of LANGS) {
  for (const panel of PANELS) {
    test(`shots · ${panel.role} · ${lang}`, async ({ page, context }, info) => {
      test.setTimeout(900_000);
      const dir = path.join(OUT, lang);
      fs.mkdirSync(dir, { recursive: true });

      const broken: string[] = [];
      // The worker panel asks for the phone's position before it will show the
      // clock. Granting it photographs the screen a worker actually sees,
      // instead of the permission prompt in front of it.
      await context.grantPermissions(['geolocation']);
      await context.setGeolocation({ latitude: 14.558612, longitude: -90.476233 });
      await stage(page, context, { lang, role: panel.role, username: panel.username });
      await installManualApi(page, lang);

      for (const shot of panel.shots) {
        if (shot.route) {
          await page.goto(shot.route);
        } else if (shot.tour) {
          // The admin panel's own nav carries the tour id; reuse its wait.
          await openSection(page, shot.tour);
        } else if (shot.label) {
          await page.goto(panel.dashboard);
          await page.waitForTimeout(2200);
          await navByLabel(page, shot.label[lang]);
        } else {
          await page.goto(panel.dashboard);
        }
        if (shot.after) await shot.after(page, lang);
        await settle(page, shot.ready);

        // A chunk that failed to load photographs as an error card. Retry the
        // whole approach once rather than shipping it in the manual.
        if (await brokeChunk(page)) {
          await page.reload();
          await page.waitForTimeout(2000);
          if (shot.tour) await openSection(page, shot.tour);
          else if (shot.label) { await page.waitForTimeout(1500); await navByLabel(page, shot.label[lang]); }
          if (shot.after) await shot.after(page, lang);
          await settle(page, shot.ready);
        }

        await page.screenshot({ path: path.join(dir, `${shot.key}.png`) });
        fs.writeFileSync(path.join(dir, `${shot.key}.txt`), await mainText(page));
        if (await brokeChunk(page)) broken.push(shot.key);
        info.annotations.push({ type: 'shot', description: shot.key });
      }
      if (broken.length) throw new Error(`sections that would not load: ${broken.join(', ')}`);
    });
  }
}
