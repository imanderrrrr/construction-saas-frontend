# Rescate de finanzas del PR #186 en el panel — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Anderson pidió que lo implemente el mismo chat (2026-10-12): superpowers:executing-plans, con TDD.

**Goal:** Llevar a `develop` del panel lo que el PR #186 traía y `develop` no tiene, en cinco PRs contra `develop`. Van emparejados con los cuatro PRs del servidor (plan `2026-10-12-rescate-finanzas-backend.md` del backend).

**Architecture:** #186 no se rebasea, porque su base es del 10-03 y choca en 43 archivos. `develop` ya trae, por la rama de Codex (6e2d1d3), el rediseño (e86575e) y la auditoría (#189), casi todo lo de Finanzas: inicio, clientes en consulta, mano de obra en modo Finanzas, pagos parciales y cuentas vinculadas. Cada pieza que falta se reescribe sobre el código de `develop`, con la prueba primero.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + Testing Library, i18next (`es` de tú, `en`).

**Spec:**
- Los commits de #186 (`origin/feat/finanzas-integracion` del panel), que se leen con `git show <sha>`:
  - 7a1c7aa: Cobros, una sola pantalla.
  - 2dbbb0d: nómina en modo Finanzas.
  - 2df85dd: tutoriales.
  - adb68ec: aprobaciones y marcas.
  - b83cf50: pagos de subcontratistas.
- Las decisiones de Anderson del 2026-10-12:
  - Facturas y Cobrar en una sola pantalla.
  - FINANCE confirma pagos de nómina y exporta «Pagos a Excel».
  - Se rescatan #172 y #186.

**Rutas abreviadas:** `A/` = `src/app/`, `L/` = `src/i18n/locales/`.

## Global Constraints

- **Ramas y PR**
  - Cada rama sale de `origin/develop` y se deja sin upstream.
  - El PR va contra `develop` y se empuja con refspec explícito.
  - No se toca `main` ni producción. No se usa Ruflo.
- **Commits:** en español, autor Anderson, con la última línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Antes de cada PR** se corren los tres pasos del CI, en este orden y desde la raíz del worktree: `npm run typecheck`, `npm run lint` (0 errores; los warnings ya existen) y `npm test`.
- **Textos:** en `es` (de tú) y en `en`, juntos en el mismo commit. Las guardas `screens.i18n` y la del tuteo tienen que seguir verdes.
- **Paleta del panel:** `#0A0A0A`, `#F5F1E8`, `#F97316`/`#C2410C`, bordes `#E7E1D5`, errores `#B3402A`. Nada de morado ni esquinas redondeadas nuevas.
- **Servidor más viejo:** si el servidor todavía no trae un campo nuevo, la pantalla funciona igual que hoy. Las cifras se calculan con las filas.

## Review Focus

1. **Un favorito viejo «Facturas» o un enlace a `/finance/invoices`.** Tiene que abrir Cobros con la ventana de emitir, no una sección vacía → prueba de P2.2.
2. **Cobros con un servidor sin `collectedThisMonth`, `pending` ni `pendingCount`.** Las cifras salen de las filas, sin `NaN` ni `$0` falso → prueba de P2.1.
3. **FINANCE sin tarifa para un trabajador.** Puede confirmar a los que tienen tarifa y ve «Tarifa pendiente de Administración» en los otros → prueba de P1.1.
4. **Aprobar una factura que ya está tecleada en Pagar (409).** El mensaje dice qué cuenta revisar, no «error del servidor» → prueba de P5.1.
5. **La jornada no carga en el cajón de aprobaciones.** Se ve «Reintentar», no un giro infinito → prueba de P4.1.

---

## PR P1 — `feat/nomina-finanzas-panel` (va con B2)

### Task P1.1: en modo Finanzas, Nómina ofrece «Confirmar pago» y «Pagos a Excel»

**Files:** Modify `A/components/labor/LaborPayrollScreen.tsx` (~137, ~228, ~236). Test `A/components/labor/FinanceLaborScreens.test.tsx`.

