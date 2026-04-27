# Prompt 16 — Worker Dashboard: conectar todos los componentes huérfanos

## Diagnóstico del problema

`WorkerDashboard.tsx` tiene **solo 60 líneas** con 2 nav items: "Time tracking" (funcional) y "Dashboard" (marcado `comingSoon: true`). Solo renderiza `WorkerTime`.

Sin embargo, **ya existen 4 componentes completos** que el trabajador necesita según requisitos y que están implementados pero **nunca se importan ni se usan**:

| Componente | Líneas | Funcionalidad | Estado |
|---|---|---|---|
| `WorkerTime.tsx` | 339 | Registro de entrada/almuerzo/salida con geofence | ✅ Conectado |
| `MyHours.tsx` | 607 | Historial personal de horas, filtros, paginación | ❌ Huérfano |
| `NewExpense.tsx` | 365 | Formulario de registro de gasto con comprobante | ❌ Huérfano |
| `MyExpenses.tsx` | 632 | Historial personal de gastos, filtros, detalle | ❌ Huérfano |
| `MyTools.tsx` | 140 | Herramientas asignadas al trabajador (solo lectura) | ❌ Huérfano |

Además, falta un **dashboard resumen** del trabajador (KPIs personales).

El `AppShell.tsx` (que usa `WorkerDashboard`) muestra **"Admin Panel"** hardcodeado en la línea 79 del sidebar brand — debería mostrar un label según el rol.

## Requisitos del Trabajador (de requisitos.md)

- Registrar: hora de entrada, almuerzo, salida → `WorkerTime` ✅
- Registrar gastos propios con comprobante → `NewExpense` ❌ no conectado
- Ver historial personal de horas → `MyHours` ❌ no conectado
- Ver historial personal de gastos → `MyExpenses` ❌ no conectado
- Ver herramientas asignadas → `MyTools` ❌ no conectado
- Solo puede ver su propia información
- No puede ver presupuestos, reportes globales ni inventario general

## Design System (mandatory)

- **Colors:** Primary `#F97316`, Deep `#C2410C`, Dark `#0A0A0A`, Light bg `#FAFAFA`, Border `#D4D4D8`, Muted `#71717A`, Worker role: emerald-600.
- **Cards:** `rounded-xl border border-[#D4D4D8] p-6` on white.
- **Badges:** `inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border` with 1.5px dot.
- **Labels:** `text-[11px] font-semibold text-[#71717A] uppercase tracking-wide`.
- **Icons:** `lucide-react` only. Nav icons: `style={{ width: 17, height: 17 }}`.
- **shadcn/ui:** `Button`, `Select`, `StatCard`, `DropdownMenu`, `Dialog`, `toast` (sonner).
- **AppShell:** The shared shell component already handles sidebar, topbar, mobile overlay. Worker Dashboard must use `AppShell` (not build its own sidebar).

---

## Task 1 — Fix AppShell.tsx: dynamic panel label

In `AppShell.tsx`, the sidebar brand section (around line 79) shows:

```tsx
<p className="text-[11px] text-[#71717A]">Admin Panel</p>
```

This is wrong for all non-Admin roles. Fix it:

### 1.1 — Add `panelLabel` prop to `AppShellProps`

Add an **optional** prop to the `AppShellProps` interface:

```ts
panelLabel?: string;  // e.g. "Worker Panel", "Supervisor Panel"
```

### 1.2 — Use the prop with a default

In the brand section, replace the hardcoded "Admin Panel" with:

```tsx
<p className="text-[11px] text-[#71717A]">{panelLabel ?? `${role} Panel`}</p>
```

This way: if `panelLabel` is passed, use it. Otherwise, derive from role (e.g., "WORKER Panel", "FINANCE Panel"). Existing usages (AdminDashboard, SupervisorDashboard, FinanceDashboard) that don't pass the prop will get the auto-derived label — this is acceptable and correct.

