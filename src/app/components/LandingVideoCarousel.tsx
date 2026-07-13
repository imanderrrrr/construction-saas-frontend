import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from './ui/carousel';
import { IntroAnimation, INTRO_ANIMATION_DURATION_MS } from './IntroAnimation';

// Pause between the end of one animation cycle and the next replay,
// while the animation slide is the active one in the carousel.
const LOOP_GAP_MS = 4_000;

/**
 * Public-landing carousel of product demo videos.
 *
 * Slot 1 is the ArchLogic → BuildTrack intro animation (re-used from the
 * first-visit overlay). Slots 2-3 are auto-recorded walkthroughs of real
 * modules (screen captures of the seeded demo tenant, served from
 * /public/demos): the client punch list and accounts payable.
 *
 * The intro animation is re-keyed every time the user returns to its
 * slide so the animation plays from the start, instead of staying frozen
 * on its final frame. Demo videos behave the same way: the active slide's
 * video restarts and plays, inactive ones pause.
 */

type Slot =
  | { kind: 'animation'; id: string }
  | {
      kind: 'video';
      id: string;
      srcWebm: string;
      srcMp4: string;
      poster: string;
      titleKey: string;
      captionKey: string;
    };

const SLOTS: Slot[] = [
  { kind: 'animation', id: 'archlogic' },
  {
    kind: 'video',
    id: 'punch-list',
    srcWebm: '/demos/punch-list.webm',
    srcMp4: '/demos/punch-list.mp4',
    poster: '/demos/punch-list.jpg',
    titleKey: 'videos.punchList.title',
    captionKey: 'videos.punchList.subtitle',
  },
  {
    kind: 'video',
    id: 'cuentas-por-pagar',
    srcWebm: '/demos/cuentas-por-pagar.webm',
    srcMp4: '/demos/cuentas-por-pagar.mp4',
    poster: '/demos/cuentas-por-pagar.jpg',
    titleKey: 'videos.finance.title',
    captionKey: 'videos.finance.subtitle',
  },
];

export function LandingVideoCarousel() {
  const { t } = useTranslation('landing');
  const [api, setApi] = useState<CarouselApi | undefined>();
  const [activeIndex, setActiveIndex] = useState(0);
  // Bumped each time the user lands on the animation slide, so React
  // remounts <IntroAnimation /> and the CSS keyframes restart from 0.
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const idx = api.selectedScrollSnap();
      setActiveIndex(idx);
      if (SLOTS[idx]?.kind === 'animation') {
        setAnimationKey((k) => k + 1);
      }
    };
    onSelect();
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  // Auto-replay the animation while its slide is the active one. Each cycle
  // is `INTRO_ANIMATION_DURATION_MS + LOOP_GAP_MS` long; after that we bump
  // the key so React remounts <IntroAnimation /> and the keyframes restart.
  // Effect re-runs whenever `animationKey` changes, scheduling the next
  // tick. When the user navigates to another slide, the cleanup cancels the
  // pending timer.
  useEffect(() => {
    if (SLOTS[activeIndex]?.kind !== 'animation') return;
    const timer = window.setTimeout(() => {
      setAnimationKey((k) => k + 1);
    }, INTRO_ANIMATION_DURATION_MS + LOOP_GAP_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, animationKey]);

  return (
    <section id="see-it" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            {t('videos.title')}
          </h2>
          <p className="text-[#71717A] leading-relaxed">{t('videos.subtitle')}</p>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: 'start', loop: true }}
          className="relative"
        >
          <CarouselContent>
            {SLOTS.map((slot, i) => (
              <CarouselItem key={slot.id}>
                <VideoFrame>
                  {slot.kind === 'animation' ? (
                    // Padding + max-width give the animation breathing room
                    // inside the 16:9 frame instead of edge-to-edge.
                    <div className="w-full h-full flex items-center justify-center p-6 sm:p-12 md:p-20">
                      <div className="w-full max-w-3xl h-full">
                        <IntroAnimation key={animationKey} />
                      </div>
                    </div>
                  ) : (
                    <DemoVideoSlot
                      slot={slot}
                      active={activeIndex === i}
                      title={t(slot.titleKey)}
                      caption={t(slot.captionKey)}
                    />
                  )}
                </VideoFrame>
              </CarouselItem>
            ))}
          </CarouselContent>

          <CarouselPrevious className="left-2 sm:-left-12" />
          <CarouselNext className="right-2 sm:-right-12" />
        </Carousel>

        {/* Dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {SLOTS.map((slot, i) => (
            <button
              key={slot.id}
              type="button"
              aria-label={t('videos.goToSlide', { n: i + 1 })}
              onClick={() => api?.scrollTo(i)}
              className={
                'h-1.5 rounded-full transition-all ' +
                (i === activeIndex
                  ? 'w-8 bg-[#F97316]'
                  : 'w-2 bg-[#D4D4D8] hover:bg-[#A1A1AA]')
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// 16:9 frame with a soft border + shadow — same chrome on every slot so
// future real videos drop in without restyling the wrapper.
function VideoFrame({ children }: { children: ReactNode }) {
  return (
    <div className="aspect-video w-full bg-white rounded-2xl border border-[#E4E4E7] shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function DemoVideoSlot({
  slot,
  active,
  title,
  caption,
}: {
  slot: Extract<Slot, { kind: 'video' }>;
  active: boolean;
  title: string;
  caption: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // The clips are short storyboarded walkthroughs, so mirror the intro
  // animation's re-key behavior: restart from the beginning when the slide
  // becomes active, pause while it is not. No `autoPlay` attribute — embla
  // keeps every slide mounted, and off-screen playback would waste decode.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      // Muted playback is allowed to autostart everywhere; the catch only
      // guards odd embedded contexts, where the poster stays visible.
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        loop
        muted
        playsInline
        preload="metadata"
        poster={slot.poster}
        aria-label={title}
      >
        <source src={slot.srcWebm} type="video/webm" />
        <source src={slot.srcMp4} type="video/mp4" />
      </video>
      {/* Caption overlay — keeps every slide the exact same 16:9 footprint. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A0A0A]/75 via-[#0A0A0A]/35 to-transparent px-5 pb-4 pt-14 text-left">
        <p className="text-sm sm:text-[15px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-xs sm:text-[13px] leading-relaxed text-white/80">{caption}</p>
      </div>
    </div>
  );
}
