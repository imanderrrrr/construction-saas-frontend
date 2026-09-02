/**
 * The one contact address BuildTrack publishes, and the only place it is written.
 *
 * Archlogic Systems now owns `buildtrackfield.com`, routed through Cloudflare
 * Email Routing: `support@` and `soporte@` both deliver to the same mailbox.
 * The web pages use `support@` because a single constant serves the Spanish and
 * English documents alike; the mobile legal text picks the address that matches
 * the language of each block. Everything user-facing — billing, the landing
 * CTAs, /support, the legal documents — resolves here.
 *
 * Why a single constant instead of a literal per page: the OFJR → BuildTrack
 * rebrand had to be done by hand in every file that spelled an address out, and
 * /support was missed for almost two months. The addresses it replaced
 * (hola@ / demo@ / beta@buildtrack.gt) were worse than stale — that domain was
 * never registered, so those mailtos opened a message to a name that does not
 * resolve. The founder's personal Gmail stood in after that, published on the
 * legal pages an App Store reviewer reads. `contact.singleSource.test.ts` keeps
 * all three from creeping back.
 */
export const SUPPORT_EMAIL = 'support@buildtrackfield.com';

/**
 * `mailto:` for the support inbox, with an optional prefilled subject.
 *
 * One mailbox now answers demo requests, beta signups, billing and support, so
 * the subject is what separates the threads — pass one wherever the reply needs
 * to land in a particular conversation.
 */
export function supportMailto(subject?: string): string {
  const to = `mailto:${SUPPORT_EMAIL}`;
  return subject ? `${to}?subject=${encodeURIComponent(subject)}` : to;
}
