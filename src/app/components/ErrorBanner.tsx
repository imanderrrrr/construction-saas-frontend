import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-red-900">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
