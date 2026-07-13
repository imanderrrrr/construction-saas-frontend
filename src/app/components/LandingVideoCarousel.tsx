import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayCircle } from 'lucide-react';
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
 * first-visit overlay). Future slots will hold real product walkthroughs;
 * for now they're "coming soon" placeholders so the slot layout already
 * matches what the real videos will look like.
 *
 * The intro animation is re-keyed every time the user returns to its
 * slide so the animation plays from the start, instead of staying frozen
 * on its final frame.
 */

type Slot =
  | { kind: 'animation'; id: string }
  | { kind: 'placeholder'; id: string };

const SLOTS: Slot[] = [
  { kind: 'animation',  id: 'archlogic' },
  { kind: 'placeholder', id: 'placeholder-1' },
  { kind: 'placeholder', id: 'placeholder-2' },
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
            {SLOTS.map((slot) => (
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
                    <ComingSoonSlot
                      label={t('videos.placeholder.label')}
                      title={t('videos.placeholder.title')}
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

function ComingSoonSlot({ label, title }: { label: string; title: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAFA] text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center mb-4">
        <PlayCircle className="w-7 h-7" />
      </div>
      <p className="text-xs font-semibold tracking-widest text-[#F97316] uppercase mb-2">
        {label}
      </p>
      <p className="text-base text-[#71717A]">{title}</p>
    </div>
  );
}
