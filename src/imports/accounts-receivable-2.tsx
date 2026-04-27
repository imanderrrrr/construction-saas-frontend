 with `// TODO: GET|POST /api/v1/…` comments — NO fetch calls. New records created via forms are added to local state only. |
| **Exports** | Named exports only (`export function Xyz`) |

### Design-system tokens

| Token | Value | Usage |
|-------|-------|-------|
| Dark | `#0A0A0A` | Headings, body text |
| Light bg | `#FAFAFA` | Page background, subtle fills |
| Border | `#D4D4D8` | Cards, dividers, table borders |
| Muted | `#71717A` | Captions, secondary text |
| Destructive | `#d4183d` | Errors, overdue |
| **Finance accent** | `#9333ea` / `purple-600` | Active states, primary buttons, role color |

---

## Task 1 — Edit `AccountsReceivable.tsx`

**File:** `src/app/components/AccountsReceivable.tsx`

The stub already has imports for `Receipt`, `DollarSign`, `Clock`, `AlertTriangle`, `ChevronDown`, `ChevronRight`, `FilterIcon`, `MoreHorizontal`, `toast`, `Button`, `StatCard`, `Table*`, `Select*`, `Dialog*`, plus `PaymentRecord` and `Invoice` interfaces and an empty `INVOICES` array.

**Replace the entire component body** and expand imports/types as needed (add `Input`, `Label`, `Textarea`, `Plus` icon, etc.).

---

### 1A — Top bar with "New Invoice" button

At the top of the component, render a header row:
- Left: Section title is handled by AppShell, so no h2 needed
- Right: **"+ New Invoice"** button (purple-600 bg, white text, `Plus` icon) that opens the **Create Invoice Dialog**

---

### 1B — Create Invoice Dialog

**Trigger:** The "+ New Invoice" button.  
**Dialog title:** "Create New Invoice"

**Form fields (all required unless marked optional):**

| Field | Type | Details |
|-------|------|---------|
| Invoice # | Text input | Auto-generate next number (e.g. "INV-2026-011"), editable |
| Client | Select | Options: "Metro Development Corp", "Greenfield Holdings", "Pacific Coast Builders", "Riverside Properties", + "Other" which shows a text input |
| Project | Select | Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion |
| Description | Textarea | e.g. "Foundation work — Phase 1", 2 rows |
| Amount | Number input | Required, > 0 |
| Issue Date | Date input | Default: today (2026-02-28) |
| Due Date | Date input | Required, must be ≥ issue date |
| Notes | Textarea (optional) | 2 rows |

**Buttons:** Cancel (ghost) | **Create Invoice** (purple-600 bg, white text)

**On submit:**
- Validate: all required fields filled, amount > 0, dueDate ≥ issuedDate
- Create new `Invoice` with `status: 'pending'`, `paidAmount: 0`, `payments: []`
- Add to local state (prepend to list)
- `toast.success("Invoice INV-2026-XXX created successfully")`
- Close dialog, reset form

```ts
// TODO: POST /api/v1/finance/receivables
```

---

### 1C — KPI cards row

4 `StatCard`s — values **computed from local state** (not hardcoded, so they update when invoices are created):

| Icon | Title | Computed value | Subtitle | iconBgColor | iconColor |
|------|-------|---------------|----------|-------------|-----------|
| `Receipt` | Total receivable | sum of all non-paid invoice amounts | All active invoices | bg-purple-50 | text-purple-600 |
| `DollarSign` | Collected this month | sum of paidAmount for current month | Feb 2026 | bg-emerald-50 | text-emerald-600 |
| `Clock` | Pending | sum of balance for pending invoices | {count} invoices | bg-amber-50 | text-amber-600 |
| `AlertTriangle` | Overdue | sum of balance for overdue invoices | {count} invoices · Action required | bg-red-50 | text-red-600 |

---

### 1D — Filter bar

Same pattern as `FinanceExpenses.tsx`:
- **Project** (Select: All Projects, Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion)
- **Status** (Select: All Statuses, Paid, Pending, Overdue)
- **Date range**: From / To date inputs
- "Clear filters" button (visible when any filter active)

---

### 1E — Mock data

**Fill the `INVOICES` array** with 10 realistic invoices as initial state (use `useState` initialized with this array):

- Clients: "Metro Development Corp", "Greenfield Holdings", "Pacific Coast Builders", "Riverside Properties"
- Projects: Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion
- Invoice numbers: INV-2026-001 through INV-2026-010
- **3 paid** (paidAmount === amount, status: 'paid')
- **4 pending** (dueDate in Mar–Apr 2026, paidAmount: 0, status: 'pending')
- **3 overdue** (dueDate before 2026-02-28, paidAmount < amount, status: 'overdue')
- At least 1 invoice with 2 `PaymentRecord` entries (partial payments)
- Amounts: range from $5,000 to $65,000 (construction-scale)

---

### 1F — Invoice table

