# Web E2E (Playwright) — hermetic

End-to-end tests for the BuildTrack web app's critical onboarding/auth path.
They are **hermetic**: every `/api/v1/**` call and the Paddle checkout are
intercepted at the browser network layer (see `support/mock-api.ts`), so the
suite needs **no backend and no real Paddle account** and is deterministic.

This suite is **separate** from the vitest unit suite (`npm test`) and runs in
its own CI job (`.github/workflows/e2e.yml`).

## Run locally

```bash
npm ci
npx playwright install --with-deps chromium   # one-time
npm run e2e          # headless
npm run e2e:ui       # Playwright UI mode
```

Playwright starts the Vite dev server itself (`webServer` in
`playwright.config.ts`) with a dummy `VITE_PADDLE_CLIENT_TOKEN`, so you don't
need to start anything by hand. If you already have the dev server on `:5180`,
it is reused locally — but make sure that server also has the dummy Paddle env,
or run `npm run e2e` with no dev server running so Playwright owns it.

## What's covered (maps to the critical path)

| Spec | Path covered |
|---|---|
| `onboarding.spec.ts` | signup → (stubbed Paddle) checkout → `/signup/complete` → admin dashboard; admin login via the form |
| `accept-invite.spec.ts` | invite preview → set password → invited worker login; **429 rate-limit** message; 410 expired screen |
| `invite-admin.spec.ts` | admin generates a QR invitation → accept link/token shown |
| `dashboards-smoke.spec.ts` | each role reaches its dashboard route (ProtectedRoute + BillingGuard), not bounced to login |

## How the mocking works

`installHermeticBase(page, { role })`:
- forces `localStorage.ofjr_language = 'en'` (deterministic text),
- stubs `window.Paddle` + intercepts the Paddle CDN so `Checkout.open()`
  "pays" by redirecting to its `successUrl`,
- answers `GET /billing/status` with `ACTIVE` (so the ADMIN `BillingGuard`
  renders),
- defaults every other `/api/v1/**` call to `500`, so data-driven dashboards
  fall back to their empty state and still render their shell.

`setSession(context, role)` seeds the client-readable `ofjr_session` cookie the
way the backend would, so `AuthService` sees a logged-in user. Specs add
endpoint-specific `page.route(...)` overrides after the base; the most recently
registered Playwright route wins.

## Conventions

- Specs live in `e2e/**/*.spec.ts`. The vitest config excludes this folder.
- Prefer stable selectors (`#id`, `button[type="submit"]`, roles) over
  translated text; where text is asserted it is pinned to the English bundle.
- Stability over coverage: wait on states/URLs, never on fixed `sleep`s.
