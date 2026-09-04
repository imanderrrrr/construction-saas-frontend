// BuildTrack — Internal punch-list view (fase 2 del portal de cliente).
// Shared by the admin project ficha (Pendientes tab) and the supervisor
// section: list with status filters, assignment, "marcar listo" with evidence
// photos, return-to-progress, internal close (D3 rules), the comment thread
// the client also reads, and the event timeline.
//
// Look (Claude Design "Proyectos BuildTrack" 03D + "Proyectos Ventanas" 04F–04I):
// stacked cards with a 3 px edge only when the item asks for a hand, a drawer
// for the new item, and in-line panels inside the card for everything that
// edits it — the item never leaves the screen while it is being worked on.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Download, FileSpreadsheet, FileText, Loader2, MessageSquare, Plus, Undo2,
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
import { cn } from '../ui/utils';
import { FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { BtDrawer } from '../bt/windows';
import { PhotoGrid, usePhotoPicker, type PickerMessages } from '../bt/PhotoPicker';
import { Bone, CreateButton, EmptyWord, FieldError, FieldHint, FieldLabel, INPUT, INPUT_MONO, Mono, MonoSelect, PaperNote } from '../projects/bt';
import { initialsOf } from '../projects/badges';

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

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] leading-none px-2 py-[5px] whitespace-nowrap';
const STATUS_LOOK: Record<PunchItemStatus, string> = {
  OPEN: 'border border-[#DBD0BB] text-[#5A5346]',
  IN_PROGRESS: 'bg-[#F3EEE4] text-[#0A0A0A]',
  READY_FOR_REVIEW: 'bg-[#F97316] text-[#0A0A0A]',
  REOPENED: 'border border-[#B3402A] text-[#B3402A]',
  CLOSED: 'bg-[#0A0A0A] text-[#F5F1E8]',
};
/** The card's edge only when the item asks for a hand: ours in orange, bounced in red. */
const EDGE: Partial<Record<PunchItemStatus, string>> = {
  OPEN: 'border-l-[3px] border-l-[#F97316]',
  IN_PROGRESS: 'border-l-[3px] border-l-[#F97316]',
  REOPENED: 'border-l-[3px] border-l-[#B3402A]',
};
const TEXTAREA = cn(INPUT, 'h-auto min-h-[62px] py-2 resize-y text-[13.5px] leading-[1.5]');
const CHIP_FILTER = 'px-3 py-[7px] border font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors';

