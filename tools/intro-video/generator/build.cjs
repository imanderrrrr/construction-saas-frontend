// Intro «Del plano a la obra»: genera index.html + compositions/{plano,obra}.html
// a partir de glyphs.json (logos vectorizados con potrace, una pieza por letra) y de geometría
// procedural (grúa, andamio…). Uso: `node generator/build.cjs` (escribe en la carpeta del proyecto).
// El HTML generado ES la fuente: se puede editar a mano; este script solo evita hacerlo en 190 KB de trazos.
const fs = require('fs');
const path = require('path');
const G = require('./glyphs.json');

const PROJECT = process.argv[2] || path.resolve(__dirname, '..');
fs.mkdirSync(path.join(PROJECT, 'compositions'), { recursive: true });

const f = n => +n.toFixed(2);
const W = 2560, H = 1080, CX = W / 2;
const K = 4 / 3;
const YG = 800;                    // línea de terreno (nivel 0.00)
const PAN = 2240;                  // recorrido del barrido = 28 × 80 (cuadrícula continua)

// Paleta: la de la landing (papel de plano, tinta, naranja) + colores medidos de los logos
const PAPER = '#F3EEE6', PAPER2 = '#E7DFD1', RULE = '#D9CFBC', RULE2 = '#CBBFA6';
const INK = '#17130F', MUTED = '#6C6152', ORANGE = '#F97316';
const LOGO_INK = '#030303', SYS = '#373B3E', BT_ORANGE = '#EF5701', BT_BLACK = '#000000';

// Tiempos (s)
const T = {
  total: 9.15,
  pan: 3.75, panDur: 1.0,
  plano: { dur: 4.95 },
  obra: { start: 3.75, dur: 5.4 },
};

// ─── Easing y desenfoque de movimiento compartidos ───────────────────────────
const WHIP_JS = `
    const whip = (() => {
      const a = 0.32, b = (4 / (1 - a)) / (2 / a + 4 / (1 - a));
      return t => t < a ? b * Math.pow(t / a, 2) : b + (1 - b) * (1 - Math.pow(1 - (t - a) / (1 - a), 4));
    })();`;
const blurTweens = (sel, at, dur, sigma) => `
    tl.fromTo('${sel}', { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '${sigma} 0' }, duration: ${dur} * 0.32, ease: 'none' }, ${at});
    tl.fromTo('${sel}', { attr: { stdDeviation: '${sigma} 0' } }, { attr: { stdDeviation: '0 0' }, duration: ${dur} * 0.68, ease: 'power3.out', immediateRender: false }, ${at} + ${dur} * 0.32);`;
const hblur = (id) => `<filter id="${id}" x="-10%" y="0%" width="120%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur id="${id}-s" stdDeviation="0 0"/></filter>`;

// Trazo que se dibuja: path con pathLength=1
const draw = (id, d, attrs = '') => `<path id="${id}" d="${d}" pathLength="1" fill="none" stroke-dasharray="1 1" style="stroke-dashoffset:1" ${attrs}/>`;

// ═════════════════════ ESCENA 1 · EL PLANO (ArchLogic) ═════════════════════
const SW = 0.62 * K;
const BLOCK_TOP = 323, BLOCK_BOT = 757;
const blockH = (BLOCK_BOT - BLOCK_TOP) * SW;
const SM = blockH / 857;
const MK = { x0: 29, y0: 163, x1: 1225, y1: 1020 };
const markW = (MK.x1 - MK.x0) * SM;
const WX0 = 18, WX1 = 1517;
const wordW = (WX1 - WX0) * SW;
const GAP = 64 * K;
const totalW = markW + GAP + wordW;
const L0 = CX - totalW / 2;
const T0 = YG - blockH;            // la marca y "Systems" apoyan en el terreno
const wordLeft = L0 + markW + GAP;
const PADM = 10;

const pxX = sx => L0 + (sx - MK.x0) * SM;
const pxY = sy => T0 + (sy - MK.y0) * SM;

const mkVB = `${MK.x0 - PADM} ${MK.y0 - PADM} ${MK.x1 - MK.x0 + 2 * PADM} ${MK.y1 - MK.y0 + 2 * PADM}`;
const mkBox = {
  left: f(L0 - PADM * SM), top: f(T0 - PADM * SM),
  w: f((MK.x1 - MK.x0 + 2 * PADM) * SM), h: f((MK.y1 - MK.y0 + 2 * PADM) * SM),
};
const baseD = G.markBase.map(s => s.d).join(' ');
const bodyD = G.markOrange[0].d;
const footD = G.markOrange[1].d;

function glyphSvg(id, g, color, wrapLeft, wrapTop, scale, ox, oy) {
  const [x0, y0, x1, y1] = g.bbox, p = 2;
  const vb = `${f(x0 - p)} ${f(y0 - p)} ${f(x1 - x0 + 2 * p)} ${f(y1 - y0 + 2 * p)}`;
  const left = f(ox + (x0 - p) * scale - wrapLeft), top = f(oy + (y0 - p) * scale - wrapTop);
  const w = f((x1 - x0 + 2 * p) * scale), h = f((y1 - y0 + 2 * p) * scale);
  return `<svg id="${id}" class="gl" viewBox="${vb}" style="left:${left}px;top:${top}px;width:${w}px;height:${h}px"><path d="${g.d}" fill="${color}" fill-rule="evenodd"/></svg>`;
}
const archWrap = { left: wordLeft - 12, width: wordW + 24, top: T0 + (305 - BLOCK_TOP) * SW, height: (632 - 305) * SW };
const sysWrap = { left: wordLeft - 12, width: wordW + 24, top: T0 + (586 - BLOCK_TOP) * SW, height: (806 - 586) * SW };
const ox = wordLeft - WX0 * SW, oy = T0 - BLOCK_TOP * SW;
const archSvgs = G.arch.map((g, i) => glyphSvg(`pl-a${i}`, g, LOGO_INK, archWrap.left, archWrap.top, SW, ox, oy)).join('\n          ');
const sysSvgs = G.systems.map((g, i) => glyphSvg(`pl-s${i}`, g, SYS, sysWrap.left, sysWrap.top, SW, ox, oy)).join('\n          ');
const archX = G.arch.map(g => f(ox + g.bbox[0] * SW));
const sysX = G.systems.map(g => f(ox + g.bbox[0] * SW));
const markStartX = f(CX - (L0 + markW / 2));
const markRightFinal = f(L0 + markW);

