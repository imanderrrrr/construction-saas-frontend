import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The Videos block of the Platform section — the real product footage.
 *
 * These are the clips in `public/demos/`: raw screen recordings of the actual
 * admin app driven by Playwright over the seeded demo tenant, no narration and
 * no editing. The design shipped this block as three "clip pending"
 * placeholders; all six real clips exist, so they're wired here and the
 * section says where the footage comes from instead.
 *
 * Frames are a uniform 16:9 (the design's proportion) and the clips are
 * anchored to the top, so the 16:10 recordings lose a sliver of chrome at the
 * bottom rather than losing the sidebar off the side. Each card's title block
 * states the clip's true aspect ratio.
 */

type Clip = {
  /** File stem in `public/demos/` — `<key>.webm` / `.mp4` / `.jpg`. */
  key: string;
  /** Real recording ratio, printed in the title block. */
  ratio: string;
};

// Order = sheet numbering BT-V01…BT-V06. Matches public/demos/manifest.json.
const CLIPS: Clip[] = [
  { key: 'bitacora', ratio: '16:10' },
  { key: 'tiempo', ratio: '16:10' },
  { key: 'kanban', ratio: '16:10' },
  { key: 'finanzas', ratio: '16:10' },
  { key: 'punch-list', ratio: '16:9' },
  { key: 'cuentas-por-pagar', ratio: '16:9' },
];

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

export function DemoVideos() {
  const { t } = useTranslation('landing');
  // Six silent clips looping at once is exactly the motion someone asking for
  // less of it does not want — they get a poster and a play button instead.
  const reduced = usePrefersReducedMotion();

  return (
    <>
      <div className="mb-[18px] mt-[clamp(40px,5vw,56px)] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('videos.label')}</p>
        <p className="font-bt-mono text-[10px] tracking-[0.1em] text-bt-orange">{t('videos.provenance')}</p>
      </div>

      <div className="grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[clamp(20px,2.5vw,28px)]">
        {CLIPS.map((clip, i) => {
          const title = t(`videos.${clip.key}.title`);
          return (
            <figure
              key={clip.key}
              className="border border-[rgba(23,19,15,0.3)] bg-bt-sheet shadow-[0_22px_50px_-32px_rgba(23,19,15,0.4)]"
            >
              <div className="aspect-video overflow-hidden bg-bt-ink">
                <video
                  className="h-full w-full object-cover object-top"
                  poster={`/demos/${clip.key}.jpg`}
                  aria-label={t('videos.alt', { title })}
                  autoPlay={!reduced}
                  loop={!reduced}
                  controls={reduced}
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src={`/demos/${clip.key}.webm`} type="video/webm" />
                  <source src={`/demos/${clip.key}.mp4`} type="video/mp4" />
                </video>
              </div>
              <figcaption className="flex justify-between gap-2.5 border-t border-[rgba(23,19,15,0.3)] px-3.5 py-[9px] font-bt-mono text-[8.5px] tracking-[0.12em]">
                <span className="min-w-0 truncate text-bt-ink">
                  BT-V{pad(i + 1)} · {title.toUpperCase()}
                </span>
                <span className="flex-none text-bt-muted-2">{clip.ratio}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