- [ ] **Step 1:** pruebas.
  - Se reescribe `uses unpaid hours for payroll without offering admin payment actions` como `finance confirms payroll and exports payments`:
    - con `mode="finance"`, existen `admin:pay.confirm` y `admin:pay.exportPayments`;
    - pulsar «Confirmar pago» abre la ventana y llama a `previewPayment`.
  - Nueva `finance cannot manage rates`: en Finanzas, un trabajador sin tarifa muestra `finance:labor.rateAdmin` y no el enlace de configurar tarifa.
- [ ] **Step 2:** `npx vitest run src/app/components/labor/FinanceLaborScreens.test.tsx` → FALLA.
- [ ] **Step 3:** `canPay` y el botón de exportar pasan a verse en los dos modos. `canManageRates` sigue siendo `mode === 'admin'`.
- [ ] **Step 4:** se corre → PASA.
- [ ] **Step 5:** commit `feat(nomina): en Finanzas se confirman pagos y se exportan «Pagos a Excel»`.

## PR P2 — `feat/cobros-una-pantalla` (va con B3)

### Task P2.1: Cobros emite: «Emitir documento», la nota de la firma, el PDF firmado y las cifras del servidor

**Files:**
- Modify `A/components/accounts/ReceivablesScreen.tsx`, `A/components/accounts/accounting.ts` y `A/services/finance.ts` (el tipo `ReceivableSummary`).
- Create `A/components/accounts/ReceivablesScreen.issue.test.tsx`, que es el porte del de 7a1c7aa.
- Modify `L/{es,en}/finance.json`.

**Interfaces:**
- `ReceivableSummary` gana `collectedThisMonthCount?: number`. Además `collectedThisMonth`, `pending` y `pendingCount` pasan a ser opcionales, porque un servidor viejo no los trae.
- `receivableFiguresFromSummary(summary: ReceivableSummary, fromRows: ReceivableFigures): ReceivableFigures` en `accounting.ts`: toma del servidor cada cifra que venga y de las filas la que falte.

- [ ] **Step 1:** pruebas, en el archivo nuevo.
  - `issues from the header and opens the new document`: «Emitir documento» (`data-testid="issue-document"`) monta `InvoiceWindow` (simulado). Su `onCreated` cierra la ventana, abre el documento en «Por documento» y muestra `invoice-created-notice`.
  - `«Ver cómo» sends the tour to the signature stop`: llama a `requestTourStop('accounts-receivable', 'signature')`.
  - `a change order waiting for approval is not opened among the rows`.
  - `the menu downloads the signed PDF`: llama a `downloadInvoicePdf` con los datos del documento y la firma.
  - `figures come from the server summary and fall back to the rows`:
    - con resumen, «cobrado este mes» = `collectedThisMonth`;
    - sin `collectedThisMonth`, la cifra es la de las filas;
    - si `getReceivableSummary` falla, todo sale de las filas.
  - `filters by document type`.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa sobre el `ReceivablesScreen` de `develop`, conservando lo que trae: `useScreenState`, `projectCatalog`, `CatalogNote` y el arreglo de AUD-055.
  - `InvoiceWindow` se carga con `lazy`, y `exportInvoicePdf` con `import()` al pulsar.
  - `issuing` y `justCreated` siguen la forma de 7a1c7aa.
  - El ancla del tutorial es `data-tour="sec.accounts-receivable.new"`.
- [ ] **Step 4:** se corren el archivo y `src/app/components/accounts/` → PASA.
- [ ] **Step 5:** commit `feat(cobros): emitir y cobrar en la misma pantalla`.

### Task P2.2: se retira la sección Facturas, y sus caminos llevan a Cobros con la ventana abierta

