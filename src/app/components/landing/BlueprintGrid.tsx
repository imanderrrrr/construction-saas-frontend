import { useRef, useState, type ReactNode } from 'react';

/**
 * Blueprint / floor-tile grid background with a cursor-reactive spotlight and a
 * per-cell orange hover.
 *
 * A faint square grid (like a construction blueprint / floor). Near the pointer
 * it brightens and picks up a soft orange glow; the exact 60px cell under the
 * pointer fills brand orange with a right-to-left wipe and STAYS lit while the
 * pointer rests on it. As the pointer moves, the cells it leaves behind fade
 * out — a short comet-tail of lit squares. Wrap section content with
 * <BlueprintGridSection>; the grid sits behind it (pointer-events-none, so
 * content stays clickable) and only reacts on desktop (mousemove — touch has no
 * hover, so nothing fires).
 */

const CELL = 60; // px — matches the Pencil mock (60px squares)

/** A grid cell (snapped to the CELL grid). `id` is unique so React keys are
 *  stable and the wipe/fade animations run exactly once each. */
type Cell = { x: number; y: number; id: number };

/** How many trailing (fading) cells to keep at most — a safety cap in case an
 *  animationend never fires (e.g. the tab is backgrounded mid-fade). */
const MAX_TRAIL = 14;

function gridLayer(color: string): React.CSSProperties {
  return {
    backgroundImage: `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
    backgroundSize: `${CELL}px ${CELL}px`,
  };
}

const SPOTLIGHT =
  'radial-gradient(circle 220px at var(--mx, -200px) var(--my, -200px), black 0%, transparent 72%)';

const CELL_CSS = `
.bpg-cell {
  height: 100%;
  width: 100%;
  background: rgba(249, 115, 22, 0.9);
  transform-origin: right center;
  will-change: transform, opacity;
}
.bpg-cell-in { animation: bpg-cell-wipe 150ms ease-out both; }
.bpg-cell-out { animation: bpg-cell-fade 340ms ease-out forwards; }
@keyframes bpg-cell-wipe {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
@keyframes bpg-cell-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .bpg-cell-in, .bpg-cell-out { animation-duration: 1ms; }
}
`;

function CellBox({
  cell,
  className,
  onDone,
}: {
  cell: Cell;
  className: string;
  onDone?: () => void;
}) {
  return (
    <div
      className="absolute left-0 top-0"
      style={{ height: CELL, width: CELL, transform: `translate(${cell.x}px, ${cell.y}px)` }}
    >
      <div className={className} onAnimationEnd={onDone} />
    </div>
  );
}

export function BlueprintGrid({
  dark = false,
  current = null,
  trail = [],
  onTrailDone,
}: {
  dark?: boolean;
  current?: Cell | null;
  trail?: Cell[];
  onTrailDone?: (id: number) => void;
}) {
  const line = dark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,10,0.05)';
  const lineBright = dark ? 'rgba(255,255,255,0.20)' : 'rgba(10,10,10,0.14)';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* fading trail of cells the pointer has left behind */}
      {trail.map((c) => (
        <CellBox key={c.id} cell={c} className="bpg-cell bpg-cell-out" onDone={() => onTrailDone?.(c.id)} />
      ))}
      {/* the cell under the pointer — wipes in right-to-left, stays lit */}
      {current && <CellBox key={current.id} cell={current} className="bpg-cell bpg-cell-in" />}
      {/* dim base grid (always visible) — faint lines sit over the orange cells */}
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
 * (for the spotlight/glow) plus the hovered cell + fading trail.
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
  const idRef = useRef(0);
  const currentRef = useRef<Cell | null>(null);
  const [current, setCurrent] = useState<Cell | null>(null);
  const [trail, setTrail] = useState<Cell[]>([]);

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
    if (key === lastKey.current) return;
    lastKey.current = key;

    const next: Cell = { x: cx, y: cy, id: idRef.current++ };
    const prev = currentRef.current;
    currentRef.current = next;
    setCurrent(next);
    if (prev) setTrail((t) => [...t, prev].slice(-MAX_TRAIL)); // demote old cell to the fading trail
  };

  const onLeave = () => {
    const prev = currentRef.current;
    currentRef.current = null;
    lastKey.current = '';
    setCurrent(null);
    if (prev) setTrail((t) => [...t, prev].slice(-MAX_TRAIL));
  };

  const onTrailDone = (id: number) => setTrail((t) => t.filter((c) => c.id !== id));

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`relative overflow-hidden ${className}`}
    >
      <BlueprintGrid dark={dark} current={current} trail={trail} onTrailDone={onTrailDone} />
      <div className="relative">{children}</div>
    </section>
  );
}
