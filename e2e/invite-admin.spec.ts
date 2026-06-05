// Admin generates an invitation (QR + accept link) from the Users panel.
//
// NOTE on the brief: the invite-create flow is QR/token-based and role-only —
// there is NO email field here (that was an assumption in the brief). The
// email-less token is what the accept-invite spec then consumes.

import { test, expect } from '@playwright/test';
import { installHermeticBase, setSession, json } from './support/mock-api';

const EMPTY_PAGE = {
  content: [], totalElements: 0, totalPages: 0, number: 0, size: 20,
  first: true, last: true, numberOfElements: 0, empty: true,
};

test.describe('Admin invites a user via QR', () => {
  test('generate an invitation → the accept link with the new token is shown', async ({ page, context }) => {
    await setSession(context, 'ADMIN', 'admin1');
    await installHermeticBase(page, { role: 'ADMIN', username: 'admin1' });

    // UserManagement loads the users list on mount.
    await page.route('**/api/v1/admin/users**', json(EMPTY_PAGE));
    // Invitations: GET list → empty; POST create → a fresh token.
    await page.route('**/api/v1/admin/invitations', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1, token: 'fresh-invite-token', role: 'WORKER', status: 'PENDING',
            expiresAt: '2099-01-01T00:00:00Z', createdAt: '2026-06-04T00:00:00Z',
            invitedByUserId: 1, acceptedAt: null, acceptedUserId: null,
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/admin/dashboard');

    // Open the Users section, then the QR invite modal.
    await page.getByRole('button', { name: 'Users' }).first().click();
    await page.getByRole('button', { name: 'Invitar por QR' }).click();
    await expect(page.getByText('Invite a new user')).toBeVisible();

    // Default role is WORKER — generate.
    await page.getByRole('button', { name: 'Generate QR' }).click();

    await expect(page.getByText('Share this QR')).toBeVisible();
    await expect(page.getByText('/accept-invite/fresh-invite-token')).toBeVisible();
  });
});
