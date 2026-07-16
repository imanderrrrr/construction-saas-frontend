import type { ReactNode } from 'react';

/**
 * The console's one dialog chrome. Lifted out of PlatformTenantDetail when
 * the tenant-creation form needed the same shell — two copies of a backdrop
 * that swallows its own clicks is exactly the kind of thing that drifts.
 */
export function PlatformModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}
