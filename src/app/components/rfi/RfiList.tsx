// BuildTrack — Internal RFI view ("Consultas de obra", Procore-style).
// Shared by the admin project ficha (Consultas tab) and the supervisor
// section: drafts (edit/send/discard), the answer thread with the client,
// impacts, and closing with THE official response.
//
// Look (Claude Design "Proyectos BuildTrack" 03E + "Proyectos Ventanas"
// 04J–04L): cards with an edge only when it is our move (orange) or the answer
// is overdue (red); the draft card is dashed on paper; the new / edit form is
// a 492 px drawer; impacts and replies are in-line panels; closing is a modal
// because it freezes the record.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, MessageSquare, Plus, Send } from 'lucide-react';
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
import { cn } from '../ui/utils';
import { DestroyButton, FOCUS_RING, PrimaryButton, SecondaryButton, TertiaryButton } from '../onboarding/chrome';
import { BtDrawer, BtModal } from '../bt/windows';
import { PhotoGrid, usePhotoPicker, type PickerMessages } from '../bt/PhotoPicker';
import { Bone, CreateButton, EmptyWord, FieldError, FieldHint, FieldLabel, INPUT, INPUT_MONO, Mono, MonoSelect, PaperNote } from '../projects/bt';
import { initialsOf } from '../projects/badges';

export interface RfiProject {
  id: number;
  name: string;
}

const STATUS_FILTERS: (RfiStatus | 'ALL')[] = ['ALL', 'DRAFT', 'OPEN', 'RESPONDED', 'CLOSED'];

const CHIP = 'inline-flex items-center font-bt-mono text-[9.5px] uppercase tracking-[0.1em] leading-none px-2 py-[5px] whitespace-nowrap';
const STATUS_LOOK: Record<RfiStatus, string> = {
  DRAFT: 'border border-[#CDBFA6] text-[#8A8175]',
  OPEN: 'border border-[#DBD0BB] text-[#5A5346]',
  RESPONDED: 'bg-[#F3EEE4] text-[#0A0A0A]',
  CLOSED: 'bg-[#0A0A0A] text-[#F5F1E8]',
};
const CHIP_FILTER = 'px-3 py-[7px] border font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors';
const TEXTAREA = cn(INPUT, 'h-auto min-h-[62px] py-2 resize-y text-[13.5px] leading-[1.5]');
const IMPACT_OPTIONS: RfiImpact[] = ['YES', 'NO', 'TBD'];

