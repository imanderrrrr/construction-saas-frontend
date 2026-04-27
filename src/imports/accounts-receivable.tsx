# Prompt 17 — Finance: Accounts Receivable, Accounts Payable, Project Financials & Dashboard Rewrite

## System context (read once, apply everywhere)

| Token | Value |
|-------|-------|
| **Framework** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS v4 utility classes — **no `@apply`**, no CSS modules |
| **Component library** | shadcn/ui already installed (Button, Table, Select, Dialog, DropdownMenu, Tabs, Badge, Tooltip, Card, etc.) — import from `./ui/<component>` |
| **Icons** | `lucide-react` — only tree-shake what you import |
| **Toasts** | `sonner` — `import { toast } from 'sonner'` |
| **State** | Local `useState` / `useMemo` — no Redux, no Zustand, no Context |
| **Data** | Hardcoded mock arrays with `// TODO: GET|POST /api/v1/…` comments — NO fetch calls |
| **Exports** | Named exports only (`export function Xyz`) |
| **File encoding** | UTF-8, LF line endings, no BOM |

### Design-system tokens (use **literally** — no CSS vars)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#F97316` | Links, primary actions |
| Deep | `#C2410C` | Admin accent |
| Dark | `#0A0A0A` | Headings, body text |
| Light bg | `#FAFAFA` | Page background, subtle fills |
| Border | `#D4D4D8` | Cards, dividers, table borders |
| Muted | `#71717A` | Captions, secondary text |
| Destructive | `#d4183d` | Errors, delete actions, overdue |
| **Finance accent** | `#9333ea` / `purple-600` | Role color for Finance role |

### Role context

The **Finance/Contador** role uses purple-600 (`#9333ea`) as its accent. All new components are for this role. Currently only 5 sections exist (dashboard, approved-expenses, expense-report, budgets, budget-report). We are adding **3 new sections** (accounts-receivable, accounts-payable, project-financials) and **rewriting** the dashboard page to use `AppShell`.

---

## Task 1 — Create `AccountsReceivable.tsx`

**File:** `src/app/components/AccountsReceivable.tsx`

Create a complete Accounts Receivable (Cuentas por Cobrar) component following the same structural pattern as `FinanceExpenses.tsx` and `FinanceBudgets.tsx`.

### Requirements from requisitos.md §4.4:
- Visualizar facturas emitidas
- Ver estatus (pagado, pendiente, vencido)
- Registrar pagos recibidos
- Gestionar fechas de vencimiento y alertas

### Component specification

```
export function AccountsReceivable()
```

**KPI cards row** (4 cards using `StatCard`):
| Icon | Title | Mock value | Subtitle | Colors |
|------|-------|------------|----------|--------|
| `Receipt` | Total receivable | $185,400.00 | All active invoices | purple-50 / purple-600 |
| `DollarSign` | Collected this month | $42,300.00 | Feb 2026 | emerald-50 / emerald-600 |
| `Clock` | Pending | $98,700.00 | 12 invoices | amber-50 / amber-600 |
| `AlertTriangle` | Overdue | $44,400.00 | 5 invoices · Action required | red-50 / red-600 |

**Filter bar** (same pattern as FinanceExpenses):
- Filter by **Project** (Select: All Projects, Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion)
- Filter by **Status** (Select: All Statuses, Paid, Pending, Overdue)
- Filter by **Date range**: From / To date inputs
- "Clear filters" button when any active

**Mock data** (8-10 invoices):
```ts
// TODO: GET /api/v1/finance/receivables
interface Invoice {
  id: string;
  invoiceNumber: string;      // e.g. "INV-2026-001"
  client: string;             // e.g. "Metro Development Corp"
  project: string;
  description: string;        // e.g. "Foundation work — Phase 1"
  issuedDate: string;         // ISO date
  dueDate: string;            // ISO date
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'overdue';
  payments: PaymentRecord[];  // payment history
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;             // "Bank transfer", "Check", "Cash"
  reference?: string;         // check number or transfer ref
}
```

Provide realistic mock data with a mix of statuses:
- 3-4 paid invoices (paidAmount === amount)
- 3-4 pending invoices (dueDate in the future)
- 2-3 overdue invoices (dueDate in the past, paidAmount < amount)
- At least 1 invoice with partial payments (2 PaymentRecords)