**Table card** (white bg, rounded-xl, border):

| Column | Detail |
|--------|--------|
| ▸ | Chevron to expand row |
| Invoice # | `invoiceNumber` — `font-mono text-sm` |
| Client | Client name |
| Project | `text-[#71717A]` |
| Issue Date | Formatted (e.g. "Feb 26, 2026") |
| Due Date | Formatted. **Red text** if overdue |
| Amount | `font-mono font-semibold` |
| Paid | `font-mono`, **emerald** when amount fully paid |
| Balance | `amount - paidAmount`. Amber if pending, **red if overdue** |
| Status | Badge: paid → `bg-emerald-50 text-emerald-700`, pending → `bg-amber-50 text-amber-700`, overdue → `bg-red-50 text-red-700` |
| Actions | "Register Payment" button (small, outline purple) — disabled if paid |

**Expandable row** (toggle with chevron click):
- Payment history sub-table: Date, Amount, Method, Reference
- If no payments: "No payments recorded yet" muted text

---

### 1G — Register Payment Dialog

**Trigger:** The "Register Payment" button on each row.  
**Dialog title:** "Register Payment — INV-2026-XXX"

**Fields:**
| Field | Type | Details |
|-------|------|---------|
| Amount | Number input | Pre-filled with remaining balance, max = balance |
| Payment Date | Date input | Default: today |
| Method | Select | Bank transfer, Check, Cash, Other |
| Reference | Text input (optional) | Check # or transfer ref |

**Buttons:** Cancel (ghost) | **Register Payment** (purple-600)

**On submit:**
- Validate: amount > 0, amount ≤ balance, date required
- Add `PaymentRecord` to invoice's `payments` array in local state
- Update `paidAmount += amount`
- If `paidAmount >= amount` → set `status: 'paid'`
- `toast.success("Payment of $X,XXX.XX registered for INV-2026-XXX")`
- Close dialog

```ts
// TODO: POST /api/v1/finance/receivables/{id}/payments
```

---

### 1H — Overdue alerts section

Render **only if overdue invoices exist**, below the table:

- Amber/red card with `AlertTriangle` icon:  
  "⚠ {count} invoices are overdue totaling ${total}"
- List each overdue invoice: Invoice #, Client, days overdue (computed from today vs dueDate), balance due

---

### 1I — Pagination & footer

- 10 items per page, Previous/Next buttons
- **Summary footer** inside table card:
  - Left: "Showing X of Y invoices"
  - Right: "Total Outstanding: $XX,XXX.XX" in `font-mono font-semibold`

---

## Task 2 — Edit `AccountsPayable.tsx`

**File:** `src/app/components/AccountsPayable.tsx`

The stub already has: `Wallet`, `DollarSign`, `Clock`, `AlertTriangle`, `ChevronDown`, `ChevronRight`, `FilterIcon`, `MoreHorizontal`, `toast`, `Button`, `StatCard`, `Table*`, `Select*`, `Dialog*`, plus `VendorPayment` and `VendorBill` interfaces and an empty `VENDOR_BILLS` array.

**Replace the entire component body** and expand imports/types as needed.

---

### 2A — Top bar with "New Bill" button

- Right-aligned: **"+ New Bill"** button (purple-600 bg, white text, `Plus` icon) → opens Create Bill Dialog

---

### 2B — Create Bill Dialog

**Dialog title:** "Register New Bill"

**Form fields:**

| Field | Type | Details |
|-------|------|---------|
| Bill # | Text input | Auto-generate "BILL-2026-XXX", editable |
| Vendor | Select | "Acme Steel Supply", "QuickMix Concrete", "Torres Equipment Rental", "Rivera Electrical Services", "López Plumbing", "Hernández Lumber", + "Other" (shows text input) |
| Category | Select | Materials, Equipment Rental, Subcontractor, Services, Other |
| Project | Select | Downtown Plaza, Highway Bridge, Office Renovation, Harbor Expansion |
| Description | Textarea | 2 rows |
| Amount | Number input | Required, > 0 |
| Received Date | Date input | Default: today |
| Due Date | Date input | Required, ≥ received date |
| Notes | Textarea (optional) | 2 rows |

**Buttons:** Cancel (ghost) | **Register Bill** (purple-600)

**On submit:**
- Validate all required fields, amount > 0, dueDate ≥ receivedDate
- Create `VendorBill` with `status: 'pending'`, `paidAmount: 0`, `payments: []`
- Prepend to local state
- `toast.success("Bill BILL-2026-XXX registered successfully")`
- Close dialog, reset form

```ts
// TODO: POST /api/v1/finance/payables
```

---

### 2C — KPI cards row

4 `StatCard`s — **computed from local state**:

