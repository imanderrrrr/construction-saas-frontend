// OFJR Construction — Route configuration (canonical, Phase 1 + 2)
// Role → route mapping is the source of truth in types/index.ts (ROLE_DASHBOARD_ROUTES)

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Landing }             from './pages/Landing';
import { Docs }                from './pages/Docs';
import { Status }              from './pages/Status';
import { ChoosePlan }          from './pages/landing/ChoosePlan';
import { Login }               from './pages/Login';
import { Signup }              from './pages/Signup';
import { AcceptInvite }        from './pages/AcceptInvite';
import { ForgotPassword }      from './pages/ForgotPassword';
import { ResetPassword }       from './pages/ResetPassword';
import { PrivacyPolicy }       from './pages/PrivacyPolicy';
import { TermsOfService }      from './pages/TermsOfService';
import { Support }             from './pages/Support';
import { AdminDashboard }      from './pages/AdminDashboard';
import { SupervisorDashboard } from './pages/SupervisorDashboard';
import { WorkerDashboard }     from './pages/WorkerDashboard';
import { AccessDenied }        from './pages/AccessDenied';
import { AuthHandoff }         from './pages/AuthHandoff';
import { FinanceDashboard }    from './pages/FinanceDashboard';
import { WarehouseDashboard }  from './pages/WarehouseDashboard';
import { SubcontractorWebInfo } from './pages/SubcontractorWebInfo';
import { BillingPage }         from './pages/admin/BillingPage';
import { CheckoutSuccess }     from './pages/CheckoutSuccess';
import { CheckoutCancel }      from './pages/CheckoutCancel';
import { ClientView }          from './pages/ClientView';
import { AuthService }         from './services/auth';
import { BillingGuard }        from './components/BillingGuard';
import { CanonicalRole, ROLE_DASHBOARD_ROUTES } from './types';

// Platform (super-admin) console — separate auth model (Bearer + MFA),
// separate context, separate shell. Lives at /platform/<...>.
import { PlatformAuthProvider } from '../platform/context/PlatformAuthContext';
import { ProtectedPlatformRoute } from '../platform/components/ProtectedPlatformRoute';
import { PlatformLogin } from '../platform/pages/PlatformLogin';
import { PlatformOverview } from '../platform/pages/PlatformOverview';
import { PlatformTenants } from '../platform/pages/PlatformTenants';
import { PlatformTenantDetailPage } from '../platform/pages/PlatformTenantDetail';
import { PlatformAudit } from '../platform/pages/PlatformAudit';

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

  return <>{children}</>;
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

