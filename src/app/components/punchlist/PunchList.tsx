// BuildTrack — Internal punch-list view (fase 2 del portal de cliente).
// Shared by the admin project-details card and the supervisor section: list
// with status filters, assignment, "marcar listo" with evidence photos,
// return-to-progress, internal close (D3 rules) and the event timeline.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera, CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText,
  History, Loader2, MapPin, MessageSquare, Plus, Send, Undo2,
  User as UserIcon, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addPunchItemComment,
  assignPunchItem,
  closePunchItem,
  createPunchItem,
  getPunchItem,
  listPunchItemComments,
  listPunchItems,
  markPunchItemReady,
  MAX_INTERNAL_PHOTO_BYTES,
  MAX_INTERNAL_PHOTOS,
  punchItemPhotoUrl,
  returnPunchItemToProgress,
  type PunchItem,
  type PunchItemComment,
  type PunchItemStatus,
} from '../../services/punchItems';
import { exportPunchListCsv, exportPunchListPdf, type PunchListExportLabels } from '../../helpers/exportPunchList';
import { AuthImage } from '../sitelog/AuthImage';
import { Lightbox, type LightboxImage } from '../sitelog/Lightbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';

/** One assignable field user (WORKER / SUPERVISOR / SUBCONTRACTOR). */
export interface PunchAssignee {
  id: number;
  name: string;
}

export interface PunchProject {
  id: number;
  name: string;
  assignees: PunchAssignee[];
}

const STATUS_FILTERS: (PunchItemStatus | 'ALL')[] = [
  'ALL', 'OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'REOPENED', 'CLOSED',
];

