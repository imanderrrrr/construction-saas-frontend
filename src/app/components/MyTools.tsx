import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, Clock, Info, Loader2, AlertTriangle } from 'lucide-react';
import { StatCard } from './StatCard';
import { getWorkerTools, type AssignmentResponse } from '../services/warehouse';

// ── Helpers ──────────────────────────────────────────

function fmtDate(iso: string, lng: string) {
  const locale = lng === 'es' ? 'es-GT' : 'en-US';
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  ASSIGNED:   { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  IN_REVIEW:  { dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  DAMAGED:    { dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
  AVAILABLE:  { dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  LOST:       { dot: 'bg-gray-500',    bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200'    },
};

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

// ── Tool Card ────────────────────────────────────────

function ToolCard({ tool }: { tool: AssignmentResponse }) {
  const { t, i18n } = useTranslation('worker');
  const s = getStatusStyle(tool.status);
  const statusLabel = t(`tools.status.${tool.status}`, { defaultValue: tool.status });

  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] p-4 hover:border-emerald-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-mono text-[#71717A]">{tool.toolCode}</p>
          <p className="text-sm font-semibold text-[#0A0A0A] mt-0.5">{tool.toolName}</p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap flex-shrink-0">
          {tool.category}
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('tools.assigned')}</p>
          <p className="text-xs text-[#0A0A0A] font-medium">{fmtDate(tool.assignedDate, i18n.language)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('tools.project')}</p>
          <p className="text-xs text-[#0A0A0A] font-medium truncate">{tool.project}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('tools.daysHeld')}</p>
          <p className={`text-xs font-semibold ${tool.daysOut >= 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {t('tools.day', { count: tool.daysOut })}
          </p>
        </div>
      </div>

      {/* Footer badges */}
      <div className="flex items-center justify-between pt-3 border-t border-[#D4D4D8]/60">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text} border ${s.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{statusLabel}
        </span>
        <p className="text-[10px] text-[#71717A] italic">{t('tools.contactWarehouse')}</p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────

export function MyTools() {
  const { t } = useTranslation('worker');
  const [tools, setTools] = useState<AssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTools() {
      try {
        const data = await getWorkerTools();
        if (!cancelled) {
          setTools(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tools');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTools();
    return () => { cancelled = true; };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.subtitle')}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#D4D4D8] flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#71717A] animate-spin" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.subtitle')}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('tools.unableToLoad')}</p>
          <p className="text-xs text-[#71717A]">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (tools.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.title')}</h2>
          <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.subtitle')}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <Wrench className="w-7 h-7 text-[#D4D4D8]" />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('tools.noToolsAssigned')}</p>
          <p className="text-xs text-[#71717A]">{t('tools.noToolsHint')}</p>
        </div>
      </div>
    );
  }

  // Data
  const totalAssigned = tools.length;
  const longestHeld = Math.max(...tools.map(t => t.daysOut));

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{t('tools.title')}</h2>
        <p className="text-[11px] text-[#71717A] mt-0.5">{t('tools.subtitle')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Wrench} title={t('tools.toolsAssigned')} value={totalAssigned.toString()}
          subtitle={t('tools.currentlyWithYou')} iconBgColor="bg-emerald-50" iconColor="text-emerald-600"
        />
        <StatCard
          icon={Clock} title={t('tools.longestHeld')} value={t('tools.day', { count: longestHeld })}
          subtitle={t('tools.daysSinceAssignment')} iconBgColor="bg-amber-50" iconColor="text-amber-600"
        />
      </div>

      {/* Tool cards */}
      <div className="grid grid-cols-1 gap-4">
        {tools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {/* Info panel */}
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800">
          {t('tools.infoMessage')}{' '}
          <span className="font-semibold">{t('tools.warehouseStaff')}</span>.
        </p>
      </div>
    </div>
  );
}
