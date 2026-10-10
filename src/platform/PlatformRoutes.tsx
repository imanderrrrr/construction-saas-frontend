// The platform (super-admin) console as one lazily loaded chunk (AUD-019).
//
// routes.tsx used to import the console statically, so every visitor of the
// public site downloaded it — motion/react included. routes.tsx now imports
// this module only when a /platform route renders.

import { PlatformAuthProvider } from './context/PlatformAuthContext';
import { ProtectedPlatformRoute } from './components/ProtectedPlatformRoute';
import { PlatformShell } from './components/PlatformShell';
import { PlatformLogin } from './pages/PlatformLogin';

export { PlatformOverview } from './pages/PlatformOverview';
export { PlatformTenants } from './pages/PlatformTenants';
export { PlatformTenantCreate } from './pages/PlatformTenantCreate';
export { PlatformTenantDetailPage } from './pages/PlatformTenantDetail';
export { PlatformAudit } from './pages/PlatformAudit';

export function PlatformLoginRoute() {
  return (
    <PlatformAuthProvider>
      <PlatformLogin />
    </PlatformAuthProvider>
  );
}

/**
 * The authenticated pages hang off one layout route: PlatformShell renders
 * the chrome once and cross-fades page changes through its router outlet.
 */
export function PlatformLayoutRoute() {
  return (
    <PlatformAuthProvider>
      <ProtectedPlatformRoute>
        <PlatformShell />
      </ProtectedPlatformRoute>
    </PlatformAuthProvider>
  );
}
