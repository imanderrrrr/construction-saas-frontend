import { useTranslation } from 'react-i18next';

import { TESTIMONIALS, type Testimonial } from './testimonialsData';

const SECTION = 'mx-auto max-w-[1400px] px-[clamp(22px,5vw,64px)]';

/**
 * Social proof: named customers in their own words. Renders nothing until
 * `testimonialsData.ts` holds at least one real, approved testimonial.
 */
export function Testimonials({ items = TESTIMONIALS }: { items?: Testimonial[] }) {
  const { t, i18n } = useTranslation('landing');
  if (items.length === 0) return null;
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('en') ? 'en' : 'es';

  return (
    <section id="testimonios" className="scroll-mt-16 border-t border-bt-rule bg-bt-paper">
      <div className={`${SECTION} py-[clamp(64px,8vw,104px)]`}>
        <p className="mb-5 font-bt-mono text-[11px] tracking-[0.12em] text-bt-muted">{t('testimonials.label')}</p>
        <h2 className="max-w-[24ch] text-balance font-bt-heading text-[clamp(30px,3.5vw,46px)] font-bold leading-[1.06] tracking-[-0.015em] text-bt-ink">
          {t('testimonials.title')}
        </h2>

        <div className="mt-[clamp(36px,4.5vw,52px)] grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-[clamp(20px,2.5vw,28px)]">
          {items.map((item) => (
            <figure
              key={item.name}
              className="flex flex-col border border-bt-rule bg-bt-sheet px-[clamp(22px,2.5vw,30px)] pb-6 pt-7"
            >
              {item.result && (
                <p className="font-bt-mono text-[11px] tracking-[0.12em] text-bt-orange">
                  {item.result[lang].toUpperCase()}
                </p>
              )}
              <blockquote className="mt-3.5 flex-1 text-pretty font-bt-heading text-[clamp(18px,1.6vw,21px)] font-semibold leading-[1.4] tracking-[-0.01em] text-bt-ink">
                “{item.quote[lang]}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3.5 border-t border-bt-rule-2 pt-4">
                {item.photo && (
                  <img
                    src={item.photo}
                    alt=""
                    width={44}
                    height={44}
                    loading="lazy"
                    className="h-11 w-11 flex-none rounded-full object-cover"
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-bt-ink">{item.name}</span>
                  <span className="block text-[13.5px] text-bt-muted">
                    {item.role[lang]} · {item.company}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