**No other changes to AppShell.tsx.** Do not add or remove any other props, logic, or styles.

---

## Task 2 — Rewrite `WorkerDashboard.tsx`

Completely rewrite `WorkerDashboard.tsx` to connect ALL existing worker components and add a personal dashboard.

### 2.1 — Imports

```tsx
import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import {
  Clock, Receipt, PlusCircle, Wrench, LayoutDashboard,
  CalendarCheck, AlertTriangle, CheckCircle, DollarSign,
} from 'lucide-react';
import { AppShell, AppShellNavItem } from '../components/AppShell';
import { StatCard } from '../components/StatCard';
import { AuthService } from '../services/auth';
import { Toaster } from '../components/ui/sonner';
```

### 2.2 — Lazy-loaded sections

```tsx
const WorkerTime = lazy(() =>
  import('../components/WorkerTime').then(m => ({ default: m.WorkerTime }))
);
const MyHours = lazy(() =>
  import('../components/MyHours').then(m => ({ default: m.MyHours }))
);
const NewExpense = lazy(() =>
  import('../components/NewExpense').then(m => ({ default: m.NewExpense }))
);
const MyExpenses = lazy(() =>
  import('../components/MyExpenses').then(m => ({ default: m.MyExpenses }))
);
const MyTools = lazy(() =>
  import('../components/MyTools').then(m => ({ default: m.MyTools }))
);
```

### 2.3 — Section type

```ts
type Section = 'dashboard' | 'time' | 'my-hours' | 'new-expense' | 'my-expenses' | 'my-tools';
```

### 2.4 — Navigation config

```tsx
const NAV_ITEMS: AppShellNavItem[] = [
  { key: 'dashboard',   label: 'Dashboard',      icon: LayoutDashboard },
  { key: 'time',        label: 'Time Clock',      icon: Clock,          group: 'work' },
  { key: 'my-hours',    label: 'My Hours',        icon: CalendarCheck,  group: 'work' },
  { key: 'new-expense', label: 'New Expense',     icon: PlusCircle,     group: 'expenses' },
  { key: 'my-expenses', label: 'My Expenses',     icon: Receipt,        group: 'expenses' },
  { key: 'my-tools',    label: 'My Tools',        icon: Wrench,         group: 'equipment' },
];

const NAV_GROUPS = [
  { key: 'work',      label: 'Work' },
  { key: 'expenses',  label: 'Expenses' },
  { key: 'equipment', label: 'Equipment' },
];
```

**CRITICAL:** No `comingSoon` flag on any item. ALL sections are functional.

### 2.5 — Section metadata

```tsx
const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  'dashboard':   { title: 'Dashboard',      subtitle: 'Overview of your work activity'           },
  'time':        { title: 'Time Clock',      subtitle: 'Punch in and out for your shift'          },
  'my-hours':    { title: 'My Hours',        subtitle: 'Your personal time history'               },
  'new-expense': { title: 'New Expense',     subtitle: 'Register a new expense with receipt'      },
  'my-expenses': { title: 'My Expenses',     subtitle: 'Track your submitted expenses'            },
  'my-tools':    { title: 'My Tools',        subtitle: 'Tools currently assigned to you'          },
};
```

### 2.6 — DashboardView internal function

Create a `DashboardView` function **inside** `WorkerDashboard.tsx` (NOT a separate file). This is the worker's personal overview.

```tsx
function DashboardView({ username, onNavigate }: { username: string; onNavigate: (s: string) => void }) {
```

#### KPI cards (4 cards, `grid-cols-2 lg:grid-cols-4 gap-4`)

Use `StatCard` component with mock data:

