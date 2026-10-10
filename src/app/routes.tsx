import { BrowsingStateProvider } from './workspace/BrowsingState';
// OFJR Construction — Route configuration (canonical, Phase 1 + 2)
// Role → route mapping is the source of truth in types/index.ts (ROLE_DASHBOARD_ROUTES)

import React from 'react';
import { createBrowserRouter, matchPath, Navigate } from 'react-router';
import { lazyRoute, RoutePage } from './lazyRoute';
import { AuthService }         from './services/auth';
import { BillingGuard }        from './components/BillingGuard';
import { PasswordChangeGuard } from './components/PasswordChangeGuard';
import { WhatsNewModal }       from './components/WhatsNewModal';
import { CanonicalRole, ROLE_DASHBOARD_ROUTES } from './types';
import { WorkspaceStateProvider } from './workspace/WorkspaceState';
import { WORKSPACE_PATHS, type WorkspaceRole } from './workspace/paths';

// Pages: one chunk each, fetched with their translations when the route
// renders (AUD-019). The guards below run first, so a visitor who is not let
// in never downloads the page.
const Landing             = lazyRoute('landing',        () => import('./pages/Landing').then(m => m.Landing));
const Docs                = lazyRoute('docs',           () => import('./pages/Docs').then(m => m.Docs));
const Status              = lazyRoute('status',         () => import('./pages/Status').then(m => m.Status));
const Login               = lazyRoute('login',          () => import('./pages/Login').then(m => m.Login));
const AcceptInvite        = lazyRoute('acceptInvite',   () => import('./pages/AcceptInvite').then(m => m.AcceptInvite));
const ForgotPassword      = lazyRoute('forgotPassword', () => import('./pages/ForgotPassword').then(m => m.ForgotPassword));
const ResetPassword       = lazyRoute('resetPassword',  () => import('./pages/ResetPassword').then(m => m.ResetPassword));
const Pay                 = lazyRoute('pay',            () => import('./pages/Pay').then(m => m.Pay));
const PrivacyPolicy       = lazyRoute('privacy',        () => import('./pages/PrivacyPolicy').then(m => m.PrivacyPolicy));
const TermsOfService      = lazyRoute('terms',          () => import('./pages/TermsOfService').then(m => m.TermsOfService));
const Support             = lazyRoute('support',        () => import('./pages/Support').then(m => m.Support));
const AccessDenied        = lazyRoute('accessDenied',   () => import('./pages/AccessDenied').then(m => m.AccessDenied));
const AuthHandoff         = lazyRoute('authHandoff',    () => import('./pages/AuthHandoff').then(m => m.AuthHandoff));
const ClientView          = lazyRoute('clientView',     () => import('./pages/ClientView').then(m => m.ClientView));
const SignDocument        = lazyRoute('sign',           () => import('./pages/SignDocument').then(m => m.SignDocument));
const AdminDashboard      = lazyRoute('workspace',      () => import('./pages/AdminDashboard').then(m => m.AdminDashboard));
const SupervisorDashboard = lazyRoute('workspace',      () => import('./pages/SupervisorDashboard').then(m => m.SupervisorDashboard));
const WorkerDashboard     = lazyRoute('workspace',      () => import('./pages/WorkerDashboard').then(m => m.WorkerDashboard));
const FinanceDashboard    = lazyRoute('workspace',      () => import('./pages/FinanceDashboard').then(m => m.FinanceDashboard));
const WarehouseDashboard  = lazyRoute('workspace',      () => import('./pages/WarehouseDashboard').then(m => m.WarehouseDashboard));
const SubcontractorWebInfo = lazyRoute('workspace',     () => import('./pages/SubcontractorWebInfo').then(m => m.SubcontractorWebInfo));
const BillingPage         = lazyRoute('workspace',      () => import('./pages/admin/BillingPage').then(m => m.BillingPage));

// Platform (super-admin) console — separate auth model (Bearer + MFA),
// separate context, separate shell. Lives at /platform/<...>, in one chunk.
const platform = () => import('../platform/PlatformRoutes');
const PlatformLoginRoute       = lazyRoute('platform', () => platform().then(m => m.PlatformLoginRoute));
const PlatformLayoutRoute      = lazyRoute('platform', () => platform().then(m => m.PlatformLayoutRoute));
const PlatformOverview         = lazyRoute('platform', () => platform().then(m => m.PlatformOverview));
const PlatformTenants          = lazyRoute('platform', () => platform().then(m => m.PlatformTenants));
const PlatformTenantCreate     = lazyRoute('platform', () => platform().then(m => m.PlatformTenantCreate));
const PlatformTenantDetailPage = lazyRoute('platform', () => platform().then(m => m.PlatformTenantDetailPage));
const PlatformAudit            = lazyRoute('platform', () => platform().then(m => m.PlatformAudit));