// Dibujo técnico alrededor de la marca (coordenadas de lienzo)
const apexSrc = { x: 627.6, y: -31 };               // donde se cruzarían los lados de la A
const apex = { x: pxX(apexSrc.x), y: pxY(apexSrc.y) };
const topL = { x: pxX(517), y: pxY(163) }, topR = { x: pxX(738), y: pxY(163) };
const baseL = pxX(MK.x0), baseR = pxX(MK.x1);
const draftD = {
  apexL: `M${f(topL.x)} ${f(topL.y)} L${f(apex.x)} ${f(apex.y)}`,
  apexR: `M${f(topR.x)} ${f(topR.y)} L${f(apex.x)} ${f(apex.y)}`,
  axis: `M${f(apex.x)} ${f(apex.y - 40)} V${YG + 46}`,
  top: `M${f(baseL - 120)} ${f(topL.y)} H${f(baseR + 120)}`,
  dimH: `M${f(baseL)} ${YG + 118} H${f(baseR)} M${f(baseL)} ${YG + 98} V${YG + 138} M${f(baseR)} ${YG + 98} V${YG + 138}`,
  dimV: `M${f(baseL - 70)} ${f(T0)} V${YG} M${f(baseL - 90)} ${f(T0)} H${f(baseL - 50)} M${f(baseL - 90)} ${YG} H${f(baseL - 50)}`,
};

