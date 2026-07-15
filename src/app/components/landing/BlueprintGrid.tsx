/**
 * The faint blueprint grid behind the dark sections of the public site.
 *
 * A 52px square rule, masked so it fades out towards the content — exactly the
 * three treatments the design uses: the hero (strong at the top, gone by the
 * fold), the field-app section (fading upward) and the final CTA (fading
 * downward).
 *
 * Purely decorative: aria-hidden and pointer-events-none, so it never sits
 * between the reader and the content.
 */

const CELL = 52; // px — the design's rule spacing

/** Which way the grid dissolves. Named for where the grid is *strongest*. */
export type GridFade = 'hero' | 'bottom' | 'top';

const MASKS: Record<GridFade, string> = {
  hero: 'linear-gradient(to bottom,rgba(0,0,0,0.85),rgba(0,0,0,0.4) 62%,transparent 96%)',
  bottom: 'linear-gradient(to top,rgba(0,0,0,0.8),transparent 70%)',
  top: 'linear-gradient(to bottom,rgba(0,0,0,0.8),transparent 85%)',
};

export function BlueprintGrid({
  fade = 'hero',
  lineOpacity = 0.05,
}: {
  fade?: GridFade;
  /** Rule alpha. The design uses 0.05 in the hero and 0.04 elsewhere. */
  lineOpacity?: number;
}) {
  const line = `rgba(248,243,235,${lineOpacity})`;
  const mask = MASKS[fade];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `repeating-linear-gradient(to right,${line} 0 1px,transparent 1px ${CELL}px),repeating-linear-gradient(to bottom,${line} 0 1px,transparent 1px ${CELL}px)`,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />
  );
}
