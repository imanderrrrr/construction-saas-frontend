// Per-role dashboard smoke. With a hermetic session cookie, each role's
// dashboard route must render its protected shell — i.e. ProtectedRoute lets
// the role through and (for ADMIN) BillingGuard passes — without bouncing to
// /login. Data fetches default to 500 (see mock-api) so this asserts routing +
// guards, not data; richer content is covered by the flow specs + unit tests.

import { test, expect } from '@playwright/test';
import { installHermeticBase, setSession, BASE_URL } from './support/mock-api';

const TARGETS: { role: string; route: string }[] = [
  { role: 'ADMIN', route: '/admin/dashboard' },
  { role: 'SUPERVISOR', route: '/supervisor/dashboard' },
  { role: 'WORKER', route: '/worker/dashboard' },
  { role: 'FINANCE', route: '/finance/dashboard' },
  { role: 'WAREHOUSE', route: '/warehouse/dashboard' },
  { role: 'SUBCONTRACTOR', route: '/subcontractor/info' },
];

test.describe('Per-role dashboard smoke', () => {
  for (const { role, route } of TARGETS) {
    test(`${role} reaches ${route} (not bounced to login)`, async ({ page, context }) => {
      await setSession(context, role, role.toLowerCase());
      await installHermeticBase(page, { role, username: role.toLowerCase() });

      await page.goto(route);

      await expect(page).toHaveURL(`${BASE_URL}${route}`);
      // No password field ⇒ we're not on the login page.
      await expect(page.locator('#password')).toHaveCount(0);
    });
  }
});
