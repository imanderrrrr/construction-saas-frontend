import { Lock } from 'lucide-react';

interface ClosedProjectBannerProps {
  message?: string;
  className?: string;
}

/**
 * Reusable banner shown when a project is closed and actions are blocked.
 * Consistent UX across all screens that reference a closed project.
 */
export function ClosedProjectBanner({
  message = 'This project is closed. No new records or modifications are allowed.',
  className = '',
}: ClosedProjectBannerProps) {
  return (
    <div className={`flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl ${className}`}>
      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Lock className="w-4 h-4 text-red-600" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-900">Project closed</p>
        <p className="text-xs text-red-600 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