**Files:**
- Modify `A/pages/AdminDashboard.tsx` y `A/pages/FinanceDashboard.tsx` (sección `invoices` y su menú).
- Modify `A/lib/sectionIntent.ts`: `'accounts-receivable': { openReceivableId?: number; openIssue?: boolean }`.
- Modify `A/routes.tsx`, para que `/finance/invoices` y `/admin/invoices` lleven a Cobros con `openIssue`.
- Modify `A/components/onboarding/sectionTourSteps.ts`: la parada «Emite desde aquí».
- Delete `A/components/InvoiceManager.tsx` y sus tres pruebas. Lo que todavía valga de esas pruebas, como la nota de la firma, ya lo cubre P2.1.
- Modify `L/{es,en}/{admin,finance}.json`.
- Tests: `A/pages/FinanceDashboard.test.tsx` y `A/routes.test.tsx`.

- [ ] **Step 1:** pruebas.
  - `the Facturas section is gone from both panels`: no hay entrada `invoices` en los menús.
  - `an old «Facturas» favorite opens Cobros with the issue window`.
  - `/finance/invoices opens Cobros with the issue window`.
  - `the Cobros tour has the issue stop`.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa.
  - Los favoritos con clave `invoices` ya migran a `accounts-receivable` (`AdminDashboard.tsx:206`). Ahora además escriben `setSectionIntent('accounts-receivable', { openIssue: true })`.
  - «Plantilla de factura» (`invoice-branding`) sigue en su lugar; la ventana la abre con `onOpenBranding`, solo para el admin.
- [ ] **Step 4:** se corren `npm run typecheck` y `npm test` → PASA. `screens.i18n` no deja claves huérfanas.
- [ ] **Step 5:** commit `feat(cobros): Facturas deja de ser una sección y sus enlaces llevan a Cobros`.

## PR P3 — `feat/finanzas-tutoriales`

### Task P3.1: cada pantalla del panel de Finanzas tiene su tutorial

**Files:** se porta 2df85dd sobre `develop`.
- `A/components/clients/ClientsSection.tsx` y `ClientFicha.tsx`.
- `A/components/labor/LaborCostScreen.tsx` y `LaborPayrollScreen.tsx`.
- `A/components/approvals/ApprovalsInbox.tsx`.
- `A/components/onboarding/sectionTourSteps.ts` y `SectionIntro.tsx`.
- `L/{es,en}/admin.json`.
- Las pruebas que trae 2df85dd, adaptadas.

**Interfaces:** las claves de tutorial nuevas, que solo se reclaman en modo Finanzas con `useTourScopeWhileMounted`:
- `clients-finanzas`;
- `clients-ficha-finanzas`;
- `labor-cost-finanzas`;
- `labor-payroll-finanzas`, que incluye la parada de exportar;
- `supervisor-hours-finanzas`.

- [ ] **Step 1:** pruebas, una por pantalla: `<pantalla> claims <clave> in finance mode with all its anchors, also while loading` y `the admin panel claims nothing new`.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa.
  - Las anclas literales van en bloques que existen también al cargar, vacíos o con error.
  - Los textos son los de 2df85dd, revisados contra lo que hace hoy cada pantalla. Ejemplo: en nómina, FINANCE confirma pagos (P1).
- [ ] **Step 4:** se corren `npm test` y las guardas del registro de tutoriales y del tuteo → PASA.
- [ ] **Step 5:** commit `feat(finanzas): tutoriales propios para las pantallas de Finanzas`.

## PR P4 — `fix/aprobaciones-pulido`

### Task P4.1: el cajón de aprobaciones no gira para siempre y se queda abierto al agregar marcas

**Files:** Modify `A/components/approvals/RecordDrawer.tsx`. Test `A/components/approvals/RecordDrawer.addMarks.test.tsx`, que es el porte del de adb68ec.

- [ ] **Step 1:** pruebas.
  - `a workday that fails to load says so with «Reintentar»`: reintentar vuelve a pedirla.
  - `adding missing marks keeps the drawer open and refreshes the list`: después de agregar marcas se llama otra vez a la carga y a `onUpdated`.
  - `Escape closes the marks window, not the drawer`.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa el estado de error con reintento, `onUpdated` y la tecla Escape de la ventana, tal como en adb68ec, sobre el `RecordDrawer` de `develop`.
