// BuildTrack — Client-portal RFI section ("Consultas de obra"): the building
// owner reads the constructora's formal questions and ANSWERS them (text +
// photos). Rendered inside the public ClientView page; auth is the portal
// session token (Bearer). Team-side identity is anonymous by design.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, HelpCircle, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { clientAuthHeaders, type ClientViewSession } from '../../services/clientView';
import {
  clientRfiPhotoUrl,
  getClientRfiResponses,
  getClientRfis,
  MAX_RESPONSE_PHOTO_BYTES,
  MAX_RESPONSE_PHOTOS,
  respondClientRfi,
  type ClientRfi,
  type ClientRfiPhoto,
  type ClientRfiResponseEntry,
  type ClientRfiStatus,
} from '../../services/clientRfis';
import { AuthImage } from '../sitelog/AuthImage';
import { Lightbox, type LightboxImage } from '../sitelog/Lightbox';

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<ClientRfiStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  RESPONDED: 'bg-blue-50 text-blue-700 border-blue-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function ClientRfiSection({ session, onGone }: {
  session: ClientViewSession;
  /** The share link died mid-browse (410) — the parent page shows its dead-link state. */
  onGone: () => void;
}) {
  const { t, i18n } = useTranslation(['rfi']);

  const [items, setItems] = useState<ClientRfi[]>([]);
  const [pageNum, setPageNum] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const isGone = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 410 || err.code === 'CLIENT_VIEW_GONE');

  const loadPage = useCallback(async (page: number, append: boolean) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await getClientRfis(session.sessionToken, page, PAGE_SIZE);
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

  // Date-ONLY strings (dueDate) must parse as local midnight — new Date('YYYY-MM-DD')
  // reads UTC and shifts the shown day back west of Greenwich.
  const fmtDay = (isoDate: string): string => fmtDate(`${isoDate}T00:00:00`);

  const replaceItem = (updated: ClientRfi) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  };

  const openLightbox = (photos: ClientRfiPhoto[], photoId: number, alt: string) => {
    const images: LightboxImage[] = photos.map((p) => ({
      id: p.id,
      url: clientRfiPhotoUrl(p),
      alt,
      downloadName: `rfi-photo-${p.id}`,
    }));
    const index = Math.max(0, images.findIndex((img) => img.id === photoId));
    setLightbox({ images, index });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[#0A0A0A] inline-flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#F97316]" />
          {t('client.title')}
        </h2>
        <p className="text-xs text-[#71717A] mt-0.5">{t('client.subtitle')}</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 p-4 text-center">
          <p className="text-sm text-red-700 mb-2">{t('client.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void loadPage(0, false)}
            className="h-9 px-4 rounded-lg border border-[#D4D4D8] text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA]"
          >
            {t('client.retry')}
          </button>
        </div>
      )}

      {!loadError && !loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-11 h-11 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
            <HelpCircle className="w-5 h-5 text-[#D4D4D8]" />
          </div>
          <p className="text-sm font-medium text-[#0A0A0A]">{t('client.empty.title')}</p>
          <p className="text-xs text-[#71717A] mt-1">{t('client.empty.subtitle')}</p>
        </div>
      )}

      {items.map((rfi) => (
        <ClientRfiCard
          key={rfi.id}
          session={session}
          rfi={rfi}
          fmtDate={fmtDate}
          fmtDay={fmtDay}
          onChanged={replaceItem}
          onGone={onGone}
          onOpenPhoto={openLightbox}
        />
      ))}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
        </div>
      )}

      {!loading && pageNum + 1 < totalPages && (
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
    </section>
  );
}

// ──────────────────────────── card ────────────────────────────