**Table columns:**
| Column | Width hint | Content |
|--------|-----------|---------|
| Invoice # | 120px | `invoiceNumber` — monospace font |
| Client | flex | Client name |
| Project | 160px | Project name, muted text |
| Issue Date | 110px | Formatted date |
| Due Date | 110px | Formatted date. If overdue → red text |
| Amount | 110px | Monospace, font-semibold |
| Paid | 110px | Monospace, emerald when full |
| Balance | 110px | `amount - paidAmount`, monospace. If > 0 → amber/red depending on overdue |
| Status | 100px | Badge: paid → emerald bg/text, pending → amber bg/text, overdue → red bg/text |
| Actions | 80px | Kebab menu or button |

**Expandable row** (click row or chevron to expand):
- Shows payment history table (Date, Amount, Method, Reference)
- "Register Payment" button (purple-600) that opens a Dialog

**Register Payment Dialog** (Dialog from shadcn/ui):
- Title: "Register Payment — INV-XXXX"
- Fields:
  - Amount (number input, max = remaining balance, pre-filled with balance)
  - Payment Date (date input, default today)
  - Method (Select: Bank transfer, Check, Cash, Other)
  - Reference (text input, optional)
- Buttons: Cancel (ghost) | Register Payment (purple-600 bg)
- On submit: toast.success("Payment registered for INV-XXXX"), add to local state
- Validation: amount > 0, amount ≤ balance, date required

**Overdue alerts section** (below table if any overdue invoices):
- Yellow/red alert banner: "⚠ {count} invoices are overdue totaling ${total}"
- List each overdue invoice: Invoice #, Client, Days overdue, Amount due

**Pagination**: Same pattern as FinanceExpenses — 10 items per page, Previous/Next buttons.

**Summary footer** in table card:
- Left: "Showing X of Y invoices"
- Right: "Total Outstanding: $XX,XXX.XX" in monospace font-semibold

---

## Task 2 — Create `AccountsPayable.tsx`

**File:** `src/app/components/AccountsPayable.tsx`

Create a complete Accounts Payable (Cuentas por Pagar) component.

### Requirements from requisitos.md §4.4:
- Gestionar proveedores
- Visualizar facturas pendientes
- Registrar pagos realizados

### Component specification

```
export function AccountsPayable()
```

**KPI cards row** (4 cards using `StatCard`):
| Icon | Title | Mock value | Subtitle | Colors |
|------|-------|------------|----------|--------|
| `Wallet` | Total payable | $127,800.00 | All vendor invoices | purple-50 / purple-600 |
| `DollarSign` | Paid this month | $38,500.00 | Feb 2026 | emerald-50 / emerald-600 |
| `Clock` | Pending payment | $67,300.00 | 15 invoices | amber-50 / amber-600 |
| `AlertTriangle` | Overdue | $22,000.00 | 3 invoices | red-50 / red-600 |

**Filter bar:**
- Filter by **Vendor** (Select: All Vendors + list from mock data)
- Filter by **Status** (Select: All, Paid, Pending, Overdue)
- Filter by **Category** (Select: All, Materials, Equipment Rental, Subcontractor, Services, Other)
- "Clear filters" button

**Mock data** (8-10 vendor bills):
```ts
// TODO: GET /api/v1/finance/payables
interface VendorBill {
  id: string;
  billNumber: string;         // e.g. "BILL-2026-001"
  vendor: string;             // e.g. "Acme Steel Supply"
  category: 'materials' | 'equipment-rental' | 'subcontractor' | 'services' | 'other';
  project: string;
  description: string;
  receivedDate: string;       // when bill was received
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'overdue';
  payments: VendorPayment[];
}

interface VendorPayment {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference?: string;
  approvedBy?: string;
}
```

Provide realistic construction vendor mock data:
- Vendors: "Acme Steel Supply", "QuickMix Concrete", "Torres Equipment Rental", "Rivera Electrical Services", "López Plumbing", "Hernández Lumber"
- Mix of statuses: 3 paid, 3-4 pending, 2 overdue
- Category variety: materials (most common), equipment-rental, subcontractor, services

**Table columns:**
| Column | Content |
|--------|---------|
| Bill # | `billNumber` — monospace |
| Vendor | Vendor name |
| Category | Badge with category label — neutral colors |
| Project | Project name, muted |
| Received | Formatted date |
| Due Date | Red text if overdue |
| Amount | Monospace font-semibold |
| Paid | Monospace, emerald if fully paid |
| Balance | Remaining amount |
| Status | Badge (same color scheme as AR) |
| Actions | Kebab / button |

**Expandable row:**
- Payment history (Date, Amount, Method, Reference, Approved By)
- "Record Payment" button (purple-600)