// Protected Route

function ProtectedRoute({
  children, allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: CanonicalRole[];
}) {
  const isAuthenticated = AuthService.isAuthenticated();
  const role            = AuthService.getRole();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role as CanonicalRole)) {
    const redirect = AuthService.getDashboardRoute(role);
    return <Navigate to={redirect} replace />;
  }

  // Inside the role check, so the user has already been routed to the
  // dashboard their role earns them and the change screen appears THERE —
  // not at a URL of its own. One wrap here covers every internal page.
  return <PasswordChangeGuard>{children}</PasswordChangeGuard>;
}

// A tenant-internal PAGE (not a redirect): ProtectedRoute → (its inner
// PasswordChangeGuard) → BillingGuard → the page, with the what's-new modal
// as the page's sibling INSIDE BillingGuard. Both guards render children only
// once they are satisfied, so the modal can never paint over the forced
// password change or the billing wall — and /admin/billing (deliberately
// outside BillingGuard, it's where a blocked admin lands) never mounts it.
function GuardedPage({
  children, allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: CanonicalRole[];
}) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <BillingGuard>
        {allowedRoles?.[0] && allowedRoles[0] !== 'SUBCONTRACTOR' ? (
          <WorkspaceStateProvider role={allowedRoles[0] as WorkspaceRole}><RoutePage>{children}</RoutePage><WhatsNewModal /></WorkspaceStateProvider>
        ) : <><RoutePage>{children}</RoutePage><WhatsNewModal /></>}
      </BillingGuard>
    </ProtectedRoute>
  );
}

// Role dashboard redirect
// Landing after login — redirects to role-appropriate dashboard.
function RoleRedirect() {
  const role = AuthService.getRole();
  if (!role) return <Navigate to="/" replace />;
  return <Navigate to={ROLE_DASHBOARD_ROUTES[role as CanonicalRole] ?? '/'} replace />;
}

// Router
// `routes` is exported separately from `router` so tests can mount any path
// with createMemoryRouter without spinning up a real browser history.

const LEGACY_WORKSPACE_PATHS = new Set(["/admin/billing", "/admin/dashboard", "/finance/budgets", "/finance/clients", "/finance/dashboard", "/finance/expenses", "/finance/invoices", "/finance/labor-cost", "/finance/payables", "/finance/payroll", "/finance/receivables", "/finance/supervisor-hours", "/supervisor/dashboard", "/supervisor/time-approvals", "/warehouse/dashboard", "/warehouse/inventory", "/worker/dashboard", "/worker/time"]);

