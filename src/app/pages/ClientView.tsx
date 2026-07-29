// BuildTrack — Public client portal: read-only site log (bitácora) of ONE
// project, opened from a share link. No account, no install: the token in the
// URL is exchanged (+ optional 6-digit PIN) for a short-lived session and the
// page renders the PUBLISHED entries only. A dead link (revoked / expired /
// project closed) renders a friendly "ask for a new link" state.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Camera, CheckCircle2, ClipboardList, CloudFog, CloudLightning, CloudRain, Cloudy,
  HardHat, HelpCircle, Loader2, Lock, NotebookPen, ShieldAlert, Sun, Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  clientAuthHeaders,
  clientPhotoUrl,
  getClientSiteLogs,
  openClientSession,
  type ClientSiteLogEntry,
  type ClientViewSession,
} from '../services/clientView';
import type { Weather } from '../services/siteLog';
import { AuthImage } from '../components/sitelog/AuthImage';
import { Lightbox, type LightboxImage } from '../components/sitelog/Lightbox';
import { ClientPunchSection } from '../components/punchlist/ClientPunchSection';
import { ClientRfiSection } from '../components/rfi/ClientRfiSection';

type Phase = 'loading' | 'pin' | 'ready' | 'gone' | 'invalid';
type PinError = 'wrong' | 'rate' | null;
type PortalTab = 'sitelog' | 'punch' | 'rfi';

const PAGE_SIZE = 10;

const WEATHER_ICONS: Record<Weather, LucideIcon> = {
  SOLEADO: Sun,
  NUBLADO: Cloudy,
  LLUVIA: CloudRain,
  TORMENTA: CloudLightning,
  NIEBLA: CloudFog,
};

function classify(err: unknown): 'pin' | 'wrong' | 'rate' | 'gone' | 'invalid' {
  if (err instanceof ApiError) {
    if (err.code === 'CLIENT_VIEW_PIN_REQUIRED') return 'pin';
    if (err.code === 'CLIENT_VIEW_AUTH_FAILED') return 'wrong';
    if (err.status === 429) return 'rate';
    if (err.status === 410 || err.code === 'CLIENT_VIEW_GONE') return 'gone';
  }
  return 'invalid';
}