**Record Payment Dialog:**
- Title: "Record Payment — BILL-XXXX"
- Fields: Amount (max = balance), Payment Date, Method (Bank transfer, Check, Cash, Wire transfer, Other), Reference, Notes
- Buttons: Cancel | Record Payment
- toast.success on submit

**Vendor summary section** (collapsible, above or below table):
- Card per vendor showing: vendor name, total bills, total amount, paid amount, outstanding balance
- Small horizontal bar showing paid % in emerald vs remaining in gray

**Pagination & summary footer**: same pattern as Task 1.

---

## Task 3 — Create `ProjectFinancials.tsx`

**File:** `src/app/components/ProjectFinancials.tsx`

Create a Project Financial Control component.

### Requirements from requisitos.md §4.4:
- Visualizar costos reales vs presupuesto
- Analizar: Mano de obra, Materiales, Equipo, Gastos misceláneos
- Ver márgenes por proyecto

### Component specification

```
export function ProjectFinancials()
```

**Filter bar:**
- Project selector (Select: select a project or "All Projects" for overview)
- Period selector (Select: This Month, This Quarter, This Year, All Time)

**All Projects overview** (when "All Projects" selected — default view):

**KPI row** (4 StatCards):
| Icon | Title | Mock value | Subtitle | Colors |
|------|-------|------------|----------|--------|
| `DollarSign` | Total Revenue | $425,000.00 | Across all projects | purple-50 / purple-600 |
| `TrendingDown` | Total Costs | $312,500.00 | Real costs to date | amber-50 / amber-600 |
| `TrendingUp` | Gross Margin | 26.5% | Avg across projects | emerald-50 / emerald-600 |
| `AlertTriangle` | Over Budget | 1 project | Needs attention | red-50 / red-600 |

**Projects comparison table:**
| Column | Content |
|--------|---------|
| Project | Project name |
| Budget | Total budget amount |
| Revenue | Contract / billed amount |
| Labor | Real labor cost (mano de obra) |
| Materials | Real materials cost |
| Equipment | Real equipment cost |
| Misc | Miscellaneous costs |
| Total Cost | Sum of cost categories |
| Margin | `(Revenue - Total Cost) / Revenue * 100` — % with color: ≥20% emerald, 10-19% amber, <10% red |
| Budget Usage | `Total Cost / Budget * 100` — progress bar with color coding |

**Single project detail** (when a specific project is selected):

**Project header card:**
- Project name (bold h2), status badge (Active/Closed), date range
- Large KPI: Contract Value → Total Cost → Margin (with arrow indicators)

**Cost breakdown card** (side-by-side or stacked):
Left: **Budget vs Actual** horizontal bar chart (built with divs, no chart lib):
- For each category (Labor, Materials, Equipment, Misc):
  - Label, Budget amount, Actual amount
  - Horizontal bar: budget in gray outline, actual filled (emerald if under, amber if 80-100%, red if over)
  - Variance: `actual - budget` with +/- prefix

Right: **Cost Distribution** (simple donut built with conic-gradient or stacked bars):
- Show % of total cost per category with color coding

**Mock data:**
```ts
// TODO: GET /api/v1/finance/project-financials
interface ProjectFinancial {
  id: string;
  project: string;
  status: 'Active' | 'Closed';
  startDate: string;
  endDate?: string;
  contractValue: number;      // revenue/contract amount
  budget: number;
  costs: {
    labor: { budget: number; actual: number };
    materials: { budget: number; actual: number };
    equipment: { budget: number; actual: number };
    misc: { budget: number; actual: number };
  };
}
```

Provide 4 projects matching existing names:
- Downtown Plaza: Active, healthy margins (~25%)
- Highway Bridge: Active, over budget on materials (margin ~8%)
- Office Renovation: Active, on budget (~22% margin)
- Harbor Expansion: Active, early stage, under budget so far (~30% margin)

**Margin timeline section** (simple monthly table):
- Table with months as columns, rows: Revenue, Costs, Margin
- Last 3-4 months of mock data
- Show trend direction with small up/down icons

---

## Task 4 — Rewrite `FinanceDashboard.tsx`

**File:** `src/app/pages/FinanceDashboard.tsx`

**Rewrite entirely.** The current file has its own custom sidebar (~100 lines of duplicated layout code). Replace it with the shared `AppShell` component, following the exact same pattern as `AdminDashboard.tsx` and the recently refactored `WorkerDashboard.tsx`.

### Import AppShell

```tsx
import { AppShell, type AppShellNavItem } from '../components/AppShell';
```

