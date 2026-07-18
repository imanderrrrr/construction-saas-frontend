import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  LogIn,
  LogOut as LogOutIcon,
  UserPlus,
  Clock,
  RefreshCw,
  Download,
  Eye,
  Copy,
  Database,
  AlertCircle,
  FileText,
  Info,
  X,
  CheckCheck,
  Filter as FilterIcon,
  Shield,
  FolderOpen,
  Receipt,
  Wallet,
  Wrench,
  Package,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  CircleX,
  Hash,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from './ui/sheet';
import { searchAuditLogs, type AuditLogDTO, type AuditLogsPage } from '../services/audit';
import { exportAuditCsv, exportAuditExcel } from '../helpers/exportAuditCsv';
import { FIELD_LIMITS } from '../../shared/fieldLimits';

// Types

type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'WARNING';

interface AuditEvent {
  id: number;
  actorUserId: number | null;
  actorUsername: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  outcome: AuditOutcome;
  message: string;
  metadata: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string; // ISO-8601
}

interface AuditFilters {
  dateFrom: string;
  dateTo: string;
  action: string;
  category: string;
  actorUserId: string;
  entityId: string;
  entityType: string;
  outcome: string;
}

type ViewState = 'api-disabled' | 'loading' | 'data' | 'empty' | 'error';

// Action Catalogue

type ActionCategory =
  | 'auth'
  | 'project'
  | 'time'
  | 'expense'
  | 'budget'
  | 'tool'
  | 'consumable'
  | 'finance'
  | 'report';

interface ActionDef {
  label: string;
  category: ActionCategory;
  bg: string;
  text: string;
  dot: string;
}

