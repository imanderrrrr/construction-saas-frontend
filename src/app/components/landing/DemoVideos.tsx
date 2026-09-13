import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
 * They are grouped by MODULE, in the order the "Cinco módulos" section above
 * names them, so the block answers "what does each module actually look like"
 * instead of being a wall of unlabelled screens. A module with two screens
 * worth showing gets two plates; the rest get one.
 *
 * Frames are 16:10 — the recording's own ratio — so nothing is cropped.
 */

type Group = {
  /** i18n key under `videos.group.` and the block's identity. */
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

/** Sheet number per clip: BT-V01… in the order the groups are drawn. */
const SHEET: Record<string, number> = Object.fromEntries(
  GROUPS.flatMap(g => g.clips).map((clip, i) => [clip, i + 1]),
);

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

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ClipCard({ clip, lang, reduced }: { clip: string; lang: ClipLang; reduced: boolean }) {
  const { t } = useTranslation('landing');
  const ref = useRef<HTMLVideoElement>(null);
  const title = t(`videos.${clip}.title`);

  // Eight silent loops running at once is bandwidth nobody asked for and
  // decoders the browser does not have: a clip plays while it is on screen and
  // stops the moment it leaves. `preload="none"` keeps the ones below the fold
  // from being fetched at all until they are scrolled to.
  useEffect(() => {
    const video = ref.current;
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
  }, [reduced, lang]);

  return (
    <figure className="border border-[rgba(23,19,15,0.3)] bg-bt-sheet shadow-[0_22px_50px_-32px_rgba(23,19,15,0.4)]">
      <div className="aspect-[16/10] overflow-hidden bg-bt-ink">
        {/* Keyed by language: swapping the <source> children of a playing
            <video> does nothing on its own — the element keeps the media it
            already loaded until it is torn down and mounted again. */}
        <video
          key={lang}
          ref={ref}
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
      <figcaption className="flex justify-between gap-2.5 border-t border-[rgba(23,19,15,0.3)] px-3.5 py-[9px] font-bt-mono text-[8.5px] tracking-[0.12em]">
        <span className="min-w-0 truncate text-bt-ink">
          BT-V{pad(SHEET[clip])} · {title.toUpperCase()}
        </span>
        <span className="flex-none text-bt-muted-2">16:10</span>
      </figcaption>
    </figure>
  );
}

export function DemoVideos() {
  const { t, i18n } = useTranslation('landing');
  const reduced = usePrefersReducedMotion();
  const lang = clipLang(i18n.resolvedLanguage ?? i18n.language);

  return (
    <>
      <div className="mb-[22px] mt-[clamp(40px,5vw,56px)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('videos.label')}</p>
        <p className="font-bt-mono text-[10px] tracking-[0.1em] text-bt-orange">{t('videos.provenance')}</p>
      </div>

      <div className="max-w-[1120px] space-y-[clamp(26px,3.2vw,40px)]">
        {GROUPS.map(group => (
          <section
            key={group.key}
            className="flex flex-col gap-[18px] border-t border-bt-rule pt-[22px] md:flex-row md:gap-[clamp(24px,3vw,44px)]"
          >
            <header className="md:w-[188px] md:flex-none">
              <p className="font-bt-mono text-[10.5px] tracking-[0.14em] text-bt-orange">
                {t(`videos.group.${group.key}.label`)}
              </p>
              <h3 className="mt-2.5 text-balance font-bt-heading text-[18px] font-bold tracking-[-0.01em] text-bt-ink">
                {t(`videos.group.${group.key}.title`)}
              </h3>
              <p className="mt-2 text-pretty text-[13.5px] leading-[1.5] text-bt-muted">
                {t(`videos.group.${group.key}.body`)}
              </p>
            </header>

            <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[clamp(16px,2vw,24px)]">
              {group.clips.map(clip => (
                <ClipCard key={clip} clip={clip} lang={lang} reduced={reduced} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