### ActiveSection — add new sections

```ts
type ActiveSection =
  | 'dashboard'
  | 'approved-expenses'
  | 'expense-report'
  | 'accounts-receivable'   // NEW
  | 'accounts-payable'      // NEW
  | 'budgets'
  | 'budget-report'
  | 'project-financials';   // NEW
```

### Lazy imports — add new components

Keep existing lazy imports exactly as-is, then add:
```tsx
const AccountsReceivable = lazy(() =>
  import('../components/AccountsReceivable').then(m => ({ default: m.AccountsReceivable }))
);
const AccountsPayable = lazy(() =>
  import('../components/AccountsPayable').then(m => ({ default: m.AccountsPayable }))
);
const ProjectFinancials = lazy(() =>
  import('../components/ProjectFinancials').then(m => ({ default: m.ProjectFinancials }))
);
```

### Navigation config — using navGroups pattern

```tsx
const NAV_ITEMS: AppShellNavItem[] = [
  { key: 'dashboard',            label: 'Dashboard',             icon: LayoutDashboard },
  { key: 'accounts-receivable',  label: 'Accounts Receivable',   icon: ArrowDownToLine, group: 'accounting' },
  { key: 'accounts-payable',     label: 'Accounts Payable',      icon: ArrowUpFromLine, group: 'accounting' },
  { key: 'approved-expenses',    label: 'Approved Expenses',     icon: CheckCircle,     group: 'expenses'   },
  { key: 'expense-report',       label: 'Expense Report',        icon: FileBarChart,    group: 'expenses'   },
  { key: 'budgets',              label: 'Budgets',               icon: Wallet,          group: 'budgets'    },
  { key: 'budget-report',        label: 'Budget Report',         icon: PieChart,        group: 'budgets'    },
  { key: 'project-financials',   label: 'Project Financials',    icon: BarChart3,       group: 'budgets'    },
];

const NAV_GROUPS = [
  { key: 'accounting', label: 'Accounting' },
  { key: 'expenses',   label: 'Expenses' },
  { key: 'budgets',    label: 'Budgets & Projects' },
];
```

### Section metadata

Add entries for new sections:
```ts
const SECTION_META: Record<ActiveSection, { title: string; subtitle: string }> = {
  'dashboard':            { title: 'Dashboard',             subtitle: 'Financial overview and KPIs' },
  'accounts-receivable':  { title: 'Accounts Receivable',   subtitle: 'Client invoices and payment tracking' },
  'accounts-payable':     { title: 'Accounts Payable',      subtitle: 'Vendor bills and payment management' },
  'approved-expenses':    { title: 'Approved Expenses',     subtitle: 'View all approved expense records' },
  'expense-report':       { title: 'Expense Report',        subtitle: 'Financial analysis by project and worker' },
  'budgets':              { title: 'Project Budgets',       subtitle: 'View budget status across all projects' },
  'budget-report':        { title: 'Budget Report',         subtitle: 'Budget vs actual analysis and export' },
  'project-financials':   { title: 'Project Financials',    subtitle: 'Cost analysis and margins by project' },
};
```

### Enhanced DashboardView

The inline `DashboardView` function stays inside `FinanceDashboard.tsx` but gets enhanced:

**KPI cards** — upgrade from 4 expense-only cards to a financial overview:
| Icon | Title | Mock value | Subtitle | Colors |
|------|-------|------------|----------|--------|
| `DollarSign` | Revenue | $425,000.00 | Total contracted | purple-50 / purple-600 |
| `TrendingDown` | Expenses | $312,500.00 | Total costs | amber-50 / amber-600 |
| `TrendingUp` | Net Margin | 26.5% | Across all projects | emerald-50 / emerald-600 |
| `Wallet` | Cash Flow | +$68,200.00 | This month | purple-50 / purple-600 |

**Quick access cards** — expand from 3 to 6 (grid 2×3 on desktop):
1. Accounts Receivable → `accounts-receivable` (icon: ArrowDownToLine, "Track client invoices and payments")
2. Accounts Payable → `accounts-payable` (icon: ArrowUpFromLine, "Manage vendor bills and payments")
3. Approved Expenses → `approved-expenses` (icon: CheckCircle, "Browse approved expense records")
4. Expense Report → `expense-report` (icon: FileBarChart, "Analyze expenses by project")
5. Project Budgets → `budgets` (icon: Wallet, "Budget allocation and consumption")
6. Project Financials → `project-financials` (icon: BarChart3, "Cost analysis and margins")

