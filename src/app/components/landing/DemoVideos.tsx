import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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

// Order = sheet numbering BT-V01…BT-V08. Matches public/demos/manifest.json.
const GROUPS: Group[] = [
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

/** True when the reader has asked the OS to reduce motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
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
  const videoRef = useRef<FullscreenVideo>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const { clip, group } = CLIPS[index];
  const title = t(`videos.${clip}.title`);
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;

  // The clip plays while the player is on screen and stops when it leaves.
  // `preload="none"` keeps it from being fetched before it is scrolled to.
  useEffect(() => {
    const video = videoRef.current;
    // No observer (jsdom, and any browser old enough to lack it): leave the
    // element exactly as the markup declares it — autoplaying and looping.
    if (!video || reduced || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => { /* autoplay refused */ });
        else video.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [reduced, lang, index]);

  function select(next: number, focus = false) {
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

  return (
    <>
      <div className="mb-[22px] mt-[clamp(40px,5vw,56px)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('videos.label')}</p>
        <p className="font-bt-mono text-[10px] tracking-[0.1em] text-bt-orange">{t('videos.provenance')}</p>
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
                  className={`font-bt-mono text-[10px] tracking-[0.12em] ${selected ? 'text-bt-orange' : 'text-bt-muted-2'}`}
                >
                  {`V${pad(i + 1)}`}
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
            <div className="aspect-[16/10] overflow-hidden bg-bt-ink">
              {/* Keyed by language and clip: swapping the <source> children of
                  a playing <video> does nothing on its own — the element keeps
                  the media it already loaded until it is mounted again. */}
              <video
                key={`${lang}-${clip}`}
                ref={videoRef}
                className="h-full w-full object-cover"
                poster={`/demos/${lang}/${clip}.jpg`}
                aria-label={t('videos.alt', { title })}
                autoPlay={!reduced}
                loop={!reduced}
                controls={reduced}
                muted
                playsInline
                preload="none"
              >
                <source src={`/demos/${lang}/${clip}.webm`} type="video/webm" />
                <source src={`/demos/${lang}/${clip}.mp4`} type="video/mp4" />
              </video>
            </div>
            <figcaption className="flex items-center justify-between gap-2.5 border-t border-[rgba(23,19,15,0.3)] px-3.5 py-[7px] font-bt-mono text-[9px] tracking-[0.12em]">
              <span className="min-w-0 truncate text-bt-ink">
                BT-V{pad(index + 1)} · {title.toUpperCase()}
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
