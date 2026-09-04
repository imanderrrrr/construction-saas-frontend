/**
 * The panel's revision stamp — ONE source for every "Rev 08.2026" on screen.
 *
 * It is the what's-new release version: bumping WHATS_NEW_VERSION is what
 * ships a fresh set of cards, and the login column, the welcome footer and the
 * carousel header all read it from here so no stamp can drift from the others
 * (the design sheet arrived with a hand-written "07.2026" once — never again).
 */
export const WHATS_NEW_VERSION = '2026-08';

/** "2026-08" → "08.2026", the stamp style the dashboard uses ("Rev 08.2026"). */
export function revStamp(version: string): string {
  const [year, month] = version.split('-');
  return month && year ? `${month}.${year}` : version;
}

export const PANEL_REV = revStamp(WHATS_NEW_VERSION);
