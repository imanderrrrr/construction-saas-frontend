import { useRef, useState, type ReactNode } from 'react';

/**
 * Blueprint / floor-tile grid background with a cursor-reactive spotlight and a
 * per-cell hover highlight.
 *
 * A faint square grid (like a construction blueprint / floor). Near the pointer
 * it brightens and picks up a soft orange glow; the exact 60px cell under the
 * pointer fills orange with a right-to-left wipe, re-triggered each time the
 * pointer crosses into a new square. Wrap section content with
 * <BlueprintGridSection>; the grid sits behind it (pointer-events-none, so
 * content stays clickable) and only reacts on desktop (mousemove — touch
 * devices have no hover, so nothing fires).
 *
 * Implementation: stacked layers (orange hover cell → dim base grid → bright
 * grid + orange glow, both masked to a radial circle at the `--mx`/`--my` vars
 * the section updates on mousemove). The hovered cell is snapped to the grid in
 * JS and passed as `cell`; a React key on the fill restarts the wipe per cell.
 */

const CELL = 60; // px — matches the Pencil mock (60px squares)

/** Snapped grid cell under the pointer. `n` increments per new cell so the
 *  wipe animation restarts (via React key) each time the pointer crosses in. */
export type HoverCell = { x: number; y: number; n: number } | null;

function gridLayer(color: string): React.CSSProperties {
  return {
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${CELL}px ${CELL}px`,
  };
}

const SPOTLIGHT =
  'radial-gradient(circle 220px at var(--mx, -200px) var(--my, -200px), black 0%, transparent 72%)';

const CELL_CSS = `
.bpg-cell-fill {
  height: 100%;
  width: 100%;
  background: rgba(249, 115, 22, 0.85);
  transform-origin: right center;
  will-change: transform;
  animation: bpg-cell-wipe 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes bpg-cell-wipe {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@media (prefers-reduced-motion: reduce) {
  .bpg-cell-fill { animation-duration: 1ms; }
}
`;

export function BlueprintGrid({ dark = false, cell = null }: { dark?: boolean; cell?: HoverCell }) {
  const line = dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,10,0.05)';
  const lineBright = dark ? 'rgba(255,255,255,0.20)' : 'rgba(10,10,10,0.14)';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* orange cell under the pointer — wipes in right-to-left, restarts per cell */}
      {cell && (
        <div
          className="absolute left-0 top-0"
          style={{ height: CELL, width: CELL, transform: `translate(${cell.x}px, ${cell.y}px)` }}
        >
          <div key={cell.n} className="bpg-cell-fill" />
        </div>
      )}
      {/* dim base grid (always visible) — faint lines sit over the orange cell */}
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
      <style>{CELL_CSS}</style>
    </div>
  );
}

/**
 * Section wrapper that hosts a BlueprintGrid and feeds it the pointer position
 * (for the spotlight/glow) plus the snapped cell (for the hover highlight).
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
  const lastKey = useRef('');
  const [cell, setCell] = useState<HoverCell>(null);

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    el.style.setProperty('--mx', `${mx}px`);
    el.style.setProperty('--my', `${my}px`);

    const cx = Math.floor(mx / CELL) * CELL;
    const cy = Math.floor(my / CELL) * CELL;
    const key = `${cx}:${cy}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      // Same `children` element reference across updates, so React reuses the
      // content subtree — only the grid re-renders as the cell moves.
      setCell((prev) => ({ x: cx, y: cy, n: (prev?.n ?? 0) + 1 }));
    }
  };

  const onLeave = () => {
    lastKey.current = '';
    setCell(null);
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative overflow-hidden ${className}`}
    >
      <BlueprintGrid dark={dark} cell={cell} />
      <div className="relative">{children}</div>
    </section>
  );
}