1. **Hours this week** — `Clock` icon, `bg-emerald-50`/`text-emerald-600`, value `"32.5h"`, subtitle `"Mon–Fri"`.
2. **Pending approvals** — `AlertTriangle` icon, `bg-amber-50`/`text-amber-600`, value `"2"`, subtitle `"Awaiting review"`.
3. **Expenses this month** — `DollarSign` icon, `bg-[#F97316]/10`/`text-[#F97316]`, value `"$487.50"`, subtitle `"6 submitted"`.
4. **Tools assigned** — `Wrench` icon, `bg-purple-50`/`text-purple-600`, value `"3"`, subtitle `"Currently held"`.

Add `TODO: GET /api/v1/worker/dashboard` comment above the KPIs.

#### Today's status card

A card showing today's time entries status:

```tsx
<div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
  <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
    <div className="flex items-center gap-2">
      <Clock className="w-4 h-4 text-[#71717A]" />
      <span className="text-sm font-semibold text-[#0A0A0A]">Today's Shift</span>
    </div>
    <button onClick={() => onNavigate('time')}
      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors">
      Go to Time Clock →
    </button>
  </div>
  <div className="p-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {[
        { label: 'Clock In',     time: '7:58 AM',  done: true  },
        { label: 'Lunch Start',  time: '12:01 PM', done: true  },
        { label: 'Lunch End',    time: '1:02 PM',  done: true  },
        { label: 'Clock Out',    time: '—',        done: false },
      ].map(entry => (
        <div key={entry.label} className="text-center">
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">{entry.label}</p>
          <div className={`flex items-center justify-center gap-1.5 ${entry.done ? 'text-emerald-600' : 'text-[#D4D4D8]'}`}>
            {entry.done && <CheckCircle className="w-3.5 h-3.5" />}
            <span className={`text-sm font-semibold ${entry.done ? 'text-[#0A0A0A]' : 'text-[#D4D4D8]'}`}>{entry.time}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

#### Recent expenses card

A card showing the last 3 expenses:

```tsx
<div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
  <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4D4D8]">
    <div className="flex items-center gap-2">
      <Receipt className="w-4 h-4 text-[#71717A]" />
      <span className="text-sm font-semibold text-[#0A0A0A]">Recent Expenses</span>
      <span className="text-xs text-[#71717A]">· Last 3</span>
    </div>
    <button onClick={() => onNavigate('my-expenses')}
      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors">
      View all →
    </button>
  </div>
  <div className="divide-y divide-[#D4D4D8]/50">
    {[
      { date: 'Feb 26', type: 'Fuel',      amount: '$45.00',  status: 'Pending',  statusColor: 'bg-amber-50 text-amber-700 border-amber-200'   },
      { date: 'Feb 25', type: 'Materials',  amount: '$320.00', status: 'Approved', statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { date: 'Feb 24', type: 'Per diem',   amount: '$25.00',  status: 'Approved', statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    ].map((exp, i) => (
      <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-[#FAFAFA]/50 transition-colors">
        <div>
          <p className="text-sm font-medium text-[#0A0A0A]">{exp.type}</p>
          <p className="text-[11px] text-[#71717A]">{exp.date}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#0A0A0A]">{exp.amount}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${exp.statusColor}`}>
            {exp.status}
          </span>
        </div>
      </div>
    ))}
  </div>
</div>
```

#### Quick access buttons (2 columns)

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <button onClick={() => onNavigate('time')}
    className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-emerald-400 hover:shadow-sm transition-all group">
    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center mb-3">
      <Clock className="text-emerald-600" style={{ width: 18, height: 18 }} />
    </div>
    <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-emerald-600 transition-colors">Time Clock</p>
    <p className="text-xs text-[#71717A]">Clock in, lunch, clock out</p>
  </button>
  <button onClick={() => onNavigate('new-expense')}
    className="bg-white rounded-xl border border-[#D4D4D8] p-5 text-left hover:border-emerald-400 hover:shadow-sm transition-all group">
    <div className="w-9 h-9 bg-[#F97316]/10 rounded-lg flex items-center justify-center mb-3">
      <PlusCircle className="text-[#F97316]" style={{ width: 18, height: 18 }} />
    </div>
    <p className="text-sm font-semibold text-[#0A0A0A] mb-0.5 group-hover:text-emerald-600 transition-colors">New Expense</p>
    <p className="text-xs text-[#71717A]">Submit an expense with receipt</p>
  </button>
</div>
```

Wrap the entire DashboardView content in `<div className="space-y-6 max-w-5xl">`. Start with a welcome message:

```tsx
<div>
  <h2 className="text-2xl font-bold text-[#0A0A0A]">Welcome back, {username}!</h2>
  <p className="text-sm text-[#71717A] mt-1">Here's a summary of your recent activity.</p>
</div>
```

### 2.7 — Main WorkerDashboard component

```tsx
export function WorkerDashboard() {
  const navigate = useNavigate();
  const username = AuthService.getUsername() ?? 'worker';
  const [active, setActive] = useState<Section>('dashboard');

  const handleLogout = () => { AuthService.logout(); navigate('/'); };
  const handleNavigate = (s: string) => setActive(s as Section);
  const meta = SECTION_META[active];

  const fallback = (
    <div className="animate-pulse h-64 bg-white rounded-xl border border-[#D4D4D8]" />
  );

  return (
    <>
      <AppShell
        role="WORKER"
        username={username}
        panelLabel="Worker Panel"
        navItems={NAV_ITEMS}
        navGroups={NAV_GROUPS}
        activeSection={active}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        pageTitle={meta.title}
        pageSubtitle={meta.subtitle}
      >
        {active === 'dashboard'   && <DashboardView username={username} onNavigate={handleNavigate} />}
        {active === 'time'        && <Suspense fallback={fallback}><WorkerTime username={username} /></Suspense>}
        {active === 'my-hours'    && <Suspense fallback={fallback}><MyHours /></Suspense>}
        {active === 'new-expense' && <Suspense fallback={fallback}><NewExpense onSubmitSuccess={() => setActive('my-expenses')} /></Suspense>}
        {active === 'my-expenses' && <Suspense fallback={fallback}><MyExpenses /></Suspense>}
        {active === 'my-tools'    && <Suspense fallback={fallback}><MyTools /></Suspense>}
      </AppShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
```

**Key details:**
- `NewExpense` receives `onSubmitSuccess` callback that navigates to `my-expenses` after successful submission.
- Default active section is `'dashboard'` (NOT `'time'`).
- `panelLabel="Worker Panel"` uses the new AppShell prop from Task 1.
- `navGroups` is passed to AppShell to render grouped sidebar navigation.

---

## Validation Checklist

After implementing, verify:

1. **AppShell sidebar brand** says "Worker Panel" (not "Admin Panel") when rendered from WorkerDashboard.
2. **Sidebar shows 4 groups:** Dashboard (ungrouped), Work (Time Clock, My Hours), Expenses (New Expense, My Expenses), Equipment (My Tools).
3. **Zero comingSoon items** — all 6 nav items are functional and clickable.
4. **Dashboard section** shows 4 KPI cards, Today's Shift card, Recent Expenses card, and 2 quick access buttons.
5. **Time Clock** renders `WorkerTime` correctly with username prop.
6. **My Hours** renders `MyHours` with full history table, filters, pagination.
7. **New Expense** renders `NewExpense` with form, receipt upload, and navigates to My Expenses on success.
8. **My Expenses** renders `MyExpenses` with expense list, status badges, filters.
9. **My Tools** renders `MyTools` with assigned tool cards and KPIs.
10. All existing component exports match: `WorkerTime` (named, takes `{ username }`), `MyHours` (named, no props), `NewExpense` (named, takes `{ onSubmitSuccess? }`), `MyExpenses` (named, no props), `MyTools` (named, no props).
11. No TypeScript errors. All imports resolve.
12. Mobile responsive: sidebar collapses, topbar hamburger works (handled by AppShell).
