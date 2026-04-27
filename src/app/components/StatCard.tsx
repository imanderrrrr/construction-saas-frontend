import { LucideIcon } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle: string;
  iconBgColor: string;
  iconColor: string;
  isLoading?: boolean;
  isError?: boolean;
  trend?: { value: string; positive: boolean };
}

export function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconBgColor,
  iconColor,
  isLoading = false,
  isError = false,
  trend,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-[#D4D4D8]">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <Skeleton className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-16 mb-1.5" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-[#D4D4D8]">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className={`w-9 h-9 sm:w-11 sm:h-11 ${iconBgColor} rounded-lg flex items-center justify-center opacity-40`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
          </div>
        </div>
        <p className="text-[10px] sm:text-xs font-medium text-[#71717A] mb-1">{title}</p>
        <p className="text-xl sm:text-2xl font-bold text-[#D4D4D8] mb-1">—</p>
        <p className="text-[10px] sm:text-xs text-red-500">Unable to load</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 border border-[#D4D4D8] hover:border-[#F97316]/40 hover:shadow-sm transition-all overflow-hidden">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 ${iconBgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
        {trend && (
          <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-1 sm:mb-1.5">{title}</p>
      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#0A0A0A] mb-0.5 truncate">{value}</p>
      <p className="text-[10px] sm:text-xs text-[#71717A] truncate">{subtitle}</p>
    </div>
  );
}