/** D3: a client item can be closed internally seven days after "ready". */
const CLIENT_CLOSE_WINDOW_MS = 7 * 86_400_000;

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

  // Handles both timestamps (createdAt) and date-only strings (dueDate).
  // Date-only must parse as LOCAL midnight: new Date('YYYY-MM-DD') is UTC
  // midnight, which renders as the previous day west of Greenwich (UTC-6).
  const fmtDate = (iso: string): string =>
    (iso.includes('T') ? new Date(iso) : new Date(`${iso}T00:00:00`)).toLocaleDateString(
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
      caption: t('internal.photoOf', { number: item.displayNumber }),
      meta: t('internal.photoBy', { name: p.uploadedByName ?? '—', date: fmtDate(p.createdAt) }),
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
    <div className="bg-white border border-[#E7E1D5] overflow-hidden">
      {/* Header — the subventana's title and purpose (sheet 03D) */}
      <div className="px-4 pt-4 md:px-[22px] md:pt-5 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bt-display font-extrabold uppercase text-[24px] md:text-[26px] leading-none text-[#0A0A0A]">
            {t('internal.title')}
          </h3>
          <p className="text-[13.5px] leading-[1.55] text-[#5A5346] mt-1.5">{t('internal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <MonoSelect
              aria-label={t('internal.project')}
              value={projectId ?? ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              className="h-[38px] py-0"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </MonoSelect>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn('inline-flex items-center gap-1.5 px-3.5 py-[10px] border border-[#DBD0BB] bg-white font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A0A0A] hover:border-[#F97316] hover:text-[#C2410C] transition-colors', FOCUS_RING)}
              >
                <Download className="w-3.5 h-3.5" />
                {t('internal.export')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] rounded-none border-[#CDBFA6] p-0 shadow-[0_16px_48px_rgba(23,19,15,0.3)]">
              <DropdownMenuItem onClick={() => runExport('pdf')} className="rounded-none gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3.5 py-2.5 cursor-pointer focus:bg-[#F3EEE4]">
                <FileText className="w-3.5 h-3.5 text-[#8A8175]" />
                {t('internal.export.pdf')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => runExport('csv')} className="rounded-none gap-2 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] px-3.5 py-2.5 cursor-pointer focus:bg-[#F3EEE4]">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#8A8175]" />
                {t('internal.export.csv')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <CreateButton onClick={() => setCreateOpen(true)} className="px-3.5 py-[10px] text-[10px]">
            <Plus className="w-3.5 h-3.5" />
            {t('internal.new')}
          </CreateButton>
        </div>
      </div>

      <div className="px-4 py-4 md:px-[22px] md:pb-5 space-y-3">
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('internal.filter.all')} data-tour="sec.projects-ficha-pendientes.states">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf}
              type="button"
              aria-pressed={statusFilter === sf}
              onClick={() => setStatusFilter(sf)}
              className={cn(
                CHIP_FILTER,
                statusFilter === sf ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A]' : 'bg-white text-[#5A5346] border-[#DBD0BB] hover:border-[#F97316] hover:text-[#C2410C]',
                FOCUS_RING,
              )}
            >
              {sf === 'ALL' ? t('internal.filter.all') : t(`status.${sf}`)}
            </button>
          ))}
        </div>

        {loadError && (
          <PaperNote tone="red" className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[#0A0A0A]">{t('internal.loadFailed')}</span>
            <button type="button" onClick={() => void load()} className={cn('font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[#C2410C] hover:text-[#F97316]', FOCUS_RING)}>
              {t('internal.retry')}
            </button>
          </PaperNote>
        )}

        {loading && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Bone className="h-24 w-full" />
            <Bone className="h-24 w-full" />
          </div>
        )}

        {!loading && !loadError && items.length === 0 && (
          <EmptyWord word={t('internal.empty.title')} title={t('internal.empty.title')} hint={t('internal.empty.subtitle')} className="border-0 py-9" />
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

      {project && (
        <NewPunchDrawer
          open={createOpen}
          project={project}
          onCreated={(item) => {
            setCreateOpen(false);
            setItems((prev) => [item, ...prev]);
          }}
          onClose={() => setCreateOpen(false)}
        />
      )}

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
  const loadedDetail = detail && detail !== 'loading' && detail !== 'error' ? detail : null;
  const closeAvailableAt = item.readyAt ? new Date(new Date(item.readyAt).getTime() + CLIENT_CLOSE_WINDOW_MS).toISOString() : null;
  const waitingForClientWindow = item.origin === 'CLIENT' && item.status === 'READY_FOR_REVIEW' && !item.closableInternally;

  // The meta line: place · assignee · who and when · due date · closed when.
  const meta: React.ReactNode[] = [];
  if (item.location) meta.push(item.location);
  if (item.assigneeName) meta.push(t('internal.meta.assignedTo', { name: item.assigneeName }));
  meta.push(item.createdByClient
    ? t('internal.meta.reportedByClient', { date: fmtDate(item.createdAt) })
    : t('internal.meta.createdBy', { name: item.createdByName ?? '—', date: fmtDate(item.createdAt) }));
  if (item.dueDate) meta.push(<span key="due">{t('internal.dueDate')}: {fmtDate(item.dueDate)}</span>);
  if (item.status === 'CLOSED' && item.closedAt) {
    meta.push(item.closedByClient
      ? t('internal.meta.closedClient', { date: fmtDate(item.closedAt) })
      : t('internal.meta.closedBy', { date: fmtDate(item.closedAt), name: item.closedByName ?? '—' }));
  }

  return (
    <article className={cn('border border-[#E4E4E7] bg-white', EDGE[item.status])}>
      <div className="px-4 py-3.5 md:px-[18px] md:py-4 flex flex-col gap-3">
        {/* Header: number, chips, toggles */}
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-bt-display font-extrabold text-[22px] leading-none text-[#C2410C] tabular-nums">{item.displayNumber}</span>
            <span className={cn(CHIP, 'border border-[#DBD0BB] text-[#5A5346]')} data-tour="sec.projects-ficha-pendientes.origin">
              {t(`internal.origin.${item.origin}`)}
            </span>
            <span className={cn(CHIP, STATUS_LOOK[item.status])}>{t(`status.${item.status}`)}</span>
            {item.reopenCount > 0 && (
              <span className={cn(CHIP, 'border border-[#B3402A] text-[#B3402A]')}>{t('internal.reopens', { count: item.reopenCount })}</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              data-tour="sec.projects-ficha-pendientes.review"
              onClick={() => void toggleThread()}
              className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5346] hover:text-[#C2410C] transition-colors', FOCUS_RING)}
            >
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={2} />
              {t('internal.comments.toggle', { count: commentCount })}
            </button>
            <TertiaryButton onClick={onToggleTimeline} className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#5A5346]">
              {detail ? t('internal.timeline.hide') : t('internal.timeline.show')}
              {!detail && <ArrowRight className="w-3 h-3" strokeWidth={2.2} />}
            </TertiaryButton>
          </div>
        </header>

        <div>
          <h4 className="text-[15px] font-semibold text-[#0A0A0A] leading-snug">{item.title}</h4>
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] leading-[1.7] mt-1">
            {meta.flatMap((part, i) => (i > 0 ? [<span key={`sep-${i}`}> · </span>, <span key={i}>{part}</span>] : [<span key={i}>{part}</span>]))}
          </Mono>
        </div>

        {item.description && (
          <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A] whitespace-pre-wrap">{item.description}</p>
        )}

        {/* Client's rejection note (why it bounced) */}
        {item.status === 'REOPENED' && loadedDetail && loadedDetail.events.filter((e) => e.type === 'REJECTED').slice(-1).map((e, i) => e.note && (
          <PaperNote key={i} tone="red">
            <Mono className="block text-[9.5px] font-semibold tracking-[0.1em] text-[#B3402A] mb-1">{t('internal.rejectNote')}:</Mono>
            <p className="text-[13.5px] leading-[1.5] text-[#0A0A0A] whitespace-pre-wrap">{e.note}</p>
          </PaperNote>
        ))}

        {item.status === 'READY_FOR_REVIEW' && (
          <PaperNote tone="orange">
            <p className="text-[13.5px] font-semibold text-[#0A0A0A] leading-[1.5]">
              {t('internal.waitingClient')}.{closeAvailableAt && ` ${t('internal.waitingClientUntil', { date: fmtDate(closeAvailableAt) })}`}
            </p>
            {item.readyNote && (
              <p className="text-[13.5px] leading-[1.5] text-[#0A0A0A] whitespace-pre-wrap mt-1">
                <Mono className="text-[9.5px] font-semibold tracking-[0.1em] text-[#8A8175] mr-1.5">{t('internal.readyNote')}:</Mono>
                {item.readyNote}
              </p>
            )}
          </PaperNote>
        )}

        {/* Photos */}
        {(reportPhotos.length > 0 || evidencePhotos.length > 0) && (
          <div className="flex flex-wrap gap-5">
            {reportPhotos.length > 0 && (
              <InternalPhotoStrip label={`${t('internal.photos.report')} · ${reportPhotos.length}`} itemId={item.id} photos={reportPhotos} onOpen={onOpenPhoto} />
            )}
            {evidencePhotos.length > 0 && (
              <InternalPhotoStrip label={`${t('internal.photos.evidence')} · ${evidencePhotos.length}`} itemId={item.id} photos={evidencePhotos} onOpen={onOpenPhoto} evidence />
            )}
          </div>
        )}

        {/* Assignment + workflow actions */}
        {open && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <MonoSelect
              aria-label={t('internal.assignTo')}
              value={item.assigneeId ?? ''}
              disabled={busy}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (id) void act(() => assignPunchItem(item.id, id), 'internal.assigned');
              }}
              className="h-[36px] py-0 pr-8 normal-case text-[11.5px]"
            >
              <option value="">{t('internal.unassigned')}</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </MonoSelect>

            {canReady && (
              <PrimaryButton
                data-tour="sec.projects-ficha-pendientes.ready"
                disabled={busy}
                onClick={() => { setReadyOpen((v) => !v); setCloseOpen(false); }}
                className="px-3.5 py-[10px] text-[10px]"
              >
                {t('internal.ready')}
              </PrimaryButton>
            )}

            {item.status === 'READY_FOR_REVIEW' && (
              <SecondaryButton
                disabled={busy}
                onClick={() => void act(() => returnPunchItemToProgress(item.id), 'internal.returned')}
                className="px-3.5 py-[10px] text-[10px] gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" strokeWidth={2} />
                {t('internal.returnToProgress')}
              </SecondaryButton>
            )}

            {item.closableInternally ? (
              <SecondaryButton
                disabled={busy}
                onClick={() => { setCloseOpen((v) => !v); setReadyOpen(false); }}
                className="px-3.5 py-[10px] text-[10px]"
              >
                {t('internal.close')}
              </SecondaryButton>
            ) : waitingForClientWindow ? (
              <>
                <SecondaryButton disabled className="px-3.5 py-[10px] text-[10px]">{t('internal.close.submit')}</SecondaryButton>
                {closeAvailableAt && (
                  <Mono className="text-[9.5px] font-semibold tracking-[0.1em] text-[#C2410C]">{t('internal.close.availableOn', { date: fmtDate(closeAvailableAt) })}</Mono>
                )}
                <p className="basis-full text-[12px] leading-[1.5] text-[#8A8175]">{t('internal.close.clientWindowHint')}</p>
              </>
            ) : null}
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
            item={item}
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
          <FieldError>{t('internal.comments.loadFailed')}</FieldError>
        )}
        {Array.isArray(thread) && (
          <InternalCommentThread
            item={item}
            thread={thread}
            fmtDate={fmtDate}
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
          <FieldError>{t('internal.timeline.loadFailed')}</FieldError>
        )}
        {loadedDetail && (
          <div className="border-t border-[#F0EBE1] pt-3">
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2.5">{t('internal.timeline')}</Mono>
            <ol className="relative ml-[5px] pl-4 border-l border-[#DBD0BB] flex flex-col gap-2.5">
              {loadedDetail.events.map((event, i) => (
                <li key={i} className="relative">
                  <span
                    className={cn('absolute -left-[21px] top-[3px] w-[9px] h-[9px]', i === 0 ? 'bg-[#F97316]' : 'bg-white border border-[#CDBFA6]')}
                    aria-hidden="true"
                  />
                  <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{fmtDateTime(event.createdAt)}</Mono>
                  <p className="text-[13px] leading-[1.5] text-[#0A0A0A]">
                    <span className="font-semibold">{event.byClient ? t('internal.timeline.client') : (event.actorName ?? '—')}</span>{' '}
                    {t(`internal.event.${event.type}`)}
                    {event.note && <span className="text-[#8A8175]"> — “{event.note}”</span>}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </article>
  );

  function fmtDateTime(iso: string): string {
    const time = new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${fmtDate(iso)} · ${time}`;
  }
}

// ──────────────────────────── comment thread (fase 3, D5) ────────────────────────────

/**
 * The item's shared conversation, internal face: full author names; the
 * client's messages labelled as the client. On CLIENT items the hint reminds
 * the team that the OWNER READS THIS THREAD on their portal.
 */
function InternalCommentThread({ item, thread, fmtDate, onPosted }: {
  item: PunchItem;
  thread: PunchItemComment[];
  fmtDate: (iso: string) => string;
  onPosted: (comment: PunchItemComment) => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const fmtDateTime = (iso: string): string =>
    `${fmtDate(iso)} · ${new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

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
    <div className="border-t border-[#F0EBE1] pt-3 flex flex-col gap-3">
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">
        {t('internal.comments')} ({thread.length})
        <span className="ml-2 font-normal text-[#8A8175]">
          {item.origin === 'CLIENT' ? t('internal.comments.visibleHint') : t('internal.comments.internalHint')}
        </span>
      </Mono>

      {thread.length === 0 && (
        <p className="text-[12.5px] italic text-[#A69C8D]">{t('internal.comments.empty')}</p>
      )}
      <ul className="flex flex-col gap-2.5">
        {thread.map((comment) => {
          const author = comment.byClient ? t('internal.comments.client') : (comment.authorName ?? '—');
          return (
            <li key={comment.id} className={cn('flex items-start gap-2.5', comment.byClient && 'flex-row-reverse')}>
              <span className={cn('w-[26px] h-[26px] flex items-center justify-center flex-shrink-0 font-bt-mono text-[9px]', comment.byClient ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]')} aria-hidden="true">
                {comment.byClient ? 'CL' : initialsOf(author)}
              </span>
              <div className={cn('max-w-[78%] px-3 py-2.5', comment.byClient ? 'bg-[#FBEDE0] border border-[#F6CFA6]' : 'bg-[#FAF7F0]')}>
                <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] mb-1">{author} · {fmtDateTime(comment.createdAt)}</Mono>
                <p className="text-[13.5px] leading-[1.5] text-[#0A0A0A] whitespace-pre-wrap">{comment.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <textarea
          aria-label={t('internal.comments.placeholder')}
          maxLength={2000}
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('internal.comments.placeholder')}
          className={cn(TEXTAREA, 'flex-1')}
        />
        <CreateButton disabled={sending || !body.trim()} onClick={() => void submit()} className="px-3.5 py-[10px] text-[10px] h-[38px]">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {t('internal.comments.send')}
        </CreateButton>
      </div>
    </div>
  );
}

// ──────────────────────────── forms ────────────────────────────

function usePunchPicker() {
  const { t } = useTranslation(['punchList']);
  const messages: PickerMessages = {
    invalidType: t('internal.photoInvalidType'),
    tooLarge: t('internal.photoTooLarge', { mb: MAX_INTERNAL_PHOTO_BYTES / (1024 * 1024) }),
    tooMany: t('internal.tooManyPhotos', { max: MAX_INTERNAL_PHOTOS }),
  };
  return usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES, messages);
}

/** 04G — in-line panel: note for the client + evidence photos. */
function ReadyForm({ item, busy, onSubmit, onCancel }: {
  item: PunchItem;
  busy: boolean;
  onSubmit: (note: string, photos: File[]) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [note, setNote] = useState('');
  const picker = usePunchPicker();

  return (
    <div className="border border-[#F97316] bg-[#FBEDE0]/40 px-4 py-4 flex flex-col gap-3.5">
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('internal.ready')}</Mono>
      <div>
        <FieldLabel htmlFor={`ready-note-${item.id}`}>{t('internal.ready.note')}</FieldLabel>
        <textarea
          id={`ready-note-${item.id}`}
          maxLength={1000}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('internal.ready.notePlaceholder')}
          className={TEXTAREA}
        />
      </div>
      <PhotoGrid
        picker={picker}
        label={t('internal.photos.evidenceCount', { count: picker.photos.length, max: MAX_INTERNAL_PHOTOS })}
        hint={t('internal.photos.hint')}
        addLabel={t('internal.photos.add')}
        removeLabel={t('internal.photos.remove')}
      />
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <SecondaryButton onClick={onCancel} disabled={busy} className="px-3.5 py-[10px] text-[10px]">{t('internal.form.cancel')}</SecondaryButton>
        <PrimaryButton disabled={busy} onClick={() => void onSubmit(note, picker.photos)} className="px-3.5 py-[10px] text-[10px]">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {item.origin === 'CLIENT' ? t('internal.ready.submit') : t('internal.readyInternal')}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** 04H — in-line panel: closing note. */
function CloseForm({ item, busy, onSubmit, onCancel }: {
  item: PunchItem;
  busy: boolean;
  onSubmit: (note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [note, setNote] = useState('');

  return (
    <div className="border border-[#DBD0BB] bg-[#FAF7F0] px-4 py-4 flex flex-col gap-3.5">
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('internal.close.submit')}</Mono>
      <div>
        <FieldLabel htmlFor="close-note">{t('internal.close.note')}</FieldLabel>
        <textarea
          id="close-note"
          maxLength={1000}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('internal.close.notePlaceholder')}
          className={TEXTAREA}
        />
      </div>
      {item.origin === 'CLIENT' && (
        <p className="text-[12.5px] leading-[1.5] text-[#5A5346]">{t('internal.close.clientWindowHint')}</p>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <SecondaryButton onClick={onCancel} disabled={busy} className="px-3.5 py-[10px] text-[10px]">{t('internal.form.cancel')}</SecondaryButton>
        <PrimaryButton disabled={busy} onClick={() => void onSubmit(note)} className="px-3.5 py-[10px] text-[10px]">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.close.submit')}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** 04F — the 492 px drawer for a new item (full sheet on phones). */
function NewPunchDrawer({ open, project, onCreated, onClose }: {
  open: boolean;
  project: PunchProject;
  onCreated: (item: PunchItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['punchList']);
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const picker = usePunchPicker();

  // Fresh form on every open.
  useEffect(() => {
    if (!open) return;
    setTitle(''); setTitleError(''); setDescription(''); setLocation(''); setAssigneeId(''); setDueDate('');
    picker.setPhotos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(t('internal.form.titleRequired'));
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
    <BtDrawer
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      kicker={project.name}
      title={t('internal.new')}
      closeDisabled={submitting}
      footer={(
        <>
          <SecondaryButton onClick={onClose} disabled={submitting} className="px-4 py-[11px]">{t('internal.form.cancel')}</SecondaryButton>
          <PrimaryButton type="submit" form="punch-create-form" disabled={submitting} className="px-[18px] py-[11px]">
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? t('internal.form.submitting') : t('internal.form.submit')}
          </PrimaryButton>
        </>
      )}
    >
      <form id="punch-create-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor="punch-int-title" required>{t('internal.form.titleLabel')}</FieldLabel>
          <input
            id="punch-int-title"
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
            placeholder={t('internal.form.titlePlaceholder')}
            className={cn(INPUT, 'h-[38px] md:h-[38px]', titleError && 'border-[#F97316]')}
            autoFocus
          />
          {titleError && <FieldError>{titleError}</FieldError>}
        </div>
        <div>
          <FieldLabel htmlFor="punch-int-desc">{t('internal.form.descriptionLabel')}</FieldLabel>
          <textarea
            id="punch-int-desc"
            maxLength={2000}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={cn(TEXTAREA, 'min-h-[70px]')}
          />
        </div>
        <div>
          <FieldLabel htmlFor="punch-int-location">{t('internal.form.locationLabel')}</FieldLabel>
          <input
            id="punch-int-location"
            type="text"
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={cn(INPUT, 'h-[38px]')}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="w-[170px]">
            <FieldLabel htmlFor="punch-int-due">{t('internal.form.dueDateLabel')}</FieldLabel>
            <input
              id="punch-int-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(INPUT, INPUT_MONO, 'h-[38px]')}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <FieldLabel htmlFor="punch-int-assignee">{t('internal.form.assigneeLabel')}</FieldLabel>
            <MonoSelect
              id="punch-int-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-[38px] py-0 bg-white normal-case text-[12.5px]"
            >
              <option value="">{t('internal.unassigned')}</option>
              {project.assignees.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </MonoSelect>
            <FieldHint>{t('internal.form.assigneeHint')}</FieldHint>
          </div>
        </div>
        <PhotoGrid
          picker={picker}
          label={t('internal.photos.count', { count: picker.photos.length, max: MAX_INTERNAL_PHOTOS })}
          hint={t('internal.photos.hint')}
          addLabel={t('internal.photos.add')}
          removeLabel={t('internal.photos.remove')}
        />
      </form>
    </BtDrawer>
  );
}

function InternalPhotoStrip({ label, itemId, photos, onOpen, evidence = false }: {
  label: string;
  itemId: number;
  photos: PunchItem['photos'];
  onOpen: (photoId: number) => void;
  evidence?: boolean;
}) {
  return (
    <div>
      <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">{label}</Mono>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className={cn('w-14 h-14 overflow-hidden border hover:opacity-90 transition-opacity', evidence ? 'border-[#F97316]' : 'border-[#DBD0BB]', FOCUS_RING)}
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
