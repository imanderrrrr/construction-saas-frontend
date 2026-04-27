// Shared task history timeline panel (used by both admin KanbanBoard and SupervisorTaskBoard)
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, AlertCircle, Clock } from 'lucide-react';
import { type TaskStatusHistoryEntry, type TaskStatus, TASK_STATUS_LABELS } from '../services/tasks';

// ── Status pill ──────────────────────────────────────

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO:        'bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]',
  IN_PROGRESS: 'bg-blue-50 text-[#F97316] border border-blue-200',
  REVIEW:      'bg-amber-50 text-amber-700 border border-amber-200',
  DONE:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
};

const STATUS_DOT: Record<TaskStatus, string> = {
  TODO:        'bg-[#71717A]',
  IN_PROGRESS: 'bg-[#F97316]',
  REVIEW:      'bg-amber-500',
  DONE:        'bg-emerald-500',
};

function StatusPill({ status, lang }: { status: TaskStatus; lang: string }) {
  const label = TASK_STATUS_LABELS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
      {lang === 'es' ? label.es : label.en}
    </span>
  );
}

// ── Timeline entry ───────────────────────────────────

function HistoryRow({ entry, isLast, lang }: { entry: TaskStatusHistoryEntry; isLast: boolean; lang: string }) {
  const { t } = useTranslation('admin');
  const isCreated = entry.fromStatus === null;
  const displayName = entry.movedByFullName || entry.movedByUsername;

  const dateStr = new Date(entry.movedAt).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
          isCreated ? 'bg-emerald-500' :
          entry.toStatus === 'DONE' ? 'bg-emerald-500' : STATUS_DOT[entry.toStatus as TaskStatus]
        }`} />
        {!isLast && <div className="w-px flex-1 bg-[#D4D4D8] my-1" />}
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {isCreated ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              {t('taskHistory.created')}
            </span>
          ) : (
            <>
              <StatusPill status={entry.fromStatus as TaskStatus} lang={lang} />
              <span className="text-[10px] text-[#71717A]">→</span>
              <StatusPill status={entry.toStatus as TaskStatus} lang={lang} />
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Avatar placeholder */}
          <div className="w-5 h-5 rounded-full bg-[#F97316]/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[9px] font-bold text-[#F97316]">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs font-semibold text-[#0A0A0A]">{displayName}</span>
          <span className="text-[10px] text-[#71717A] font-mono">@{entry.movedByUsername}</span>
        </div>

        <div className="flex items-center gap-1 mt-1">
          <Clock className="w-2.5 h-2.5 text-[#71717A]" />
          <span className="text-[11px] text-[#71717A]">{dateStr}</span>
        </div>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────

export function TaskHistoryPanel({
  taskId,
  taskTitle,
  open,
  onClose,
  fetchHistory,
}: {
  taskId: number;
  taskTitle: string;
  open: boolean;
  onClose: () => void;
  fetchHistory: (id: number) => Promise<TaskStatusHistoryEntry[]>;
}) {
  const { t, i18n } = useTranslation('admin');
  const lang = i18n.language;

  const [entries, setEntries] = useState<TaskStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistory(taskId)
      .then(data => { if (!cancelled) setEntries(data); })
      .catch(() => { if (!cancelled) setError(t('taskHistory.loadError')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, taskId, fetchHistory]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col border-l border-[#D4D4D8]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-4 border-b border-[#D4D4D8]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#F97316]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-[#F97316]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0A0A0A]">{t('taskHistory.title')}</p>
              <p className="text-[11px] text-[#71717A] truncate">"{taskTitle}"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#71717A] hover:text-[#0A0A0A] hover:bg-[#FAFAFA] border border-[#D4D4D8] flex-shrink-0 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-red-200 bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 bg-[#FAFAFA] rounded-xl flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-[#D4D4D8]" />
              </div>
              <p className="text-xs text-[#71717A]">{t('taskHistory.empty')}</p>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  isLast={i === entries.length - 1}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