const fmtUsd = (cents: number): string =>
  `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

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
      caption: t('internal.photoOf', { number: rfi.displayNumber ?? rfi.subject }),
      meta: t('internal.photoBy', { name: p.uploadedByName ?? '—', date: fmtDate(p.createdAt) }),
      downloadName: p.fileName ?? `rfi-${rfi.id}-${p.id}`,
    }));
    const index = Math.max(0, images.findIndex((img) => img.id === photoId));
    setLightbox({ images, index });
  };

  if (projects.length === 0) return null;

  const visibleItems = mineOnly ? items.filter((it) => it.ballInCourt === 'COMPANY') : items;

  return (
    <div className="bg-white border border-[#E7E1D5] overflow-hidden">
      {/* Header — the subventana's title and purpose (sheet 03E) */}
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
          <CreateButton onClick={() => setCreateOpen(true)} className="px-3.5 py-[10px] text-[10px]">
            <Plus className="w-3.5 h-3.5" />
            {t('internal.new')}
          </CreateButton>
        </div>
      </div>

      <div className="px-4 py-4 md:px-[22px] md:pb-5 space-y-3">
        {/* Filters: status chips + "my move" toggle */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('internal.filter.all')}>
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
          <button
            type="button"
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
            className={cn(
              CHIP_FILTER,
              mineOnly ? 'bg-[#F97316] text-[#0A0A0A] border-[#F97316]' : 'bg-white text-[#5A5346] border-[#DBD0BB] hover:border-[#F97316] hover:text-[#C2410C]',
              FOCUS_RING,
            )}
          >
            {t('internal.filter.mine')}
          </button>
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

        {!loading && !loadError && visibleItems.length === 0 && (
          <EmptyWord word={t('internal.empty.title')} title={t('internal.empty.title')} hint={t('internal.empty.subtitle')} className="border-0 py-9" />
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

      {project && (
        <RfiDrawer
          open={createOpen}
          mode="create"
          projectId={project.id}
          projectName={project.name}
          onDone={(rfi) => {
            setCreateOpen(false);
            setItems((prev) => [rfi, ...prev]);
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
  const { t } = useTranslation(['rfi', 'common']);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    setBusy(true);
    try {
      await deleteRfiDraft(rfi.id);
      toast.success(t('internal.draft.deleted'));
      setDeleteOpen(false);
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
        rfi.costImpact === 'YES' && rfi.costImpactAmountCents != null ? ` (${fmtUsd(rfi.costImpactAmountCents)})` : ''
      }`);
    }
    if (rfi.scheduleImpact !== 'TBD') {
      parts.push(`${t('impact.schedule')}: ${t(`impact.${rfi.scheduleImpact}`)}${
        rfi.scheduleImpact === 'YES' && rfi.scheduleImpactDays != null ? ` (${rfi.scheduleImpactDays} d)` : ''
      }`);
    }
    return parts.length ? parts.join(' · ') : null;
  };

  const edge = isDraft
    ? 'border-dashed border-[#CDBFA6] bg-[#FBF8F2]'
    : rfi.overdue
      ? 'border-[#E4E4E7] border-l-[3px] border-l-[#B3402A]'
      : rfi.ballInCourt === 'COMPANY'
        ? 'border-[#E4E4E7] border-l-[3px] border-l-[#F97316]'
        : 'border-[#E4E4E7]';

  const meta: string[] = [];
  if (rfi.dueDate) meta.push(`${t('internal.dueDate')} ${fmtDay(rfi.dueDate)}`);
  if (!isDraft && rfi.submittedAt) meta.push(t('internal.sentBy', { name: rfi.submittedByName ?? '—', date: fmtDate(rfi.submittedAt) }));
  if (rfi.respondedAt) meta.push(t('internal.respondedAt', { date: fmtDate(rfi.respondedAt) }));
  if (isClosed && rfi.closedAt) meta.push(t('internal.closedBy', { name: rfi.closedByName ?? '—', date: fmtDate(rfi.closedAt) }));

  return (
    <article className={cn('border bg-white', edge)}>
      <div className="px-4 py-3.5 md:px-[18px] md:py-4 flex flex-col gap-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {rfi.displayNumber && (
              <span className="font-bt-display font-extrabold text-[22px] leading-none text-[#C2410C] tabular-nums">{rfi.displayNumber}</span>
            )}
            <span className={cn(CHIP, STATUS_LOOK[rfi.status])}>{t(`status.${rfi.status}`)}</span>
            {rfi.ballInCourt !== 'NONE' && (
              <span
                data-tour="sec.projects-ficha-consultas.turn"
                className={cn(CHIP, rfi.ballInCourt === 'CLIENT' ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]')}
              >
                {t(`ball.${rfi.ballInCourt}`)}
              </span>
            )}
            {rfi.overdue && (
              <span className={cn(CHIP, 'border border-[#B3402A] text-[#B3402A]')}>{t('status.overdue')}</span>
            )}
          </div>
          {!isDraft && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                data-tour="sec.projects-ficha-consultas.official"
                onClick={() => { setThreadOpen((v) => !v); ensureDetail(); }}
                className={cn('inline-flex items-center gap-1.5 font-bt-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#5A5346] hover:text-[#C2410C] transition-colors', FOCUS_RING)}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={2} />
                {t('internal.responses.toggle', { count: loadedDetail ? loadedDetail.responses.length : rfi.responseCount })}
              </button>
              <TertiaryButton onClick={() => { setTimelineOpen((v) => !v); ensureDetail(); }} className="inline-flex items-center gap-1 text-[9.5px] font-semibold text-[#5A5346]">
                {timelineOpen ? t('internal.timeline.hide') : t('internal.timeline.show')}
                {!timelineOpen && <ArrowRight className="w-3 h-3" strokeWidth={2.2} />}
              </TertiaryButton>
            </div>
          )}
        </header>

        <div>
          <h4 className="text-[15px] font-semibold text-[#0A0A0A] leading-snug">{rfi.subject}</h4>
          <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175] leading-[1.7] mt-1">
            {isDraft
              ? <>{fmtDate(rfi.createdAt)} · {t('internal.createdBy')} {rfi.createdByName}</>
              : meta.map((part, i) => (
                <span key={i} className={cn(i === 0 && rfi.overdue && rfi.dueDate && 'text-[#B3402A] font-semibold')}>
                  {i > 0 && ' · '}{part}
                </span>
              ))}
          </Mono>
          {isDraft && <Mono className="block text-[9.5px] tracking-[0.1em] text-[#C2410C] mt-1">{t('internal.draft.hint')}</Mono>}
        </div>

        <p className="text-[13.5px] leading-[1.55] text-[#0A0A0A] whitespace-pre-wrap">{rfi.question}</p>

        {rfi.questionPhotos.length > 0 && (
          <div>
            <Mono className="block text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">
              {t('internal.photos.question')} · {rfi.questionPhotos.length}
            </Mono>
            <div className="flex flex-wrap gap-2">
              {rfi.questionPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPhoto(rfi.questionPhotos, photo.id)}
                  className={cn('w-14 h-14 overflow-hidden border border-[#DBD0BB] hover:opacity-90 transition-opacity', FOCUS_RING)}
                >
                  <AuthImage src={rfiPhotoUrl(rfi.id, photo.id)} alt={photo.fileName ?? ''} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Impacts summary (always visible once decided) */}
        {!isDraft && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-tour="sec.projects-ficha-consultas.impacts">
            <Mono className="text-[9.5px] font-semibold tracking-[0.12em] text-[#5A5346]">{t('internal.impacts')}:</Mono>
            <span className="text-[13px] text-[#0A0A0A]">{impactsSummary() ?? t('impact.none')}</span>
            {inThread && (
              <TertiaryButton onClick={() => { setImpactsOpen((v) => !v); }} className="text-[9.5px] font-semibold text-[#C2410C]">
                {t('internal.impacts.edit')}
              </TertiaryButton>
            )}
          </div>
        )}

        {/* Draft actions */}
        {isDraft && (
          <div data-tour="sec.projects-ficha-consultas.draft" className="flex flex-wrap items-center gap-2.5 pt-1">
            <DestroyButton disabled={busy} onClick={() => setDeleteOpen(true)} className="px-3.5 py-[10px] text-[10px]">
              {t('internal.draft.delete')}
            </DestroyButton>
            <SecondaryButton disabled={busy} onClick={() => setEditOpen(true)} className="px-3.5 py-[10px] text-[10px]">
              {t('internal.draft.edit')}
            </SecondaryButton>
            <PrimaryButton disabled={busy} onClick={() => void sendDraft()} className="px-3.5 py-[10px] text-[10px] gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
              {t('internal.draft.send')}
            </PrimaryButton>
          </div>
        )}

        {isDraft && (
          <RfiDrawer
            open={editOpen}
            mode="edit"
            rfi={rfi}
            onDone={(updated) => {
              setEditOpen(false);
              onChanged(updated);
            }}
            onClose={() => setEditOpen(false)}
          />
        )}

        {isDraft && (
          <BtModal
            open={deleteOpen}
            onOpenChange={(o) => { if (!o && !busy) setDeleteOpen(false); }}
            width={440}
            kicker={t('status.DRAFT')}
            kickerTone="red"
            title={t('internal.draft.deleteTitle')}
            description={t('internal.draft.deleteBody')}
            closeDisabled={busy}
            footer={(
              <>
                <SecondaryButton onClick={() => setDeleteOpen(false)} disabled={busy} className="px-4 py-[11px]">{t('common:buttons.cancel')}</SecondaryButton>
                <DestroyButton onClick={() => void removeDraft()} disabled={busy} className="px-4 py-[11px]">
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('common:buttons.delete')}
                </DestroyButton>
              </>
            )}
          >
            <p className="text-[15px] font-semibold text-[#0A0A0A]">{rfi.subject}</p>
          </BtModal>
        )}

        {/* Open/responded actions */}
        {inThread && (
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <SecondaryButton disabled={busy} onClick={() => { setCloseOpen(true); ensureDetail(); }} className="px-3.5 py-[10px] text-[10px]">
              {t('internal.close')}
            </SecondaryButton>
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

        {inThread && (
          <CloseRfiModal
            open={closeOpen}
            rfi={rfi}
            detail={loadedDetail}
            fmtDate={fmtDate}
            onClosed={(updated) => {
              setCloseOpen(false);
              onChanged(updated);
              toast.success(t('internal.close.done'));
            }}
            onClose={() => setCloseOpen(false)}
          />
        )}

        {/* Thread */}
        {threadOpen && detail === 'loading' && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
          </div>
        )}
        {threadOpen && detail === 'error' && (
          <FieldError>{t('internal.responses.loadFailed')}</FieldError>
        )}
        {threadOpen && loadedDetail && (
          <RfiThread
            rfi={loadedDetail}
            canReply={inThread}
            fmtDate={fmtDate}
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
          <FieldError>{t('internal.timeline.loadFailed')}</FieldError>
        )}
        {timelineOpen && loadedDetail && (
          <div className="border-t border-[#F0EBE1] pt-3">
            <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2.5">{t('internal.timeline')}</Mono>
            <ol className="relative ml-[5px] pl-4 border-l border-[#DBD0BB] flex flex-col gap-2.5">
              {loadedDetail.events.map((event, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[21px] top-[3px] w-[9px] h-[9px]', i === 0 ? 'bg-[#F97316]' : 'bg-white border border-[#CDBFA6]')} aria-hidden="true" />
                  <Mono className="block text-[9.5px] tracking-[0.1em] text-[#8A8175]">{fmtDate(event.createdAt)}</Mono>
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
}

// ──────────────────────────── thread ────────────────────────────

/**
 * The RFI's conversation, internal face: full author names; the client's
 * answers labelled as the client. The hint reminds the team the OWNER READS
 * THIS THREAD on their portal. The official answer (once chosen) carries the
 * orange edge and the chip.
 */
function RfiThread({ rfi, canReply, fmtDate, onPosted, onOpenPhoto }: {
  rfi: Rfi;
  canReply: boolean;
  fmtDate: (iso: string) => string;
  onPosted: (entry: RfiResponseEntry) => void;
  onOpenPhoto: (photos: Rfi['questionPhotos'], photoId: number) => void;
}) {
  const { t } = useTranslation(['rfi']);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const picker = useRfiPicker();

  const fmtDateTime = (iso: string): string =>
    `${fmtDate(iso)} · ${new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

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
    <div className="border-t border-[#F0EBE1] pt-3 flex flex-col gap-3">
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">
        {t('internal.responses')} ({rfi.responses.length})
        <span className="ml-2 font-normal text-[#8A8175]">{t('internal.responses.visibleHint')}</span>
      </Mono>

      {rfi.responses.length === 0 && (
        <p className="text-[12.5px] italic text-[#A69C8D]">{t('internal.responses.empty')}</p>
      )}
      <ul className="flex flex-col gap-2.5">
        {rfi.responses.map((entry) => {
          const author = entry.byClient ? t('internal.responses.client') : (entry.authorName ?? '—');
          return (
            <li key={entry.id} className={cn('flex items-start gap-2.5', entry.byClient && 'flex-row-reverse')}>
              <span className={cn('w-[26px] h-[26px] flex items-center justify-center flex-shrink-0 font-bt-mono text-[9px]', entry.byClient ? 'bg-[#F97316] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-[#F5F1E8]')} aria-hidden="true">
                {entry.byClient ? 'CL' : initialsOf(author)}
              </span>
              <div className={cn('max-w-[78%] px-3 py-2.5', entry.byClient ? 'bg-[#FBEDE0] border border-[#F6CFA6]' : 'bg-[#FAF7F0]', entry.official && 'border-l-2 border-l-[#F97316]')}>
                <Mono className="flex flex-wrap items-center gap-2 text-[9.5px] tracking-[0.1em] text-[#8A8175] mb-1">
                  <span>{author} · {fmtDateTime(entry.createdAt)}</span>
                  {entry.official && <span className={cn(CHIP, 'bg-[#F97316] text-[#0A0A0A]')}>{t('internal.responses.official')}</span>}
                </Mono>
                <p className="text-[13.5px] leading-[1.5] text-[#0A0A0A] whitespace-pre-wrap">{entry.body}</p>
                {entry.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => onOpenPhoto(entry.photos, photo.id)}
                        className={cn('w-11 h-11 overflow-hidden border border-[#DBD0BB] hover:opacity-90 transition-opacity', FOCUS_RING)}
                      >
                        <AuthImage src={rfiPhotoUrl(rfi.id, photo.id)} alt={photo.fileName ?? ''} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canReply && (
        <div className="flex flex-col gap-2.5">
          <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('internal.responses.reply')}</Mono>
          <textarea
            aria-label={t('internal.responses.placeholder')}
            maxLength={2000}
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('internal.responses.placeholder')}
            className={TEXTAREA}
          />
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <PhotoGrid
              picker={picker}
              size={44}
              label={t('internal.photos.count', { count: picker.photos.length, max: MAX_INTERNAL_PHOTOS })}
              addLabel={t('internal.photos.add')}
              removeLabel={t('internal.photos.remove')}
            />
            <PrimaryButton disabled={sending || !body.trim()} onClick={() => void submit()} className="px-3.5 py-[10px] text-[10px] gap-1.5">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
              {t('internal.responses.send')}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────── forms ────────────────────────────

function useRfiPicker() {
  const { t } = useTranslation(['rfi']);
  const messages: PickerMessages = {
    invalidType: t('internal.photoInvalidType'),
    tooLarge: t('internal.photoTooLarge', { mb: MAX_INTERNAL_PHOTO_BYTES / (1024 * 1024) }),
    tooMany: t('internal.tooManyPhotos', { max: MAX_INTERNAL_PHOTOS }),
  };
  return usePhotoPicker(MAX_INTERNAL_PHOTOS, MAX_INTERNAL_PHOTO_BYTES, messages);
}

/** 04J — create (draft or direct send) and edit-draft share the 492 px drawer. */
function RfiDrawer(props:
  | { open: boolean; mode: 'create'; projectId: number; projectName: string; onDone: (rfi: Rfi) => void; onClose: () => void }
  | { open: boolean; mode: 'edit'; rfi: Rfi; onDone: (rfi: Rfi) => void; onClose: () => void }
) {
  const { t } = useTranslation(['rfi']);
  const editing = props.mode === 'edit' ? props.rfi : null;
  const [subject, setSubject] = useState(editing?.subject ?? '');
  const [question, setQuestion] = useState(editing?.question ?? '');
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? '');
  const [subjectError, setSubjectError] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [submitting, setSubmitting] = useState<false | 'draft' | 'send' | 'save' | 'saveSend'>(false);
  const picker = useRfiPicker();

  // Fresh form on every open (an edit drawer re-reads the draft).
  useEffect(() => {
    if (!props.open) return;
    setSubject(editing?.subject ?? '');
    setQuestion(editing?.question ?? '');
    setDueDate(editing?.dueDate ?? '');
    setSubjectError('');
    setQuestionError('');
    picker.setPhotos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const validate = (): boolean => {
    let ok = true;
    if (!subject.trim()) { setSubjectError(t('internal.form.subjectRequired')); ok = false; }
    if (!question.trim()) { setQuestionError(t('internal.form.questionRequired')); ok = false; }
    return ok;
  };

  const run = async (kind: 'draft' | 'send' | 'save' | 'saveSend') => {
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
        if (kind === 'saveSend') {
          const sent = await submitRfi(updated.id);
          toast.success(t('internal.form.sent'));
          props.onDone(sent);
        } else {
          toast.success(t('internal.form.updated'));
          props.onDone(updated);
        }
      }
    } catch {
      toast.error(t('internal.form.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const idSuffix = editing?.id ?? 'new';
  const busy = submitting !== false;

  return (
    <BtDrawer
      open={props.open}
      onOpenChange={(o) => { if (!o) props.onClose(); }}
      kicker={props.mode === 'create' ? props.projectName : `${t('internal.form.editTitle')} · ${editing?.subject ?? ''}`}
      title={props.mode === 'create' ? t('internal.form.title') : t('internal.form.editTitle')}
      closeDisabled={busy}
      footer={props.mode === 'create' ? (
        <>
          <SecondaryButton disabled={busy} onClick={() => void run('draft')} className="px-4 py-[11px]">
            {submitting === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('internal.form.saveDraft')}
          </SecondaryButton>
          <PrimaryButton type="submit" form={`rfi-form-${idSuffix}`} disabled={busy} className="px-[18px] py-[11px] gap-1.5">
            {submitting === 'send' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
            {submitting === 'send' ? t('internal.form.sending') : t('internal.form.send')}
          </PrimaryButton>
        </>
      ) : (
        <>
          <SecondaryButton type="submit" form={`rfi-form-${idSuffix}`} disabled={busy} className="px-4 py-[11px]">
            {submitting === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('internal.form.saveChanges')}
          </SecondaryButton>
          <PrimaryButton disabled={busy} onClick={() => void run('saveSend')} className="px-[18px] py-[11px] gap-1.5">
            {submitting === 'saveSend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={2} />}
            {t('internal.form.saveAndSend')}
          </PrimaryButton>
        </>
      )}
    >
      <form
        id={`rfi-form-${idSuffix}`}
        onSubmit={(e) => { e.preventDefault(); void run(props.mode === 'edit' ? 'save' : 'send'); }}
        className="flex flex-col gap-4"
      >
        <div>
          <FieldLabel htmlFor={`rfi-subject-${idSuffix}`} required>{t('internal.form.subjectLabel')}</FieldLabel>
          <input
            id={`rfi-subject-${idSuffix}`}
            type="text"
            maxLength={200}
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setSubjectError(''); }}
            placeholder={t('internal.form.subjectPlaceholder')}
            className={cn(INPUT, 'h-[38px]', subjectError && 'border-[#F97316]')}
            autoFocus
          />
          {subjectError && <FieldError>{subjectError}</FieldError>}
        </div>
        <div>
          <FieldLabel htmlFor={`rfi-question-${idSuffix}`} required>{t('internal.form.questionLabel')}</FieldLabel>
          <textarea
            id={`rfi-question-${idSuffix}`}
            maxLength={10000}
            rows={5}
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setQuestionError(''); }}
            placeholder={t('internal.form.questionPlaceholder')}
            className={cn(TEXTAREA, 'min-h-[130px]', questionError && 'border-[#F97316]')}
          />
          <div className="flex items-start justify-between gap-3">
            {questionError ? <FieldError>{questionError}</FieldError> : <FieldHint>{t('internal.form.questionHint')}</FieldHint>}
            <FieldHint className="flex-shrink-0">{t('internal.form.counter', { n: question.length.toLocaleString('en-US') })}</FieldHint>
          </div>
        </div>
        <div className="w-[170px]">
          <FieldLabel htmlFor={`rfi-due-${idSuffix}`}>{t('internal.form.dueDateLabel')}</FieldLabel>
          <input
            id={`rfi-due-${idSuffix}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={cn(INPUT, INPUT_MONO, 'h-[38px]')}
          />
        </div>
        {props.mode === 'create' && (
          <PhotoGrid
            picker={picker}
            label={t('internal.photos.count', { count: picker.photos.length, max: MAX_INTERNAL_PHOTOS })}
            hint={t('internal.photos.hint')}
            addLabel={t('internal.photos.add')}
            removeLabel={t('internal.photos.remove')}
          />
        )}
      </form>
    </BtDrawer>
  );
}

/** Sí / No / Por definir as joined squares; the quantity field wakes up only on "Sí". */
function ImpactFields({ cost, setCost, amountQ, setAmountQ, schedule, setSchedule, days, setDays, idPrefix }: {
  cost: RfiImpact;
  setCost: (v: RfiImpact) => void;
  amountQ: string;
  setAmountQ: (v: string) => void;
  schedule: RfiImpact;
  setSchedule: (v: RfiImpact) => void;
  days: string;
  setDays: (v: string) => void;
  idPrefix: string;
}) {
  const { t } = useTranslation(['rfi']);

  const toggle = (name: 'cost' | 'schedule', value: RfiImpact, set: (v: RfiImpact) => void, label: string) => (
    <div className="flex" role="group" aria-label={label}>
      {IMPACT_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          data-testid={`rfi-impact-${name}-${opt}`}
          aria-pressed={value === opt}
          onClick={() => set(opt)}
          className={cn(
            'h-[34px] px-3 border border-[#DBD0BB] -ml-px first:ml-0 font-bt-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors',
            value === opt ? 'bg-[#0A0A0A] text-[#F5F1E8] border-[#0A0A0A] relative z-[1]' : 'bg-white text-[#5A5346] hover:text-[#0A0A0A]',
            FOCUS_RING,
          )}
        >
          {t(`impact.${opt}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>{t('impact.cost')}</FieldLabel>
          {toggle('cost', cost, setCost, t('impact.cost'))}
        </div>
        <div className="w-[180px]">
          <FieldLabel htmlFor={`${idPrefix}-amount`}>{t('impact.amount')}</FieldLabel>
          <div className="flex">
            <span className="w-7 h-[34px] flex items-center justify-center border border-r-0 border-[#DBD0BB] bg-[#FAF7F0] font-bt-mono text-[12px] text-[#5A5346]">$</span>
            <input
              id={`${idPrefix}-amount`}
              aria-label={t('impact.amount')}
              type="number"
              min="0"
              step="0.01"
              value={amountQ}
              disabled={cost !== 'YES'}
              onChange={(e) => setAmountQ(e.target.value)}
              placeholder="0.00"
              className={cn(INPUT, INPUT_MONO, 'h-[34px] py-0 text-right')}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <FieldLabel>{t('impact.schedule')}</FieldLabel>
          {toggle('schedule', schedule, setSchedule, t('impact.schedule'))}
        </div>
        <div className="w-[120px]">
          <FieldLabel htmlFor={`${idPrefix}-days`}>{t('impact.days')}</FieldLabel>
          <input
            id={`${idPrefix}-days`}
            aria-label={t('impact.days')}
            type="number"
            min="0"
            step="1"
            value={days}
            disabled={schedule !== 'YES'}
            onChange={(e) => setDays(e.target.value)}
            placeholder="0"
            className={cn(INPUT, INPUT_MONO, 'h-[34px] py-0 text-right')}
          />
          <FieldHint>{t('internal.impacts.daysHint')}</FieldHint>
        </div>
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

/** 04K — in-line panel inside the card. */
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
    <div className="border border-[#DBD0BB] bg-[#FAF7F0] px-4 py-4 flex flex-col gap-3.5 max-w-[560px]">
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A]">{t('internal.impacts.title', { number: rfi.displayNumber ?? '' })}</Mono>
      <ImpactFields
        idPrefix={`rfi-impacts-${rfi.id}`}
        cost={cost} setCost={setCost} amountQ={amountQ} setAmountQ={setAmountQ}
        schedule={schedule} setSchedule={setSchedule} days={days} setDays={setDays}
      />
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
        <SecondaryButton onClick={onCancel} disabled={busy} className="px-3.5 py-[10px] text-[10px]">{t('internal.form.cancel')}</SecondaryButton>
        <PrimaryButton disabled={busy} onClick={() => void save()} className="px-3.5 py-[10px] text-[10px]">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {t('internal.impacts.save')}
        </PrimaryButton>
      </div>
    </div>
  );
}

/** 04L — close = pick THE official answer from the thread + settle the impacts. Modal: it freezes the record. */
function CloseRfiModal({ open, rfi, detail, fmtDate, onClosed, onClose }: {
  open: boolean;
  rfi: Rfi;
  detail: Rfi | null;
  fmtDate: (iso: string) => string;
  onClosed: (rfi: Rfi) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(['rfi', 'common']);
  const [officialId, setOfficialId] = useState<number | null>(null);
  const [cost, setCost] = useState<RfiImpact>(rfi.costImpact);
  const [amountQ, setAmountQ] = useState(rfi.costImpactAmountCents != null ? String(rfi.costImpactAmountCents / 100) : '');
  const [schedule, setSchedule] = useState<RfiImpact>(rfi.scheduleImpact);
  const [days, setDays] = useState(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOfficialId(null);
    setCost(rfi.costImpact);
    setAmountQ(rfi.costImpactAmountCents != null ? String(rfi.costImpactAmountCents / 100) : '');
    setSchedule(rfi.scheduleImpact);
    setDays(rfi.scheduleImpactDays != null ? String(rfi.scheduleImpactDays) : '');
    setBusy(false);
  }, [open, rfi]);

  const fmtDateTime = (iso: string): string =>
    `${fmtDate(iso)} · ${new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;

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
    <BtModal
      open={open}
      onOpenChange={(o) => { if (!o && !busy) onClose(); }}
      width={520}
      kicker={`${rfi.displayNumber ?? ''} · ${rfi.subject}`}
      title={t('internal.close.title')}
      closeDisabled={busy}
      dismissible={false}
      footer={(
        <>
          <SecondaryButton onClick={onClose} disabled={busy} className="px-4 py-[11px]">{t('internal.form.cancel')}</SecondaryButton>
          <PrimaryButton disabled={busy || officialId == null} onClick={() => void submit()} className="px-[18px] py-[11px]">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('internal.close.confirm')}
          </PrimaryButton>
        </>
      )}
    >
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mb-2.5">{t('internal.close.pick')}</Mono>

      {!detail && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
        </div>
      )}
      {detail && detail.responses.length === 0 && (
        <Mono className="block text-[9.5px] font-semibold tracking-[0.1em] text-[#C2410C]">{t('internal.close.needResponse')}</Mono>
      )}
      {detail && detail.responses.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {detail.responses.map((entry) => {
              const chosen = officialId === entry.id;
              return (
                <li key={entry.id}>
                  <label className={cn('flex items-start gap-2.5 border px-3 py-2.5 cursor-pointer transition-colors', chosen ? 'border-[#F97316] bg-[#FBEDE0]' : 'border-[#DBD0BB] bg-white hover:border-[#F97316]')}>
                    <input
                      type="radio"
                      name={`rfi-official-${rfi.id}`}
                      checked={chosen}
                      onChange={() => setOfficialId(entry.id)}
                      className="mt-0.5 accent-[#F97316]"
                    />
                    <span className="min-w-0 flex-1">
                      <Mono className="flex flex-wrap items-center gap-2 text-[9.5px] tracking-[0.1em] text-[#8A8175]">
                        <span>{entry.byClient ? t('internal.responses.client') : (entry.authorName ?? '—')} · {fmtDateTime(entry.createdAt)}</span>
                        {chosen && <span className={cn(CHIP, 'bg-[#F97316] text-[#0A0A0A]')}>{t('internal.close.chosen')}</span>}
                      </Mono>
                      <span className="block text-[13.5px] leading-[1.5] text-[#0A0A0A] whitespace-pre-wrap mt-1">
                        {entry.body.length > 160 ? `${entry.body.slice(0, 160)}…` : entry.body}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#0A0A0A] mt-5 mb-2.5">{t('internal.close.impactsHint')}</Mono>
          <ImpactFields
            idPrefix={`rfi-close-${rfi.id}`}
            cost={cost} setCost={setCost} amountQ={amountQ} setAmountQ={setAmountQ}
            schedule={schedule} setSchedule={setSchedule} days={days} setDays={setDays}
          />
        </>
      )}
    </BtModal>
  );
}