const STATUS_STYLES: Record<PunchItemStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  READY_FOR_REVIEW: 'bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/30',
  REOPENED: 'bg-red-50 text-red-700 border-red-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function PunchList({ projects }: { projects: PunchProject[] }) {
  const { t, i18n } = useTranslation(['punchList']);

  const [projectId, setProjectId] = useState<number | null>(projects[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<PunchItemStatus | 'ALL'>('ALL');
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, PunchItem | 'loading' | 'error'>>({});
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const project = projects.find((p) => p.id === projectId) ?? null;

  useEffect(() => {
    if (projectId == null && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const load = useCallback(async () => {
    if (projectId == null) return;
    setLoading(true);
    setLoadError(false);
    try {
      const list = await listPunchItems(
        projectId,
        statusFilter === 'ALL' ? {} : { status: statusFilter },
      );
      setItems(list);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', year: 'numeric' },
    );

  const replaceItem = (updated: PunchItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...updated, events: it.events } : it)));
    setExpanded((prev) => (prev[updated.id] && prev[updated.id] !== 'loading' && prev[updated.id] !== 'error'
      ? { ...prev, [updated.id]: updated }
      : prev));
  };

  const toggleTimeline = async (item: PunchItem) => {
    if (expanded[item.id]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    setExpanded((prev) => ({ ...prev, [item.id]: 'loading' }));
    try {
      const detail = await getPunchItem(item.id);
      setExpanded((prev) => ({ ...prev, [item.id]: detail }));
    } catch {
      setExpanded((prev) => ({ ...prev, [item.id]: 'error' }));
    }
  };

  const openLightbox = (item: PunchItem, photoId: number) => {
    const images: LightboxImage[] = item.photos.map((p) => ({
      id: p.id,
      url: punchItemPhotoUrl(item.id, p.id),
      alt: item.title,
      caption: p.fileName,
      downloadName: p.fileName ?? `punch-${item.id}-${p.id}`,
    }));
    const index = Math.max(0, images.findIndex((img) => img.id === photoId));
    setLightbox({ images, index });
  };

  // Export of the CURRENTLY FILTERED list (fase 3) — labels pre-translated
  // so the file matches the user's language.
  const exportLabels = (): PunchListExportLabels => ({
    docTitle: t('internal.title'),
    filterLine: [
      project?.name ?? '',
      statusFilter === 'ALL' ? t('internal.filter.all') : t(`status.${statusFilter}`),
      t('internal.export.count', { count: items.length }),
    ].filter(Boolean).join(' · '),
    columns: {
      number: t('internal.export.col.number'),
      title: t('internal.export.col.title'),
      status: t('internal.export.col.status'),
      origin: t('internal.export.col.origin'),
      assignee: t('internal.export.col.assignee'),
      location: t('internal.export.col.location'),
      createdAt: t('internal.export.col.createdAt'),
      readyAt: t('internal.export.col.readyAt'),
      closedAt: t('internal.export.col.closedAt'),
      resolution: t('internal.export.col.resolution'),
    },
    status: {
      OPEN: t('status.OPEN'),
      IN_PROGRESS: t('status.IN_PROGRESS'),
      READY_FOR_REVIEW: t('status.READY_FOR_REVIEW'),
      REOPENED: t('status.REOPENED'),
      CLOSED: t('status.CLOSED'),
    },
    origin: {
      CLIENT: t('internal.origin.CLIENT'),
      INTERNAL: t('internal.origin.INTERNAL'),
    },
  });

  const runExport = (kind: 'csv' | 'pdf') => {
    if (!project || items.length === 0) {
      toast.error(t('internal.export.empty'));
      return;
    }
    try {
      const params = { items, projectName: project.name, labels: exportLabels() };
      if (kind === 'csv') exportPunchListCsv(params);
      else exportPunchListPdf(params);
      toast.success(t('internal.export.started'));
    } catch {
      toast.error(t('internal.export.failed'));
    }
  };

  if (projects.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A] inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#F97316]" />
            {t('internal.title')}
          </h3>
          <p className="text-xs text-[#71717A] mt-0.5">{t('internal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <select
              aria-label={t('internal.project')}
              value={projectId ?? ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="h-8 rounded-lg border border-[#D4D4D8] bg-white px-2 text-xs font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 px-3 rounded-lg border border-[#D4D4D8] bg-white text-xs font-medium text-[#0A0A0A] hover:text-[#F97316] inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {t('internal.export')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => runExport('pdf')} className="gap-2 text-sm cursor-pointer">
                <FileText className="w-4 h-4 text-[#71717A]" />
                {t('internal.export.pdf')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport('csv')} className="gap-2 text-sm cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 text-[#71717A]" />
                {t('internal.export.csv')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="h-8 px-3 rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('internal.new')}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Create form */}
        {createOpen && project && (
          <InternalCreateForm
            project={project}
            onCreated={(item) => {
              setCreateOpen(false);
              setItems((prev) => [item, ...prev]);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        )}

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('internal.filter.all')}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf}
              type="button"
              onClick={() => setStatusFilter(sf)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${
                statusFilter === sf
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#71717A] border-[#D4D4D8] hover:border-[#0A0A0A]'
              }`}
            >
              {sf === 'ALL' ? t('internal.filter.all') : t(`status.${sf}`)}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 p-4 text-center">
            <p className="text-sm text-red-700 mb-2">{t('internal.loadFailed')}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="h-8 px-3 rounded-lg border border-[#D4D4D8] text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA]"
            >
              {t('internal.retry')}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          </div>
        )}

        {!loading && !loadError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <ClipboardList className="w-5 h-5 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{t('internal.empty.title')}</p>
            <p className="text-xs text-[#71717A] mt-1">{t('internal.empty.subtitle')}</p>
          </div>
        )}

        {!loading && items.map((item) => (
          <PunchItemCard
            key={item.id}
            item={item}
            assignees={project?.assignees ?? []}
            detail={expanded[item.id]}
            fmtDate={fmtDate}
            onChanged={replaceItem}
            onToggleTimeline={() => void toggleTimeline(item)}
            onOpenPhoto={(photoId) => openLightbox(item, photoId)}
          />
        ))}
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
          labels={{
            download: t('clientView:lightbox.download'),
            prev: t('clientView:lightbox.prev'),
            next: t('clientView:lightbox.next'),
            close: t('clientView:lightbox.close'),
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────── item card ────────────────────────────

function PunchItemCard({ item, assignees, detail, fmtDate, onChanged, onToggleTimeline, onOpenPhoto }: {
  item: PunchItem;
  assignees: PunchAssignee[];
  detail: PunchItem | 'loading' | 'error' | undefined;
  fmtDate: (iso: string) => string;
  onChanged: (item: PunchItem) => void;
  onToggleTimeline: () => void;
  onOpenPhoto: (photoId: number) => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [busy, setBusy] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [thread, setThread] = useState<PunchItemComment[] | 'loading' | 'error' | null>(null);

  const commentCount = Array.isArray(thread) ? thread.length : item.commentCount;

  const toggleThread = async () => {
    if (thread) {
      setThread(null);
      return;
    }
    setThread('loading');
    try {
      setThread(await listPunchItemComments(item.id));
    } catch {
      setThread('error');
    }
  };

  const act = async (action: () => Promise<PunchItem>, successKey: string) => {
    setBusy(true);
    try {
      onChanged(await action());
      toast.success(t(successKey));
    } catch {
      toast.error(t('internal.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const open = item.status !== 'CLOSED';
  const canReady = open && item.status !== 'READY_FOR_REVIEW';
  const reportPhotos = item.photos.filter((p) => p.kind === 'REPORT');
  const evidencePhotos = item.photos.filter((p) => p.kind === 'EVIDENCE');

  return (
    <article className="rounded-lg border border-[#D4D4D8] overflow-hidden">
      <header className="px-4 py-3 bg-[#FAFAFA]/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[#F97316] tabular-nums">{item.displayNumber}</span>
          <h4 className="text-sm font-semibold text-[#0A0A0A]">{item.title}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[item.status]}`}>
            {t(`status.${item.status}`)}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-white text-[#71717A] border-[#D4D4D8]">
            {t(`internal.origin.${item.origin}`)}
          </span>
          {item.reopenCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
              {t('internal.reopens', { count: item.reopenCount })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void toggleThread()}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#71717A] hover:bg-white inline-flex items-center gap-1.5 border border-transparent hover:border-[#D4D4D8] transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {t('internal.comments.toggle', { count: commentCount })}
          </button>
          <button
            type="button"
            onClick={onToggleTimeline}
            className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#71717A] hover:bg-white inline-flex items-center gap-1.5 border border-transparent hover:border-[#D4D4D8] transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            {detail ? t('internal.timeline.hide') : t('internal.timeline.show')}
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#71717A]">
          <span>{fmtDate(item.createdAt)} · {t('internal.createdBy')} {item.createdByClient ? t('internal.byClient') : (item.createdByName ?? '—')}</span>
          {item.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#F97316]" />
              {item.location}
            </span>
          )}
          {item.dueDate && <span>{t('internal.dueDate')}: {fmtDate(item.dueDate)}</span>}
        </div>

        {item.description && (
          <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{item.description}</p>
        )}

        {/* Client's rejection note (why it bounced) */}
        {item.status === 'REOPENED' && (detail && detail !== 'loading' && detail !== 'error'
          ? detail.events.filter((e) => e.type === 'REJECTED').slice(-1).map((e, i) => e.note && (
            <div key={i} className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700 mb-0.5">{t('internal.rejectNote')}</p>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{e.note}</p>
            </div>
          ))
          : null)}

        {item.status === 'READY_FOR_REVIEW' && (
          <div className="rounded-lg bg-[#F97316]/5 border border-[#F97316]/20 px-3 py-2 space-y-1">
            <p className="text-xs font-semibold text-[#C2410C]">{t('internal.waitingClient')}</p>
            {item.readyNote && (
              <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">
                <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mr-1.5">{t('internal.readyNote')}:</span>
                {item.readyNote}
              </p>
            )}
          </div>
        )}

        {/* Photos */}
        {(reportPhotos.length > 0 || evidencePhotos.length > 0) && (
          <div className="flex flex-wrap gap-4">
            {reportPhotos.length > 0 && (
              <InternalPhotoStrip label={t('internal.photos.report')} itemId={item.id} photos={reportPhotos} onOpen={onOpenPhoto} />
            )}
            {evidencePhotos.length > 0 && (
              <InternalPhotoStrip label={t('internal.photos.evidence')} itemId={item.id} photos={evidencePhotos} onOpen={onOpenPhoto} />
            )}
          </div>
        )}

        {/* Assignment + workflow actions */}
        {open && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-1.5 text-xs text-[#71717A]">
              <UserIcon className="w-3.5 h-3.5" />
              <select
                aria-label={t('internal.assignTo')}
                value={item.assigneeId ?? ''}
                disabled={busy}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) void act(() => assignPunchItem(item.id, id), 'internal.assigned');
                }}
                className="h-8 rounded-lg border border-[#D4D4D8] bg-white px-2 text-xs font-medium text-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              >
                <option value="">{t('internal.unassigned')}</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

            {canReady && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { setReadyOpen((v) => !v); setCloseOpen(false); }}
                className="h-8 px-3 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('internal.ready')}
              </button>
            )}

            {item.status === 'READY_FOR_REVIEW' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(() => returnPunchItemToProgress(item.id), 'internal.returned')}
                className="h-8 px-3 rounded-lg border border-[#D4D4D8] bg-white disabled:opacity-50 text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] inline-flex items-center gap-1.5 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                {t('internal.returnToProgress')}
              </button>
            )}

            {item.closableInternally ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => { setCloseOpen((v) => !v); setReadyOpen(false); }}
                className="h-8 px-3 rounded-lg border border-emerald-600 text-emerald-700 bg-white disabled:opacity-50 text-xs font-semibold hover:bg-emerald-50 inline-flex items-center gap-1.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t('internal.close')}
              </button>
            ) : (
              item.origin === 'CLIENT' && item.status === 'READY_FOR_REVIEW' && (
                <span className="text-[11px] text-[#71717A] basis-full sm:basis-auto">
                  {t('internal.close.clientWindowHint')}
                </span>
              )
            )}
          </div>
        )}

        {readyOpen && open && (
          <ReadyForm
            item={item}
            busy={busy}
            onSubmit={async (note, photos) => {
              setBusy(true);
              try {
                onChanged(await markPunchItemReady(item.id, { note, photos }));
                setReadyOpen(false);
                toast.success(t('internal.ready.done'));
              } catch {
                toast.error(t('internal.actionFailed'));
              } finally {
                setBusy(false);
              }
            }}
            onCancel={() => setReadyOpen(false)}
          />
        )}

        {closeOpen && open && (
          <CloseForm
            busy={busy}
            onSubmit={async (note) => {
              setBusy(true);
              try {
                onChanged(await closePunchItem(item.id, note));
                setCloseOpen(false);
                toast.success(t('internal.close.done'));
              } catch {
                toast.error(t('internal.actionFailed'));
              } finally {
                setBusy(false);
              }
            }}
            onCancel={() => setCloseOpen(false)}
          />
        )}

        {/* Comment thread (fase 3, D5) */}
        {thread === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          </div>
        )}
        {thread === 'error' && (
          <p className="text-xs text-red-600">{t('internal.comments.loadFailed')}</p>
        )}
        {Array.isArray(thread) && (
          <InternalCommentThread
            item={item}
            thread={thread}
            onPosted={(comment) => setThread((prev) => (Array.isArray(prev) ? [...prev, comment] : [comment]))}
          />
        )}

        {/* Timeline */}
        {detail === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          </div>
        )}
        {detail === 'error' && (
          <p className="text-xs text-red-600">{t('internal.timeline.loadFailed')}</p>
        )}
        {detail && detail !== 'loading' && detail !== 'error' && (
          <div className="rounded-lg bg-[#FAFAFA] border border-[#F4F4F5] px-3 py-2">
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">{t('internal.timeline')}</p>
            <ul className="space-y-1">
              {detail.events.map((event, i) => (
                <li key={i} className="text-xs text-[#0A0A0A] flex flex-wrap items-baseline gap-x-1.5">
                  <span className="text-[#71717A] tabular-nums">{fmtDate(event.createdAt)}</span>
                  <span className="font-medium">{event.byClient ? t('internal.timeline.client') : (event.actorName ?? '—')}</span>
                  <span>{t(`internal.event.${event.type}`)}</span>
                  {event.note && <span className="text-[#71717A]">— “{event.note}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

// ──────────────────────────── comment thread (fase 3, D5) ────────────────────────────

/**
 * The item's shared conversation, internal face: full author names; the
 * client's messages labelled as the client. On CLIENT items the hint reminds
 * the team that the OWNER READS THIS THREAD on their portal.
 */
function InternalCommentThread({ item, thread, onPosted }: {
  item: PunchItem;
  thread: PunchItemComment[];
  onPosted: (comment: PunchItemComment) => void;
}) {
  const { t, i18n } = useTranslation(['punchList']);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    );

  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      onPosted(await addPunchItemComment(item.id, body));
      setBody('');
      toast.success(t('internal.comments.sent'));
    } catch {
      toast.error(t('internal.comments.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg bg-[#FAFAFA] border border-[#F4F4F5] px-3 py-2 space-y-2">
      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">
        {t('internal.comments')}
        <span className="ml-1.5 normal-case font-normal tracking-normal">
          {item.origin === 'CLIENT' ? t('internal.comments.visibleHint') : t('internal.comments.internalHint')}
        </span>
      </p>

      {thread.length === 0 && (
        <p className="text-xs text-[#71717A]">{t('internal.comments.empty')}</p>
      )}
      <ul className="space-y-1.5">
        {thread.map((comment) => (
          <li
            key={comment.id}
            className={`rounded-lg border px-3 py-2 ${
              comment.byClient ? 'bg-[#F97316]/5 border-[#F97316]/20' : 'bg-white border-[#F4F4F5]'
            }`}
          >
            <p className="text-[11px] mb-0.5">
              <span className="font-semibold text-[#0A0A0A]">
                {comment.byClient ? t('internal.comments.client') : (comment.authorName ?? '—')}
              </span>
              <span className="text-[#71717A] ml-1.5">{fmtDateTime(comment.createdAt)}</span>
            </p>
            <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{comment.body}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2">
        <textarea
          aria-label={t('internal.comments.placeholder')}
          maxLength={2000}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('internal.comments.placeholder')}
          className="flex-1 px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
        />
        <button
          type="button"
          disabled={sending || !body.trim()}
          onClick={() => void submit()}
          className="h-9 px-3.5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {t('internal.comments.send')}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────── forms ────────────────────────────

function usePhotoPicker(max: number, maxBytes: number) {
  const { t } = useTranslation(['punchList']);
  const [photos, setPhotos] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/')) {
          toast.error(t('internal.photoInvalidType'));
          continue;
        }
        if (file.size > maxBytes) {
          toast.error(t('internal.photoTooLarge', { mb: maxBytes / (1024 * 1024) }));
          continue;
        }
        if (next.length >= max) {
          toast.error(t('internal.tooManyPhotos', { max }));
          break;
        }
        next.push(file);
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  return { photos, setPhotos, inputRef, addFiles };
}

function PhotoPickerRow({ picker, label }: {
  picker: ReturnType<typeof usePhotoPicker>;
  label: string;
}) {
  return (
    <div>
      <span className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {picker.photos.map((file, i) => (
          <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-lg bg-[#FAFAFA] border border-[#D4D4D8] text-xs text-[#0A0A0A] max-w-48">
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              aria-label={`remove-${file.name}`}
              onClick={() => picker.setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
              className="w-4 h-4 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center flex-shrink-0"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => picker.inputRef.current?.click()}
          className="h-8 px-2.5 rounded-lg border-2 border-dashed border-[#D4D4D8] hover:border-[#F97316] text-xs font-medium text-[#71717A] hover:text-[#F97316] inline-flex items-center gap-1.5 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
          {label}
        </button>
      </div>
      <input
        ref={picker.inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => picker.addFiles(e.target.files)}
      />
    </div>
  );
}

function ReadyForm({ item, busy, onSubmit, onCancel }: {
  item: PunchItem;
  busy: boolean;
  onSubmit: (note: string, photos: File[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [note, setNote] = useState('');
  const picker = usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES);

  return (
    <div className="rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 px-3 py-3 space-y-3">
      <div>
        <label htmlFor={`ready-note-${item.id}`} className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">
          {t('internal.ready.note')}
        </label>
        <textarea
          id={`ready-note-${item.id}`}
          maxLength={1000}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('internal.ready.notePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y bg-white"
        />
      </div>
      <PhotoPickerRow picker={picker} label={t('internal.ready.photos', { max: MAX_INTERNAL_PHOTOS })} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSubmit(note, picker.photos)}
          className="h-9 px-3.5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.ready.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
        >
          {t('internal.form.cancel')}
        </button>
      </div>
    </div>
  );
}

function CloseForm({ busy, onSubmit, onCancel }: {
  busy: boolean;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [note, setNote] = useState('');

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-3">
      <div>
        <label htmlFor="close-note" className="block text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">
          {t('internal.close.note')}
        </label>
        <textarea
          id="close-note"
          maxLength={1000}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('internal.close.notePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-y bg-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSubmit(note)}
          className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.close.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
        >
          {t('internal.form.cancel')}
        </button>
      </div>
    </div>
  );
}

function InternalCreateForm({ project, onCreated, onCancel }: {
  project: PunchProject;
  onCreated: (item: PunchItem) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const picker = usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('internal.form.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPunchItem(project.id, {
        title: title.trim(),
        description,
        location,
        assigneeId: assigneeId === '' ? undefined : assigneeId,
        dueDate: dueDate || undefined,
        photos: picker.photos,
      });
      toast.success(t('internal.form.created'));
      onCreated(created);
    } catch {
      toast.error(t('internal.form.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/50 px-4 py-4 space-y-3">
      <p className="text-xs font-semibold text-[#0A0A0A]">{t('internal.form.title')}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="punch-int-title" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.titleLabel')}
          </label>
          <input
            id="punch-int-title"
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('internal.form.titlePlaceholder')}
            className="w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            autoFocus
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="punch-int-desc" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.descriptionLabel')}
          </label>
          <textarea
            id="punch-int-desc"
            maxLength={2000}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
          />
        </div>
        <div>
          <label htmlFor="punch-int-location" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.locationLabel')}
          </label>
          <input
            id="punch-int-location"
            type="text"
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label htmlFor="punch-int-due" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.dueDateLabel')}
          </label>
          <input
            id="punch-int-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        </div>
        <div>
          <label htmlFor="punch-int-assignee" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.assigneeLabel')}
          </label>
          <select
            id="punch-int-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full h-9 px-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          >
            <option value="">{t('internal.unassigned')}</option>
            {project.assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>
      <PhotoPickerRow picker={picker} label={t('internal.form.photosLabel', { max: MAX_INTERNAL_PHOTOS })} />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-9 px-3.5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? t('internal.form.submitting') : t('internal.form.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
        >
          {t('internal.form.cancel')}
        </button>
      </div>
    </form>
  );
}

function InternalPhotoStrip({ label, itemId, photos, onOpen }: {
  label: string;
  itemId: number;
  photos: PunchItem['photos'];
  onOpen: (photoId: number) => void;
}) {
  return (
    <div>
      <span className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className="w-16 h-16 overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
          >
            <AuthImage
              src={punchItemPhotoUrl(itemId, photo.id)}
              alt={photo.fileName ?? ''}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
