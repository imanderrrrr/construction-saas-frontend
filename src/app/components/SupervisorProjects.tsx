import { useScreenState } from '../workspace/WorkspaceState';
// SupervisorProjects.tsx — Supervisor's assigned projects with operational detail
// Connected to GET /api/v1/supervisor/dashboard/projects

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { FolderKanban, Users, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getSupervisorProjects, type SupervisorProjectDetail } from '../services/time';
import { SectionHeader } from './workspace/SectionChrome';
import { StatusBadge as ProjectStatusBadge, initialsOf } from './projects/badges';
import { EmptyWord } from './projects/bt';
import { SecondaryButton } from './onboarding/chrome';

// Helpers

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
  return <ProjectStatusBadge status={status === 'ACTIVE' || status === 'CLOSED' ? status : 'INACTIVE'} />;
}

// Project Card

function ProjectCard({ project }: { project: SupervisorProjectDetail }) {
  const { t } = useTranslation('supervisor');
  const isCompleted = project.status === 'CLOSED';
  const maxVisible = 5;
  const visible = project.assignedUsers.slice(0, maxVisible);
  const extra = project.assignedUsers.length > maxVisible ? project.assignedUsers.length - maxVisible : 0;

  return (
    <div className={`border border-[#DBD0BB] bg-white p-4 sm:p-6 hover:border-[#F97316] transition-colors overflow-hidden ${isCompleted ? 'opacity-75' : ''}`}>
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
        <div className="bg-[#FAF7F0] p-2.5 sm:p-3 overflow-hidden">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8A8175] flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] text-[#8A8175] font-medium uppercase tracking-wider truncate">{t('projects.hoursThisWeek')}</span>
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mt-1">{t('projects.hrs', { count: project.hoursThisWeek })}</p>
          <p className="text-[10px] sm:text-[11px] text-[#8A8175] mt-0.5 truncate">
            {t('projects.approved', { count: project.approvedRecordsThisWeek })}
            {project.pendingRecordsThisWeek > 0 && <span className="text-amber-600"> · {t('projects.pending', { count: project.pendingRecordsThisWeek })}</span>}
          </p>
        </div>

        {/* Team */}
        <div className="bg-[#FAF7F0] p-2.5 sm:p-3 overflow-hidden">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8A8175] flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] text-[#8A8175] font-medium uppercase tracking-wider truncate">{t('projects.team')}</span>
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mt-1">{t('dash.members', { count: project.teamTotal })}</p>
          <p className="text-[10px] sm:text-[11px] text-[#8A8175] mt-0.5 truncate">{t('projects.activeToday', { count: project.teamActiveToday })}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-[#DBD0BB]">
        <div className="flex gap-1 flex-shrink-0">
          {visible.map(u => (
            <div
              key={u.id}
              title={u.fullName ?? undefined}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-none text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-white bg-[#0A0A0A]`}
            >
              {initialsOf(u.fullName ?? '?')}
            </div>
          ))}
          {extra > 0 && (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-none bg-[#DBD0BB] text-[#5A5346] text-[9px] sm:text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              +{extra}
            </div>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-[#8A8175] truncate">{t('projects.lastActivity', { time: relativeTime(project.lastActivityAt, t) })}</span>
      </div>
    </div>
  );
}

// Skeleton Card

function SkeletonCard() {
  return (
    <div className="border border-[#DBD0BB] bg-white p-6 animate-pulse">
      <div className="h-5 w-48 bg-[#EEE7DA] rounded mb-3" />
      <div className="h-5 w-16 bg-[#EEE7DA] rounded mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#FAF7F0] p-3 col-span-2 h-20" />
        <div className="bg-[#FAF7F0] p-3 h-16" />
        <div className="bg-[#FAF7F0] p-3 h-16" />
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-[#DBD0BB]">
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="w-7 h-7 rounded-none bg-[#DBD0BB] ring-2 ring-white" />)}
        </div>
        <div className="h-3 w-24 bg-[#EEE7DA] rounded" />
      </div>
    </div>
  );
}

// Main component

export function SupervisorProjects() {
  const { t } = useTranslation(['supervisor', 'common']);
  const [statusFilter, setStatusFilter] = useScreenState<string>('estado', 'all');
  const [projects, setProjects] = useState<SupervisorProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    getSupervisorProjects()
      .then(setProjects)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [reload]);

  const filteredProjects = projects.filter(p =>
    statusFilter === 'all' || p.status.toLowerCase() === statusFilter
  );

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <SectionHeader kicker={t('panelLabel')} title={t('projects.title')} description={t('projects.subtitle')} action={<div className="flex items-center gap-3">
          <span className="text-xs bg-[#F97316]/10 text-[#F97316] px-2.5 py-1 rounded-none font-medium">
            {t('projects.count', { count: projects.length })}
          </span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-none h-9 border-[#DBD0BB] text-sm w-[140px]">
              <SelectValue placeholder={t('common:labels.all')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common:labels.all')}</SelectItem>
              <SelectItem value="active">{t('dash.statusActive')}</SelectItem>
              <SelectItem value="closed">{t('dash.statusClosed')}</SelectItem>
              <SelectItem value="inactive">{t('dash.statusInactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>} />

      {/* Grid, loading, or empty state */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? <EmptyWord word={t('common:stat.unableToLoad')} title={t('common:error.generic')}
        action={<SecondaryButton onClick={() => { setLoading(true); setError(false); setReload(n => n + 1); }}>{t('common:buttons.retry')}</SecondaryButton>} /> : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <FolderKanban className="w-16 h-16 text-[#DBD0BB] mx-auto mb-4" />
          <p className="text-base font-medium text-[#8A8175]">{t('projects.empty.title')}</p>
          <p className="text-sm text-[#DBD0BB] mt-1">{t('projects.empty.desc')}</p>
        </div>
      )}
    </div>
  );
}
