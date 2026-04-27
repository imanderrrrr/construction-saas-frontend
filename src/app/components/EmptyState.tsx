import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#71717A]" />
      </div>
      <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#71717A] text-center max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}