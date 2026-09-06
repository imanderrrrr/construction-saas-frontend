/**
 * Section intent — a one-shot hand-off between two sections of the admin panel.
 *
 * The sidebar sections are siblings that mount and unmount on `activeSection`;
 * none of them can see the other's state. When the client ficha says "Ver
 * todas en Proyectos →" it needs Proyectos to open with the client filter
 * already applied, and the only channel between them is this tiny store:
 *
 *   1. the caller writes the intent (`setSectionIntent('projects', {...})`),
 *   2. the caller navigates (`onNavigate('projects')`),
 *   3. the target section reads it while initialising its state
 *      (`peekSectionIntent('projects')` — pure, safe under StrictMode's
 *      double initializer) and clears it once mounted
 *      (`clearSectionIntent('projects')`).
 *
 * One-shot on purpose: an intent that survived its first mount would re-apply
 * the filter every time the user came back to the section by hand. Not a
 * global state manager — one section-keyed slot, and only sections listed in
 * `SectionIntents` can carry one, so a typo in the key fails to compile.
 */
export interface SectionIntents {
  /** Proyectos: open the list already narrowed to this client — and, if asked, straight into one of its fichas. */
  projects: { clientId: number; clientName: string; openProjectId?: number };
}

type Key = keyof SectionIntents;

const slots = new Map<Key, SectionIntents[Key]>();

export function setSectionIntent<K extends Key>(section: K, intent: SectionIntents[K]): void {
  slots.set(section, intent);
}

/** Reads the intent for `section` without clearing it; null when nobody asked for anything. */
export function peekSectionIntent<K extends Key>(section: K): SectionIntents[K] | null {
  return (slots.get(section) as SectionIntents[K] | undefined) ?? null;
}

export function clearSectionIntent(section: Key): void {
  slots.delete(section);
}

/** Peek + clear in one go, for callers that read outside a state initializer. */
export function consumeSectionIntent<K extends Key>(section: K): SectionIntents[K] | null {
  const intent = peekSectionIntent(section);
  slots.delete(section);
  return intent;
}

/** Tests only. */
export function resetSectionIntents(): void {
  slots.clear();
}