export const routes = [

  // Public
  { path: '/',                       element: <RoutePage><Landing /></RoutePage> },
  // Public marketing site alongside the landing — linked from its nav/footer.
  { path: '/docs',                   element: <RoutePage><Docs /></RoutePage> },
  { path: '/status',                 element: <RoutePage><Status /></RoutePage> },
  { path: '/login',                  element: <RoutePage><Login /></RoutePage> },
  // No public self-serve signup: accounts are provisioned by us after the
  // customer asks for one on the demo call, so there is no /signup and no
  // plan chooser on the public site.
  { path: '/accept-invite/:token',   element: <RoutePage><AcceptInvite /></RoutePage> },
  // Paddle default-payment-link target — NOT a signup. The backend mints a
  // checkout for a console-provisioned tenant and Paddle builds the emailed
  // URL as this page + `?_ptxn=<transaction>`; Paddle.js reads the param and
  // opens its overlay. Session-free on purpose (the payer has no password
  // yet) and it never mutates billing state — activation is webhook-driven.
  { path: '/pay',                    element: <RoutePage><Pay /></RoutePage> },
  // Client portal — public read-only site-log view. Auth is the signed token
  // in the URL (exchanged in-page), NOT a user session: no guards on purpose.
  { path: '/client-view/:token',     element: <BrowsingStateProvider><RoutePage><ClientView /></RoutePage></BrowsingStateProvider> },
  // Document signing — public by design: the person signing is an external
  // superintendent / PM with no account here. Auth is the signed token in the
  // URL (exchanged in-page for a short-lived session), NOT a user session.
  { path: '/sign/:token',            element: <RoutePage><SignDocument /></RoutePage> },
  { path: '/forgot-password',        element: <RoutePage><ForgotPassword /></RoutePage> },
  { path: '/reset-password/:token',  element: <RoutePage><ResetPassword /></RoutePage> },
  { path: '/auth/handoff',           element: <RoutePage><AuthHandoff /></RoutePage> },
  { path: '/access-denied', element: <RoutePage><AccessDenied /></RoutePage> },
  { path: '/privacy',       element: <RoutePage><PrivacyPolicy /></RoutePage> },
  { path: '/terms',         element: <RoutePage><TermsOfService /></RoutePage> },
  { path: '/support',       element: <RoutePage><Support /></RoutePage> },
  { path: '/dashboard',    element: <ProtectedRoute><BillingGuard><RoleRedirect /></BillingGuard></ProtectedRoute> },

  // ADMIN
  {
    path: '/admin/dashboard',
    element: (
      <GuardedPage allowedRoles={['ADMIN']}>
        <AdminDashboard />
      </GuardedPage>
    ),
  },
  // Admin time-approvals is a section inside AdminDashboard (no separate route needed)
  // Billing page is deliberately OUTSIDE BillingGuard — it's where admins
  // land when their tenant is locked, so it has to render while blocked.
  {
    path: '/admin/billing',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <RoutePage><BillingPage /></RoutePage>
      </ProtectedRoute>
    ),
  },

  // SUPERVISOR
  {
    path: '/supervisor/dashboard',
    element: (
      <GuardedPage allowedRoles={['SUPERVISOR']}>
        <SupervisorDashboard />
      </GuardedPage>
    ),
  },
  {
    path: '/supervisor/time-approvals',
    element: (
      <GuardedPage allowedRoles={['SUPERVISOR']}>
        <SupervisorDashboard />
      </GuardedPage>
    ),
  },

  // WORKER
  {
    path: '/worker/dashboard',
    element: (
      <GuardedPage allowedRoles={['WORKER']}>
        <WorkerDashboard />
      </GuardedPage>
    ),
  },
  {
    path: '/worker/time',
    element: (
      <GuardedPage allowedRoles={['WORKER']}>
        <WorkerDashboard />
      </GuardedPage>
    ),
  },

  // FINANCE
  {
    path: '/finance/dashboard',
    element: (
      <GuardedPage allowedRoles={['FINANCE']}>
        <FinanceDashboard />
      </GuardedPage>
    ),
  },
  // Deep-link routes into the finance dashboard — they open the real module
  // section while keeping the dashboard shell (sidebar, topbar, logout).
  {
    path: '/finance/expenses',
    element: (
      <GuardedPage allowedRoles={['FINANCE']}>
        <FinanceDashboard initialSection="approved-expenses" />
      </GuardedPage>
    ),
  },
  {
    path: '/finance/budgets',
    element: (
      <GuardedPage allowedRoles={['FINANCE']}>
        <FinanceDashboard initialSection="budgets" />
      </GuardedPage>
    ),
  },

  ...([
    ['/finance/clients', 'clients'],
    ['/finance/receivables', 'accounts-receivable'],
    ['/finance/payables', 'accounts-payable'],
    ['/finance/invoices', 'invoices'],
    ['/finance/labor-cost', 'labor-cost'],
    ['/finance/payroll', 'labor-payroll'],
    ['/finance/supervisor-hours', 'supervisor-hours'],
  ] as const).map(([path, initialSection]) => ({
    path,
    element: (
      <GuardedPage allowedRoles={['FINANCE']}>
        <FinanceDashboard initialSection={initialSection} />
      </GuardedPage>
    ),
  })),

  // WAREHOUSE
  {
    path: '/warehouse/dashboard',
    element: (
      <GuardedPage allowedRoles={['WAREHOUSE']}>
        <WarehouseDashboard />
      </GuardedPage>
    ),
  },
  // Deep-link into the warehouse dashboard's tool-inventory section. The
  // sidebar still exposes consumables + the other inventory sections.
  {
    path: '/warehouse/inventory',
    element: (
      <GuardedPage allowedRoles={['WAREHOUSE']}>
        <WarehouseDashboard initialSection="tool-inventory" />
      </GuardedPage>
    ),
  },

  // SUBCONTRACTOR — no web workspace, redirected here so they get a friendly
  // message pointing them to the mobile app instead of an infinite redirect
  // loop or blank screen.
  {
    path: '/subcontractor/info',
    element: (
      <GuardedPage allowedRoles={['SUBCONTRACTOR']}>
        <SubcontractorWebInfo />
      </GuardedPage>
    ),
  },

  // ── Platform (super-admin) console ──────────────────────────
  // Separate auth (Bearer + TOTP MFA) from the tenant cookie flow.
  // Wrapped in PlatformAuthProvider so all sub-routes share one
  // session context. The authenticated pages hang off one layout
  // route: PlatformShell renders the chrome once and cross-fades
  // page changes through its router outlet.
  {
    path: '/platform/login',
    element: <RoutePage><PlatformLoginRoute /></RoutePage>,
  },
  {
    path: '/platform',
    element: <RoutePage><PlatformLayoutRoute /></RoutePage>,
    children: [
      { index: true, element: <Navigate to="/platform/overview" replace /> },
      { path: 'overview', element: <RoutePage><PlatformOverview /></RoutePage> },
      { path: 'tenants', element: <RoutePage><PlatformTenants /></RoutePage> },
      { path: 'tenants/new', element: <RoutePage><PlatformTenantCreate /></RoutePage> },
      { path: 'tenants/:id', element: <RoutePage><PlatformTenantDetailPage /></RoutePage> },
      { path: 'audit', element: <RoutePage><PlatformAudit /></RoutePage> },
    ],
  },

  // Every operational screen has a protected, bookmarkable destination.
  ...Object.entries(WORKSPACE_PATHS).flatMap(([role, sections]) =>
    Object.entries(sections).filter(([, path]) => !LEGACY_WORKSPACE_PATHS.has(path)).map(([section, path]) => ({
      path,
      element: <GuardedPage allowedRoles={[role as CanonicalRole]}>{
        role === 'ADMIN' ? <AdminDashboard initialSection={section as never} /> :
        role === 'FINANCE' ? <FinanceDashboard initialSection={section as never} /> :
        role === 'SUPERVISOR' ? <SupervisorDashboard initialSection={section as never} /> :
        role === 'WORKER' ? <WorkerDashboard initialSection={section as never} /> :
        <WarehouseDashboard initialSection={section as never} />
      }</GuardedPage>,
    }))),

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
];