const planoHtml = `<template>
  <style>
    #root { position: absolute; inset: 0; background: transparent; }
    #pl-lock, #pl-move { position: absolute; inset: 0; }
    #pl-move { filter: url(#pl-hb-pan); }
    #pl-markgrp { position: absolute; inset: 0; z-index: 3; filter: url(#pl-hb-mark); }
    #pl-mark { position: absolute; left: ${mkBox.left}px; top: ${mkBox.top}px; width: ${mkBox.w}px; height: ${mkBox.h}px; }
    #pl-mark svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
    #pl-draft { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; z-index: 4; overflow: visible; }
    .pl-line { position: absolute; overflow: hidden; z-index: 1; }
    .gl { position: absolute; display: block; }
    .dim { font: 500 28px 'IBM Plex Mono', monospace; fill: ${MUTED}; letter-spacing: .08em; }
  </style>

  <div id="root" data-composition-id="plano" data-width="${W}" data-height="${H}">
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" data-layout-ignore>
      <defs>
        ${hblur('pl-hb-mark')}
        ${hblur('pl-hb-pan')}
      </defs>
    </svg>
    <div id="pl-lock" class="clip" data-start="0" data-duration="${T.plano.dur}" data-track-index="1">
      <div id="pl-move" data-layout-allow-overflow>

        <div id="pl-markgrp">
        <svg id="pl-draft" viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <!-- líneas de construcción: se dibujan y luego se retiran -->
          <g id="pl-cons" stroke="${INK}" stroke-width="1.6" opacity=".55" stroke-dasharray="14 9">
            <path id="pl-c-apexL" d="${draftD.apexL}" fill="none"/>
            <path id="pl-c-apexR" d="${draftD.apexR}" fill="none"/>
            <path id="pl-c-top" d="${draftD.top}" fill="none"/>
          </g>
          <path id="pl-c-axis" d="${draftD.axis}" fill="none" stroke="${INK}" stroke-width="1.6" opacity=".55" stroke-dasharray="26 8 4 8"/>
          <!-- contorno de la marca -->
          <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
            <svg x="${mkBox.left}" y="${mkBox.top}" width="${mkBox.w}" height="${mkBox.h}" viewBox="${mkVB}" overflow="visible">
              ${draw('pl-o-base', baseD, `stroke-width="9" vector-effect="none"`)}
              ${draw('pl-o-body', bodyD, `stroke-width="9"`)}
              ${draw('pl-o-foot', footD, `stroke-width="9"`)}
            </svg>
          </g>
          <!-- cotas -->
          <g id="pl-dims" stroke="${INK}" stroke-width="2" fill="none">
            ${draw('pl-d-h', draftD.dimH, 'stroke-width="2"')}
            ${draw('pl-d-v', draftD.dimV, 'stroke-width="2"')}
          </g>
          <text id="pl-t-h" class="dim" x="${f((baseL + baseR) / 2)}" y="${YG + 96}" text-anchor="middle">12.00</text>
          <text id="pl-t-v" class="dim" x="${f(baseL - 100)}" y="${f((T0 + YG) / 2)}" text-anchor="middle" transform="rotate(-90 ${f(baseL - 100)} ${f((T0 + YG) / 2)})">8.60</text>
        </svg>

        <div id="pl-mark">
          <svg id="pl-mk-base" viewBox="${mkVB}"><path d="${baseD}" fill="#000" fill-rule="evenodd"/></svg>
          <svg id="pl-mk-body" viewBox="${mkVB}">
            <defs><linearGradient id="pl-gA" gradientUnits="userSpaceOnUse" x1="640" y1="163" x2="520" y2="1020">
              <stop offset="0" stop-color="#FE9D00"/><stop offset=".45" stop-color="#FD7205"/><stop offset="1" stop-color="#FC3F06"/>
            </linearGradient></defs>
            <path d="${bodyD}" fill="url(#pl-gA)" fill-rule="evenodd"/>
          </svg>
          <svg id="pl-mk-foot" viewBox="${mkVB}">
            <defs><linearGradient id="pl-gL" gradientUnits="userSpaceOnUse" x1="900" y1="630" x2="1000" y2="1020">
              <stop offset="0" stop-color="#FE9C00"/><stop offset="1" stop-color="#FB5203"/>
            </linearGradient></defs>
            <path d="${footD}" fill="url(#pl-gL)" fill-rule="evenodd"/>
          </svg>
        </div>
        </div>

        <div id="pl-arch" class="pl-line" data-layout-allow-overflow style="left:${f(archWrap.left)}px;top:${f(archWrap.top)}px;width:${f(archWrap.width)}px;height:${f(archWrap.height)}px">
          ${archSvgs}
        </div>
        <div id="pl-sys" class="pl-line" data-layout-allow-overflow style="left:${f(sysWrap.left)}px;top:${f(sysWrap.top)}px;width:${f(sysWrap.width)}px;height:${f(sysWrap.height)}px">
          ${sysSvgs}
        </div>
      </div>
    </div>
  </div>

  <script>
    const ARCH_X = ${JSON.stringify(archX)};
    const SYS_X = ${JSON.stringify(sysX)};
    const ARCH_H = ${f(archWrap.height)};
    const SYS_H = ${f(sysWrap.height)};
    const MARK_DX = ${markStartX};
    const MARK_RIGHT = ${markRightFinal};
    const PAN = ${PAN}, PAN_AT = ${T.pan}, PAN_DUR = ${T.panDur};
    ${WHIP_JS}
    const tl = gsap.timeline({ paused: true });

    // 1 · El plano: la marca se dibuja con línea de construcción, antes de ser sólida.
    tl.fromTo('#pl-o-base', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 0.4);
    tl.fromTo('#pl-o-body', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0.5);
    tl.fromTo('#pl-o-foot', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, 0.7);
    tl.fromTo('#pl-cons path', { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' }, 0.7);
    tl.fromTo('#pl-c-axis', { opacity: 0 }, { opacity: 0.55, duration: 0.45, ease: 'power1.out' }, 0.8);
    tl.fromTo('#pl-d-h', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out' }, 0.85);
    tl.fromTo('#pl-d-v', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out' }, 0.95);
    tl.fromTo('#pl-t-h, #pl-t-v', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 1.15);

    // 2 · Se rellena: de plano a material.
    tl.fromTo('#pl-mk-base', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'power3.out' }, 1.25);
    tl.fromTo('#pl-mk-body', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'power3.out' }, 1.38);
    tl.fromTo('#pl-mk-foot', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.45, ease: 'power3.out' }, 1.5);
    // lo dibujado se retira cuando ya hay material
    tl.fromTo('#pl-o-base, #pl-o-body, #pl-o-foot', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'power1.in', immediateRender: false }, 1.85);
    tl.fromTo('#pl-cons, #pl-c-axis, #pl-dims, #pl-t-h, #pl-t-v', { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'power1.in', immediateRender: false }, 2.05);

    // 3 · La marca cede el centro y el nombre emerge a su paso.
    const SLIDE_AT = 1.75, SLIDE_DUR = 0.8;
    const slideEase = gsap.parseEase('power3.inOut');
    tl.fromTo('#pl-markgrp', { x: MARK_DX }, { x: 0, duration: SLIDE_DUR, ease: 'power3.inOut' }, SLIDE_AT);
    tl.fromTo('#pl-hb-mark-s', { attr: { stdDeviation: '0 0' } }, { attr: { stdDeviation: '8 0' }, duration: SLIDE_DUR / 2, ease: 'power2.in' }, SLIDE_AT);
    tl.fromTo('#pl-hb-mark-s', { attr: { stdDeviation: '8 0' } }, { attr: { stdDeviation: '0 0' }, duration: SLIDE_DUR / 2, ease: 'power2.out', immediateRender: false }, SLIDE_AT + SLIDE_DUR / 2);
    function edgeTime(x) {
      const target = (x - MARK_RIGHT) / MARK_DX;
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; (1 - slideEase(mid) > target) ? (lo = mid) : (hi = mid); }
      return SLIDE_AT + hi * SLIDE_DUR;
    }
    const T0 = edgeTime(ARCH_X[0]) - 0.04;
    ARCH_X.forEach((x, i) => {
      tl.fromTo('#pl-a' + i, { y: ARCH_H + 12 }, { y: 0, duration: 0.95, ease: 'expo.out' }, T0 + i * 0.05);
    });
    SYS_X.forEach((x, i) => {
      tl.fromTo('#pl-s' + i, { y: SYS_H + 12 }, { y: 0, duration: 0.85, ease: 'expo.out' }, T0 + 0.4 + i * 0.04);
    });

    // 4 · Pausa de lectura y salida: la cámara barre hacia la obra (whip-pan).
    tl.fromTo('#pl-move', { x: 0 }, { x: ${f(21)}, duration: 0.18, ease: 'power2.out', immediateRender: false }, PAN_AT - 0.18);
    tl.fromTo('#pl-move', { x: ${f(21)} }, { x: -PAN, duration: PAN_DUR, ease: whip, immediateRender: false }, PAN_AT);
    ${blurTweens('#pl-hb-pan-s', 'PAN_AT', 'PAN_DUR', 13)}

    window.__timelines['plano'] = tl;
  </script>
</template>
`;
fs.writeFileSync(path.join(PROJECT, 'compositions', 'plano.html'), planoHtml);

// ═════════════════════ ESCENA 2 · LA OBRA (BuildTrack) ═════════════════════
const BX0 = 87, BX1 = 1913, BY0 = 192, BY1 = 495;
const SB = (1080 * K) / (BX1 - BX0);
const bw = (BX1 - BX0) * SB;
const bOx = CX - bw / 2 - BX0 * SB;
const bOy = YG - 487 * SB;                 // la línea base de las letras (y=487 en el original) apoya en el terreno
const bX = sx => bOx + sx * SB, bY = sy => bOy + sy * SB;

const swIdx = G.buildOrange.findIndex(g => g.bbox[0] > 1200);
const buildLetters = G.buildOrange.filter((_, i) => i !== swIdx);
const swoosh = G.buildOrange[swIdx];
const trackLetters = G.trackBlack;

