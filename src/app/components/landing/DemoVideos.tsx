import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { track } from '../../lib/analytics';

/**
 * The Videos block of the Platform section — the real product footage.
 *
 * The clips in `public/demos/<lang>/` are screen recordings of the admin panel
 * as it ships today, driven by Playwright over a demo dataset
 * (`tools/demo-recorder/`). No narration and no editing beyond the cut.
 *
 * There is one set per language, and the block serves the set of the language
 * the page is being read in — panel chrome and demo content included. A reader
 * who switched the page to English was being shown a Spanish panel under an
 * English heading, which reads as "this product is not for you".
 *
 * ONE player with a tab per clip. The eight clips used to be stacked one
 * under another, which made this block a third of the whole page; now the
 * reader picks the screen and the module it belongs to is named under it.
 * Tabs follow the order of the "Cinco módulos" section above.
 *
 * The first tab, BT-V00, is not a recording: it is the narrated welcome film
 * (1:12, voice, music and captions; encoded by `tools/welcome-video/`). A film
 * with a voice is not a silent loop, so it gets its own rules: native controls,
 * no loop, captions in the page's language, and it never starts with sound on
 * its own — it plays muted with the captions on screen, and one button starts
 * it again from the top with sound.
 *
 * On a phone a 16:10 recording of a desktop panel is too small to read, so the
 * player offers full screen (turn the phone sideways and it fills it).
 */

type Group = {
  /** i18n key under `videos.group.` */
  key: string;
  /** File stems — `/demos/<lang>/<key>.webm` / `.mp4` / `.jpg`. */
  clips: string[];
};

/** The languages the clips were recorded in; anything else falls back to `es`. */
const CLIP_LANGS = ['es', 'en'] as const;
type ClipLang = (typeof CLIP_LANGS)[number];

function clipLang(language: string | undefined): ClipLang {
  const tag = (language ?? '').toLowerCase();
  return CLIP_LANGS.find(l => tag === l || tag.startsWith(`${l}-`)) ?? 'es';
}

/** BT-V00 — the narrated welcome film. Also `/demos/<lang>/bienvenida.vtt`. */
const WELCOME = 'bienvenida';

// Order = sheet numbering BT-V00…BT-V08. Matches public/demos/manifest.json.
const GROUPS: Group[] = [
  { key: 'bienvenida', clips: [WELCOME] },
  { key: 'panel',      clips: ['panel'] },
  { key: 'proyectos',  clips: ['proyectos', 'contrato'] },
  { key: 'finanzas',   clips: ['presupuestos', 'facturas'] },
  { key: 'pendientes', clips: ['pendientes'] },
  { key: 'consultas',  clips: ['consultas'] },
  { key: 'portal',     clips: ['portal'] },
];

