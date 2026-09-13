import type { Locator, Page } from '@playwright/test';

// A visible pointer for the clips.
//
// Playwright's video does not draw the mouse, so a recording of real clicks
// looks like the UI changing by itself. This injects a DOM pointer that we move
// alongside the real mouse, plus a click ring — the only "editing" in the
// footage, and the reason a viewer can follow what is being done.

const CURSOR_CSS = `
#bt-demo-cursor {
  position: fixed; left: 0; top: 0; width: 22px; height: 22px;
  z-index: 2147483647; pointer-events: none; opacity: 0;
  transform: translate(-2px, -2px);
  transition: transform 520ms cubic-bezier(.33,.1,.25,1), opacity 200ms linear;
  will-change: transform;
}
#bt-demo-cursor svg { display: block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45)); }
#bt-demo-ring {
  position: fixed; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px;
  border: 2px solid #F97316; border-radius: 50%; z-index: 2147483646; pointer-events: none;
  opacity: 0; transform: scale(.35);
}
#bt-demo-ring.bt-pulse { animation: bt-demo-pulse 480ms ease-out; }
@keyframes bt-demo-pulse {
  0%   { opacity: .95; transform: scale(.35); }
  100% { opacity: 0;   transform: scale(1.25); }
}
`;

const CURSOR_SVG = `
<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 2 L3 17.2 L7.1 13.4 L9.9 19.6 L12.6 18.4 L9.8 12.3 L15.4 12.1 Z"
        fill="#0A0A0A" stroke="#F5F1E8" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/** Inject the pointer. Runs on every document, so it survives navigation. */
export async function installCursor(page: Page) {
  await page.addInitScript(({ css, svg }) => {
    const draw = () => {
      if (document.getElementById('bt-demo-cursor')) return;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      const ring = document.createElement('div');
      ring.id = 'bt-demo-ring';
      const cur = document.createElement('div');
      cur.id = 'bt-demo-cursor';
      cur.innerHTML = svg;
      document.body.append(ring, cur);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw);
    else draw();
  }, { css: CURSOR_CSS, svg: CURSOR_SVG });
}

async function place(page: Page, x: number, y: number, show = true) {
  await page.evaluate(({ x, y, show }) => {
    const cur = document.getElementById('bt-demo-cursor');
    const ring = document.getElementById('bt-demo-ring');
    if (cur) {
      cur.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
      cur.style.opacity = show ? '1' : '0';
    }
    if (ring) { ring.style.left = `${x}px`; ring.style.top = `${y}px`; }
  }, { x, y, show });
}

async function centerOf(target: Locator): Promise<{ x: number; y: number }> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error('cursor: target has no box — is it visible?');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Glide the pointer to a target and leave it there. */
export async function moveTo(page: Page, target: Locator, settle = 620) {
  const { x, y } = await centerOf(target);
  await place(page, x, y);
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(settle);
}

/** Glide, ring, then really click. */
export async function click(page: Page, target: Locator, opts: { after?: number; settle?: number } = {}) {
  await moveTo(page, target, opts.settle ?? 620);
  await page.evaluate(() => {
    const ring = document.getElementById('bt-demo-ring');
    if (!ring) return;
    ring.classList.remove('bt-pulse');
    void ring.offsetWidth;
    ring.classList.add('bt-pulse');
  });
  await page.waitForTimeout(160);
  await target.click();
  await page.waitForTimeout(opts.after ?? 900);
}

/** Park the pointer off-screen (nothing to point at right now). */
export async function hideCursor(page: Page) {
  await place(page, -60, -60, false);
}

/** Wheel-scroll the page (or a scroller under the pointer) by `dy`, smoothly. */
export async function scroll(page: Page, dy: number, steps = 14, gap = 45) {
  const step = Math.round(dy / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(gap);
  }
  await page.waitForTimeout(250);
}