| Icon | Title | Computed | Subtitle | iconBgColor | iconColor |
|------|-------|---------|----------|-------------|-----------|
| `Wallet` | Total payable | sum of non-paid bill amounts | All vendor invoices | bg-purple-50 | text-purple-600 |
| `DollarSign` | Paid this month | sum of payments in current month | Feb 2026 | bg-emerald-50 | text-emerald-600 |
| `Clock` | Pending payment | sum of balance for pending | {count} invoices | bg-amber-50 | text-amber-600 |
| `AlertTriangle` | Overdue | sum of balance for overdue | {count} invoices | bg-red-50 | text-red-600 |

---

### 2D — Filter bar

- **Vendor** (Select: All Vendors + unique vendors from data)
- **Status** (Select: All, Paid, Pending, Overdue)
- **Category** (Select: All, Materials, Equipment Rental, Subcontractor, Services, Other)
- "Clear filters" button

---

### 2E — Mock data

**Fill `VENDOR_BILLS` array** with 10 bills as initial state:

- Vendors: "Acme Steel Supply", "QuickMix Concrete", "Torres Equipment Rental", "Rivera Electrical Services", "López Plumbing", "Hernández Lumber"
- Bill numbers: BILL-2026-001 through BILL-2026-010
- Categories: materials (4), equipment-rental (2), subcontractor (2), services (2)
- **3 paid**, **4 pending** (due Mar–Apr 2026), **3 overdue** (due before Feb 28 2026)
- At least 1 with 2 payment records
- Amounts: $2,500 to $35,000 range

---

### 2F — Bills table

| Column | Detail |
|--------|--------|
| ▸ | Expand chevron |
| Bill # | `billNumber` — `font-mono` |
| Vendor | Vendor name |
| Category | Badge — neutral gray `bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8]` |
| Project | `text-[#71717A]` |
| Received | Formatted date |
| Due Date | **Red text** if overdue |
| Amount | `font-mono font-semibold` |
| Paid | `font-mono`, emerald if fully paid |
| Balance | Remaining, amber/red |
| Status | Badge (same colors as AR) |
| Actions | "Record Payment" button — disabled if paid |

**Expandable row:**
- Payment history: Date, Amount, Method, Reference, Approved By
- If empty: "No payments recorded yet"

---

### 2G — Record Payment Dialog

**Dialog title:** "Record Payment — BILL-2026-XXX"

**Fields:**
| Field | Type | Details |
|-------|------|---------|
| Amount | Number input | Pre-filled with balance, max = balance |
| Payment Date | Date input | Default: today |
| Method | Select | Bank transfer, Check, Cash, Wire transfer, Other |
| Reference | Text input (optional) | Transfer/check ref |
| Notes | Textarea (optional) | 2 rows |

**On submit:**
- Validate: amount > 0, ≤ balance, date required
- Add `VendorPayment` to bill (with `approvedBy: 'finance'`)
- Update `paidAmount`, if fully paid → `status: 'paid'`
- `toast.success("Payment of $X,XXX.XX recorded for BILL-2026-XXX")`

```ts
// TODO: POST /api/v1/finance/payables/{id}/payments
```

---

### 2H — Vendor summary section

Collapsible card below filters, toggle via "Show Vendor Summary" / "Hide Vendor Summary" button:
- One row per vendor: name, total bills, total amount, paid, outstanding
- Small horizontal bar: emerald fill = paid %, gray = remaining

---

### 2I — Overdue alerts, pagination & footer

Same pattern as Task 1:
- Overdue alert card if any overdue bills
- 10 per page pagination
- Footer: "Showing X of Y" + "Total Outstanding: $XX,XXX"

---

## Quality checklist

- [ ] Named exports: `export function AccountsReceivable()`, `export function AccountsPayable()`
- [ ] Both components have a **"+ New"** button that opens a **Create dialog**
- [ ] Both components have **"Register/Record Payment"** dialogs per row
- [ ] KPIs are **computed from state** (update when items are created/payments added)
- [ ] Zero `@apply` — only Tailwind utility classes
- [ ] Literal hex colors from design system, no CSS vars
- [ ] shadcn/ui imports from `./ui/…` (add Input, Label, Textarea as needed)
- [ ] Mock arrays have `// TODO: GET/POST /api/v1/…` comments
- [ ] No fetch/axios/useEffect for data
- [ ] `fmtDate` / `fmtAmount` helpers defined locally
- [ ] Purple-600 accent for primary buttons
- [ ] Tables wrapped in `overflow-x-auto`
- [ ] Pagination: 10 per page
- [ ] Dialogs via shadcn/ui Dialog
- [ ] Toasts via `toast.success()` from sonner
- [ ] Form validation before submit (show errors or disable button)

## File manifest

| # | File | Action |
|---|------|--------|
| 1 | `src/app/components/AccountsReceivable.tsx` | **EDIT** — stub → full with Create Invoice + Register Payment (~600-700 lines) |
| 2 | `src/app/components/AccountsPayable.tsx` | **EDIT** — stub → full with Create Bill + Record Payment (~600-700 lines) |