// Una palabra = un svg con todas sus letras; N hileras recortadas para el efecto de mampostería
function wordBox(letters, pad = 4) {
  const x0 = Math.min(...letters.map(g => g.bbox[0])) - pad, x1 = Math.max(...letters.map(g => g.bbox[2])) + pad;
  const y0 = 190, y1 = 497;
  return { x0, y0, x1, y1, left: f(bX(x0)), top: f(bY(y0)), w: f((x1 - x0) * SB), h: f((y1 - y0) * SB), vb: `${x0} ${y0} ${x1 - x0} ${y1 - y0}` };
}
const wb = wordBox(buildLetters), wt = wordBox(trackLetters);
const COURSES = 6;
function courses(prefix, box, letters, color) {
  const paths = letters.map(g => `<path d="${g.d}" fill="${color}" fill-rule="evenodd"/>`).join('');
  const out = [];
  for (let k = 0; k < COURSES; k++) {
    const t = f(k * box.h / COURSES - (k > 0 ? 1.5 : 0));
    const b = f(box.h - (k + 1) * box.h / COURSES - (k < COURSES - 1 ? 1.5 : 0));
    out.push(`<svg id="${prefix}-c${k}" class="word course" viewBox="${box.vb}" style="left:${box.left}px;top:${box.top}px;width:${box.w}px;height:${box.h}px;clip-path:inset(${t}px 0px ${b}px 0px)">${paths}</svg>`);
  }
  out.push(`<svg id="${prefix}-full" class="word" viewBox="${box.vb}" style="left:${box.left}px;top:${box.top}px;width:${box.w}px;height:${box.h}px;opacity:0">${paths}</svg>`);
  return out.join('\n        ');
}
// el trazo naranja
const swP = 2;
const swBox = {
  vb: `${f(swoosh.bbox[0] - swP)} ${f(swoosh.bbox[1] - swP)} ${f(swoosh.bbox[2] - swoosh.bbox[0] + 2 * swP)} ${f(swoosh.bbox[3] - swoosh.bbox[1] + 2 * swP)}`,
  w: f((swoosh.bbox[2] - swoosh.bbox[0] + 2 * swP) * SB), h: f((swoosh.bbox[3] - swoosh.bbox[1] + 2 * swP) * SB),
  cx: f(bX((swoosh.bbox[0] + swoosh.bbox[2]) / 2)), cy: f(bY((swoosh.bbox[1] + swoosh.bbox[3]) / 2)),
};
const swPath = `<path d="${swoosh.d}" fill="${BT_ORANGE}" fill-rule="evenodd" stroke="${BT_ORANGE}" stroke-width="1.6" stroke-linejoin="round"/>`;

// Andamio
const POSTS = [520, 900, 1280, 1660, 2040];
const LEVELS = [YG, 690, 580, 510];
const scafPosts = POSTS.map(x => `M${x} ${YG} V${LEVELS[3]}`).join(' ');
const scafLedgers = LEVELS.slice(1).map(y => `M${POSTS[0]} ${y} H${POSTS[POSTS.length - 1]}`).join(' ');
const scafBraces = [[0, 1], [2, 3]].map(([a, b]) => `M${POSTS[a]} ${YG} L${POSTS[b]} ${LEVELS[2]} M${POSTS[b]} ${YG} L${POSTS[a]} ${LEVELS[2]}`).join(' ');
const couplers = [];
POSTS.forEach((x, i) => LEVELS.slice(1).forEach((y, j) => couplers.push(`<circle class="cp" cx="${x}" cy="${y}" r="7" fill="${ORANGE}" stroke="${INK}" stroke-width="2.5"/>`)));

// Grúa torre
const MX = 2250, MWd = 70, MTOP = 170, SEG = 70;
const mL = MX - MWd / 2, mR = MX + MWd / 2;
let mast = `M${mL} ${YG} V${MTOP} M${mR} ${YG} V${MTOP}`;
for (let i = 0; i < (YG - MTOP) / SEG; i++) {
  const y0 = YG - i * SEG, y1 = y0 - SEG;
  mast += ` M${i % 2 ? mR : mL} ${y0} L${i % 2 ? mL : mR} ${y1} M${mL} ${y1} H${mR}`;
}
const JIB_TIP = 1100;
const jibTop = x => 118 + (MX - x) * (156 - 118) / (MX - JIB_TIP);
let jib = `M${MX} 118 L${JIB_TIP} 156 M${MX} 170 H${JIB_TIP} M${JIB_TIP} 156 V170`;
{ let x = MX, up = false; let pts = `M${MX} 170`; while (x > JIB_TIP + 40) { x -= 62; up = !up; pts += ` L${f(x)} ${up ? f(jibTop(x)) : 170}`; } jib += ' ' + pts; }
const CJ_END = 2415;
let cjib = `M${MX} 118 L${CJ_END} 128 M${MX} 170 H${CJ_END} M${CJ_END} 128 V170`;
{ let x = MX, up = false; let pts = `M${MX} 170`; while (x < CJ_END - 40) { x += 56; up = !up; pts += ` L${x} ${up ? f(118 + (x - MX) * 10 / (CJ_END - MX)) : 170}`; } cjib += ' ' + pts; }
const apexD = `M${MX - 34} 118 L${MX} 38 L${MX + 34} 118 M${MX - 17} 78 H${MX + 17}`;
const pendantD = `M${MX} 38 L${JIB_TIP} 156 M${MX} 38 L${CJ_END} 128`;

const SLING = 150;                           // cables del gancho a la pieza
const HOOK_H0 = 255;                         // altura del gancho al inicio (la pieza cuelga bajo la pluma)
const HOOK_H1 = f(swBox.cy - (22 + SLING + swBox.h / 2));   // al final: la pieza queda en su sitio
const RIG_X0 = 1960, RIG_X1 = swBox.cx;

// Chispas (determinista)
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const ang = (i * 360 / 16 + (i % 3) * 9) * Math.PI / 180, dist = 80 + ((i * 37) % 70);
  return { dx: f(Math.cos(ang) * dist), dy: f(Math.sin(ang) * dist * 0.8 - 20), rot: (i * 53) % 180 };
});