export const routes = [

  // Public
  { path: '/',                       element: <Landing /> },
  // Public marketing site alongside the landing — linked from its nav/footer.
  { path: '/docs',                   element: <Docs /> },
  { path: '/status',                 element: <Status /> },
  { path: '/login',                  element: <Login /> },
  { path: '/choose-plan',            element: <ChoosePlan /> },
  { path: '/signup',                 element: <Signup /> },
  { path: '/accept-invite/:token',   element: <AcceptInvite /> },
  // Client portal — public read-only site-log view. Auth is the signed token
  // in the URL (exchanged in-page), NOT a user session: no guards on purpose.
  { path: '/client-view/:token',     element: <ClientView /> },
  { path: '/forgot-password',        element: <ForgotPassword /> },
  { path: '/reset-password/:token',  element: <ResetPassword /> },
  { path: '/auth/handoff',           element: <AuthHandoff /> },
  { path: '/access-denied', element: <AccessDenied /> },
  { path: '/privacy',       element: <PrivacyPolicy /> },
  { path: '/terms',         element: <TermsOfService /> },
  { path: '/support',       element: <Support /> },
  { path: '/dashboard',    element: <ProtectedRoute><BillingGuard><RoleRedirect /></BillingGuard></ProtectedRoute> },

  // Paddle return pages — public on purpose. Activation lives on the
  // backend webhook, NOT on these pages, so they need no auth and never
  // mutate state. They MUST stay outside BillingGuard so the user can
  // land here right after checkout while billingStatus is still pending.
  { path: '/checkout/success', element: <CheckoutSuccess /> },
  { path: '/checkout/cancel',  element: <CheckoutCancel /> },

  // ADMIN
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <BillingGuard>
          <AdminDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  // Admin time-approvals is a section inside AdminDashboard (no separate route needed)
  // Billing page is deliberately OUTSIDE BillingGuard — it's the activation
  // surface that admins are sent to when their tenant is locked.
  {
    path: '/admin/billing',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <BillingPage />
      </ProtectedRoute>
    ),
  },

  // SUPERVISOR
  {
    path: '/supervisor/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['SUPERVISOR']}>
        <BillingGuard>
          <SupervisorDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/supervisor/time-approvals',
    element: (
      <ProtectedRoute allowedRoles={['SUPERVISOR']}>
        <BillingGuard>
          <SupervisorDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },

  // WORKER
  {
    path: '/worker/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['WORKER']}>
        <BillingGuard>
          <WorkerDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/worker/time',
    element: (
      <ProtectedRoute allowedRoles={['WORKER']}>
        <BillingGuard>
          <WorkerDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },

  // FINANCE
  {
    path: '/finance/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['FINANCE']}>
        <BillingGuard>
          <FinanceDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  // Deep-link routes into the finance dashboard — they open the real module
  // section while keeping the dashboard shell (sidebar, topbar, logout).
  {
    path: '/finance/expenses',
    element: (
      <ProtectedRoute allowedRoles={['FINANCE']}>
        <BillingGuard>
          <FinanceDashboard initialSection="approved-expenses" />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/finance/budgets',
    element: (
      <ProtectedRoute allowedRoles={['FINANCE']}>
        <BillingGuard>
          <FinanceDashboard initialSection="budgets" />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },

  // WAREHOUSE
  {
    path: '/warehouse/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['WAREHOUSE']}>
        <BillingGuard>
          <WarehouseDashboard />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },
  // Deep-link into the warehouse dashboard's tool-inventory section. The
  // sidebar still exposes consumables + the other inventory sections.
  {
    path: '/warehouse/inventory',
    element: (
      <ProtectedRoute allowedRoles={['WAREHOUSE']}>
        <BillingGuard>
          <WarehouseDashboard initialSection="tool-inventory" />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },

  // SUBCONTRACTOR — no web workspace, redirected here so they get a friendly
  // message pointing them to the mobile app instead of an infinite redirect
  // loop or blank screen.
  {
    path: '/subcontractor/info',
    element: (
      <ProtectedRoute allowedRoles={['SUBCONTRACTOR']}>
        <BillingGuard>
          <SubcontractorWebInfo />
        </BillingGuard>
      </ProtectedRoute>
    ),
  },

  // ── Platform (super-admin) console ──────────────────────────
  // Separate auth (Bearer + TOTP MFA) from the tenant cookie flow.
  // Wrapped in PlatformAuthProvider so all sub-routes share one
  // session context.
  {
    path: '/platform/login',
    element: (
      <PlatformAuthProvider>
        <PlatformLogin />
      </PlatformAuthProvider>
    ),
  },
  {
    path: '/platform',
    element: (
      <PlatformAuthProvider>
        <Navigate to="/platform/overview" replace />
      </PlatformAuthProvider>
    ),
  },
  {
    path: '/platform/overview',
    element: (
      <PlatformAuthProvider>
        <ProtectedPlatformRoute>
          <PlatformOverview />
        </ProtectedPlatformRoute>
      </PlatformAuthProvider>
    ),
  },
  {
    path: '/platform/tenants',
    element: (
      <PlatformAuthProvider>
        <ProtectedPlatformRoute>
          <PlatformTenants />
        </ProtectedPlatformRoute>
      </PlatformAuthProvider>
    ),
  },
  {
    path: '/platform/tenants/:id',
    element: (
      <PlatformAuthProvider>
        <ProtectedPlatformRoute>
          <PlatformTenantDetailPage />
        </ProtectedPlatformRoute>
      </PlatformAuthProvider>
    ),
  },
  {
    path: '/platform/audit',
    element: (
      <PlatformAuthProvider>
        <ProtectedPlatformRoute>
          <PlatformAudit />
        </ProtectedPlatformRoute>
      </PlatformAuthProvider>
    ),
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);