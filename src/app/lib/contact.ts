/**
 * The one contact address BuildTrack publishes, and the only place it is written.
 *
 * Archlogic Systems runs no company domain: there is no budget for one, so the
 * founder's personal inbox is the support address by decision, not by oversight.
 * Everything user-facing — billing, the landing CTAs, /support, the legal
 * documents — resolves here.
 *
 * Why a single constant instead of a literal per page: the OFJR → BuildTrack
 * rebrand had to be done by hand in every file that spelled an address out, and
 * /support was missed for almost two months. The addresses it replaced
 * (hola@ / demo@ / beta@buildtrack.gt) were worse than stale — that domain was
 * never registered, so those mailtos opened a message to a name that does not
 * resolve. `contact.singleSource.test.ts` keeps new literals from creeping back.
 */
export const SUPPORT_EMAIL = 'andersonaguirre794@gmail.com';

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
