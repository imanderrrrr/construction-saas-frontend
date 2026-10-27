/**
 * What customers say about BuildTrack, for the landing's social-proof section.
 *
 * REAL PEOPLE ONLY, each with their written OK to publish their name, words and
 * photo. Nothing here is ever invented or "for now": while the list is empty
 * the section does not render at all.
 *
 * The quote is the customer's own words in the language they said them; the
 * other language is a faithful translation of the same sentence, not new copy.
 */
export type Testimonial = {
  /** Full name, as the person agreed to have it published. */
  name: string;
  role: { es: string; en: string };
  company: string;
  quote: { es: string; en: string };
  /** A concrete result in their words, e.g. "Cerramos la nómina en 1 hora". */
  result?: { es: string; en: string };
  /** Photo under `public/testimonials/`, published with permission. */
  photo?: string;
};

export const TESTIMONIALS: Testimonial[] = [];
