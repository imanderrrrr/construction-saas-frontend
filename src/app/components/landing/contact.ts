/**
 * BuildTrack contact addresses.
 *
 * We sell nothing directly: the primary CTA books a live demo and the
 * secondary one joins the free beta, both by email. No pricing table, no
 * checkout — a plan is quoted per project on the demo call, and we create
 * the account by hand afterwards.
 *
 * Not only for the public site: /admin/billing points a locked tenant at
 * BETA_EMAIL too, since reactivating is a conversation, not a purchase.
 */
export const DEMO_EMAIL = 'demo@buildtrack.gt';
export const BETA_EMAIL = 'beta@buildtrack.gt';

/** `mailto:` with a prefilled subject, so a reply lands in the right thread. */
export function mailtoWithSubject(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
