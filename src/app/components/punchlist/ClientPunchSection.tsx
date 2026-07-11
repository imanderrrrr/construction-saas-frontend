// BuildTrack — Client-portal punch list section (fase 2): the building owner
// reports items to finish/fix (with photos), tracks their state, and
// confirms/rejects the ones the builder marked ready. Rendered inside the
// public ClientView page; auth is the portal session token (Bearer).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera, CheckCircle2, ClipboardList, Loader2, MapPin, MessageSquare, Plus,
  Send, Undo2, X,
} from 'lucide-react';
import { ApiError } from '../../lib/api';
import { clientAuthHeaders, type ClientViewSession } from '../../services/clientView';
import {
  addClientPunchComment,
  clientPunchPhotoUrl,
  confirmClientPunchItem,
  createClientPunchItem,
  getClientPunchComments,
  getClientPunchItems,
  MAX_REPORT_PHOTO_BYTES,
  MAX_REPORT_PHOTOS,
  rejectClientPunchItem,
  type ClientPunchItem,
  type ClientPunchItemComment,
  type ClientPunchItemPhoto,
  type ClientPunchItemStatus,
} from '../../services/clientPunchItems';
import { AuthImage } from '../sitelog/AuthImage';
import { Lightbox, type LightboxImage } from '../sitelog/Lightbox';

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<ClientPunchItemStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  READY_FOR_REVIEW: 'bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/30',
  REOPENED: 'bg-red-50 text-red-700 border-red-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function ClientPunchSection({ session, onGone }: {
  session: ClientViewSession;
  /** The share link died mid-browse (410) — the parent page shows its dead-link state. */
  onGone: () => void;
}) {
  const { t, i18n } = useTranslation(['punchList']);

  const [items, setItems] = useState<ClientPunchItem[]>([]);
  const [pageNum, setPageNum] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [actionErrorId, setActionErrorId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const isGone = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 410 || err.code === 'CLIENT_VIEW_GONE');

  const loadPage = useCallback(async (page: number, append: boolean) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getClientPunchItems(session.sessionToken, page, PAGE_SIZE);
      setItems((prev) => (append ? [...prev, ...res.content] : res.content));
      setPageNum(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isGone(err)) onGone();
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [session.sessionToken, onGone]);

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const fmtDate = (iso: string): string =>
    new Date(iso).toLocaleDateString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'long', year: 'numeric' },
    );

  // ── report form ─────────────────────────────────────────────────────

  const handlePhotoFiles = (list: FileList | null) => {
    if (!list) return;
    setFormError(null);
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) {
        setFormError(t('client.form.photoInvalidType'));
        continue;
      }
      if (file.size > MAX_REPORT_PHOTO_BYTES) {
        setFormError(t('client.form.photoTooLarge', { mb: MAX_REPORT_PHOTO_BYTES / (1024 * 1024) }));
        continue;
      }
      if (next.length >= MAX_REPORT_PHOTOS) {
        setFormError(t('client.form.tooManyPhotos', { max: MAX_REPORT_PHOTOS }));
        break;
      }
      next.push(file);
    }
    setPhotos(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setPhotos([]);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError(t('client.form.titleRequired'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createClientPunchItem(session.sessionToken, {
        title: title.trim(),
        description,
        location,
        photos,
      });
      setItems((prev) => [created, ...prev]);
      resetForm();
      setReportOpen(false);
    } catch (err) {
      if (isGone(err)) {
        onGone();
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError(t('client.form.rateLimited'));
      } else if (err instanceof ApiError && err.code === 'PUNCH_ITEM_LIMIT_REACHED') {
        setFormError(t('client.form.limitReached'));
      } else {
        setFormError(t('client.form.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── review actions ──────────────────────────────────────────────────

  const replaceItem = (updated: ClientPunchItem) =>
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));

  const handleConfirm = async (item: ClientPunchItem) => {
    setConfirmingId(item.id);
    setActionErrorId(null);
    try {
      replaceItem(await confirmClientPunchItem(session.sessionToken, item.id));
    } catch (err) {
      if (isGone(err)) onGone();
      else setActionErrorId(item.id);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReject = async (item: ClientPunchItem) => {
    setRejectSubmitting(true);
    setActionErrorId(null);
    try {
      replaceItem(await rejectClientPunchItem(session.sessionToken, item.id, rejectNote));
      setRejectingId(null);
      setRejectNote('');
    } catch (err) {
      if (isGone(err)) onGone();
      else setActionErrorId(item.id);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const openLightbox = (item: ClientPunchItem, photoId: number) => {
    const images: LightboxImage[] = item.photos.map((p) => ({
      id: p.id,
      url: clientPunchPhotoUrl(p),
      alt: item.title,
      caption: t(p.kind === 'EVIDENCE' ? 'client.item.evidencePhotos' : 'client.item.reportPhotos'),
      downloadName: `pendiente-${item.id}-${p.id}`,
    }));
    const index = Math.max(0, images.findIndex((img) => img.id === photoId));
    setLightbox({ images, index });
  };

  const hasMore = pageNum + 1 < totalPages;

  // ── render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Intro + report button */}
      <section className="bg-white rounded-xl border border-[#D4D4D8] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#0A0A0A]">{t('client.title')}</h2>
            <p className="text-sm text-[#71717A] mt-1 max-w-md">{t('client.subtitle')}</p>
          </div>
          {!reportOpen && (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('client.report')}
            </button>
          )}
        </div>

        {reportOpen && (
          <form onSubmit={handleSubmit} className="mt-5 pt-5 border-t border-[#F4F4F5] space-y-4">
            <div>
              <label htmlFor="punch-title" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5">
                {t('client.form.titleLabel')}
              </label>
              <input
                id="punch-title"
                type="text"
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('client.form.titlePlaceholder')}
                className="w-full h-10 px-3 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="punch-description" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5">
                {t('client.form.descriptionLabel')}
              </label>
              <textarea
                id="punch-description"
                maxLength={2000}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('client.form.descriptionPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
              />
            </div>
            <div>
              <label htmlFor="punch-location" className="block text-xs font-semibold text-[#0A0A0A] mb-1.5">
                {t('client.form.locationLabel')}
              </label>
              <input
                id="punch-location"
                type="text"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('client.form.locationPlaceholder')}
                className="w-full h-10 px-3 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#0A0A0A] mb-1.5">
                {t('client.form.photosLabel', { max: MAX_REPORT_PHOTOS })}
              </span>
              <div className="flex flex-wrap gap-2">
                {photos.map((file, i) => (
                  <PhotoPreview key={`${file.name}-${i}`} file={file} onRemove={() => {
                    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
                    setFormError(null);
                  }} />
                ))}
                {photos.length < MAX_REPORT_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-[#D4D4D8] hover:border-[#F97316] flex flex-col items-center justify-center gap-1 text-[#71717A] hover:text-[#F97316] transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-medium">{t('client.form.addPhoto')}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handlePhotoFiles(e.target.files)}
              />
            </div>

            {formError && <p className="text-sm text-red-600" role="alert">{formError}</p>}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? t('client.form.submitting') : t('client.form.submit')}
              </button>
              <button
                type="button"
                onClick={() => { setReportOpen(false); resetForm(); }}
                className="h-10 px-4 rounded-lg border border-[#D4D4D8] text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
              >
                {t('client.form.cancel')}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Load error */}
      {loadError && (
        <div className="bg-white rounded-xl border border-red-200 p-5 text-center">
          <p className="text-sm text-red-700 mb-3">{t('client.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void loadPage(0, false)}
            className="h-9 px-4 rounded-lg border border-[#D4D4D8] text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA]"
          >
            {t('client.retry')}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loadError && items.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-14 px-4 text-center">
          <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <ClipboardList className="w-7 h-7 text-[#D4D4D8]" />
          </div>
          <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('client.empty.title')}</p>
          <p className="text-xs text-[#71717A]">{t('client.empty.subtitle')}</p>
        </div>
      )}

      {/* Items */}
      {items.map((item) => {
        const reportPhotos = item.photos.filter((p) => p.kind === 'REPORT');
        const evidencePhotos = item.photos.filter((p) => p.kind === 'EVIDENCE');
        return (
          <article key={item.id} className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
            <header className="px-4 sm:px-6 py-3 border-b border-[#F4F4F5] bg-[#FAFAFA]/60 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-sm sm:text-base font-semibold text-[#F97316] tabular-nums">{item.displayNumber}</span>
                <h3 className="text-sm sm:text-base font-semibold text-[#0A0A0A]">{item.title}</h3>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_STYLES[item.status]}`}>
                {t(`status.${item.status}`)}
              </span>
            </header>

            <div className="p-4 sm:p-6 space-y-4">
              <p className="text-xs text-[#71717A]">{t('client.item.reportedOn', { date: fmtDate(item.createdAt) })}</p>

              {item.location && (
                <p className="text-sm text-[#0A0A0A] inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                  {item.location}
                </p>
              )}

              {item.description && (
                <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{item.description}</p>
              )}

              {item.lastRejectNote && item.status === 'REOPENED' && (
                <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <p className="text-[11px] font-semibold text-red-700 mb-0.5">{t('client.item.yourRejectNote')}</p>
                  <p className="text-sm text-red-800 whitespace-pre-wrap">{item.lastRejectNote}</p>
                </div>
              )}

              {reportPhotos.length > 0 && (
                <PhotoGrid
                  label={t('client.item.reportPhotos')}
                  photos={reportPhotos}
                  sessionToken={session.sessionToken}
                  onOpen={(photoId) => openLightbox(item, photoId)}
                />
              )}

              {/* Ready-for-review block: builder's note + evidence + actions */}
              {item.status === 'READY_FOR_REVIEW' && (
                <div className="rounded-lg bg-[#F97316]/5 border border-[#F97316]/20 px-3 py-3 space-y-3">
                  <p className="text-sm text-[#0A0A0A]">{t('client.item.reviewHint')}</p>
                  {item.readyAt && (
                    <p className="text-xs text-[#71717A]">{t('client.item.readyOn', { date: fmtDate(item.readyAt) })}</p>
                  )}
                  {item.readyNote && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-0.5">{t('client.item.readyNote')}</p>
                      <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{item.readyNote}</p>
                    </div>
                  )}
                  {evidencePhotos.length > 0 && (
                    <PhotoGrid
                      label={t('client.item.evidencePhotos')}
                      photos={evidencePhotos}
                      sessionToken={session.sessionToken}
                      onOpen={(photoId) => openLightbox(item, photoId)}
                    />
                  )}

                  {actionErrorId === item.id && (
                    <p className="text-sm text-red-600" role="alert">{t('client.item.actionFailed')}</p>
                  )}

                  {item.canReview && rejectingId !== item.id && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={confirmingId === item.id}
                        onClick={() => void handleConfirm(item)}
                        className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                      >
                        {confirmingId === item.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <CheckCircle2 className="w-4 h-4" />}
                        {confirmingId === item.id ? t('client.item.confirming') : t('client.item.confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectingId(item.id); setRejectNote(''); }}
                        className="h-10 px-4 rounded-lg border border-[#D4D4D8] bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors inline-flex items-center gap-2"
                      >
                        <Undo2 className="w-4 h-4" />
                        {t('client.item.reject')}
                      </button>
                    </div>
                  )}

                  {item.canReview && rejectingId === item.id && (
                    <div className="space-y-2 pt-1">
                      <label htmlFor={`reject-note-${item.id}`} className="block text-xs font-semibold text-[#0A0A0A]">
                        {t('client.item.rejectNoteLabel')}
                      </label>
                      <textarea
                        id={`reject-note-${item.id}`}
                        maxLength={500}
                        rows={2}
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder={t('client.item.rejectNotePlaceholder')}
                        className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={rejectSubmitting}
                          onClick={() => void handleReject(item)}
                          className="h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2"
                        >
                          {rejectSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                          {rejectSubmitting ? t('client.item.rejecting') : t('client.item.rejectSubmit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(null); setRejectNote(''); }}
                          className="h-10 px-4 rounded-lg border border-[#D4D4D8] text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
                        >
                          {t('client.form.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comment thread with the construction team (fase 3, D5) */}
              <ClientCommentThread session={session} item={item} onGone={onGone} />

              {/* Closed summary (evidence stays visible) */}
              {item.status === 'CLOSED' && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 space-y-2">
                  <p className="text-xs text-emerald-800">
                    {item.closedAt ? t('client.item.closedOn', { date: fmtDate(item.closedAt) }) : t('status.CLOSED')}
                    {item.closedByCompany ? ` · ${t('client.item.closedByCompany')}` : ''}
                  </p>
                  {item.closeNote && (
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">{t('client.item.closeNote')}</p>
                      <p className="text-sm text-emerald-900 whitespace-pre-wrap">{item.closeNote}</p>
                    </div>
                  )}
                  {evidencePhotos.length > 0 && (
                    <PhotoGrid
                      label={t('client.item.evidencePhotos')}
                      photos={evidencePhotos}
                      sessionToken={session.sessionToken}
                      onOpen={(photoId) => openLightbox(item, photoId)}
                    />
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadPage(pageNum + 1, true)}
            className="h-10 px-5 rounded-lg border border-[#D4D4D8] bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
          >
            {t('client.loadMore')}
          </button>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
          imageHeaders={clientAuthHeaders(session.sessionToken)}
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

// ──────────────────────────── sub-components ────────────────────────────

/**
 * The item's shared conversation, portal face (fase 3, D5): the client talks
 * with the construction company about THIS item. Identity is deliberately
 * anonymous team-side (D7): the payload only says `byClient`, rendered here
 * as the client's own name (the session knows it) or the localized
 * "construction team" label — never an internal user's name.
 */
function ClientCommentThread({ session, item, onGone }: {
  session: ClientViewSession;
  item: ClientPunchItem;
  onGone: () => void;
}) {
  const { t, i18n } = useTranslation(['punchList']);
  const [thread, setThread] = useState<ClientPunchItemComment[] | 'loading' | 'error' | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const commentCount = Array.isArray(thread) ? thread.length : item.commentCount;

  const isGone = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 410 || err.code === 'CLIENT_VIEW_GONE');

  const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    );

  const toggle = async () => {
    if (thread) {
      setThread(null);
      return;
    }
    setThread('loading');
    try {
      setThread(await getClientPunchComments(session.sessionToken, item.id));
    } catch (err) {
      if (isGone(err)) onGone();
      else setThread('error');
    }
  };

  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const created = await addClientPunchComment(session.sessionToken, item.id, body);
      setThread((prev) => (Array.isArray(prev) ? [...prev, created] : [created]));
      setBody('');
    } catch (err) {
      if (isGone(err)) onGone();
      else if (err instanceof ApiError && err.status === 429) setSendError(t('client.comments.rateLimited'));
      else setSendError(t('client.comments.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#F4F4F5] bg-[#FAFAFA]/60 px-3 py-2 space-y-2">
      <button
        type="button"
        onClick={() => void toggle()}
        className="h-8 rounded-lg text-xs font-semibold text-[#0A0A0A] inline-flex items-center gap-1.5 hover:text-[#F97316] transition-colors"
      >
        <MessageSquare className="w-4 h-4 text-[#F97316]" />
        {t('client.comments.toggle', { count: commentCount })}
      </button>

      {thread === 'loading' && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
        </div>
      )}
      {thread === 'error' && (
        <p className="text-xs text-red-600">{t('client.comments.loadFailed')}</p>
      )}

      {Array.isArray(thread) && (
        <>
          {thread.length === 0 && (
            <p className="text-xs text-[#71717A]">{t('client.comments.empty')}</p>
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
                    {comment.byClient ? session.project.clientName : t('client.comments.team')}
                  </span>
                  <span className="text-[#71717A] ml-1.5">{fmtDateTime(comment.createdAt)}</span>
                </p>
                <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{comment.body}</p>
              </li>
            ))}
          </ul>

          {sendError && <p className="text-xs text-red-600" role="alert">{sendError}</p>}

          <div className="flex items-end gap-2">
            <textarea
              aria-label={t('client.comments.placeholder')}
              maxLength={2000}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('client.comments.placeholder')}
              className="flex-1 px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
            />
            <button
              type="button"
              disabled={sending || !body.trim()}
              onClick={() => void submit()}
              className="h-10 px-4 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('client.comments.send')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Local (not-yet-uploaded) photo thumbnail with a remove button. */
function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#D4D4D8]">
      {url && <img src={url} alt={file.name} className="w-full h-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`remove-${file.name}`}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function PhotoGrid({ label, photos, sessionToken, onOpen }: {
  label: string;
  photos: ClientPunchItemPhoto[];
  sessionToken: string;
  onOpen: (photoId: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Camera className="w-3.5 h-3.5 text-[#F97316]" />
        <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{label}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(photo.id)}
            className="aspect-square overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
          >
            <AuthImage
              src={clientPunchPhotoUrl(photo)}
              alt=""
              className="w-full h-full object-cover"
              headers={clientAuthHeaders(sessionToken)}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