const ACTION_CATALOGUE: Record<string, ActionDef> = {
  // Auth & Security
  LOGIN_SUCCESS:         { label: 'Login Success',         category: 'auth',       bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-400' },
  LOGIN_FAILED:          { label: 'Login Failed',          category: 'auth',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  LOGIN_FAILURE:         { label: 'Login Failure',         category: 'auth',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  LOGOUT:                { label: 'Logout',                category: 'auth',       bg: 'bg-slate-50',         text: 'text-slate-600',   dot: 'bg-slate-400'   },
  TOKEN_REFRESH:         { label: 'Token Refresh',         category: 'auth',       bg: 'bg-sky-50',           text: 'text-sky-700',     dot: 'bg-sky-400'     },
  ACCESS_DENIED:         { label: 'Access Denied',         category: 'auth',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-500'     },
  PASSWORD_CHANGED:      { label: 'Password Changed',      category: 'auth',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  PASSWORD_RESET:        { label: 'Password Reset',        category: 'auth',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  // Real backend user action names
  USER_CREATED:          { label: 'User Created',          category: 'auth',       bg: 'bg-[#F97316]/8',      text: 'text-[#F97316]',   dot: 'bg-[#F97316]'   },
  USER_UPDATED:          { label: 'User Updated',          category: 'auth',       bg: 'bg-purple-50',        text: 'text-purple-700',  dot: 'bg-purple-400'  },
  USER_STATUS_CHANGED:   { label: 'User Status Changed',   category: 'auth',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  // Legacy action names for backward compatibility
  USER_CREATE:           { label: 'User Created',          category: 'auth',       bg: 'bg-[#F97316]/8',      text: 'text-[#F97316]',   dot: 'bg-[#F97316]'   },
  USER_UPDATE:           { label: 'User Updated',          category: 'auth',       bg: 'bg-purple-50',        text: 'text-purple-700',  dot: 'bg-purple-400'  },
  USER_DISABLE:          { label: 'User Disabled',         category: 'auth',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  USER_DELETE:           { label: 'User Deleted',          category: 'auth',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  USER_PASSWORD_RESET:   { label: 'User Pwd Reset',        category: 'auth',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  ROLE_CHANGED:          { label: 'Role Changed',          category: 'auth',       bg: 'bg-purple-50',        text: 'text-purple-700',  dot: 'bg-purple-400'  },

  // Projects
  PROJECT_CREATED:             { label: 'Project Created',      category: 'project',    bg: 'bg-blue-50',          text: 'text-blue-700',    dot: 'bg-blue-500'    },
  PROJECT_UPDATED:             { label: 'Project Updated',      category: 'project',    bg: 'bg-blue-50',          text: 'text-blue-600',    dot: 'bg-blue-400'    },
  PROJECT_DELETED:             { label: 'Project Deleted',      category: 'project',    bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  PROJECT_CLOSED:              { label: 'Project Closed',       category: 'project',    bg: 'bg-slate-100',        text: 'text-slate-700',   dot: 'bg-slate-500'   },
  PROJECT_GEOFENCE_UPDATED:    { label: 'Geofence Updated',     category: 'project',    bg: 'bg-cyan-50',          text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
  PROJECT_ASSIGNMENTS_UPDATED: { label: 'Members Assigned',     category: 'project',    bg: 'bg-indigo-50',        text: 'text-indigo-700',  dot: 'bg-indigo-500'  },

  // Time Entries
  TIME_CHECK_IN:         { label: 'Check In',              category: 'time',       bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-500' },
  TIME_CHECK_OUT:        { label: 'Check Out',             category: 'time',       bg: 'bg-orange-50',        text: 'text-orange-700',  dot: 'bg-orange-400'  },
  TIME_LUNCH_START:      { label: 'Lunch Start',           category: 'time',       bg: 'bg-yellow-50',        text: 'text-yellow-700',  dot: 'bg-yellow-400'  },
  TIME_LUNCH_END:        { label: 'Lunch End',             category: 'time',       bg: 'bg-yellow-50',        text: 'text-yellow-600',  dot: 'bg-yellow-400'  },
  TIME_ENTRY_APPROVED:   { label: 'Record Approved',       category: 'time',       bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-400' },
  TIME_ENTRY_REJECTED:   { label: 'Record Rejected',       category: 'time',       bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  TIME_ENTRY_CORRECTED:  { label: 'Record Corrected',      category: 'time',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  TIME_EVENT_APPROVED:   { label: 'Event Approved',        category: 'time',       bg: 'bg-emerald-50',       text: 'text-emerald-600', dot: 'bg-emerald-400' },
  TIME_EVENT_REJECTED:   { label: 'Event Rejected',        category: 'time',       bg: 'bg-red-50',           text: 'text-red-600',     dot: 'bg-red-400'     },
  TIME_EVENT_CORRECTED:  { label: 'Event Corrected',       category: 'time',       bg: 'bg-amber-50',         text: 'text-amber-600',   dot: 'bg-amber-400'   },

  // Expenses
  EXPENSE_CREATED:       { label: 'Expense Created',       category: 'expense',    bg: 'bg-indigo-50',        text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  EXPENSE_APPROVED:      { label: 'Expense Approved',      category: 'expense',    bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-400' },
  EXPENSE_REJECTED:      { label: 'Expense Rejected',      category: 'expense',    bg: 'bg-red-50',           text: 'text-red-700',     dot: 'bg-red-400'     },
  EXPENSE_OBSERVED:      { label: 'Expense Observed',      category: 'expense',    bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  EXPENSE_CORRECTED:     { label: 'Expense Corrected',     category: 'expense',    bg: 'bg-purple-50',        text: 'text-purple-700',  dot: 'bg-purple-400'  },

  // Budgets
  BUDGET_CREATED:        { label: 'Budget Created',        category: 'budget',     bg: 'bg-violet-50',        text: 'text-violet-700',  dot: 'bg-violet-500'  },
  BUDGET_UPDATED:        { label: 'Budget Updated',        category: 'budget',     bg: 'bg-violet-50',        text: 'text-violet-600',  dot: 'bg-violet-400'  },
  BUDGET_LINE_ADDED:     { label: 'Budget Line Added',     category: 'budget',     bg: 'bg-violet-50',        text: 'text-violet-600',  dot: 'bg-violet-400'  },
  BUDGET_THRESHOLD_UPDATED: { label: 'Threshold Updated',  category: 'budget',     bg: 'bg-fuchsia-50',       text: 'text-fuchsia-700', dot: 'bg-fuchsia-400' },
  BUDGET_ADJUSTED:       { label: 'Budget Adjusted',       category: 'budget',     bg: 'bg-violet-50',        text: 'text-violet-700',  dot: 'bg-violet-500'  },

  // Tools
  TOOL_CREATED:          { label: 'Tool Created',          category: 'tool',       bg: 'bg-teal-50',          text: 'text-teal-700',    dot: 'bg-teal-500'    },
  TOOL_ASSIGNED:         { label: 'Tool Assigned',         category: 'tool',       bg: 'bg-teal-50',          text: 'text-teal-600',    dot: 'bg-teal-400'    },
  TOOL_RETURNED:         { label: 'Tool Returned',         category: 'tool',       bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-400' },
  TOOL_STATUS_CHANGED:   { label: 'Tool Status Changed',   category: 'tool',       bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  TOOL_TRANSFERRED:      { label: 'Tool Transferred',      category: 'tool',       bg: 'bg-sky-50',           text: 'text-sky-700',     dot: 'bg-sky-400'     },
  TOOL_DECOMMISSIONED:   { label: 'Tool Decommissioned',   category: 'tool',       bg: 'bg-red-50',           text: 'text-red-600',     dot: 'bg-red-400'     },

  // Consumables
  CONSUMABLE_ENTRY:      { label: 'Consumable Entry',      category: 'consumable', bg: 'bg-lime-50',          text: 'text-lime-700',    dot: 'bg-lime-500'    },
  CONSUMABLE_DISPATCH:   { label: 'Consumable Dispatch',   category: 'consumable', bg: 'bg-orange-50',        text: 'text-orange-700',  dot: 'bg-orange-500'  },
  CONSUMABLE_ADJUSTMENT: { label: 'Consumable Adjusted',   category: 'consumable', bg: 'bg-amber-50',         text: 'text-amber-700',   dot: 'bg-amber-400'   },
  CONSUMABLE_CATALOG_UPDATED: { label: 'Catalog Updated',  category: 'consumable', bg: 'bg-lime-50',          text: 'text-lime-600',    dot: 'bg-lime-400'    },

  // Finance AR/AP
  INVOICE_CREATED:       { label: 'Invoice Created',       category: 'finance',    bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-500' },
  INVOICE_UPDATED:       { label: 'Invoice Updated',       category: 'finance',    bg: 'bg-emerald-50',       text: 'text-emerald-600', dot: 'bg-emerald-400' },
  INVOICE_PAID:          { label: 'Invoice Paid',          category: 'finance',    bg: 'bg-emerald-50',       text: 'text-emerald-700', dot: 'bg-emerald-500' },
  BILL_CREATED:          { label: 'Bill Created',          category: 'finance',    bg: 'bg-rose-50',          text: 'text-rose-700',    dot: 'bg-rose-500'    },
  BILL_PAID:             { label: 'Bill Paid',             category: 'finance',    bg: 'bg-rose-50',          text: 'text-rose-600',    dot: 'bg-rose-400'    },
  PAYMENT_RECORDED:      { label: 'Payment Recorded',      category: 'finance',    bg: 'bg-green-50',         text: 'text-green-700',   dot: 'bg-green-500'   },

  // Reports
  REPORT_EXPORTED:       { label: 'Report Exported',       category: 'report',     bg: 'bg-sky-50',           text: 'text-sky-700',     dot: 'bg-sky-500'     },
};

const CATEGORY_LABELS: Record<ActionCategory, { label: string; icon: React.ElementType }> = {
  auth:       { label: 'Auth & Security', icon: Shield },
  project:    { label: 'Projects',        icon: FolderOpen },
  time:       { label: 'Time Entries',    icon: Clock },
  expense:    { label: 'Expenses',        icon: Receipt },
  budget:     { label: 'Budgets',         icon: Wallet },
  tool:       { label: 'Tools',           icon: Wrench },
  consumable: { label: 'Consumables',     icon: Package },
  finance:    { label: 'Finance AR/AP',   icon: Banknote },
  report:     { label: 'Reports',         icon: FileText },
};

const ENTITY_TYPES = [
  'USER', 'PROJECT', 'TIME_EVENT', 'TIME_RECORD', 'EXPENSE', 'BUDGET',
  'TOOL', 'CONSUMABLE', 'INVOICE', 'BILL', 'REPORT',
] as const;

function getActionDef(action: string): ActionDef {
  return ACTION_CATALOGUE[action] ?? {
    label: action,
    category: 'auth' as ActionCategory,
    bg: 'bg-[#FAFAFA]',
    text: 'text-[#71717A]',
    dot: 'bg-[#71717A]',
  };
}


// Derived stats


function computeStats(events: AuditEvent[], locale = 'en-US') {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recent = events.filter(e => new Date(e.createdAt) >= h24);
  return {
    events24h: recent.length,
    logins24h: recent.filter(e => e.action === 'LOGIN_SUCCESS').length,
    failures24h: events.filter(e => e.outcome === 'FAILURE').length,
    categories: new Set(events.map(e => getActionDef(e.action).category)).size,
    lastEvent: events[0] ? { action: events[0].action, time: formatTime(events[0].createdAt, locale) } : null,
  };
}

// Helpers

import { fmtDateTimeFull as formatDateTime, fmtTime as formatTime, startOfDayISO, endOfDayISO } from '../helpers/dateTime';

function formatJSONPretty(json: string | null): string {
  if (!json) return 'null';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// Pagination helpers

const PAGE_SIZES = [10, 20, 50] as const;

// ActionBadge

function ActionBadge({ action }: { action: string }) {
  const def = getActionDef(action);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${def.bg} ${def.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${def.dot}`} />
      {action}
    </span>
  );
}

// OutcomeBadge

function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  const { t } = useTranslation(['admin']);
  if (outcome === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
        <CheckCircle className="w-3 h-3" />
        {t('admin:audit.outcome.SUCCESS')}
      </span>
    );
  }
  if (outcome === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
        <AlertCircle className="w-3 h-3" />
        {t('admin:audit.outcome.WARNING')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700">
      <CircleX className="w-3 h-3" />
      {t('admin:audit.outcome.FAILURE')}
    </span>
  );
}

// CategoryBadge

function CategoryBadge({ category }: { category: ActionCategory }) {
  const { t } = useTranslation(['admin']);
  const cat = CATEGORY_LABELS[category];
  const Icon = cat.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]/60">
      <Icon className="w-3 h-3" />
      {t('admin:audit.category.' + category)}
    </span>
  );
}

// AuditStatCard

interface AuditStatCardProps {
  icon: React.ElementType;
  title: string;
  value: React.ReactNode;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  isLoading?: boolean;
  isError?: boolean;
  isDisabled?: boolean;
}

function AuditStatCard({
  icon: Icon, title, value, subtitle, iconBg, iconColor,
  isLoading = false, isError = false, isDisabled = false,
}: AuditStatCardProps) {
  const { t } = useTranslation(['admin']);
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-5 border border-[#D4D4D8]">
        <div className="flex items-start justify-between mb-4"><Skeleton className="h-10 w-10 rounded-lg" /></div>
        <Skeleton className="h-7 w-16 mb-2" />
        <Skeleton className="h-4 w-28 mb-1" />
        <Skeleton className="h-3 w-20 mt-1" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-white rounded-xl p-5 border border-[#D4D4D8]">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center opacity-40`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
        <p className="text-2xl font-bold text-[#D4D4D8] mb-1">—</p>
        <p className="text-sm text-[#0A0A0A]">{title}</p>
        <p className="text-xs text-red-500 mt-1">{t('admin:audit.unableToLoad')}</p>
      </div>
    );
  }
  if (isDisabled) {
    return (
      <div className="bg-white rounded-xl p-5 border border-dashed border-[#D4D4D8]">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center opacity-30`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
        <p className="text-2xl font-bold text-[#D4D4D8] mb-1">—</p>
        <p className="text-sm text-[#71717A]">{title}</p>
        <p className="text-xs text-[#D4D4D8] mt-1">{subtitle}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-[#D4D4D8] hover:border-[#F97316]/40 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#0A0A0A] mb-1 truncate">{value}</p>
      <p className="text-sm text-[#0A0A0A]">{title}</p>
      <p className="text-xs text-[#71717A] mt-0.5">{subtitle}</p>
    </div>
  );
}

// Filter Bar

const DEFAULT_FILTERS: AuditFilters = {
  dateFrom: '', dateTo: '',
  action: 'any', category: 'any',
  actorUserId: '', entityId: '',
  entityType: 'any', outcome: 'any',
};

interface AuditFilterBarProps {
  filters: AuditFilters;
  onChange: (f: AuditFilters) => void;
  onApply: () => void;
  onClear: () => void;
}

function AuditFilterBar({ filters, onChange, onApply, onClear }: AuditFilterBarProps) {
  const { t } = useTranslation(['admin']);
  const [expanded, setExpanded] = useState(false);

  function update(key: keyof AuditFilters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'action' || k === 'category' || k === 'entityType' || k === 'outcome') return v !== 'any';
    return v !== '';
  });

  // Actions for the selected category
  const filteredActions = useMemo(() => {
    if (filters.category === 'any') return Object.keys(ACTION_CATALOGUE);
    return Object.entries(ACTION_CATALOGUE)
      .filter(([, def]) => def.category === filters.category)
      .map(([key]) => key);
  }, [filters.category]);

  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] p-5">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4">
        <FilterIcon className="w-4 h-4 text-[#71717A]" />
        <span className="text-sm font-semibold text-[#0A0A0A]">{t('admin:audit.filters.title')}</span>
        {hasActiveFilters && (
          <span className="ml-1 px-1.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-medium rounded-full">
            {t('admin:audit.filters.active')}
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto text-xs text-[#F97316] hover:text-[#C2410C] font-medium"
        >
          {expanded ? t('admin:audit.filters.lessFilters') : t('admin:audit.filters.moreFilters')}
        </button>
      </div>

      {/* Primary row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Date From */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.from')}</label>
          <input
            type="date" value={filters.dateFrom}
            onChange={(e) => update('dateFrom', e.target.value)}
            className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
          />
        </div>
        {/* Date To */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.to')}</label>
          <input
            type="date" value={filters.dateTo}
            onChange={(e) => update('dateTo', e.target.value)}
            className="h-9 rounded-lg border border-[#D4D4D8] bg-white px-3 text-sm text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]/25 focus:border-[#F97316] transition-colors"
          />
        </div>
        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.category')}</label>
          <Select value={filters.category} onValueChange={(v) => { update('category', v); if (v !== 'any') onChange({ ...filters, category: v, action: 'any' }); }}>
            <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
              <SelectValue placeholder={t('admin:audit.filters.any')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('admin:audit.filters.allCategories')}</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as ActionCategory[]).map(cat => (
                <SelectItem key={cat} value={cat}>{t('admin:audit.category.' + cat)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Action */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.action')}</label>
          <Select value={filters.action} onValueChange={(v) => update('action', v)}>
            <SelectTrigger className="h-9 border-[#D4D4D8] text-sm font-mono">
              <SelectValue placeholder={t('admin:audit.filters.any')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('admin:audit.filters.any')}</SelectItem>
              {filteredActions.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Outcome */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.outcome')}</label>
          <Select value={filters.outcome} onValueChange={(v) => update('outcome', v)}>
            <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
              <SelectValue placeholder={t('admin:audit.filters.any')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('admin:audit.filters.any')}</SelectItem>
              <SelectItem value="SUCCESS">{t('admin:audit.outcome.SUCCESS')}</SelectItem>
              <SelectItem value="FAILURE">{t('admin:audit.outcome.FAILURE')}</SelectItem>
              <SelectItem value="WARNING">{t('admin:audit.outcome.WARNING')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Actor User ID */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.actorId')}</label>
          <Input type="text" placeholder="e.g. 1" value={filters.actorUserId}
            onChange={(e) => update('actorUserId', e.target.value)}
            maxLength={FIELD_LIMITS.SEARCH}
            className="h-9 border-[#D4D4D8] text-sm font-mono"
          />
        </div>
      </div>

      {/* Expanded row */}
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mt-3">
          {/* Entity Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.entityType')}</label>
            <Select value={filters.entityType} onValueChange={(v) => update('entityType', v)}>
              <SelectTrigger className="h-9 border-[#D4D4D8] text-sm">
                <SelectValue placeholder={t('admin:audit.filters.any')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('admin:audit.filters.any')}</SelectItem>
                {ENTITY_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Entity ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#71717A] uppercase tracking-wide">{t('admin:audit.filters.entityId')}</label>
            <Input type="text" placeholder="e.g. TL-112" value={filters.entityId}
              onChange={(e) => update('entityId', e.target.value)}
              maxLength={FIELD_LIMITS.SEARCH}
              className="h-9 border-[#D4D4D8] text-sm font-mono"
            />
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#71717A] flex-shrink-0" />
          <span className="text-xs text-[#71717A]">
            {t('admin:audit.filters.serverSideNote')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}
            className="h-8 px-3 text-xs text-[#71717A] hover:text-[#0A0A0A]">
            {t('admin:audit.filters.clear')}
          </Button>
          <Button size="sm" onClick={onApply}
            className="h-8 px-4 text-xs bg-[#F97316] hover:bg-[#C2410C] text-white">
            {t('admin:audit.filters.apply')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Skeleton Table Rows

function SkeletonTableRows() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, i) => (
        <TableRow key={i} className="border-b border-[#D4D4D8]/50">
          <TableCell><Skeleton className="h-3.5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-6 w-32 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-14" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-52" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-8" /></TableCell>
          <TableCell><Skeleton className="h-7 w-7 rounded-lg ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// API Disabled State

function ApiDisabledState({ onPreview }: { onPreview: () => void }) {
  const { t } = useTranslation(['admin']);
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      <div className="relative mb-8">
        <div className="w-28 h-28 bg-[#FAFAFA] rounded-full flex items-center justify-center border-2 border-dashed border-[#D4D4D8]">
          <Database className="w-12 h-12 text-[#D4D4D8]" />
        </div>
        <div className="absolute -top-2 -right-2 w-9 h-9 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center shadow-sm">
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="absolute -bottom-1 -left-2 w-8 h-8 bg-[#F97316]/10 border-2 border-[#F97316]/20 rounded-full flex items-center justify-center">
          <Shield className="w-4 h-4 text-[#F97316]" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-[#0A0A0A] mb-2">
        {t('admin:audit.apiDisabled.title')}
      </h3>
      <p className="text-sm text-[#71717A] text-center max-w-md mb-3 leading-relaxed">
        {t('admin:audit.apiDisabled.desc')}
      </p>

      {/* Categories being recorded */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <span className="text-xs text-[#71717A]">{t('admin:audit.apiDisabled.recording')}</span>
        {(Object.keys(CATEGORY_LABELS) as ActionCategory[]).map(cat => (
          <CategoryBadge key={cat} category={cat} />
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={onPreview}
        className="border-[#D4D4D8] text-[#71717A] hover:text-[#F97316] hover:border-[#F97316] text-xs gap-2">
        <Eye className="w-3.5 h-3.5" />
        {t('admin:audit.apiDisabled.previewMock')}
      </Button>
    </div>
  );
}

// Event Detail Drawer

interface EventDrawerProps {
  event: AuditEvent | null;
  open: boolean;
  onClose: () => void;
}

function EventDetailDrawer({ event, open, onClose }: EventDrawerProps) {
  const { t, i18n } = useTranslation(['admin']);
  const [copied, setCopied] = useState(false);

  const handleCopyJSON = useCallback(() => {
    if (!event?.metadata) return;
    navigator.clipboard
      .writeText(formatJSONPretty(event.metadata))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  }, [event]);

  if (!event) return null;

  const prettyJson = formatJSONPretty(event.metadata);
  const def = getActionDef(event.action);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col border-l border-[#D4D4D8] bg-white"
        style={{ maxWidth: '520px', width: '100%' }}
      >
        {/* Drawer header */}
        <SheetHeader className="px-6 py-5 border-b border-[#D4D4D8] bg-[#FAFAFA] flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-base font-semibold text-[#0A0A0A]">
                {t('admin:audit.drawer.title')}
              </SheetTitle>
              <SheetDescription className="text-xs text-[#71717A] mt-0.5">
                {t('admin:audit.drawer.auditId')}{' '}
                <span className="font-mono text-[#F97316]">#{event.id}</span>
                {event.correlationId && (
                  <span className="ml-2">
                    · CID <span className="font-mono text-[#71717A]">{event.correlationId.slice(0, 8)}</span>
                  </span>
                )}
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#D4D4D8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Action + outcome + category */}
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={event.action} />
            <OutcomeBadge outcome={event.outcome} />
            <CategoryBadge category={def.category} />
          </div>

          {/* Message */}
          {event.message && (
            <div className="bg-[#FAFAFA] rounded-lg px-4 py-3 border border-[#D4D4D8]/60">
              <p className="text-sm text-[#0A0A0A]">{event.message}</p>
            </div>
          )}

          {/* Fields grid */}
          <div className="space-y-0 divide-y divide-[#FAFAFA]">
            <DrawerField label={t('admin:audit.drawer.field.id')} value={String(event.id)} mono />
            <DrawerField label={t('admin:audit.drawer.field.time')} value={formatDateTime(event.createdAt, i18n.language)} />
            <DrawerField label={t('admin:audit.drawer.field.action')} value={event.action} mono />
            <DrawerField label={t('admin:audit.drawer.field.outcome')} value={event.outcome} mono />
            <DrawerField label={t('admin:audit.drawer.field.actor')} value={
              event.actorUsername
                ? `${event.actorUsername} (#${event.actorUserId})`
                : event.actorUserId != null ? `#${event.actorUserId}` : '—'
            } empty={!event.actorUserId && !event.actorUsername} />
            <DrawerField label={t('admin:audit.drawer.field.actorRole')} value={event.actorRole ?? '—'} empty={!event.actorRole} />
            <DrawerField label={t('admin:audit.drawer.field.entityType')} value={event.entityType ?? '—'} empty={!event.entityType} />
            <DrawerField label={t('admin:audit.drawer.field.entityId')} value={event.entityId ?? '—'} mono empty={!event.entityId} />
            <DrawerField label={t('admin:audit.drawer.field.ipAddress')} value={event.ipAddress ?? '—'} mono empty={!event.ipAddress} />
            <DrawerField label={t('admin:audit.drawer.field.correlationId')} value={event.correlationId ?? '—'} mono empty={!event.correlationId} />
          </div>

          {/* User Agent */}
          {event.userAgent && (
            <div>
              <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wide block mb-2">{t('admin:audit.drawer.userAgent')}</span>
              <p className="text-xs text-[#71717A] font-mono break-all bg-[#FAFAFA] px-3 py-2 rounded-lg border border-[#D4D4D8]/40">
                {event.userAgent}
              </p>
            </div>
          )}

          {/* Metadata JSON block */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#71717A] uppercase tracking-wide">
                {t('admin:audit.drawer.metadataJson')}
              </span>
              <button onClick={handleCopyJSON} disabled={!event.metadata}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  copied ? 'text-emerald-600 bg-emerald-50' : 'text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA]'
                } disabled:opacity-40 disabled:cursor-not-allowed`}>
                {copied ? (<><CheckCheck className="w-3.5 h-3.5" />{t('admin:audit.drawer.copied')}</>) : (<><Copy className="w-3.5 h-3.5" />{t('admin:audit.drawer.copyJson')}</>)}
              </button>
            </div>

            <div className="bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#0A0A0A]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/50" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/50" />
                </div>
                <span className="text-[11px] font-mono text-white/25">metadata.json</span>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto overflow-y-auto max-h-56 leading-relaxed whitespace-pre-wrap break-words">
                {prettyJson}
              </pre>
            </div>

            {!event.metadata && (
              <p className="text-xs text-[#71717A] mt-2 italic">
                {t('admin:audit.drawer.noMetadata')}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerField({
  label, value, mono = false, empty = false,
}: {
  label: string; value: string; mono?: boolean; empty?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <span className="text-xs text-[#71717A] w-28 flex-shrink-0 pt-0.5 font-medium">{label}</span>
      <span className={`text-sm break-all ${mono ? 'font-mono' : ''} ${empty ? 'text-[#D4D4D8]' : 'text-[#0A0A0A]'}`}>
        {value}
      </span>
    </div>
  );
}

// Demo State Toggle (Prototype)

const VIEW_STATE_LABELS: Record<ViewState, string> = {
  'api-disabled': 'API Disabled',
  loading: 'Loading',
  data: 'Data',
  empty: 'Empty',
  error: 'Error',
};

// Main AuditLog Component

export function AuditLog() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(DEFAULT_FILTERS);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Server-side data
  const [apiEvents, setApiEvents] = useState<AuditEvent[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(1);

  const isLoading = viewState === 'loading';
  const isError = viewState === 'error';

  // Map server DTO → component AuditEvent
  function mapDtoToEvent(dto: AuditLogDTO): AuditEvent {
    return {
      id: dto.id,
      actorUserId: dto.actorUserId,
      actorUsername: dto.actorUsername,
      actorRole: dto.actorRole,
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      outcome: dto.outcome as AuditOutcome,
      message: dto.message ?? '',
      metadata: dto.payloadJson,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      correlationId: dto.correlationId,
      createdAt: dto.occurredAt,
    };
  }

  // Fetch from API
  const fetchData = useCallback(async (currentFilters: AuditFilters, currentPage: number, currentSize: number) => {
    setViewState('loading');
    try {
      const params: Record<string, string | number | undefined> = {
        page: currentPage - 1, // backend is 0-based
        size: currentSize,
      };

      // Resolve category → comma-separated actions list for the backend
      if (currentFilters.action !== 'any') {
        // Specific action selected
        params.actions = currentFilters.action;
      } else if (currentFilters.category !== 'any') {
        // Category selected → send all actions in that category
        const categoryActions = Object.entries(ACTION_CATALOGUE)
          .filter(([, def]) => def.category === currentFilters.category)
          .map(([key]) => key);
        if (categoryActions.length > 0) {
          params.actions = categoryActions.join(',');
        }
      }
      if (currentFilters.actorUserId) params.actor = currentFilters.actorUserId;
      if (currentFilters.entityType !== 'any') params.entityType = currentFilters.entityType;
      if (currentFilters.entityId) params.entityId = currentFilters.entityId;
      if (currentFilters.outcome !== 'any') params.outcome = currentFilters.outcome;
      if (currentFilters.dateFrom) params.dateFrom = startOfDayISO(currentFilters.dateFrom);
      if (currentFilters.dateTo) params.dateTo = endOfDayISO(currentFilters.dateTo);

      const result: AuditLogsPage = await searchAuditLogs(params as any);
      const events = result.content.map(mapDtoToEvent);

      setApiEvents(events);
      setTotalElements(result.totalElements);
      setApiTotalPages(result.totalPages);
      setViewState(events.length === 0 ? 'empty' : 'data');
    } catch (err) {
      setViewState('error');
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData(appliedFilters, page, pageSize);
  }, [appliedFilters, page, pageSize]);

  const handleApplyFilters = () => { setAppliedFilters({ ...filters }); setPage(1); };
  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleViewEvent = (event: AuditEvent) => {
    setSelectedEvent(event);
    setIsDrawerOpen(true);
  };

  const handleRefresh = () => {
    fetchData(appliedFilters, page, pageSize);
  };

  const handleExportCsv = () => {
    if (apiEvents.length === 0) return;
    try {
      exportAuditCsv(apiEvents);
      toast.success(t('admin:audit.exportSuccess', 'Export started'));
    } catch { toast.error(t('admin:audit.exportError', 'Export failed')); }
  };

  const handleExportExcel = async () => {
    if (apiEvents.length === 0) return;
    try {
      await exportAuditExcel(apiEvents);
      toast.success(t('admin:audit.exportSuccess', 'Export started'));
    } catch { toast.error(t('admin:audit.exportError', 'Export failed')); }
  };

  // Pagination (server-side)
  const totalPages = Math.max(1, apiTotalPages);
  const pagedEvents = apiEvents;
  const totalCount = totalElements;

  const stats = useMemo(() => computeStats(apiEvents, i18n.language), [apiEvents, i18n.language]);

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0A0A0A]">{t('admin:audit.title')}</h2>
            <p className="text-sm text-[#71717A] mt-1">
              {t('admin:audit.securityTracking')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={pagedEvents.length === 0}
                  className="border-[#D4D4D8] text-[#0A0A0A] gap-2 hover:border-[#F97316] hover:text-[#F97316]">
                  <Download className="w-4 h-4" />{t('admin:audit.exportCsv')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={handleExportCsv} className="gap-2 text-sm cursor-pointer">
                  <FileText className="w-4 h-4 text-[#71717A]" />CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2 text-sm cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleRefresh}
              className="border-[#D4D4D8] text-[#0A0A0A] gap-2 hover:border-[#F97316] hover:text-[#F97316]">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />{t('common:buttons.refresh')}
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <AuditStatCard
            icon={Activity} title={t('admin:audit.events24h')} value={stats.events24h}
            subtitle={t('admin:audit.allEventTypes')} iconBg="bg-[#F97316]/10" iconColor="text-[#F97316]"
            isLoading={isLoading} isError={isError}
          />
          <AuditStatCard
            icon={LogIn} title={t('admin:audit.logins24h')} value={stats.logins24h}
            subtitle={t('admin:audit.loginSuccessEvents')} iconBg="bg-emerald-100" iconColor="text-emerald-600"
            isLoading={isLoading} isError={isError}
          />
          <AuditStatCard
            icon={CircleX} title={t('admin:audit.failuresAllTime')} value={stats.failures24h}
            subtitle={t('admin:audit.failureOutcomes')} iconBg="bg-red-100" iconColor="text-red-600"
            isLoading={isLoading} isError={isError}
          />
          <AuditStatCard
            icon={Shield} title={t('admin:audit.categoriesStat')} value={stats.categories}
            subtitle={t('admin:audit.activeCategoriesDesc')} iconBg="bg-purple-100" iconColor="text-purple-600"
            isLoading={isLoading} isError={isError}
          />
          <AuditStatCard
            icon={Clock} title={t('admin:audit.lastEventStat')} value={stats.lastEvent ? t('admin:audit.action.' + stats.lastEvent.action) : '—'}
            subtitle={stats.lastEvent?.time ?? '—'}
            iconBg="bg-amber-100" iconColor="text-amber-600"
            isLoading={isLoading} isError={isError}
          />
        </div>

        {/* Metrics note */}
        <p className="text-xs text-[#71717A] -mt-2 flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          {t('admin:audit.metricsNote', { count: totalCount })}
        </p>

        {/* Filter Bar */}
        <AuditFilterBar
          filters={filters} onChange={setFilters}
          onApply={handleApplyFilters} onClear={handleClearFilters}
        />

        {/* Table Area */}
        <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
          {/* Table toolbar */}
          <div className="px-6 py-4 border-b border-[#D4D4D8] flex items-center justify-between bg-white">
            <div>
              <h3 className="text-sm font-semibold text-[#0A0A0A]">{t('admin:audit.auditEvents')}</h3>
              {viewState === 'data' && (
                <p className="text-xs text-[#71717A] mt-0.5">
                  {t('admin:audit.eventsFound', { count: totalCount })}
                  {totalCount > pageSize && ` · ${t('admin:audit.pageOfPages', { page, total: totalPages })}`}
                </p>
              )}
            </div>
            {viewState === 'data' && (
              <div className="flex items-center gap-3 text-xs text-[#71717A]">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-7 w-20 border-[#D4D4D8] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map(s => (
                      <SelectItem key={s} value={String(s)}>{t('admin:audit.perPage', { count: s })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* API Disabled state removed — now always loads from API */}

          {/* Error */}
          {isError && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-900">{t('admin:audit.errorTitle')}</p>
                    <p className="text-xs text-red-600 mt-0.5">{t('admin:audit.errorDesc')}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchData(appliedFilters, page, pageSize)}
                  className="gap-2 border-red-200 text-red-700 hover:bg-red-50 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />{t('common:buttons.retry')}
                </Button>
              </div>
            </div>
          )}

          {/* Table (Loading / Empty / Data) */}
          {(isLoading || viewState === 'empty' || viewState === 'data') && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAFAFA] border-b border-[#D4D4D8] hover:bg-[#FAFAFA]">
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-44">{t('admin:audit.table.time')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3">{t('admin:audit.table.action')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-20">{t('admin:audit.table.outcome')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-28">{t('admin:audit.table.actor')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-28">{t('admin:audit.table.resource')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3">{t('admin:audit.table.message')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-16">{t('admin:audit.table.id')}</TableHead>
                    <TableHead className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider py-3 w-14 text-right pr-6">{t('admin:audit.table.view')}</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading && <SkeletonTableRows />}

                  {viewState === 'empty' && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                            <FileText className="w-7 h-7 text-[#D4D4D8]" />
                          </div>
                          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:audit.emptyTitle')}</p>
                          <p className="text-xs text-[#71717A]">{t('admin:audit.emptyDesc')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {viewState === 'data' && pagedEvents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-12 h-12 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
                            <FilterIcon className="w-6 h-6 text-[#D4D4D8]" />
                          </div>
                          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('admin:audit.noMatchTitle')}</p>
                          <p className="text-xs text-[#71717A]">{t('admin:audit.noMatchDesc')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {viewState === 'data' && pagedEvents.map((event) => (
                    <TableRow key={event.id} className="border-b border-[#D4D4D8]/40 hover:bg-[#FAFAFA] transition-colors">
                      {/* Time */}
                      <TableCell className="py-3.5">
                        <span className="font-mono text-xs text-[#71717A] whitespace-nowrap">
                          {formatDateTime(event.createdAt, i18n.language)}
                        </span>
                      </TableCell>
                      {/* Action */}
                      <TableCell className="py-3.5">
                        <ActionBadge action={event.action} />
                      </TableCell>
                      {/* Outcome */}
                      <TableCell className="py-3.5">
                        <OutcomeBadge outcome={event.outcome} />
                      </TableCell>
                      {/* Actor */}
                      <TableCell className="py-3.5">
                        {event.actorUsername ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-[#0A0A0A]">{event.actorUsername}</span>
                            <span className="text-[10px] text-[#71717A] font-mono">ID: {event.actorUserId}</span>
                          </div>
                        ) : event.actorUserId != null ? (
                          <span className="font-mono text-sm text-[#0A0A0A]">#{event.actorUserId}</span>
                        ) : (
                          <span className="text-[#D4D4D8] text-sm">—</span>
                        )}
                      </TableCell>
                      {/* Resource */}
                      <TableCell className="py-3.5">
                        {event.entityType ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-[#0A0A0A]">{event.entityType}</span>
                            {event.entityId && (
                              <span className="text-[10px] text-[#71717A] font-mono">{event.entityId}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#D4D4D8] text-sm">—</span>
                        )}
                      </TableCell>
                      {/* Message */}
                      <TableCell className="py-3.5 max-w-xs">
                        <span className="text-xs text-[#71717A] block truncate max-w-[300px]">
                          {event.message || '—'}
                        </span>
                      </TableCell>
                      {/* ID */}
                      <TableCell className="py-3.5">
                        <span className="font-mono text-xs text-[#D4D4D8]">#{event.id}</span>
                      </TableCell>
                      {/* View */}
                      <TableCell className="py-3.5 pr-5 text-right">
                        <button onClick={() => handleViewEvent(event)} title="View event detail"
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#F97316] hover:bg-[#F97316]/10 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {viewState === 'data' && totalCount > pageSize && (
            <div className="px-6 py-3.5 border-t border-[#D4D4D8] flex items-center justify-between bg-[#FAFAFA]/50">
              <p className="text-xs text-[#71717A]">
                {t('admin:audit.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount), total: totalCount })}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-white hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-white hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .flatMap((p, i, arr) => {
                    const items: React.ReactNode[] = [];
                    if (i > 0 && p - arr[i - 1] > 1) {
                      items.push(
                        <span key={`ellipsis-${p}`} className="w-8 h-8 flex items-center justify-center text-xs text-[#D4D4D8]">…</span>
                      );
                    }
                    items.push(
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          page === p ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-white hover:text-[#0A0A0A]'
                        }`}>
                        {p}
                      </button>
                    );
                    return items;
                  })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-white hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:bg-white hover:text-[#0A0A0A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Drawer */}
      <EventDetailDrawer
        event={selectedEvent}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
