// SupervisorProjects.tsx — Supervisor's assigned projects with operational detail
// Connected to GET /api/v1/supervisor/dashboard/projects

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FolderKanban, Users, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getSupervisorProjects, type SupervisorProjectDetail } from '../services/time';

// Helpers

const AVATAR_COLORS = [
  'bg-[#F97316]', 'bg-emerald-600', 'bg-amber-600',
  'bg-purple-600', 'bg-rose-600', 'bg-teal-600', 'bg-slate-500', 'bg-indigo-600',
];

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(iso: string | null, t: TFunction): string {
  if (!iso) return t('projects.noActivity');
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMin < 1) return t('dash.justNow');
  if (diffMin < 60) return t('dash.minAgo', { count: diffMin });
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return t('dash.hrsAgo', { hrs });
  const days = Math.floor(hrs / 24);
  return t('projects.daysAgo', { count: days });
}

// Sub-components

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('supervisor');
  if (status === 'ACTIVE')   return <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-50 text-emerald-700">{t('dash.statusActive')}</span>;
  if (status === 'CLOSED')   return <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">{t('dash.statusClosed')}</span>;
  return <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-50 text-amber-700">{t('dash.statusInactive')}</span>;
}

// Project Card

function ProjectCard({ project }: { project: SupervisorProjectDetail }) {
  const { t } = useTranslation('supervisor');
  const isCompleted = project.status === 'CLOSED';
  const maxVisible = 5;
  const visible = project.assignedUsers.slice(0, maxVisible);
  const extra = project.assignedUsers.length > maxVisible ? project.assignedUsers.length - maxVisible : 0;

  return (
    <div className={`rounded-xl border border-[#D4D4D8] bg-white p-4 sm:p-6 hover:shadow-md transition-shadow overflow-hidden ${isCompleted ? 'opacity-75' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1 gap-2">
        <h3 className="text-base sm:text-lg font-semibold text-[#0A0A0A] truncate">{project.name}</h3>
      </div>
      <div className="mb-4">
        <StatusBadge status={project.status} />
      </div>

      {/* Mini-stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
        {/* Hours */}
        <div className="bg-[#FAFAFA] rounded-lg p-2.5 sm:p-3 overflow-hidden">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#71717A] flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] text-[#71717A] font-medium uppercase tracking-wider truncate">{t('projects.hoursThisWeek')}</span>
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mt-1">{t('projects.hrs', { count: project.hoursThisWeek })}</p>
          <p className="text-[10px] sm:text-[11px] text-[#71717A] mt-0.5 truncate">
            {t('projects.approved', { count: project.approvedRecordsThisWeek })}
            {project.pendingRecordsThisWeek > 0 && <span className="text-amber-600"> · {t('projects.pending', { count: project.pendingRecordsThisWeek })}</span>}
          </p>
        </div>

        {/* Team */}
        <div className="bg-[#FAFAFA] rounded-lg p-2.5 sm:p-3 overflow-hidden">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#71717A] flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] text-[#71717A] font-medium uppercase tracking-wider truncate">{t('projects.team')}</span>
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mt-1">{t('dash.members', { count: project.teamTotal })}</p>
          <p className="text-[10px] sm:text-[11px] text-[#71717A] mt-0.5 truncate">{t('projects.activeToday', { count: project.teamActiveToday })}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-[#D4D4D8]">
        <div className="flex -space-x-2 flex-shrink-0">
          {visible.map((u, i) => (
            <div
              key={u.id}
              title={u.fullName ?? undefined}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
            >
              {initials(u.fullName)}
            </div>
          ))}
          {extra > 0 && (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-200 text-slate-600 text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              +{extra}
            </div>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-[#71717A] truncate">{t('projects.lastActivity', { time: relativeTime(project.lastActivityAt, t) })}</span>
      </div>
    </div>
  );
}

// Skeleton Card

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#D4D4D8] bg-white p-6 animate-pulse">
      <div className="h-5 w-48 bg-slate-100 rounded mb-3" />
      <div className="h-5 w-16 bg-slate-100 rounded mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#FAFAFA] rounded-lg p-3 col-span-2 h-20" />
        <div className="bg-[#FAFAFA] rounded-lg p-3 h-16" />
        <div className="bg-[#FAFAFA] rounded-lg p-3 h-16" />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-[#D4D4D8]">
        <div className="flex -space-x-2">
          {[1, 2, 3].map(i => <div key={i} className="w-7 h-7 rounded-full bg-slate-200 ring-2 ring-white" />)}
        </div>
        <div className="h-3 w-24 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// Main component

export function SupervisorProjects() {
  const { t } = useTranslation(['supervisor', 'common']);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projects, setProjects] = useState<SupervisorProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupervisorProjects()
      .then(setProjects)
      .catch(() => { /* degrade gracefully */ })
      .finally(() => setLoading(false));
  }, []);

  const filteredProjects = projects.filter(p =>
    statusFilter === 'all' || p.status.toLowerCase() === statusFilter
  );

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#0A0A0A]">{t('projects.title')}</h2>
          <p className="text-sm text-[#71717A]">{t('projects.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-[#F97316]/10 text-[#F97316] px-2.5 py-1 rounded-full font-medium">
            {t('projects.count', { count: projects.length })}
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 border-[#D4D4D8] text-sm w-[140px]">
              <SelectValue placeholder={t('common:labels.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common:labels.all')}</SelectItem>
              <SelectItem value="active">{t('dash.statusActive')}</SelectItem>
              <SelectItem value="closed">{t('dash.statusClosed')}</SelectItem>
              <SelectItem value="inactive">{t('dash.statusInactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid, loading, or empty state */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderKanban className="w-16 h-16 text-[#D4D4D8] mx-auto mb-4" />
          <p className="text-base font-medium text-[#71717A]">{t('projects.empty.title')}</p>
          <p className="text-sm text-[#D4D4D8] mt-1">{t('projects.empty.desc')}</p>
        </div>
      )}
    </div>
  );
}
