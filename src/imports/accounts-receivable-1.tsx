# Prompt 17b — Edit Accounts Receivable & Accounts Payable stubs

> These two files already exist as stubs with types, imports and an empty component body.  
> **Edit each file** replacing the placeholder body with a full implementation.

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

### Design-system tokens

| Token | Value | Usage |
|-------|-------|-------|
| Dark | `#0A0A0A` | Headings, body text |
| Light bg | `#FAFAFA` | Page background, subtle fills |
| Border | `#D4D4D8` | Cards, dividers, table borders |
| Muted | `#71717A` | Captions, secondary text |
| Destructive | `#d4183d` | Errors, overdue |
| **Finance accent** | `#9333ea` / `purple-600` | Active states, buttons, role color |

---

## Task 1 — Edit `AccountsReceivable.tsx`

**File:** `src/app/components/AccountsReceivable.tsx`

The stub already has these imports and types: `Receipt`, `DollarSign`, `Clock`, `AlertTriangle`, `ChevronDown`, `ChevronRight`, `FilterIcon`, `MoreHorizontal`, `toast`, `Button`, `StatCard`, `Table*`, `Select*`, `Dialog*`, plus `PaymentRecord` and `Invoice` interfaces and an empty `INVOICES` array.

**Replace the entire component body** and expand imports/types as needed.

### What to build

**KPI cards row** (4 `StatCard`s):
| Icon | Title | Mock value | Subtitle | iconBgColor | iconColor |
|------|-------|------------|----------|-------------|-----------|
| `Receipt` | Total receivable | $185,400.00 | All active invoices | bg-purple-50 | text-purple-600 |
| `DollarSign` | Collected this month | $42,300.00 | Feb 2026 | bg-emerald-50 | text-emerald-600 |
| `Clock` | Pending | $98,700.00 | 12 invoices | bg-amber-50 | text-amber-600 |
| `AlertTriangle` | Overdue | $44,400.00 | 5 invoices · Action required | bg-red-50 | text-red-600 |

**Filter bar** (same pattern as `FinanceExpenses.tsx`):
- Project (Select: All Projects, Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion)
- Status (Select: All Statuses, Paid, Pending, Overdue)
- Date range: From / To date inputs
- "Clear filters" button when any active

**Fill the `INVOICES` array** with 10 realistic invoices:
- Clients: "Metro Development Corp", "Greenfield Holdings", "Pacific Coast Builders", "Riverside Properties"
- 3 paid (paidAmount === amount)
- 4 pending (dueDate in Mar-Apr 2026)
- 3 overdue (dueDate before Feb 28 2026, paidAmount < amount)
- At least 1 invoice with 2 `PaymentRecord` entries (partial payments)

**Table columns:**
| Column | Detail |
|--------|--------|
| ▸ | Expand chevron |
| Invoice # | `invoiceNumber` ("INV-2026-001" etc) — `font-mono` |
| Client | Client name |
| Project | Muted text |
| Issue Date | Formatted |
| Due Date | Red text if overdue |
| Amount | `font-mono font-semibold` |
| Paid | `font-mono`, emerald when fully paid |
| Balance | `amount - paidAmount`, amber/red if overdue |
| Status | Badge: paid → emerald, pending → amber, overdue → red |
| Actions | Button or kebab |

**Expandable row** (toggle with chevron):
- Payment history sub-table: Date, Amount, Method, Reference
- "Register Payment" button (purple-600) opens Dialog

**Register Payment Dialog:**
- Title: "Register Payment — INV-XXXX"
- Fields: Amount (pre-filled with balance, max = balance), Date (default today), Method (Select: Bank transfer, Check, Cash, Other), Reference (optional text)
- Buttons: Cancel (ghost) | Register Payment (bg purple-600 text-white)
- On submit: `toast.success(...)`, update local state, auto-close dialog
- Validation: amount > 0 && amount ≤ balance && date required

**Overdue alert** (render only if overdue invoices exist):
- Amber/red banner below table: "⚠ {count} invoices are overdue totaling $XX,XXX"
- List each: Invoice #, Client, days overdue, amount due

**Pagination:** 10 per page, Previous/Next buttons.

**Summary footer:**
- Left: "Showing X of Y invoices"
- Right: "Total Outstanding: $XX,XXX.XX" `font-mono font-semibold`

**Helpers** (define locally):
```ts
function fmtDate(iso: string) { ... }
function fmtAmount(n: number) { ... }
```

