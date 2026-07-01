import { useRef, type ReactNode } from 'react';

/**
 * Blueprint / floor-tile grid background with a cursor-reactive spotlight.
 *
 * Replaces the generic gradient blobs: a faint square grid (like a construction
 * blueprint / floor) that brightens — plus a soft orange glow — around the
 * pointer. Wrap any section content with <BlueprintGridSection>; the grid sits
 * behind it (pointer-events-none, so content stays clickable).
 *
 * Implementation: two stacked grids (dim base + bright overlay). The bright
 * overlay and the orange glow are masked to a radial circle centred on the
 * cursor via the `--mx` / `--my` CSS vars the section updates on mousemove.
 */

const CELL = 60; // px — matches the Pencil mock (60px squares)

function gridLayer(color: string): React.CSSProperties {
  return {
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${CELL}px ${CELL}px`,
  };
}

const SPOTLIGHT =
  'radial-gradient(circle 220px at var(--mx, -200px) var(--my, -200px), black 0%, transparent 72%)';

export function BlueprintGrid({ dark = false }: { dark?: boolean }) {
  const line = dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,10,0.05)';
  const lineBright = dark ? 'rgba(255,255,255,0.20)' : 'rgba(10,10,10,0.14)';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* dim base grid (always visible) */}
      <div className="absolute inset-0" style={gridLayer(line)} />
      {/* brighter grid revealed only near the cursor */}
      <div
        className="absolute inset-0"
        style={{ ...gridLayer(lineBright), maskImage: SPOTLIGHT, WebkitMaskImage: SPOTLIGHT }}
      />
      {/* soft orange glow that follows the cursor */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle 220px at var(--mx, -200px) var(--my, -200px), rgba(249,115,22,0.12), transparent 70%)',
        }}
      />
    </div>
  );
}

/**
 * Section wrapper that hosts a BlueprintGrid and feeds it the pointer position.
 * Renders a <section> with the grid behind `children`.
 */
export function BlueprintGridSection({
  children,
  dark = false,
  className = '',
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <section ref={ref} onMouseMove={onMove} className={`relative overflow-hidden ${className}`}>
      <BlueprintGrid dark={dark} />
      <div className="relative">{children}</div>
    </section>
  );
}