const CLIPS = GROUPS.flatMap(group => group.clips.map(clip => ({ clip, group: group.key })));

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the reader has asked the OS to reduce motion. */
function usePrefersReducedMotion(): boolean {
  // Read on the first render, not after it: the welcome film decides on that
  // render whether it is muted, and the clips whether they autoplay.
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

export function DemoVideos() {
  const { t, i18n } = useTranslation('landing');
  const reduced = usePrefersReducedMotion();
  const lang = clipLang(i18n.resolvedLanguage ?? i18n.language);
  const [index, setIndex] = useState(0);
  // The `${lang}-${clip}` of the film the reader is hearing. Keyed like the
  // <video>, so another language brings the sound button back (another tab
  // clears it in `select`).
  const [soundKey, setSoundKey] = useState<string | null>(null);
  const soundCounted = useRef<string | null>(null);
  const videoRef = useRef<FullscreenVideo>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const { clip, group } = CLIPS[index];
  const welcome = clip === WELCOME;
  const videoKey = `${lang}-${clip}`;
  const title = t(`videos.${clip}.title`);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;

  // The clip plays while the player is on screen and stops when it leaves.
  // `preload="none"` keeps it from being fetched before it is scrolled to.
  // The welcome film is not a loop: coming back on screen resumes it only when
  // leaving the screen is what paused it — not after the reader paused it, and
  // not after it ended.
  useEffect(() => {
    const video = videoRef.current;
    // No observer (jsdom, and any browser old enough to lack it): leave the
    // element exactly as the markup declares it — clips autoplaying and
    // looping, the welcome film waiting with its controls.
    if (!video || reduced || typeof IntersectionObserver === 'undefined') return;
    let started = false;
    let pausedOffscreen = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!welcome || !started || pausedOffscreen) void video.play().catch(() => { /* autoplay refused */ });
          started = true;
          pausedOffscreen = false;
        } else if (!video.paused) {
          video.pause();
          pausedOffscreen = true;
        }
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduced, lang, index, welcome]);

  function select(next: number, focus = false) {
    if (next !== index) {
      // The film comes back muted from the top, so its sound button does too.
      setSoundKey(null);
      soundCounted.current = null;
    }
    setIndex(next);
    if (focus) tabRefs.current[next]?.focus();
    track('demo_video_select', { clip: CLIPS[next].clip });
  }

  // Arrow keys move between tabs, Home/End jump to the ends (WAI-ARIA tabs).
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const last = CLIPS.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key], true);
  }

  function openFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    track('demo_video_fullscreen', { clip });
    // iPhone Safari only lets the <video> itself go full screen.
    if (typeof video.requestFullscreen === 'function') {
      void video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    } else {
      video.webkitEnterFullscreen?.();
    }
  }

  /** Counted once per showing of the film, whichever way the sound came on. */
  function countSound(via: 'button' | 'controls') {
    if (soundCounted.current === videoKey) return;
    soundCounted.current = videoKey;
    setSoundKey(videoKey);
    track('demo_video_sound', { clip, via });
  }

  // The muted autoplay already ran some of the film: with sound it starts
  // over, so the voice is heard from its first line. The click is the gesture
  // that lets the browser play sound (the same as IntroOverlay's button).
  function playWithSound() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    void video.play().catch(() => { /* refused: the native controls remain */ });
    countSound('button');
  }

  // The reader can also turn the sound on from the player's own controls.
  function onSoundChange(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    if (welcome && !video.muted && !video.paused) countSound('controls');
  }

  return (
    <>
      <div className="mb-[22px] mt-[clamp(40px,5vw,56px)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('videos.label')}</p>
        <p className="font-bt-mono text-[10px] tracking-[0.1em] text-bt-orange">
          {t(welcome ? 'videos.bienvenida.provenance' : 'videos.provenance')}
        </p>
      </div>

      <div className="grid max-w-[1120px] gap-[clamp(16px,2.5vw,32px)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label={t('videos.tabs')}
          className="-mx-[clamp(22px,5vw,64px)] flex gap-2 overflow-x-auto px-[clamp(22px,5vw,64px)] pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t lg:border-bt-rule lg:px-0 lg:pb-0"
        >
          {CLIPS.map((item, i) => {
            const selected = i === index;
            return (
              <button
                key={item.clip}
                ref={el => { tabRefs.current[i] = el; }}
                id={tabId(i)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={onTabKey}
                className={`flex flex-none items-baseline gap-2.5 whitespace-nowrap rounded-[2px] border px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors lg:rounded-none lg:border-0 lg:border-b lg:border-bt-rule lg:px-0 lg:py-3 lg:whitespace-normal ${
                  selected
                    ? 'border-bt-ink bg-bt-ink text-bt-bone lg:bg-transparent lg:text-bt-ink'
                    : 'border-bt-rule text-bt-muted hover:text-bt-ink'
                }`}
              >
                <span
                  className={`shrink-0 font-bt-mono text-[10px] tracking-[0.12em] ${selected ? 'text-bt-orange' : 'text-bt-muted-2'}`}
                >
                  {`V${pad(i)}`}
                </span>
                <span className={selected ? 'lg:font-bold' : undefined}>{t(`videos.${item.clip}.title`)}</span>
              </button>
            );
          })}
        </div>

        <figure
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(index)}
          className="min-w-0"
        >
          <div className="border border-[rgba(23,19,15,0.3)] bg-bt-sheet shadow-[0_22px_50px_-32px_rgba(23,19,15,0.4)]">
            <div className="relative aspect-[16/10] overflow-hidden bg-bt-ink">
              {/* Keyed by language and clip: swapping the <source> children of
                  a playing <video> does nothing on its own — the element keeps
                  the media it already loaded until it is mounted again. That
                  also stops the welcome film when another tab is picked. */}
              <video
                key={videoKey}
                ref={videoRef}
                className="h-full w-full object-cover"
                poster={`/demos/${lang}/${clip}.jpg`}
                aria-label={welcome ? t('videos.bienvenida.alt') : t('videos.alt', { title })}
                autoPlay={!reduced && !welcome}
                loop={!reduced && !welcome}
                controls={reduced || welcome}
                // The film only ever starts by itself muted. With reduced
                // motion it never starts by itself, so a press on play is the
                // reader's and gets the voice.
                muted={!welcome || !reduced}
                playsInline
                preload="none"
                onPlay={onSoundChange}
                onVolumeChange={onSoundChange}
              >
                {welcome ? (
                  <>
                    {/* MP4 first, like IntroOverlay: H.264 decodes in hardware
                        everywhere, and it carries the sRGB tag. */}
                    <source src={`/demos/${lang}/${clip}.mp4`} type="video/mp4" />
                    <source src={`/demos/${lang}/${clip}.webm`} type="video/webm" />
                    <track
                      kind="captions"
                      src={`/demos/${lang}/${clip}.vtt`}
                      srcLang={lang}
                      label={t('videos.bienvenida.captions')}
                      default
                    />
                  </>
                ) : (
                  <>
                    <source src={`/demos/${lang}/${clip}.webm`} type="video/webm" />
                    <source src={`/demos/${lang}/${clip}.mp4`} type="video/mp4" />
                  </>
                )}
              </video>
              {welcome && soundKey !== videoKey && (
                <button
                  type="button"
                  onClick={playWithSound}
                  className="absolute left-2 top-2 flex min-h-9 items-center gap-1.5 rounded-[2px] bg-bt-orange px-3 py-1.5 text-[13px] font-bold tracking-[-0.01em] text-bt-ink shadow-[0_10px_24px_-12px_rgba(23,19,15,0.7)] transition-colors hover:bg-bt-orange-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-ink sm:left-3 sm:top-3 sm:gap-2 sm:px-3.5 sm:py-2.5 sm:text-[14px]"
                >
                  {/* tabler:volume (Tabler Icons, MIT) */}
                  <svg className="size-4 sm:size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M15 8a5 5 0 0 1 0 8m2.7-11a9 9 0 0 1 0 14M6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5A.8.8 0 0 1 11 5v14a.8.8 0 0 1-1.5.5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t('videos.bienvenida.sound')}
                </button>
              )}
            </div>
            <figcaption className="flex items-center justify-between gap-2.5 border-t border-[rgba(23,19,15,0.3)] px-3.5 py-[7px] font-bt-mono text-[9px] tracking-[0.12em]">
              <span className="min-w-0 truncate text-bt-ink">
                BT-V{pad(index)} · {title.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={openFullscreen}
                className="flex flex-none items-center gap-1.5 py-1 font-bt-mono text-[9px] tracking-[0.12em] text-bt-muted transition-colors hover:text-bt-orange"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path
                    d="M1 4.5 V1 H4.5 M7.5 1 H11 V4.5 M11 7.5 V11 H7.5 M4.5 11 H1 V7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                </svg>
                {t('videos.fullscreen')}
              </button>
            </figcaption>
          </div>

          <div className="mt-[18px] max-w-[60ch]">
            <p className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-orange">
              {t(`videos.group.${group}.label`)}
            </p>
            <h3 className="mt-2 text-balance font-bt-heading text-[18px] font-bold tracking-[-0.01em] text-bt-ink">
              {t(`videos.group.${group}.title`)}
            </h3>
            <p className="mt-1.5 text-pretty text-[14px] leading-[1.55] text-bt-muted">
              {t(`videos.group.${group}.body`)}
            </p>
          </div>
        </figure>
      </div>
    </>
  );
}