/** The public pages a first visit can land on, by path. */
const PUBLIC_PAGES: Array<[string, { preload: () => Promise<unknown> }]> = [
  ['/', Landing], ['/docs', Docs], ['/status', Status], ['/login', Login],
  ['/accept-invite/:token', AcceptInvite], ['/pay', Pay], ['/client-view/:token', ClientView],
  ['/sign/:token', SignDocument], ['/forgot-password', ForgotPassword], ['/reset-password/:token', ResetPassword],
  ['/auth/handoff', AuthHandoff], ['/access-denied', AccessDenied], ['/privacy', PrivacyPolicy],
  ['/terms', TermsOfService], ['/support', Support],
];

const DASHBOARD_BY_ROLE: Partial<Record<string, { preload: () => Promise<unknown> }>> = {
  ADMIN: AdminDashboard, SUPERVISOR: SupervisorDashboard, WORKER: WorkerDashboard,
  FINANCE: FinanceDashboard, WAREHOUSE: WarehouseDashboard,
};

/**
 * Start fetching the page on screen — its chunk and its translations — at
 * boot, in parallel with the shell's translations and the session check,
 * instead of after them. Rendering still goes through the router and its
 * guards; this only warms the cache. A signed-in visitor gets their own
 * role's workspace warmed, nothing else.
 */
export function preloadRoute(pathname: string) {
  const ignore = () => { /* the route's own boundary reports a failure when it renders */ };
  const page = PUBLIC_PAGES.find(([pattern]) => matchPath(pattern, pathname))?.[1];
  if (page) { page.preload().catch(ignore); return; }
  if (pathname.startsWith('/platform')) { PlatformLayoutRoute.preload().catch(ignore); return; }
  if (AuthService.isAuthenticated()) DASHBOARD_BY_ROLE[AuthService.getRole() ?? '']?.preload().catch(ignore);
}

export const router = createBrowserRouter(routes);