const obraHtml = `<template>
  <style>
    #root { position: absolute; inset: 0; background: transparent; }
    #ob-lock, #ob-move { position: absolute; inset: 0; }
    #ob-move { filter: url(#ob-hb-pan); }
    .word { position: absolute; display: block; }
    #ob-site { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    #ob-site svg.layer { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; overflow: visible; }
    .spark { position: absolute; width: 16px; height: 5px; background: ${ORANGE}; opacity: 0; }
    #ob-flash { position: absolute; width: 260px; height: 260px; border-radius: 50%; left: ${f(swBox.cx - 130)}px; top: ${f(swBox.cy - 148)}px;
      background: radial-gradient(circle, rgba(255,190,90,.95) 0%, rgba(249,115,22,.55) 35%, rgba(249,115,22,0) 70%); opacity: 0; }
  </style>

  <div id="root" data-composition-id="obra" data-width="${W}" data-height="${H}">
    <svg width="0" height="0" style="position:absolute" aria-hidden="true" data-layout-ignore>
      <defs>
        ${hblur('ob-hb-pan')}
        <pattern id="haz" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="28" height="56" fill="${ORANGE}"/><rect x="28" width="28" height="56" fill="${INK}"/>
        </pattern>
      </defs>
    </svg>
    <div id="ob-lock" class="clip" data-start="0" data-duration="${T.obra.dur}" data-track-index="1">
      <div id="ob-move" data-layout-allow-overflow>
        <div id="ob-site">

          <!-- 1 · el andamio (detrás de las letras) -->
          <svg id="ob-scaf" class="layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">
            <g stroke="${INK}" stroke-width="5.5" stroke-linecap="square">
              ${draw('sc-posts', scafPosts)}
              ${draw('sc-ledgers', scafLedgers)}
              ${draw('sc-braces', scafBraces, 'stroke-width="3.5"')}
            </g>
            <rect id="sc-board" x="${POSTS[0]}" y="684" width="${POSTS[POSTS.length - 1] - POSTS[0]}" height="12" fill="${INK}"/>
            <g id="sc-cps">${couplers.join('')}</g>
          </svg>

          <!-- 2 · BuildTrack, por hileras como mampostería -->
          ${courses('bd', wb, buildLetters, BT_ORANGE)}
          ${courses('tk', wt, trackLetters, BT_BLACK)}
          <svg id="ob-swoosh-fixed" class="word" viewBox="${swBox.vb}" style="left:${f(swBox.cx - swBox.w / 2)}px;top:${f(swBox.cy - swBox.h / 2)}px;width:${swBox.w}px;height:${swBox.h}px;opacity:0">${swPath}</svg>

          <!-- 3 · cinta de obra al frente (se corta al terminar) -->
          <svg id="ob-tape" class="layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">
            <g id="tape-l"><rect x="${POSTS[0]}" y="768" width="${POSTS[2] - POSTS[0]}" height="26" fill="url(#haz)" stroke="${INK}" stroke-width="2.5"/></g>
            <g id="tape-r"><rect x="${POSTS[2]}" y="768" width="${POSTS[4] - POSTS[2]}" height="26" fill="url(#haz)" stroke="${INK}" stroke-width="2.5"/></g>
          </svg>

          <!-- 4 · la grúa torre -->
          <svg id="ob-crane" class="layer" viewBox="0 0 ${W} ${H}" aria-hidden="true">
            <g stroke="${INK}" stroke-width="4.5" stroke-linecap="square" stroke-linejoin="round">
              ${draw('cr-mast', mast)}
              ${draw('cr-jib', jib)}
              ${draw('cr-cjib', cjib)}
              ${draw('cr-apex', apexD)}
            </g>
            ${draw('cr-pend', pendantD, `stroke="${INK}" stroke-width="2.4"`)}
            <g id="cr-body" opacity="0">
              <rect x="${MX - 44}" y="160" width="88" height="12" fill="${INK}"/>
              <rect x="${MX + 38}" y="120" width="56" height="42" fill="${PAPER2}" stroke="${INK}" stroke-width="3"/>
              <rect x="${MX + 50}" y="130" width="30" height="18" fill="${ORANGE}"/>
              <g id="cr-cw" stroke="${INK}" stroke-width="3">
                <rect x="${CJ_END - 62}" y="172" width="62" height="20" fill="${ORANGE}"/>
                <rect x="${CJ_END - 62}" y="192" width="62" height="20" fill="${ORANGE}"/>
                <rect x="${CJ_END - 62}" y="212" width="62" height="20" fill="${ORANGE}"/>
              </g>
            </g>
            <!-- carro + cable + gancho + pieza: se mueven juntos -->
            <g id="cr-rig">
              <rect id="cr-trolley" x="-24" y="170" width="48" height="20" fill="${ORANGE}" stroke="${INK}" stroke-width="3"/>
              <line id="cr-cable" x1="0" y1="190" x2="0" y2="${HOOK_H0}" stroke="${INK}" stroke-width="3"/>
              <g id="cr-hook">
                <rect x="-16" y="0" width="32" height="22" fill="${INK}"/>
                <path id="cr-sling" d="M-60 ${22 + SLING} L0 22 L60 ${22 + SLING}" fill="none" stroke="${INK}" stroke-width="3"/>
                <svg id="cr-load" x="${f(-swBox.w / 2)}" y="${22 + SLING}" width="${swBox.w}" height="${swBox.h}" viewBox="${swBox.vb}" overflow="visible">${swPath}</svg>
              </g>
            </g>
          </svg>

          <div id="ob-flash"></div>
          ${SPARKS.map((s, i) => `<div class="spark" id="sp${i}" style="left:${f(swBox.cx - 8)}px;top:${f(swBox.cy)}px"></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <script>
    const PAN = ${PAN}, PAN_DUR = ${T.panDur};
    const SPARKS = ${JSON.stringify(SPARKS)};
    const HOOK0 = ${HOOK_H0}, HOOK1 = ${HOOK_H1}, RIG0 = ${RIG_X0}, RIG1 = ${f(RIG_X1)};
    ${WHIP_JS}
    const tl = gsap.timeline({ paused: true });

    // 0 · La cámara llega a la obra (mismo whip-pan que se llevó el plano).
    tl.fromTo('#ob-move', { x: PAN }, { x: 0, duration: PAN_DUR, ease: whip }, 0);
    ${blurTweens('#ob-hb-pan-s', '0', 'PAN_DUR', 13)}

    // 1 · Se monta el andamio.
    tl.fromTo('#sc-posts', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.65, ease: 'power1.inOut' }, 0.55);
    tl.fromTo('#sc-ledgers', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 0.9);
    tl.fromTo('#sc-braces', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out' }, 1.0);
    tl.fromTo('#sc-board', { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.45, ease: 'power2.out' }, 1.2);
    tl.fromTo('.cp', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.035 }, 0.8);
    // cinta de obra
    tl.fromTo('#tape-l', { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, 1.1);
    tl.fromTo('#tape-r', { scaleX: 0, transformOrigin: '100% 50%' }, { scaleX: 1, duration: 0.4, ease: 'power2.out' }, 1.1);

    // 2 · La grúa se levanta (ya viene creciendo cuando la cámara llega).
    tl.fromTo('#cr-mast', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power1.inOut' }, 0.2);
    tl.fromTo('#cr-jib', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.65, ease: 'power2.out' }, 0.85);
    tl.fromTo('#cr-cjib', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, 0.95);
    tl.fromTo('#cr-apex', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out' }, 1.05);
    tl.fromTo('#cr-pend', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out' }, 1.25);
    tl.fromTo('#cr-body', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 1.15);
    gsap.set('#cr-rig', { x: RIG0 });
    gsap.set('#cr-hook', { y: HOOK0 });
    tl.fromTo('#cr-rig', { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 1.45);

    // 3 · BuildTrack se levanta por hileras (de abajo hacia arriba), alternando el lado como al asentar ladrillo.
    const courseTween = (prefix, start) => {
      for (let k = 0; k < ${COURSES}; k++) {
        const at = start + (${COURSES - 1} - k) * 0.14, dir = k % 2 ? 1 : -1;
        tl.fromTo('#' + prefix + '-c' + k, { x: dir * (150 + k * 8), opacity: 0 }, { x: 0, duration: 0.34, ease: 'power3.out' }, at);
        tl.fromTo('#' + prefix + '-c' + k, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'none', immediateRender: false }, at);
      }
    };
    courseTween('bd', 1.2);
    courseTween('tk', 1.4);
    // al terminar, la pieza entera reemplaza las hileras (sin costuras)
    tl.fromTo('#bd-full', { opacity: 0 }, { opacity: 1, duration: 0.001, immediateRender: false }, 2.3);
    tl.fromTo('#tk-full', { opacity: 0 }, { opacity: 1, duration: 0.001, immediateRender: false }, 2.5);
    tl.fromTo('#bd-c0, #bd-c1, #bd-c2, #bd-c3, #bd-c4, #bd-c5', { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, 2.31);
    tl.fromTo('#tk-c0, #tk-c1, #tk-c2, #tk-c3, #tk-c4, #tk-c5', { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, 2.51);

    // 4 · La grúa baja el trazo naranja y lo coloca en la A.
    const LIFT_AT = 1.95, LIFT_DUR = 1.05;
    tl.to('#cr-rig', { x: RIG1, duration: LIFT_DUR, ease: 'power2.inOut' }, LIFT_AT);
    tl.to('#cr-hook', { y: HOOK1, duration: LIFT_DUR, ease: 'power2.inOut' }, LIFT_AT);
    tl.to('#cr-cable', { attr: { y2: HOOK1 }, duration: LIFT_DUR, ease: 'power2.inOut' }, LIFT_AT);
    // balanceo de la carga (se amortigua al llegar)
    tl.to('#cr-hook', { rotation: -5, transformOrigin: '50% 0%', duration: 0.35, ease: 'power1.out' }, LIFT_AT + 0.1);
    tl.to('#cr-hook', { rotation: 3, duration: 0.4, ease: 'sine.inOut' }, LIFT_AT + 0.45);
    tl.to('#cr-hook', { rotation: 0, duration: 0.3, ease: 'sine.out' }, LIFT_AT + 0.85);

    // 5 · Contacto: la pieza queda soldada. Flash, chispas y un golpe de cámara mínimo.
    const LAND = LIFT_AT + LIFT_DUR + 0.1;
    tl.fromTo('#ob-swoosh-fixed', { opacity: 0 }, { opacity: 1, duration: 0.001, immediateRender: false }, LAND);
    tl.fromTo('#cr-load', { opacity: 1 }, { opacity: 0, duration: 0.001, immediateRender: false }, LAND);
    tl.fromTo('#cr-sling', { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'power1.in', immediateRender: false }, LAND + 0.05);
    tl.fromTo('#ob-flash', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.12, ease: 'power2.out' }, LAND);
    tl.to('#ob-flash', { opacity: 0, scale: 1.5, duration: 0.45, ease: 'power2.in' }, LAND + 0.12);
    SPARKS.forEach((s, i) => {
      tl.fromTo('#sp' + i, { x: 0, y: 0, opacity: 1, rotation: s.rot }, { x: s.dx, y: s.dy + 40, opacity: 0, duration: 0.55, ease: 'power2.out', immediateRender: false }, LAND);
    });
    tl.fromTo('#ob-site', { y: 0 }, { y: 7, duration: 0.06, ease: 'power2.out', immediateRender: false }, LAND);
    tl.to('#ob-site', { y: 0, duration: 0.22, ease: 'bounce.out' }, LAND + 0.06);

    // 6 · Obra terminada: se retira la grúa, se desarma el andamio y se corta la cinta.
    const DONE = LAND + 0.35;
    tl.to('#cr-rig', { x: 2110, duration: 0.8, ease: 'power2.inOut' }, DONE);
    tl.to('#cr-hook', { y: 150, duration: 0.8, ease: 'power2.inOut' }, DONE);
    tl.to('#cr-cable', { attr: { y2: 150 }, duration: 0.8, ease: 'power2.inOut' }, DONE);
    tl.to('#tape-l', { rotation: 62, transformOrigin: '0% 50%', duration: 0.55, ease: 'power3.in' }, DONE + 0.05);
    tl.to('#tape-r', { rotation: -62, transformOrigin: '100% 50%', duration: 0.55, ease: 'power3.in' }, DONE + 0.05);
    tl.fromTo('#tape-l, #tape-r', { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'power1.in', immediateRender: false }, DONE + 0.45);
    tl.to('#sc-posts, #sc-ledgers, #sc-braces', { strokeDashoffset: 1, duration: 0.7, ease: 'power2.in' }, DONE + 0.2);
    tl.to('#sc-board', { scaleX: 0, transformOrigin: '100% 50%', duration: 0.4, ease: 'power2.in' }, DONE + 0.2);
    tl.to('.cp', { scale: 0, duration: 0.25, ease: 'power2.in', stagger: 0.02 }, DONE + 0.25);

    window.__timelines['obra'] = tl;
  </script>
</template>
`;
fs.writeFileSync(path.join(PROJECT, 'compositions', 'obra.html'), obraHtml);


// ═════════════════════ SONIDO ═════════════════════
// [id, archivo, inicio, duración, volumen, extras, causa]. El pico de cada golpe cae un cuadro después de la imagen.
const AUDIO = [
  ['bgm', 'music/obra-bed.mp3', 0, 9.15, 0.28, 'data-fade-in="0.6" data-fade-out="1.4"', 'Música: colchón de pads sin batería; su subida (≈6.5 s) llega a su cima cuando la grúa suelda el trazo'],
  ['sfx-foundation', 'sfx/impact-bass-1.mp3', 1.45, 1.2, 0.22, 'data-fade-out="0.6"', '1.50 · la base negra de la marca se rellena'],
  ['sfx-orange', 'sfx/pop.mp3', 1.60, 0.72, 0.30, '', '1.70 · la A naranja se rellena'],
  ['sfx-slide', 'sfx/whoosh-short.mp3', 1.99, 0.57, 0.26, '', '2.15 · la marca cede el centro'],
  ['sfx-name', 'sfx/whoosh-short.mp3', 2.14, 0.77, 0.16, 'data-playback-rate="0.75"', '2.35 · sube el nombre: el mismo whoosh, más lento y suave'],
  ['sfx-whip', 'sfx/whoosh-cinematic.mp3', 2.67, 2.9, 0.30, 'data-media-start="1.5" data-fade-in="0.7" data-fade-out="0.9"', '4.07 · tensión bajo la pausa; cima en lo más rápido del barrido hacia la obra'],
  ['sfx-assemble', 'sfx/rattle-assembly.mp3', 4.0, 1.77, 0.22, 'data-fade-out="0.4"', '4.0–5.0 · se levantan andamio y grúa'],
  ['sfx-cp1', 'sfx/clink.mp3', 4.58, 1.0, 0.16, '', '4.65 · un acople encaja'],
  ['sfx-cp2', 'sfx/strike-ring.mp3', 4.80, 1.0, 0.15, '', '4.9 · otro acople'],
  ['sfx-cp3', 'sfx/clink.mp3', 5.06, 1.0, 0.14, '', '5.13 · otro acople'],
  ['sfx-b1', 'sfx/thud-heavy.mp3', 5.12, 0.79, 0.30, '', '5.17 · primera hilera'],
  ['sfx-b2', 'sfx/thud-muffled.mp3', 5.40, 0.82, 0.26, '', '5.45 · hilera'],
  ['sfx-b3', 'sfx/thud-room.mp3', 5.68, 1.0, 0.26, '', '5.73 · hilera'],
  ['sfx-b4', 'sfx/thud-heavy.mp3', 5.88, 0.79, 0.24, '', '5.93 · hilera de «Track»'],
  ['sfx-b5', 'sfx/thud-muffled.mp3', 6.02, 0.82, 0.22, '', '6.07 · última hilera'],
  ['sfx-arrival', 'sfx/impact-bass-2.mp3', 6.47, 1.14, 0.24, 'data-media-start="1.45" data-fade-out="0.3"', '6.87 · la grúa asienta el trazo: un pequeño crescendo y el golpe'],
  ['sfx-contact', 'sfx/clunk-scrape.mp3', 6.84, 0.82, 0.30, '', '6.87 · contacto metálico'],
  ['sfx-sparks', 'sfx/sparkle.mp3', 6.86, 1.8, 0.20, 'data-fade-out="0.8"', '6.9 · chispas de soldadura'],
  ['sfx-tape', 'sfx/rip-tape.mp3', 7.15, 0.98, 0.30, '', '7.25 · se corta la cinta de obra'],
  ['sfx-dismantle', 'sfx/rattle-pieces.mp3', 7.25, 1.67, 0.26, 'data-fade-out="0.4"', '7.4–8.1 · se desarma el andamio'],
];
const audioHtml = AUDIO.map(([id, file, start, dur, vol, extra, why], i) =>
  `      <!-- ${why} -->\n      <audio id="${id}" class="clip" src="assets/${file}" data-start="${start}" data-duration="${dur}" data-track-index="${10 + i}" data-volume="${vol}" ${extra}></audio>`).join('\n');

// ═════════════════════ RAÍZ · papel de plano, mundo, rótulos ═════════════════════
const WORLD_W = W + PAN;
const gridMinor = 80, gridMajor = 400;
const crop = (x, y, a = 20) => `M${x - a} ${y} H${x + a} M${x} ${y - a} V${y + a}`;
const indexHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root { --paper: ${PAPER}; --ink: ${INK}; --muted: ${MUTED}; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--paper); }
      #root { position: relative; width: 100%; height: 100%; background: var(--paper); }
      #sheet { position: absolute; inset: 0; background: var(--paper); }
      #world { position: absolute; left: 0; top: 0; width: ${WORLD_W}px; height: ${H}px; filter: url(#w-hb); }
      #world svg { position: absolute; left: 0; top: 0; width: ${WORLD_W}px; height: ${H}px; overflow: visible; }
      #edge-top, #edge-bottom { position: absolute; left: 0; width: ${W}px; pointer-events: none; }
      #edge-top { top: 0; height: 170px; background: linear-gradient(to bottom, var(--paper) 0%, rgba(243,238,230,0) 100%); }
      #edge-bottom { top: ${H - 200}px; height: 200px; background: linear-gradient(to top, var(--paper) 0%, rgba(243,238,230,0) 100%); }
      .lbl { position: absolute; font: 500 28px 'IBM Plex Mono', monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
      #marks { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${T.total}" data-width="${W}" data-height="${H}">
      <svg width="0" height="0" style="position:absolute" aria-hidden="true" data-layout-ignore>
        <defs>${hblur('w-hb')}</defs>
      </svg>
      <div id="sheet"></div>

      <!-- el mundo: cuadrícula de plano + terreno; viaja con la cámara -->
      <div id="world" data-layout-allow-overflow>
        <svg id="grid" viewBox="0 0 ${WORLD_W} ${H}" aria-hidden="true" style="clip-path:inset(46% 46% 46% 46%)">
          <defs>
            <pattern id="g-minor" width="${gridMinor}" height="${gridMinor}" patternUnits="userSpaceOnUse"><path d="M${gridMinor} 0 V${gridMinor} M0 ${gridMinor} H${gridMinor}" fill="none" stroke="${RULE}" stroke-width="1.2"/></pattern>
            <pattern id="g-major" width="${gridMajor}" height="${gridMajor}" patternUnits="userSpaceOnUse"><path d="M${gridMajor} 0 V${gridMajor} M0 ${gridMajor} H${gridMajor}" fill="none" stroke="${RULE2}" stroke-width="2"/></pattern>
          </defs>
          <rect width="${WORLD_W}" height="${H}" fill="url(#g-minor)"/>
          <rect width="${WORLD_W}" height="${H}" fill="url(#g-major)"/>
        </svg>
        <svg id="ground" viewBox="0 0 ${WORLD_W} ${H}" aria-hidden="true">
          <defs>
            <pattern id="hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="18" stroke="${INK}" stroke-width="1.6" opacity=".5"/></pattern>
            <linearGradient id="hatch-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
            <mask id="hatch-mask"><rect x="0" y="${YG}" width="${WORLD_W}" height="64" fill="url(#hatch-fade)"/></mask>
          </defs>
          <rect x="0" y="${YG}" width="${WORLD_W}" height="64" fill="url(#hatch)" mask="url(#hatch-mask)" id="hatch-rect" style="opacity:0"/>
          ${draw('ground-line', `M0 ${YG} H${WORLD_W}`, `stroke="${INK}" stroke-width="5"`)}
          <g id="level-mark" style="opacity:0">
            <path d="M150 ${YG - 28} L174 ${YG - 28} L162 ${YG - 6} Z" fill="${INK}"/>
            <text x="190" y="${YG + 40}" style="font:500 28px 'IBM Plex Mono',monospace;letter-spacing:.14em;fill:${INK}">NIVEL 0.00</text>
          </g>
        </svg>
      </div>

      <div id="edge-top"></div><div id="edge-bottom"></div>

      <!-- marcas de esquina y rótulos de la lámina -->
      <svg id="marks" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <path id="crops" d="${crop(128, 54)} ${crop(W - 128, 54)} ${crop(128, H - 54)} ${crop(W - 128, H - 54)}" stroke="${INK}" stroke-width="2" fill="none" opacity="0"/>
      </svg>
      <div id="lbl-tl" class="lbl" style="left:160px;top:70px;opacity:0">ArchLogic Systems</div>
      <div id="lbl-tl2" class="lbl" style="left:160px;top:70px;opacity:0">BuildTrack</div>
      <div id="lbl-bl" class="lbl" style="left:160px;bottom:70px;opacity:0">Lámina 01 / 02 · Escala 1:50</div>
      <div id="lbl-bl2" class="lbl" style="left:160px;bottom:70px;opacity:0">Lámina 02 / 02 · Escala 1:50</div>
      <div id="lbl-br" class="lbl" style="right:160px;bottom:70px;opacity:0">NIVEL ±0.00 · EJE A-1 — PUNTO DE REFERENCIA</div>

      <div id="plano" data-composition-id="plano" data-composition-src="compositions/plano.html"
        data-start="0" data-duration="${T.plano.dur}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>
      <div id="obra" data-composition-id="obra" data-composition-src="compositions/obra.html"
        data-start="${T.obra.start}" data-duration="${T.obra.dur}" data-track-index="2" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>

${audioHtml}
    </div>
    <script>
      const PAN = ${PAN}, PAN_AT = ${T.pan}, PAN_DUR = ${T.panDur};
      ${WHIP_JS}
      const tl = gsap.timeline({ paused: true });

      // La hoja de dibujo: la cuadrícula se despliega desde el centro, baja el terreno, aparecen los rótulos.
      tl.fromTo('#grid', { clipPath: 'inset(46% 46% 46% 46%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.out' }, 0.05);
      tl.fromTo('#ground-line', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out' }, 0.3);
      tl.fromTo('#hatch-rect', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.7);
      tl.fromTo('#level-mark', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0.8);
      tl.fromTo('#crops', { opacity: 0 }, { opacity: 0.7, duration: 0.5, ease: 'power1.out' }, 0.5);
      tl.fromTo('#lbl-tl, #lbl-bl, #lbl-br', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out', stagger: 0.08 }, 0.9);

      // El barrido: el mundo viaja con la cámara (mismo recorrido y desenfoque que los logos).
      tl.fromTo('#world', { x: 0 }, { x: -PAN, duration: PAN_DUR, ease: whip, immediateRender: false }, PAN_AT);
      ${blurTweens('#w-hb-s', 'PAN_AT', 'PAN_DUR', 13)}
      // Los rótulos pasan a la lámina 02 y a BuildTrack.
      tl.fromTo('#lbl-tl, #lbl-bl', { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'power1.in', immediateRender: false }, PAN_AT + 0.25);
      tl.fromTo('#lbl-tl2, #lbl-bl2', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, PAN_AT + 0.55);

      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(PROJECT, 'index.html'), indexHtml);

console.log({ L0: f(L0), T0: f(T0), markW: f(markW), swoosh: swBox.cx + ',' + swBox.cy, HOOK_H1, RIG_X1: f(RIG_X1), wordBuild: wb.left + ',' + wb.top + ' ' + wb.w + 'x' + wb.h, wordTrack: wt.left + ',' + wt.top + ' ' + wt.w + 'x' + wt.h });
