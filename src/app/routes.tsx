// OFJR Construction — Route configuration (canonical, Phase 1 + 2)
// Role → route mapping is the source of truth in types/index.ts (ROLE_DASHBOARD_ROUTES)

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { Landing }             from './pages/Landing';
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
import { AuthService }         from './services/auth';
import { CanonicalRole, ROLE_DASHBOARD_ROUTES } from './types';

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

// Placeholder for unbuilt role dashboards
function ComingSoon({ role }: { role: CanonicalRole }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-[#F97316]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🚧</span>
        </div>
        <h1 className="text-xl font-bold text-[#0A0A0A] mb-2">{role} Dashboard</h1>
        <p className="text-sm text-[#71717A]">Coming in a future phase.</p>
        <button onClick={() => { AuthService.logout().then(() => { window.location.href = '/'; }); }}
          className="mt-6 text-xs text-[#F97316] hover:text-[#C2410C] underline">
          Sign out
        </button>
      </div>
    </div>
  );
}

// Router

export const router = createBrowserRouter([

  // Public
  { path: '/',                       element: <Landing /> },
  { path: '/login',                  element: <Login /> },
  { path: '/signup',                 element: <Signup /> },
  { path: '/accept-invite/:token',   element: <AcceptInvite /> },
  { path: '/forgot-password',        element: <ForgotPassword /> },
  { path: '/reset-password/:token',  element: <ResetPassword /> },
  { path: '/auth/handoff',           element: <AuthHandoff /> },
  { path: '/access-denied', element: <AccessDenied /> },
  { path: '/privacy',       element: <PrivacyPolicy /> },
  { path: '/terms',         element: <TermsOfService /> },
  { path: '/support',       element: <Support /> },
  { path: '/dashboard',    element: <ProtectedRoute><RoleRedirect /></ProtectedRoute> },

  // ADMIN
  {
    path: '/admin/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
  // Admin time-approvals is a section inside AdminDashboard (no separate route needed)

  // SUPERVISOR
  {
    path: '/supervisor/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['SUPERVISOR']}>
        <SupervisorDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/supervisor/time-approvals',
    element: (
      <ProtectedRoute allowedRoles={['SUPERVISOR']}>
        <SupervisorDashboard />
      </ProtectedRoute>
    ),
  },

  // WORKER
  {
    path: '/worker/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['WORKER']}>
        <WorkerDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/worker/time',
    element: (
      <ProtectedRoute allowedRoles={['WORKER']}>
        <WorkerDashboard />
      </ProtectedRoute>
    ),
  },

  // FINANCE
  {
    path: '/finance/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['FINANCE']}>
        <FinanceDashboard />
      </ProtectedRoute>
    ),
  },
  { path: '/finance/expenses', element: <ProtectedRoute allowedRoles={['FINANCE']}><ComingSoon role="FINANCE" /></ProtectedRoute> },
  { path: '/finance/budgets',  element: <ProtectedRoute allowedRoles={['FINANCE']}><ComingSoon role="FINANCE" /></ProtectedRoute> },

  // WAREHOUSE
  {
    path: '/warehouse/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['WAREHOUSE']}>
        <WarehouseDashboard />
      </ProtectedRoute>
    ),
  },
  { path: '/warehouse/inventory', element: <ProtectedRoute allowedRoles={['WAREHOUSE']}><ComingSoon role="WAREHOUSE" /></ProtectedRoute> },

  // SUBCONTRACTOR — no web workspace, redirected here so they get a friendly
  // message pointing them to the mobile app instead of an infinite redirect
  // loop or blank screen.
  {
    path: '/subcontractor/info',
    element: (
      <ProtectedRoute allowedRoles={['SUBCONTRACTOR']}>
        <SubcontractorWebInfo />
      </ProtectedRoute>
    ),
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
]);