---

## Task 2 — Edit `AccountsPayable.tsx`

**File:** `src/app/components/AccountsPayable.tsx`

The stub already has: `Wallet`, `DollarSign`, `Clock`, `AlertTriangle`, `ChevronDown`, `ChevronRight`, `FilterIcon`, `MoreHorizontal`, `toast`, `Button`, `StatCard`, `Table*`, `Select*`, `Dialog*`, plus `VendorPayment` and `VendorBill` interfaces and an empty `VENDOR_BILLS` array.

**Replace the entire component body** and expand imports/types as needed.

### What to build

**KPI cards row** (4 `StatCard`s):
| Icon | Title | Mock value | Subtitle | iconBgColor | iconColor |
|------|-------|------------|----------|-------------|-----------|
| `Wallet` | Total payable | $127,800.00 | All vendor invoices | bg-purple-50 | text-purple-600 |
| `DollarSign` | Paid this month | $38,500.00 | Feb 2026 | bg-emerald-50 | text-emerald-600 |
| `Clock` | Pending payment | $67,300.00 | 15 invoices | bg-amber-50 | text-amber-600 |
| `AlertTriangle` | Overdue | $22,000.00 | 3 invoices | bg-red-50 | text-red-600 |

**Filter bar:**
- Vendor (Select: All Vendors + unique vendors from mock data)
- Status (Select: All, Paid, Pending, Overdue)
- Category (Select: All, Materials, Equipment Rental, Subcontractor, Services, Other)
- "Clear filters" button

**Fill the `VENDOR_BILLS` array** with 10 realistic bills:
- Vendors: "Acme Steel Supply", "QuickMix Concrete", "Torres Equipment Rental", "Rivera Electrical Services", "López Plumbing", "Hernández Lumber"
- Categories: materials (4), equipment-rental (2), subcontractor (2), services (2)
- 3 paid, 4 pending (due Mar-Apr 2026), 3 overdue (due before Feb 28 2026)
- At least 1 bill with 2 payment records

**Table columns:**
| Column | Detail |
|--------|--------|
| ▸ | Expand chevron |
| Bill # | `billNumber` ("BILL-2026-001" etc) — `font-mono` |
| Vendor | Vendor name |
| Category | Badge with label — neutral gray bg |
| Project | Muted text |
| Received | Formatted date |
| Due Date | Red text if overdue |
| Amount | `font-mono font-semibold` |
| Paid | `font-mono`, emerald if fully paid |
| Balance | Remaining |
| Status | Badge (same color scheme as AR) |
| Actions | Button or kebab |

**Expandable row:**
- Payment history: Date, Amount, Method, Reference, Approved By
- "Record Payment" button (purple-600)

**Record Payment Dialog:**
- Title: "Record Payment — BILL-XXXX"
- Fields: Amount (max = balance), Date, Method (Bank transfer, Check, Cash, Wire transfer, Other), Reference, Notes (optional textarea)
- Buttons: Cancel (ghost) | Record Payment (purple-600)
- `toast.success(...)` on submit

**Vendor summary section** (collapsible, below filters / above table):
- Toggle button: "Show/Hide Vendor Summary"
- One card per vendor: name, total bills count, total amount, paid, outstanding
- Small horizontal bar: emerald fill = paid %, gray = remaining

**Pagination & summary footer**: same as Task 1.

---

## Quality checklist

- [ ] Named exports: `export function AccountsReceivable()`, `export function AccountsPayable()`
- [ ] Zero `@apply` — only Tailwind utility classes
- [ ] Literal hex colors from design system, no CSS vars
- [ ] shadcn/ui imports from `./ui/…`
- [ ] Mock arrays have `// TODO: GET /api/v1/…` comments
- [ ] No fetch/axios/useEffect for data
- [ ] `fmtDate` / `fmtAmount` defined locally in each file
- [ ] Purple-600 accent for active states, buttons, register payment
- [ ] Tables wrapped in `overflow-x-auto`
- [ ] Pagination: 10 per page
- [ ] Dialogs via shadcn/ui Dialog components
- [ ] Toasts via `toast.success()` from sonner

## File manifest

| # | File | Action |
|---|------|--------|
| 1 | `src/app/components/AccountsReceivable.tsx` | **EDIT** (stub → full, ~500-600 lines) |
| 2 | `src/app/components/AccountsPayable.tsx` | **EDIT** (stub → full, ~500-600 lines) |