export function ClientView() {
  const { token = '' } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation(['clientView', 'punchList', 'rfi']);

  const [tab, setTab] = useState<PortalTab>('sitelog');
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<ClientViewSession | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<PinError>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const [entries, setEntries] = useState<ClientSiteLogEntry[]>([]);
  const [pageNum, setPageNum] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  // One silent re-exchange when a session expires mid-browse (12 h TTL); the
  // guard prevents a retry loop if the backend keeps answering 401.
  const retriedRef = useRef(false);

  const loadPage = useCallback(async (sess: ClientViewSession, page: number, append: boolean) => {
    setListLoading(true);
    setListError(false);
    try {
      const res = await getClientSiteLogs(sess.sessionToken, page, PAGE_SIZE);
      retriedRef.current = false;
      setEntries((prev) => (append ? [...prev, ...res.content] : res.content));
      setPageNum(res.page);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (classify(err) === 'gone') {
        setPhase('gone');
      } else if (err instanceof ApiError && err.status === 401 && !retriedRef.current) {
        retriedRef.current = true;
        setSession(null);
        setPhase('loading');
        void start();
      } else {
        setListError(true);
      }
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async (pinValue?: string) => {
    try {
      const sess = await openClientSession(token, pinValue);
      setSession(sess);
      setPhase('ready');
      setPinError(null);
      await loadPage(sess, 0, false);
    } catch (err) {
      switch (classify(err)) {
        case 'pin':
          setPhase('pin');
          break;
        case 'wrong':
          setPhase('pin');
          setPinError('wrong');
          break;
        case 'rate':
          setPhase('pin');
          setPinError('rate');
          break;
        case 'gone':
          setPhase('gone');
          break;
        default:
          setPhase('invalid');
      }
    }
  }, [token, loadPage]);

  useEffect(() => {
    if (!token) {
      setPhase('invalid');
      return;
    }
    void start();
  }, [token, start]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(pin)) {
      setPinError('wrong');
      return;
    }
    setPinSubmitting(true);
    try {
      await start(pin);
    } finally {
      setPinSubmitting(false);
    }
  };

  const fmtDate = (isoDate: string): string =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString(
      i18n.language.startsWith('en') ? 'en-US' : 'es',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    );

  const openLightbox = (entry: ClientSiteLogEntry, index: number) => {
    const images: LightboxImage[] = entry.photos.map((p) => ({
      id: p.id,
      url: clientPhotoUrl(p),
      alt: p.caption ?? '',
      caption: p.caption,
      downloadName: `bitacora-${entry.workDate}-${p.id}`,
    }));
    setLightbox({ images, index });
  };

  // ── full-screen states ────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <CenteredShell>
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin mx-auto mb-3" />
        <p className="text-sm text-[#71717A]">{t('loading')}</p>
      </CenteredShell>
    );
  }

  if (phase === 'pin') {
    return (
      <CenteredShell>
        <div className="w-12 h-12 bg-[#F97316]/10 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#F97316]" />
        </div>
        <h1 className="text-lg font-semibold text-[#0A0A0A] mb-1">{t('pin.title')}</h1>
        <p className="text-sm text-[#71717A] mb-5">{t('pin.subtitle')}</p>
        <form onSubmit={handlePinSubmit} className="space-y-3">
          <label className="sr-only" htmlFor="client-view-pin">{t('pin.label')}</label>
          <input
            id="client-view-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(null); }}
            className="w-full h-12 rounded-lg border border-[#D4D4D8] text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            placeholder="••••••"
            autoFocus
          />
          {pinError && (
            <p className="text-sm text-red-600" role="alert">
              {pinError === 'rate' ? t('pin.rateLimited') : t('pin.wrong')}
            </p>
          )}
          <button
            type="submit"
            disabled={pinSubmitting || pin.length !== 6}
            className="w-full h-11 rounded-lg bg-[#F97316] hover:bg-[#C2410C] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {pinSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {pinSubmitting ? t('pin.checking') : t('pin.submit')}
          </button>
        </form>
      </CenteredShell>
    );
  }

  if (phase === 'gone' || phase === 'invalid') {
    return (
      <CenteredShell>
        <div className="w-12 h-12 bg-[#FAFAFA] rounded-xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-[#71717A]" />
        </div>
        <h1 className="text-lg font-semibold text-[#0A0A0A] mb-1">
          {phase === 'gone' ? t('gone.title') : t('invalid.title')}
        </h1>
        <p className="text-sm text-[#71717A]">
          {phase === 'gone' ? t('gone.subtitle') : t('invalid.subtitle')}
        </p>
      </CenteredShell>
    );
  }

  // ── ready ─────────────────────────────────────────────────────────────

  const project = session?.project;
  const hasMore = pageNum + 1 < totalPages;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#D4D4D8]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#F97316] rounded-lg flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-[#0A0A0A]">{t('brand')}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FAFAFA] text-[#71717A] border border-[#D4D4D8]">
            <Lock className="w-3 h-3" />
            {t('header.readOnly')}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Project hero */}
        {project && (
          <section className="bg-white rounded-xl border border-[#D4D4D8] p-5 sm:p-6">
            <p className="text-[11px] font-semibold text-[#F97316] uppercase tracking-wide mb-1">{t('title')}</p>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">{project.projectName}</h1>
            <p className="text-sm text-[#71717A] mt-1">
              {t('header.sharedWith', { client: project.clientName })}
              {project.address ? ` · ${project.address}` : ''}
            </p>
          </section>
        )}

        {/* Section tabs: bitácora | punch list */}
        <div className="bg-white rounded-xl border border-[#D4D4D8] p-1.5 flex gap-1" role="tablist">
          <TabButton
            active={tab === 'sitelog'}
            icon={NotebookPen}
            label={t('punchList:tab.sitelog')}
            onClick={() => setTab('sitelog')}
          />
          <TabButton
            active={tab === 'punch'}
            icon={ClipboardList}
            label={t('punchList:tab.punch')}
            onClick={() => setTab('punch')}
          />
          <TabButton
            active={tab === 'rfi'}
            icon={HelpCircle}
            label={t('rfi:tab.rfi')}
            onClick={() => setTab('rfi')}
          />
        </div>

        {tab === 'punch' && session && (
          <ClientPunchSection session={session} onGone={() => setPhase('gone')} />
        )}

        {tab === 'rfi' && session && (
          <ClientRfiSection session={session} onGone={() => setPhase('gone')} />
        )}

        {tab === 'sitelog' && (
        <>
        {/* Entries */}
        {listError && (
          <div className="bg-white rounded-xl border border-red-200 p-5 text-center">
            <p className="text-sm text-red-700 mb-3">{t('error.loadFailed')}</p>
            <button
              type="button"
              onClick={() => session && void loadPage(session, 0, false)}
              className="h-9 px-4 rounded-lg border border-[#D4D4D8] text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA]"
            >
              {t('error.retry')}
            </button>
          </div>
        )}

        {!listError && entries.length === 0 && !listLoading && (
          <div className="bg-white rounded-xl border border-[#D4D4D8] flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="w-14 h-14 bg-[#FAFAFA] rounded-full flex items-center justify-center mb-3">
              <NotebookPen className="w-7 h-7 text-[#D4D4D8]" />
            </div>
            <p className="text-sm font-semibold text-[#0A0A0A] mb-1">{t('list.empty.title')}</p>
            <p className="text-xs text-[#71717A]">{t('list.empty.subtitle')}</p>
          </div>
        )}

        {entries.map((entry) => {
          const WeatherIcon = entry.weather ? WEATHER_ICONS[entry.weather] : null;
          return (
            <article key={entry.workDate} className="bg-white rounded-xl border border-[#D4D4D8] overflow-hidden">
              <header className="px-4 sm:px-6 py-3 border-b border-[#F4F4F5] bg-[#FAFAFA]/60 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-[#0A0A0A] capitalize">
                  {fmtDate(entry.workDate)}
                </h2>
                {(WeatherIcon || entry.temperatureC != null) && (
                  <div className="flex items-center gap-2 text-xs text-[#71717A]">
                    {WeatherIcon && entry.weather && (
                      <span className="inline-flex items-center gap-1">
                        <WeatherIcon className="w-3.5 h-3.5 text-[#F97316]" />
                        {t(`weather.${entry.weather}`)}
                      </span>
                    )}
                    {entry.temperatureC != null && <span>{t('entry.temperature', { value: entry.temperatureC })}</span>}
                  </div>
                )}
              </header>

              <div className="p-4 sm:p-6 space-y-5">
                {entry.attendance.length > 0 && (
                  <EntrySection icon={Users} label={t('entry.attendance')}>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.attendance.map((a, i) => (
                        <span
                          key={`${a.name}-${i}`}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FAFAFA] text-[#0A0A0A] border border-[#D4D4D8]"
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </EntrySection>
                )}

                {entry.tasksDone.length > 0 && (
                  <EntrySection icon={CheckCircle2} label={t('entry.tasksDone')}>
                    <ul className="space-y-1.5">
                      {entry.tasksDone.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#0A0A0A]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{task.description}</span>
                        </li>
                      ))}
                    </ul>
                  </EntrySection>
                )}

                {entry.notes && (
                  <EntrySection icon={NotebookPen} label={t('entry.notes')}>
                    <p className="text-sm text-[#0A0A0A] whitespace-pre-wrap">{entry.notes}</p>
                  </EntrySection>
                )}

                {entry.photos.length > 0 && session && (
                  <EntrySection icon={Camera} label={t('entry.photos')}>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {entry.photos.map((photo, i) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => openLightbox(entry, i)}
                          className="aspect-square overflow-hidden rounded-lg border border-[#D4D4D8] hover:opacity-90 transition-opacity"
                        >
                          <AuthImage
                            src={clientPhotoUrl(photo)}
                            alt={photo.caption ?? ''}
                            className="w-full h-full object-cover"
                            headers={clientAuthHeaders(session.sessionToken)}
                          />
                        </button>
                      ))}
                    </div>
                  </EntrySection>
                )}
              </div>
            </article>
          );
        })}

        {listLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          </div>
        )}

        {hasMore && !listLoading && session && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadPage(session, pageNum + 1, true)}
              className="h-10 px-5 rounded-lg border border-[#D4D4D8] bg-white text-sm font-medium text-[#0A0A0A] hover:bg-[#FAFAFA] transition-colors"
            >
              {t('list.loadMore')}
            </button>
          </div>
        )}
        </>
        )}

        <footer className="pt-2 pb-6 text-center">
          <p className="text-[11px] text-[#71717A]">{t('footer.note')}</p>
        </footer>
      </main>

      {lightbox && session && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(i) => setLightbox((lb) => (lb ? { ...lb, index: i } : lb))}
          onClose={() => setLightbox(null)}
          imageHeaders={clientAuthHeaders(session.sessionToken)}
          labels={{
            download: t('lightbox.download'),
            prev: t('lightbox.prev'),
            next: t('lightbox.next'),
            close: t('lightbox.close'),
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────── sub-components ────────────────────────────

function TabButton({ active, icon: Icon, label, onClick }: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 h-10 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
        active ? 'bg-[#F97316] text-white' : 'text-[#71717A] hover:bg-[#FAFAFA]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-[#D4D4D8] shadow-sm p-6 sm:p-8 text-center">
        {children}
      </div>
    </div>
  );
}

function EntrySection({ icon: Icon, label, children }: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-[#F97316]" />
        <span className="text-[11px] font-semibold text-[#71717A] uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}