function ClientRfiCard({ session, rfi, fmtDate, fmtDay, onChanged, onGone, onOpenPhoto }: {
  session: ClientViewSession;
  rfi: ClientRfi;
  fmtDate: (iso: string) => string;
  /** For date-ONLY strings (dueDate) — parses as local midnight, not UTC. */
  fmtDay: (isoDate: string) => string;
  onChanged: (rfi: ClientRfi) => void;
  onGone: () => void;
  onOpenPhoto: (photos: ClientRfiPhoto[], photoId: number, alt: string) => void;
}) {
  const { t } = useTranslation(['rfi']);
  const [respondOpen, setRespondOpen] = useState(false);
  const [thread, setThread] = useState<ClientRfiResponseEntry[] | 'loading' | 'error' | null>(null);

  const isGone = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 410 || err.code === 'CLIENT_VIEW_GONE');

  const toggleThread = async () => {
    if (thread) {
      setThread(null);
      return;
    }
    setThread('loading');
    try {
      setThread(await getClientRfiResponses(session.sessionToken, rfi.id));
    } catch (err) {
      if (isGone(err)) onGone();
      else setThread('error');
    }
  };

  const responseCount = Array.isArray(thread) ? thread.length : rfi.responseCount;

  return (
    <article className="rounded-xl border border-[#D4D4D8] bg-white overflow-hidden">
      <header className="px-4 py-3 bg-[#FAFAFA]/60 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-[#F97316] tabular-nums">{rfi.displayNumber}</span>
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{rfi.subject}</h3>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[rfi.status]}`}>
          {t(`status.${rfi.status}`)}
        </span>
        {rfi.overdue && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
            {t('status.overdue')}
          </span>
        )}
      </header>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#71717A]">
          {rfi.sentAt && <span>{t('client.sentAt', { date: fmtDate(rfi.sentAt) })}</span>}
          {rfi.dueDate && (
            <span className={rfi.overdue ? 'text-red-700 font-semibold' : ''}>
              {t('client.answerBy', { date: fmtDay(rfi.dueDate) })}
            </span>
          )}
          {rfi.respondedAt && <span>{t('client.respondedAt', { date: fmtDate(rfi.respondedAt) })}</span>}
          {rfi.closedAt && <span>{t('client.closedAt', { date: fmtDate(rfi.closedAt) })}</span>}
        </div>

        <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{rfi.question}</p>

        {rfi.questionPhotos.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Camera className="w-3.5 h-3.5 text-[#F97316]" />
              <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">
                {t('client.photos.question')}
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {rfi.questionPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpenPhoto(rfi.questionPhotos, photo.id, rfi.subject)}
                  className="aspect-square overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
                >
                  <AuthImage
                    src={clientRfiPhotoUrl(photo)}
                    alt=""
                    className="w-full h-full object-cover"
                    headers={clientAuthHeaders(session.sessionToken)}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {rfi.awaitingClient && (
          <div className="rounded-lg bg-[#F97316]/5 border border-[#F97316]/20 px-3 py-2">
            <p className="text-xs font-semibold text-[#C2410C]">{t('client.waiting')}</p>
          </div>
        )}

        {rfi.status === 'CLOSED' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
            <p className="text-xs text-emerald-800">{t('client.closedInfo')}</p>
          </div>
        )}

        {/* Big answer button — the portal's one job */}
        {rfi.canRespond && !respondOpen && (
          <button
            type="button"
            onClick={() => setRespondOpen(true)}
            className="w-full sm:w-auto h-11 px-6 rounded-lg bg-[#F97316] hover:bg-[#C2410C] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            {t('client.respond')}
          </button>
        )}

        {respondOpen && rfi.canRespond && (
          <RespondForm
            session={session}
            rfi={rfi}
            onGone={onGone}
            onSent={(entry) => {
              setRespondOpen(false);
              setThread((prev) => (Array.isArray(prev) ? [...prev, entry] : prev));
              onChanged({
                ...rfi,
                status: rfi.status === 'OPEN' ? 'RESPONDED' : rfi.status,
                awaitingClient: false,
                overdue: false,
                responseCount: rfi.responseCount + 1,
                respondedAt: rfi.respondedAt ?? new Date().toISOString(),
              });
            }}
            onCancel={() => setRespondOpen(false)}
          />
        )}

        {/* Thread */}
        <div className="rounded-lg border border-[#F4F4F5] bg-[#FAFAFA]/60 px-3 py-2 space-y-2">
          <button
            type="button"
            onClick={() => void toggleThread()}
            className="h-8 rounded-lg text-xs font-semibold text-[#0A0A0A] inline-flex items-center gap-1.5 hover:text-[#F97316] transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-[#F97316]" />
            {t('client.responses.toggle', { count: responseCount })}
          </button>

          {thread === 'loading' && (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 text-[#F97316] animate-spin" />
            </div>
          )}
          {thread === 'error' && (
            <p className="text-xs text-red-600">{t('client.responses.loadFailed')}</p>
          )}

          {Array.isArray(thread) && (
            <>
              {thread.length === 0 && (
                <p className="text-xs text-[#71717A]">{t('client.responses.empty')}</p>
              )}
              <ul className="space-y-1.5">
                {thread.map((entry) => (
                  <ThreadEntry
                    key={entry.id}
                    session={session}
                    entry={entry}
                    subject={rfi.subject}
                    onOpenPhoto={onOpenPhoto}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function ThreadEntry({ session, entry, subject, onOpenPhoto }: {
  session: ClientViewSession;
  entry: ClientRfiResponseEntry;
  subject: string;
  onOpenPhoto: (photos: ClientRfiPhoto[], photoId: number, alt: string) => void;
}) {
  const { t, i18n } = useTranslation(['rfi']);

  const fmtDateTime = (iso: string): string =>
    new Date(iso).toLocaleString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    );

  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        entry.official
          ? 'bg-emerald-50 border-emerald-300'
          : entry.byClient ? 'bg-[#F97316]/5 border-[#F97316]/20' : 'bg-white border-[#F4F4F5]'
      }`}
    >
      <p className="text-[11px] mb-0.5 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-[#0A0A0A]">
          {entry.byClient ? session.project.clientName : t('client.responses.team')}
        </span>
        <span className="text-[#71717A]">{fmtDateTime(entry.createdAt)}</span>
        {entry.official && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-100 text-emerald-800 border-emerald-300">
            {t('client.responses.official')}
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
              onClick={() => onOpenPhoto(entry.photos, photo.id, subject)}
              className="w-14 h-14 overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
            >
              <AuthImage
                src={clientRfiPhotoUrl(photo)}
                alt=""
                className="w-full h-full object-cover"
                headers={clientAuthHeaders(session.sessionToken)}
              />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

// ──────────────────────────── answer form ────────────────────────────

function RespondForm({ session, rfi, onSent, onCancel, onGone }: {
  session: ClientViewSession;
  rfi: ClientRfi;
  onSent: (entry: ClientRfiResponseEntry) => void;
  onCancel: () => void;
  onGone: () => void;
}) {
  const { t } = useTranslation(['rfi']);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isGone = (err: unknown): boolean =>
    err instanceof ApiError && (err.status === 410 || err.code === 'CLIENT_VIEW_GONE');

  const handlePhotoFiles = (list: FileList | null) => {
    if (!list) return;
    setFormError(null);
    const next = [...photos];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith('image/')) {
        setFormError(t('client.form.photoInvalidType'));
        continue;
      }
      if (file.size > MAX_RESPONSE_PHOTO_BYTES) {
        setFormError(t('client.form.photoTooLarge', { mb: MAX_RESPONSE_PHOTO_BYTES / (1024 * 1024) }));
        continue;
      }
      if (next.length >= MAX_RESPONSE_PHOTOS) {
        setFormError(t('client.form.tooManyPhotos', { max: MAX_RESPONSE_PHOTOS }));
        break;
      }
      next.push(file);
    }
    setPhotos(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setFormError(t('client.respond.required'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const entry = await respondClientRfi(session.sessionToken, rfi.id, { body, photos });
      onSent(entry);
    } catch (err) {
      if (isGone(err)) {
        onGone();
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError(t('client.respond.rateLimited'));
      } else {
        setFormError(t('client.respond.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-[#F97316]/30 bg-[#F97316]/5 px-3 py-3 space-y-3">
      <div>
        <label htmlFor={`rfi-answer-${rfi.id}`} className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">
          {t('client.respond')}
        </label>
        <textarea
          id={`rfi-answer-${rfi.id}`}
          maxLength={2000}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('client.respond.placeholder')}
          className="w-full px-3 py-2 rounded-lg border border-[#D4D4D8] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-y"
          autoFocus
        />
      </div>

      <div>
        <span className="block text-[11px] font-semibold text-[#71717A] uppercase tracking-wide mb-1.5">
          {t('client.respond.photosLabel', { max: MAX_RESPONSE_PHOTOS })}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((file, i) => (
            <PhotoPreview key={`${file.name}-${i}`} file={file} onRemove={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} />
          ))}
          {photos.length < MAX_RESPONSE_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-[#D4D4D8] hover:border-[#F97316] text-[#71717A] hover:text-[#F97316] flex flex-col items-center justify-center gap-1 transition-colors"
            >
              <Camera className="w-5 h-5" />
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

      {formError && <p className="text-xs text-red-600" role="alert">{formError}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-11 px-5 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? t('client.respond.sending') : t('client.respond.send')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 px-4 rounded-lg border border-[#D4D4D8] bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
        >
          {t('internal.form.cancel')}
        </button>
      </div>
    </form>
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