**Keep** the "Recent Approved Expenses" table exactly as-is.

**Add** a small "Overdue Alerts" section below the recent expenses (if any AR/AP overdue):
- Red/amber banner: "3 receivables overdue ($44,400) · 2 payables overdue ($22,000)"
- Links to navigate to the respective sections

### Main component structure

```tsx
export function FinanceDashboard() {
  const navigate    = useNavigate();
  const username    = AuthService.getUsername() ?? 'finance';
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');

  const handleLogout   = () => { AuthService.logout(); navigate('/'); };
  const handleNavigate = (section: string) => setActiveSection(section as ActiveSection);
  const meta = SECTION_META[activeSection];

  return (
    <>
      <AppShell
        role="FINANCE"
        username={username}
        navItems={NAV_ITEMS}
        navGroups={NAV_GROUPS}
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pageTitle={meta.title}
        pageSubtitle={meta.subtitle}
      >
        {activeSection === 'dashboard' && (
          <DashboardView username={username} onNavigate={handleNavigate} />
        )}
        {activeSection === 'accounts-receivable' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <AccountsReceivable />
          </Suspense>
        )}
        {activeSection === 'accounts-payable' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <AccountsPayable />
          </Suspense>
        )}
        {activeSection === 'approved-expenses' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <FinanceExpenses />
          </Suspense>
        )}
        {activeSection === 'expense-report' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ExpenseReport readOnly />
          </Suspense>
        )}
        {activeSection === 'budgets' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <FinanceBudgets />
          </Suspense>
        )}
        {activeSection === 'budget-report' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <BudgetReport readOnly />
          </Suspense>
        )}
        {activeSection === 'project-financials' && (
          <Suspense fallback={<LoadingSkeleton />}>
            <ProjectFinancials />
          </Suspense>
        )}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
```

Use `<LoadingSkeleton />` as a small inline component:
```tsx
function LoadingSkeleton() {
  return <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />;
}
```

### What to DELETE

Remove the entire custom `SidebarContent()`, `NavItem()`, the desktop `<aside>`, the mobile sidebar overlay, the mobile hamburger menu, and all related state (`sidebarOpen`, `setSidebarOpen`). AppShell handles all of that.

Remove the `ROLE_COLOR`, `ROLE_LABEL`, `PANEL_LABEL` constants — AppShell uses the `role` prop to derive them.

Remove the custom topbar/header — AppShell renders it.

Remove the `Building2`, `Menu`, `X`, `LogOut`, `User` icon imports if no longer used.

Keep: `LayoutDashboard`, `CheckCircle`, `FileBarChart`, `Receipt`, `DollarSign`, `Clock`, `Wallet`, `PieChart` and add: `ArrowDownToLine`, `ArrowUpFromLine`, `BarChart3`, `TrendingUp`, `TrendingDown`, `AlertTriangle`.

---

## Quality checklist

For **every** file produced, verify:

- [ ] `export function ComponentName` — named export, no default
- [ ] Zero `@apply` directives — only Tailwind utility classes
- [ ] All colors use literal design-system hex values, not CSS vars
- [ ] shadcn/ui components imported from `./ui/…` (relative)
- [ ] Mock arrays have `// TODO: GET|POST /api/v1/…` migration comments
- [ ] No `fetch`, `axios`, or `useEffect` for data — everything is hardcoded
- [ ] Formatting helpers (`fmtDate`, `fmtAmount`) defined locally
- [ ] Finance accent purple-600 (`#9333ea`) used for active states, buttons, badges
- [ ] Responsive: mobile-first, tables get `overflow-x-auto`
- [ ] Pagination follows the FinanceExpenses 10-per-page pattern
- [ ] Dialogs use shadcn/ui `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle`
- [ ] Toasts use `toast.success()` from sonner
- [ ] `FinanceDashboard.tsx` uses `AppShell` — zero custom sidebar code
- [ ] `FinanceDashboard.tsx` renders all 8 sections via `Suspense` + lazy imports
- [ ] No orphaned imports — everything referenced is used

---

## File manifest

| # | File | Action | Lines (est.) |
|---|------|--------|-------------|
| 1 | `src/app/components/AccountsReceivable.tsx` | **CREATE** | ~500-600 |
| 2 | `src/app/components/AccountsPayable.tsx` | **CREATE** | ~500-600 |
| 3 | `src/app/components/ProjectFinancials.tsx` | **CREATE** | ~450-550 |
| 4 | `src/app/pages/FinanceDashboard.tsx` | **REWRITE** | ~180-220 (down from 363) |
