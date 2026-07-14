// BuildTrack — Internal RFI view ("Consultas de obra", Procore-style).
// Shared by the admin project-details card and the supervisor section:
// drafts (edit/send/discard), the answer thread with the client, impacts,
// and closing with THE official response. Look & feel mirrors the punch list.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera, CheckCircle2, HelpCircle, History, Loader2, MessageSquare,
  Pencil, Plus, Send, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addRfiResponse,
  closeRfi,
  createRfi,
  deleteRfiDraft,
  getRfi,
  listRfis,
  MAX_INTERNAL_PHOTO_BYTES,
  MAX_INTERNAL_PHOTOS,
  rfiPhotoUrl,
  submitRfi,
  updateRfiDraft,
  updateRfiImpacts,
  type Rfi,
  type RfiImpact,
  type RfiResponseEntry,
  type RfiStatus,
} from '../../services/rfis';
import { AuthImage } from '../sitelog/AuthImage';
import { Lightbox, type LightboxImage } from '../sitelog/Lightbox';

export interface RfiProject {
  id: number;
  name: string;
}

const STATUS_FILTERS: (RfiStatus | 'ALL')[] = ['ALL', 'DRAFT', 'OPEN', 'RESPONDED', 'CLOSED'];

const STATUS_STYLES: Record<RfiStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  RESPONDED: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const fmtQ = (cents: number): string =>
  `Q ${(cents / 100).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RfiList({ projects }: { projects: RfiProject[] }) {
  const { t, i18n } = useTranslation(['rfi']);

  const [projectId, setProjectId] = useState<number | null>(projects[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<RfiStatus | 'ALL'>('ALL');
  const [mineOnly, setMineOnly] = useState(false);
  const [items, setItems] = useState<Rfi[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [details, setDetails] = useState<Record<number, Rfi | 'loading' | 'error'>>({});
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
      const list = await listRfis(projectId, statusFilter === 'ALL' ? {} : { status: statusFilter });
      setItems(list);
      setDetails({});
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

  // Date-ONLY strings (dueDate) must parse as local midnight — new Date('YYYY-MM-DD')
  // reads UTC and shifts the shown day back west of Greenwich.
  const fmtDay = (isoDate: string): string => fmtDate(`${isoDate}T00:00:00`);

  const replaceItem = (updated: Rfi) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setDetails((prev) => {
      const cur = prev[updated.id];
      if (!cur || cur === 'loading' || cur === 'error') return prev;
      // Action responses come from detail-shaped endpoints (thread included).
      return { ...prev, [updated.id]: updated.responses.length || !cur.responses.length ? updated : { ...updated, responses: cur.responses, events: cur.events } };
    });
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const loadDetail = async (rfi: Rfi) => {
    setDetails((prev) => ({ ...prev, [rfi.id]: 'loading' }));
    try {
      const detail = await getRfi(rfi.id);
      setDetails((prev) => ({ ...prev, [rfi.id]: detail }));
    } catch {
      setDetails((prev) => ({ ...prev, [rfi.id]: 'error' }));
    }
  };

  const openLightbox = (rfi: Rfi, photos: Rfi['questionPhotos'], photoId: number) => {
    const images: LightboxImage[] = photos.map((p) => ({
      id: p.id,
      url: rfiPhotoUrl(rfi.id, p.id),
      alt: rfi.subject,
      caption: p.fileName,
      downloadName: p.fileName ?? `rfi-${rfi.id}-${p.id}`,
    }));
    const index = Math.max(0, images.findIndex((img) => img.id === photoId));
    setLightbox({ images, index });
  };

  if (projects.length === 0) return null;

  const visibleItems = mineOnly ? items.filter((it) => it.ballInCourt === 'COMPANY') : items;

  return (
    <div className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#D4D4D8] bg-[#FAFAFA]/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A] inline-flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#F97316]" />
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
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="h-9 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('internal.new')}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Create form */}
        {createOpen && project && (
          <RfiForm
            mode="create"
            projectId={project.id}
            onDone={(rfi) => {
              setCreateOpen(false);
              setItems((prev) => [rfi, ...prev]);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        )}

        {/* Filters: status chips + "my move" toggle */}
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
          <button
            type="button"
            onClick={() => setMineOnly((v) => !v)}
            className={`h-7 px-3 rounded-full text-[11px] font-semibold border transition-colors ${
              mineOnly
                ? 'bg-[#F97316] text-white border-[#F97316]'
                : 'bg-white text-[#71717A] border-[#D4D4D8] hover:border-[#F97316]'
            }`}
          >
            {t('internal.filter.mine')}
          </button>
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

        {!loading && !loadError && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <HelpCircle className="w-5 h-5 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A]">{t('internal.empty.title')}</p>
            <p className="text-xs text-[#71717A] mt-1">{t('internal.empty.subtitle')}</p>
          </div>
        )}

        {!loading && visibleItems.map((rfi) => (
          <RfiCard
            key={rfi.id}
            rfi={rfi}
            detail={details[rfi.id]}
            fmtDate={fmtDate}
            fmtDay={fmtDay}
            onChanged={replaceItem}
            onDeleted={removeItem}
            onLoadDetail={() => void loadDetail(rfi)}
            onOpenPhoto={(photos, photoId) => openLightbox(rfi, photos, photoId)}
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

// ──────────────────────────── card ────────────────────────────

function RfiCard({ rfi, detail, fmtDate, fmtDay, onChanged, onDeleted, onLoadDetail, onOpenPhoto }: {
  rfi: Rfi;
  detail: Rfi | 'loading' | 'error' | undefined;
  fmtDate: (iso: string) => string;
  /** For date-ONLY strings (dueDate) — parses as local midnight, not UTC. */
  fmtDay: (isoDate: string) => string;
  onChanged: (rfi: Rfi) => void;
  onDeleted: (id: number) => void;
  onLoadDetail: () => void;
  onOpenPhoto: (photos: Rfi['questionPhotos'], photoId: number) => void;
}) {
  const { t } = useTranslation(['rfi']);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [impactsOpen, setImpactsOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const isDraft = rfi.status === 'DRAFT';
  const isClosed = rfi.status === 'CLOSED';
  const inThread = rfi.status === 'OPEN' || rfi.status === 'RESPONDED';
  const loadedDetail = detail && detail !== 'loading' && detail !== 'error' ? detail : null;

  const ensureDetail = () => {
    if (!detail) onLoadDetail();
  };

  const sendDraft = async () => {
    setBusy(true);
    try {
      onChanged(await submitRfi(rfi.id));
      toast.success(t('internal.draft.sent'));
    } catch {
      toast.error(t('internal.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    if (!window.confirm(t('internal.draft.deleteConfirm'))) return;
    setBusy(true);
    try {
      await deleteRfiDraft(rfi.id);
      toast.success(t('internal.draft.deleted'));
      onDeleted(rfi.id);
    } catch {
      toast.error(t('internal.actionFailed'));
      setBusy(false);
    }
  };

  const impactsSummary = (): string | null => {
    const parts: string[] = [];
    if (rfi.costImpact !== 'TBD') {
      parts.push(`${t('impact.cost')}: ${t(`impact.${rfi.costImpact}`)}${
        rfi.costImpact === 'YES' && rfi.costImpactAmountCents != null ? ` (${fmtQ(rfi.costImpactAmountCents)})` : ''
      }`);
    }
    if (rfi.scheduleImpact !== 'TBD') {
      parts.push(`${t('impact.schedule')}: ${t(`impact.${rfi.scheduleImpact}`)}${
        rfi.scheduleImpact === 'YES' && rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays} d)` : ''
      }`);
    }
    return parts.length ? parts.join(' · ') : null;
  };

  return (
    <article className="rounded-lg border border-[#D4D4D8] overflow-hidden">
      <header className="px-4 py-3 bg-[#FAFAFA]/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {rfi.displayNumber && (
            <span className="text-sm font-semibold text-[#F97316] tabular-nums">{rfi.displayNumber}</span>
          )}
          <h4 className="text-sm font-semibold text-[#0A0A0A]">{rfi.subject}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[rfi.status]}`}>
            {t(`status.${rfi.status}`)}
          </span>
          {rfi.overdue && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
              {t('status.overdue')}
            </span>
          )}
          {rfi.ballInCourt !== 'NONE' && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                rfi.ballInCourt === 'CLIENT'
                  ? 'bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/30'
                  : 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
              }`}
            >
              {t(`ball.${rfi.ballInCourt}`)}
            </span>
          )}
        </div>
        {!isDraft && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setThreadOpen((v) => !v); ensureDetail(); }}
              className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#71717A] hover:bg-white inline-flex items-center gap-1.5 border border-transparent hover:border-[#D4D4D8] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {t('internal.responses.toggle', { count: loadedDetail ? loadedDetail.responses.length : rfi.responseCount })}
            </button>
            <button
              type="button"
              onClick={() => { setTimelineOpen((v) => !v); ensureDetail(); }}
              className="h-7 px-2.5 rounded-lg text-[11px] font-medium text-[#71717A] hover:bg-white inline-flex items-center gap-1.5 border border-transparent hover:border-[#D4D4D8] transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              {timelineOpen ? t('internal.timeline.hide') : t('internal.timeline.show')}
            </button>
          </div>
        )}
      </header>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#71717A]">
          {isDraft ? (
            <span>{fmtDate(rfi.createdAt)} · {t('internal.createdBy')} {rfi.createdByName}</span>
          ) : (
            rfi.submittedAt && <span>{t('internal.sentBy', { name: rfi.submittedByName ?? '—', date: fmtDate(rfi.submittedAt) })}</span>
          )}
          {rfi.dueDate && (
            <span className={rfi.overdue ? 'text-red-700 font-semibold' : ''}>
              {t('internal.dueDate')}: {fmtDay(rfi.dueDate)}
            </span>
          )}
          {rfi.respondedAt && <span>{t('internal.respondedAt', { date: fmtDate(rfi.respondedAt) })}</span>}
          {isClosed && rfi.closedAt && (
            <span>{t('internal.closedBy', { name: rfi.closedByName ?? '—', date: fmtDate(rfi.closedAt) })}</span>
          )}
        </div>

        {isDraft && <p className="text-[11px] text-[#71717A] italic">{t('internal.draft.hint')}</p>}

        <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{rfi.question}</p>

        {rfi.questionPhotos.length > 0 && (
          <div>
            <span className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">
              {t('internal.photos.question')}
            </span>
            <div className="flex flex-wrap gap-2">
              {rfi.questionPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPhoto(rfi.questionPhotos, photo.id)}
                  className="w-16 h-16 overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
                >
                  <AuthImage
                    src={rfiPhotoUrl(rfi.id, photo.id)}
                    alt={photo.fileName ?? ''}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Impacts summary (always visible once decided) */}
        {!isDraft && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#71717A]">
            <span className="font-semibold uppercase tracking-wide text-[11px]">{t('internal.impacts')}:</span>
            <span>{impactsSummary() ?? t('impact.none')}</span>
            {inThread && (
              <button
                type="button"
                onClick={() => { setImpactsOpen((v) => !v); setCloseOpen(false); }}
                className="h-6 px-2 rounded-lg border border-[#D4D4D8] bg-white text-[11px] font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] inline-flex items-center gap-1 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                {t('internal.impacts.edit')}
              </button>
            )}
          </div>
        )}

        {/* Draft actions */}
        {isDraft && !editOpen && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendDraft()}
              className="h-9 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {t('internal.draft.send')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditOpen(true)}
              className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white disabled:opacity-50 text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] inline-flex items-center gap-1.5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t('internal.draft.edit')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeDraft()}
              className="h-9 px-3.5 rounded-lg border border-red-200 text-red-700 bg-white disabled:opacity-50 text-xs font-medium hover:bg-red-50 inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('internal.draft.delete')}
            </button>
          </div>
        )}

        {isDraft && editOpen && (
          <RfiForm
            mode="edit"
            rfi={rfi}
            onDone={(updated) => {
              setEditOpen(false);
              onChanged(updated);
            }}
            onCancel={() => setEditOpen(false)}
          />
        )}

        {/* Open/responded actions */}
        {inThread && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => { setCloseOpen((v) => !v); setImpactsOpen(false); ensureDetail(); }}
              className="h-9 px-4 rounded-lg border border-emerald-600 text-emerald-700 bg-white disabled:opacity-50 text-xs font-semibold hover:bg-emerald-50 inline-flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('internal.close')}
            </button>
          </div>
        )}

        {impactsOpen && inThread && (
          <ImpactsForm
            rfi={rfi}
            onSaved={(updated) => {
              setImpactsOpen(false);
              onChanged(updated);
              toast.success(t('internal.impacts.saved'));
            }}
            onCancel={() => setImpactsOpen(false)}
          />
        )}

        {closeOpen && inThread && (
          <CloseRfiForm
            rfi={rfi}
            detail={loadedDetail}
            onClosed={(updated) => {
              setCloseOpen(false);
              onChanged(updated);
              toast.success(t('internal.close.done'));
            }}
            onCancel={() => setCloseOpen(false)}
          />
        )}

        {/* Thread */}
        {threadOpen && detail === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          </div>
        )}
        {threadOpen && detail === 'error' && (
          <p className="text-xs text-red-600">{t('internal.responses.loadFailed')}</p>
        )}
        {threadOpen && loadedDetail && (
          <RfiThread
            rfi={loadedDetail}
            canReply={inThread}
            onPosted={(entry) => onChanged({
              ...loadedDetail,
              responses: [...loadedDetail.responses, entry],
              responseCount: loadedDetail.responseCount + 1,
            })}
            onOpenPhoto={onOpenPhoto}
          />
        )}

        {/* Timeline */}
        {timelineOpen && detail === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          </div>
        )}
        {timelineOpen && detail === 'error' && (
          <p className="text-xs text-red-600">{t('internal.timeline.loadFailed')}</p>
        )}
        {timelineOpen && loadedDetail && (
          <div className="rounded-lg bg-[#FAFAFA] border border-[#F4F4F5] px-3 py-2">
            <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">{t('internal.timeline')}</p>
            <ul className="space-y-1">
              {loadedDetail.events.map((event, i) => (
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

// ──────────────────────────── thread ────────────────────────────

/**
 * The RFI's conversation, internal face: full author names; the client's
 * answers labelled as the client. The hint reminds the team the OWNER READS
 * THIS THREAD on their portal. The official answer (once chosen) is starred.
 */
function RfiThread({ rfi, canReply, onPosted, onOpenPhoto }: {
  rfi: Rfi;
  canReply: boolean;
  onPosted: (entry: RfiResponseEntry) => void;
  onOpenPhoto: (photos: Rfi['questionPhotos'], photoId: number) => void;
}) {
  const { t, i18n } = useTranslation(['rfi']);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const picker = usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES);

  const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    );

  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const entry = await addRfiResponse(rfi.id, { body, photos: picker.photos });
      onPosted(entry);
      setBody('');
      picker.setPhotos([]);
      toast.success(t('internal.responses.sent'));
    } catch {
      toast.error(t('internal.responses.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg bg-[#FAFAFA] border border-[#F4F4F5] px-3 py-2 space-y-2">
      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">
        {t('internal.responses')}
        <span className="ml-1.5 normal-case font-normal tracking-normal">{t('internal.responses.visibleHint')}</span>
      </p>

      {rfi.responses.length === 0 && (
        <p className="text-xs text-[#71717A]">{t('internal.responses.empty')}</p>
      )}
      <ul className="space-y-1.5">
        {rfi.responses.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-lg border px-3 py-2 ${
              entry.official
                ? 'bg-emerald-50 border-emerald-300'
                : entry.byClient ? 'bg-[#F97316]/5 border-[#F97316]/20' : 'bg-white border-[#F4F4F5]'
            }`}
          >
            <p className="text-[11px] mb-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-[#0A0A0A]">
                {entry.byClient ? t('internal.responses.client') : (entry.authorName ?? '—')}
              </span>
              <span className="text-[#71717A]">{fmtDateTime(entry.createdAt)}</span>
              {entry.official && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300">
                  {t('internal.responses.official')}
                </span>
              )}
            </p>
            <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{entry.body}</p>
            {entry.photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1.5">
                {entry.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onOpenPhoto(entry.photos, photo.id)}
                    className="w-14 h-14 overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
                  >
                    <AuthImage
                      src={rfiPhotoUrl(rfi.id, photo.id)}
                      alt={photo.fileName ?? ''}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {canReply && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <textarea
              aria-label={t('internal.responses.placeholder')}
              maxLength={2000}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('internal.responses.placeholder')}
              className="flex-1 px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
            />
            <button
              type="button"
              disabled={sending || !body.trim()}
              onClick={() => void submit()}
              className="h-9 px-3.5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {t('internal.responses.send')}
            </button>
          </div>
          <PhotoPickerRow picker={picker} label={t('internal.responses.photosLabel', { max: MAX_INTERNAL_PHOTOS })} />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── forms ────────────────────────────

function usePhotoPicker(max: number, maxBytes: number) {
  const { t } = useTranslation(['rfi']);
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

/** Create (draft or direct-send) and edit-draft share one minimal form. */
function RfiForm(props:
  | { mode: 'create'; projectId: number; onDone: (rfi: Rfi) => void; onCancel: () => void }
  | { mode: 'edit'; rfi: Rfi; onDone: (rfi: Rfi) => void; onCancel: () => void }
) {
  const { t } = useTranslation(['rfi']);
  const editing = props.mode === 'edit' ? props.rfi : null;
  const [subject, setSubject] = useState(editing?.subject ?? '');
  const [question, setQuestion] = useState(editing?.question ?? '');
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '');
  const [submitting, setSubmitting] = useState<false | 'draft' | 'send' | 'save'>(false);
  const picker = usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES);

  const validate = (): boolean => {
    if (!subject.trim()) {
      toast.error(t('internal.form.subjectRequired'));
      return false;
    }
    if (!question.trim()) {
      toast.error(t('internal.form.questionRequired'));
      return false;
    }
    return true;
  };

  const run = async (kind: 'draft' | 'send' | 'save') => {
    if (!validate()) return;
    setSubmitting(kind);
    try {
      if (props.mode === 'create') {
        const created = await createRfi(props.projectId, {
          subject: subject.trim(),
          question: question.trim(),
          dueDate: dueDate || undefined,
          photos: picker.photos,
          submit: kind === 'send',
        });
        toast.success(t(kind === 'send' ? 'internal.form.sent' : 'internal.form.draftSaved'));
        props.onDone(created);
      } else {
        const updated = await updateRfiDraft(props.rfi.id, {
          subject: subject.trim(),
          question: question.trim(),
          dueDate: dueDate || undefined,
        });
        toast.success(t('internal.form.updated'));
        props.onDone(updated);
      }
    } catch {
      toast.error(t('internal.form.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void run(props.mode === 'edit' ? 'save' : 'send'); }}
      className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/50 px-4 py-4 space-y-3"
    >
      <p className="text-xs font-semibold text-[#0A0A0A]">
        {t(props.mode === 'edit' ? 'internal.form.editTitle' : 'internal.form.title')}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor={`rfi-subject-${editing?.id ?? 'new'}`} className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.subjectLabel')}
          </label>
          <input
            id={`rfi-subject-${editing?.id ?? 'new'}`}
            type="text"
            maxLength={200}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('internal.form.subjectPlaceholder')}
            className="w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            autoFocus
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`rfi-question-${editing?.id ?? 'new'}`} className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.questionLabel')}
          </label>
          <textarea
            id={`rfi-question-${editing?.id ?? 'new'}`}
            maxLength={10000}
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('internal.form.questionPlaceholder')}
            className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
          />
        </div>
        <div>
          <label htmlFor={`rfi-due-${editing?.id ?? 'new'}`} className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
            {t('internal.form.dueDateLabel')}
          </label>
          <input
            id={`rfi-due-${editing?.id ?? 'new'}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        </div>
      </div>
      {props.mode === 'create' && (
        <PhotoPickerRow picker={picker} label={t('internal.form.photosLabel', { max: MAX_INTERNAL_PHOTOS })} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {props.mode === 'create' ? (
          <>
            <button
              type="submit"
              disabled={submitting !== false}
              className="h-9 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {submitting === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {submitting === 'send' ? t('internal.form.sending') : t('internal.form.send')}
            </button>
            <button
              type="button"
              disabled={submitting !== false}
              onClick={() => void run('draft')}
              className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white disabled:opacity-50 text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] inline-flex items-center gap-1.5 transition-colors"
            >
              {submitting === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('internal.form.saveDraft')}
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={submitting !== false}
            className="h-9 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {submitting === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('internal.form.saveChanges')}
          </button>
        )}
        <button
          type="button"
          onClick={props.onCancel}
          className="h-9 px-3.5 rounded-lg border border-[#D4D4D8] bg-white text-xs font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
        >
          {t('internal.form.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Shared impact fields: YES/NO/TBD selects + conditional quantification. */
function ImpactFields({ cost, setCost, amountQ, setAmountQ, schedule, setSchedule, days, setDays }: {
  cost: RfiImpact;
  setCost: (v: RfiImpact) => void;
  amountQ: string;
  setAmountQ: (v: string) => void;
  schedule: RfiImpact;
  setSchedule: (v: RfiImpact) => void;
  days: string;
  setDays: (v: string) => void;
}) {
  const { t } = useTranslation(['rfi']);
  const impactOptions: RfiImpact[] = ['TBD', 'YES', 'NO'];

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <label htmlFor="rfi-impact-cost" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
          {t('impact.cost')}
        </label>
        <select
          id="rfi-impact-cost"
          value={cost}
          onChange={(e) => setCost(e.target.value as RfiImpact)}
          className="w-full h-9 px-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
        >
          {impactOptions.map((opt) => (
            <option key={opt} value={opt}>{t(`impact.${opt}`)}</option>
          ))}
        </select>
        {cost === 'YES' && (
          <input
            aria-label={t('impact.amount')}
            type="number"
            min="0"
            step="0.01"
            value={amountQ}
            onChange={(e) => setAmountQ(e.target.value)}
            placeholder={t('impact.amount')}
            className="mt-1.5 w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        )}
      </div>
      <div>
        <label htmlFor="rfi-impact-schedule" className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1">
          {t('impact.schedule')}
        </label>
        <select
          id="rfi-impact-schedule"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value as RfiImpact)}
          className="w-full h-9 px-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
        >
          {impactOptions.map((opt) => (
            <option key={opt} value={opt}>{t(`impact.${opt}`)}</option>
          ))}
        </select>
        {schedule === 'YES' && (
          <input
            aria-label={t('impact.days')}
            type="number"
            min="0"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder={t('impact.days')}
            className="mt-1.5 w-full h-9 px-3 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
        )}
      </div>
    </div>
  );
}

const centsFromQ = (q: string): number | null => {
  const parsed = Number(q);
  return q.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

const daysFromInput = (d: string): number | null => {
  const parsed = Number(d);
  return d.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

function ImpactsForm({ rfi, onSaved, onCancel }: {
  rfi: Rfi;
  onSaved: (rfi: Rfi) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation(['rfi']);
  const [cost, setCost] = useState<RfiImpact>(rfi.costImpact);
  const [amountQ, setAmountQ] = useState(rfi.costImpactAmountCents != null ? String(rfi.costImpactAmountCents / 100) : '');
  const [schedule, setSchedule] = useState<RfiImpact>(rfi.scheduleImpact);
  const [days, setDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      onSaved(await updateRfiImpacts(rfi.id, {
        costImpact: cost,
        costImpactAmountCents: cost === 'YES' ? centsFromQ(amountQ) : null,
        scheduleImpact: schedule,
        scheduleImpactDays: schedule === 'YES' ? daysFromInput(days) : null,
      }));
    } catch {
      toast.error(t('internal.actionFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#D4D4D8] bg-[#FAFAFA]/50 px-3 py-3 space-y-3">
      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{t('internal.impacts')}</p>
      <ImpactFields
        cost={cost} setCost={setCost} amountQ={amountQ} setAmountQ={setAmountQ}
        schedule={schedule} setSchedule={setSchedule} days={days} setDays={setDays}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="h-9 px-3.5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.impacts.save')}
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

/** Close = pick THE official answer from the thread + settle the impacts. */
function CloseRfiForm({ rfi, detail, onClosed, onCancel }: {
  rfi: Rfi;
  detail: Rfi | null;
  onClosed: (rfi: Rfi) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation(['rfi']);
  const [officialId, setOfficialId] = useState<number | null>(null);
  const [cost, setCost] = useState<RfiImpact>(rfi.costImpact);
  const [amountQ, setAmountQ] = useState(rfi.costImpactAmountCents != null ? String(rfi.costImpactAmountCents / 100) : '');
  const [schedule, setSchedule] = useState<RfiImpact>(rfi.scheduleImpact);
  const [days, setDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : '');
  const [busy, setBusy] = useState(false);

  const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    );

  const submit = async () => {
    if (officialId == null || busy) return;
    setBusy(true);
    try {
      onClosed(await closeRfi(rfi.id, {
        officialResponseId: officialId,
        costImpact: cost,
        costImpactAmountCents: cost === 'YES' ? centsFromQ(amountQ) : null,
        scheduleImpact: schedule,
        scheduleImpactDays: schedule === 'YES' ? daysFromInput(days) : null,
      }));
    } catch {
      toast.error(t('internal.actionFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 space-y-3">
      <p className="text-xs font-semibold text-emerald-800">{t('internal.close.title')}</p>

      {!detail && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 text-emerald-700 animate-spin" />
        </div>
      )}
      {detail && detail.responses.length === 0 && (
        <p className="text-xs text-emerald-800">{t('internal.close.needResponse')}</p>
      )}
      {detail && detail.responses.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">{t('internal.close.pick')}</p>
          <ul className="space-y-1.5">
            {detail.responses.map((entry) => (
              <li key={entry.id}>
                <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 cursor-pointer hover:border-emerald-400 transition-colors">
                  <input
                    type="radio"
                    name={`rfi-official-${rfi.id}`}
                    checked={officialId === entry.id}
                    onChange={() => setOfficialId(entry.id)}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold text-[#0A0A0A]">
                      {entry.byClient ? t('internal.responses.client') : (entry.authorName ?? '—')}
                      <span className="text-[#71717A] font-normal ml-1.5">{fmtDateTime(entry.createdAt)}</span>
                    </span>
                    <span className="block text-sm text-[#0A0A0A] whitespace-pre-wrap">
                      {entry.body.length > 160 ? `${entry.body.slice(0, 160)}…` : entry.body}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">{t('internal.close.impactsHint')}</p>
          <ImpactFields
            cost={cost} setCost={setCost} amountQ={amountQ} setAmountQ={setAmountQ}
            schedule={schedule} setSchedule={setSchedule} days={days} setDays={setDays}
          />
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || officialId == null}
          onClick={() => void submit()}
          className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.close.confirm')}
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
