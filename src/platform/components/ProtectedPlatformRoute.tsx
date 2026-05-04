import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { usePlatformAuth } from '../context/PlatformAuthContext';
import type { PlatformRole } from '../types';

/**
 * Gate for routes under `/platform/*`. Redirects unauthenticated visitors
 * to `/platform/login`. If `requiredRoles` is provided, also redirects
 * users whose role isn't in the list back to `/platform/overview` so
 * they don't dead-end on a 403.
 */
export function ProtectedPlatformRoute({
  children,
  requiredRoles,
}: {
  children: ReactNode;
  requiredRoles?: PlatformRole[];
}) {
  const { isAuthenticated, role } = usePlatformAuth();

  if (!isAuthenticated) {
    return <Navigate to="/platform/login" replace />;
  }
  if (requiredRoles && role && !requiredRoles.includes(role)) {
    return <Navigate to="/platform/overview" replace />;
  }
  return <>{children}</>;
}
