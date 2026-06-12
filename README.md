# BuildTrack — Construction Management SaaS · Web App

> Multi-tenant SaaS that helps construction companies run projects, crews and money in one place: time-tracking with approvals, expenses, tool inventory, payroll and subscription billing.

**[🔗 Live demo](https://construction-saas-frontend-kappa.vercel.app)**

This is the web client of a three-app product suite — this React SPA, a Kotlin/Spring Boot API and a Flutter field app. The companion repositories are private; access can be shared with recruiters on request.

## Screenshots

**Public site & onboarding**

<p>
  <img src="docs/screenshots/landing.png" width="49%" alt="Landing page">
  <img src="docs/screenshots/login.png" width="49%" alt="Tenant login">
</p>

<p>
  <img src="docs/screenshots/signup.png" width="49%" alt="Company signup">
</p>

**Admin panel**

<p>
  <img src="docs/screenshots/admin-dashboard.png" width="49%" alt="Admin dashboard with live audit activity">
  <img src="docs/screenshots/admin-projects.png" width="49%" alt="Projects with crew assignments">
</p>

<p>
  <img src="docs/screenshots/admin-users.png" width="49%" alt="User management with QR invitations">
  <img src="docs/screenshots/admin-hours.png" width="49%" alt="Hours report">
</p>

<p>
  <img src="docs/screenshots/admin-expenses.png" width="49%" alt="Expense management with approval flow">
  <img src="docs/screenshots/admin-audit.png" width="49%" alt="Audit log with CSV export">
</p>

<p>
  <img src="docs/screenshots/admin-billing.png" width="49%" alt="Subscription status (Paddle)">
</p>

**Supervisor & Worker**

<p>
  <img src="docs/screenshots/supervisor-dashboard.png" width="49%" alt="Supervisor operational overview">
  <img src="docs/screenshots/supervisor-approvals.png" width="49%" alt="Time approvals queue">
</p>

<p>
  <img src="docs/screenshots/worker-time.png" width="49%" alt="Worker time punch with geofence awareness">
  <img src="docs/screenshots/worker-expenses.png" width="49%" alt="Worker expense history">
</p>

## What it does

- **Role-based workspaces** — Admin, Supervisor, Finance, Warehouse and Worker each get their own views and permissions
- **Projects & time-tracking** — crew hours with approval flows
- **Expenses & reporting** — capture, review and export to Excel / PDF
- **Tool & warehouse inventory** — track tools across job sites
- **Payroll & billing** — subscription billing integrated with Paddle
- **Audit log** — sensitive actions are traceable end to end
- **Platform console** — separate super-admin surface for tenant management, fully isolated from the tenant app
- **i18n** — English / Spanish, switchable from the top bar

## Tech stack

| Layer | Technology |
|---|---|
| Core | React 18 · TypeScript (`strict: true`) · Vite 6 |
| UI | Tailwind CSS 4 · Radix UI (120+ components) |
| Routing | React Router 7, lazy-loaded route trees |
| Forms | React Hook Form |
| Charts | Recharts |
| i18n | i18next · react-i18next |
| Observability | Sentry with PII scrubbing |
| Exports | ExcelJS · jsPDF |
| Testing | Vitest · Playwright (E2E) |

## Architecture highlights

- **Hardened auth** — HttpOnly cookies + CSRF protection; automatic refresh-token rotation deduplicated by a coordinator with timeout and abort handling (`src/app/lib/refresh-coordinator.ts`)
- **Single API gateway** — every request flows through one typed fetch wrapper that handles 401s, CSRF and auth-endpoint edge cases (`src/app/lib/api.ts`)
- **19 typed service modules** — one per business domain, each with explicit DTOs (`src/app/services/`)
- **Two isolated surfaces** — tenant app (`src/app/`) and super-admin platform console (`src/platform/`) share the design system and nothing else
- **Privacy-aware error tracking** — Sentry error boundaries around the route tree; passwords, tokens and MFA fields are scrubbed before any event leaves the browser (`src/app/lib/sentry.ts`)

## Quality

- ✅ 20 test files — unit/component (Vitest) plus hermetic E2E (Playwright with the API mocked)
- ✅ CI on every push — GitHub Actions: `test.yml` (tests + build) and `e2e.yml` (Playwright)
- ✅ TypeScript strict mode across the codebase

## Getting started

```bash
npm install
cp .env.example .env   # point VITE_API_URL to your backend API
npm run dev            # → http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with HMR |
| `npm test` | Unit / component tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright) |
| `npm run build` | Production build → `dist/` |

## Roadmap

- QuickBooks integration and public API
- SSO for enterprise tenants

## License & usage

**© 2026 Anthony Anderson Herrera Aguirre. All rights reserved.**

This source code is published **for portfolio review only** — you are welcome to read it, but it may not be used, copied, modified or redistributed. See [LICENSE](LICENSE).

## Author

**Anderson Aguirre** — Front-End Developer (React · TypeScript)

📫 andersonaguirre794@gmail.com · [LinkedIn](https://www.linkedin.com/in/anthony-aguirre-44585a376/) · [GitHub](https://github.com/imanderrrrr)
