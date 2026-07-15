/**
 * Public-site contact addresses.
 *
 * The site sells nothing directly: the primary CTA books a live demo and the
 * secondary one joins the free beta, both by email. No pricing table, no
 * checkout — a plan is quoted per project on the demo call.
 *
 * Distinct from `BETA_CONTACT_EMAIL` in BetaPlanCard, which the /choose-plan
 * billing flow still uses.
 */
export const DEMO_EMAIL = 'demo@buildtrack.gt';
export const BETA_EMAIL = 'beta@buildtrack.gt';

/** `mailto:` with a prefilled subject, so a reply lands in the right thread. */
export function mailtoWithSubject(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