- [ ] **Step 4:** se corre → PASA.
- [ ] **Step 5:** commit `fix(aprobaciones): el cajón dice si la jornada no carga y no se cierra al agregar marcas`.

### Task P4.2: «Crear jornada» reintenta dentro de la ventana si no carga la lista de personas

**Files:** Modify `A/components/phase2/ModalCreateDay.tsx`. Test `A/components/phase2/ModalCreateDay.test.tsx`, que es el porte del de adb68ec.

- [ ] **Step 1:** prueba `when the people list fails the window says so and retries`: aparece el mensaje con «Reintentar» dentro de la ventana, no un toast que se va.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa.
- [ ] **Step 4:** se corre → PASA.
- [ ] **Step 5:** commit `fix(aprobaciones): crear jornada reintenta la lista de personas en la ventana`.

## PR P5 — `feat/subcontratistas-pagos-panel` (va con B1 y B4)

### Task P5.1: los rechazos nuevos se explican en la ventana

**Files:**
- Modify `A/components/subcontractors/ReviewInvoiceModal.tsx` (~79) y `RegisterPaymentModal.tsx`.
- Modify `L/{es,en}/subcontractors.json`.
- Test `A/components/subcontractors/windows.test.tsx`.

- [ ] **Step 1:** pruebas.
  - `approving an invoice already typed in payables explains which bill to check`: un 409 `SUBCONTRACTOR_INVOICE_IN_PAYABLES` muestra el texto propio con proveedor y número, no `rev.error.server`.
  - `an approval due date before receipt is explained`: 400 `INVALID_DATES`.
  - `paying an invoice whose payments come from QuickBooks says so`: 409 `QUICKBOOKS_PAYMENTS_IN_QBO`.
  - `a payment request conflict asks to reload`: 409 `PAYMENT_REQUEST_CONFLICT`.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se mapea `error.code` a claves propias, siguiendo cómo el panel lee los errores de la API (ver `A/services/api*`). Para cualquier otro código, el mensaje del servidor; si no hay, el genérico.
- [ ] **Step 4:** se corre → PASA.
- [ ] **Step 5:** commit `feat(subcontratistas): los rechazos de aprobar y pagar se explican`.

### Task P5.2: la factura de antes del vínculo avisa, y la cuenta vinculada deja editar descripción y notas

**Files:**
- Modify `RegisterPaymentModal.tsx` (aviso con `legacyUnlinked`) y `A/services/subcontractors.ts` (el tipo).
- Modify `A/components/accounts/PayableDetailPanel.tsx` (~235) y `PayableDialogs.tsx` (la ventana de editar info con proveedor, categoría y número bloqueados).
- Tests `windows.test.tsx` y `A/components/accounts/PayableDialogs.*.test.tsx`.

- [ ] **Step 1:** pruebas.
  - `paying a legacy invoice warns that its bill will be created`, con `legacyUnlinked: true`.
  - `a linked bill edits description and notes with its invoice fields locked`: «Editar info» habilitado; proveedor, categoría y número de solo lectura; el cuerpo enviado lleva solo descripción y notas.
- [ ] **Step 2:** se corre → FALLA.
- [ ] **Step 3:** se implementa. El cuerpo de editar info de una cuenta vinculada omite proveedor, categoría y número; el servidor de B1.3 acepta igual los valores que ya tiene.
- [ ] **Step 4:** se corren `npm test` y `npm run typecheck` → PASA.
- [ ] **Step 5:** commit `feat(pagar): la cuenta de un subcontratista deja editar descripción y notas`.

## Orden

1. B1, el dinero.
2. B2 y P1, nómina.
3. B3 y P2, Cobros.
4. B4 y P5, pagos de subcontratistas.
5. P3 (tutoriales) y P4 (pulido), que no dependen del servidor.

Cada PR del panel que use un campo nuevo dice en su descripción con qué PR del servidor va.
