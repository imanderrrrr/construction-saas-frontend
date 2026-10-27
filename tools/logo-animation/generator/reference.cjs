// Dibuja el escenario de referencia (suelo, losa, caja naranja con casco y las letras fantasma) → reference/stage-ref*.png
//   NODE_PATH=<node_modules con playwright-core> node generator/reference.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const L = require('../letters.json');
const S = L.stage;
const P = S.palette;

const HAT = '<rect x="10.6" y="4.6" width="2.8" height="4.5" rx="1.4" fill="#FFFFFF"/><path d="M4.5 15.4 v-1.6 a7.5 7.5 0 0 1 15 0 v1.6 z" fill="#FFFFFF"/><rect x="2.8" y="16" width="18.4" height="2.9" rx="1.45" fill="#FFFFFF"/>';
const wordX0 = L.letters[0].bbox[0] - 9, wordX1 = L.letters[9].bbox[2] + 9;   // losa un poco más ancha que la palabra
const hatPx = S.tile.size * 0.625;

function svg({ ghost, grid, bare }) {
  const g = [];
  g.push(`<rect width="${S.width}" height="${S.height}" fill="${P.ink}"/>`);
  if (grid) {
    for (let x = 0; x <= S.width; x += 100) g.push(`<path d="M${x} 0V${S.height}" stroke="#fff" stroke-opacity="${x % 500 ? .09 : .22}"/><text x="${x + 4}" y="12" font="10px monospace" font-size="11" fill="#fff" fill-opacity=".55" font-family="monospace">${x}</text>`);
    for (let y = 0; y <= S.height; y += 50) g.push(`<path d="M0 ${y}H${S.width}" stroke="#fff" stroke-opacity="${y % 100 ? .06 : .16}"/><text x="3" y="${y - 3}" font-size="11" fill="#fff" fill-opacity=".55" font-family="monospace">${y}</text>`);
  }
  if (!bare) {
  // suelo
  g.push(`<path d="M0 ${S.ground.y}H${S.width}" stroke="${P.steel}" stroke-width="3"/>`);
  g.push(`<rect x="0" y="${S.ground.y}" width="${S.width}" height="${S.height - S.ground.y}" fill="${P.steelDark}" fill-opacity=".35"/>`);
  // losa de hormigón bajo la palabra: cara superior = línea de base
  g.push(`<rect x="${wordX0}" y="${S.deck.y}" width="${wordX1 - wordX0}" height="${S.ground.y - S.deck.y}" fill="${P.steelDark}"/>`);
  g.push(`<rect x="${wordX0}" y="${S.deck.y}" width="${wordX1 - wordX0}" height="3" fill="${P.steel}"/>`);
  // caja naranja con el casco
  g.push(`<rect x="${S.tile.x}" y="${S.tile.y}" width="${S.tile.size}" height="${S.tile.size}" rx="${S.tile.radius}" fill="${P.orange}"/>`);
  g.push(`<svg x="${S.tile.x + (S.tile.size - hatPx) / 2}" y="${S.tile.y + (S.tile.size - hatPx) / 2}" width="${hatPx}" height="${hatPx}" viewBox="0 0 24 24">${HAT}</svg>`);
  }
  // letras: fantasma (sitio donde deben quedar) o llenas
  for (const l of L.letters) g.push(`<path d="${l.d}" fill="${ghost ? 'none' : l.color}" fill-rule="evenodd" ${ghost ? `stroke="${l.color}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="5 4"` : ''}/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S.width}" height="${S.height}" viewBox="0 0 ${S.width} ${S.height}">${g.join('')}</svg>`;
}

(async () => {
  const out = path.join(__dirname, '..', 'reference');
  fs.mkdirSync(out, { recursive: true });
  const variants = { 'stage-ref': { ghost: true }, 'stage-ref-grid': { ghost: true, grid: true }, 'stage-final': { ghost: false }, 'stage-empty': { ghost: true, bare: true } };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: S.width, height: S.height }, deviceScaleFactor: 1 });
  for (const [name, o] of Object.entries(variants)) {
    await page.setContent(`<body style="margin:0;background:${P.ink}">${svg(o)}</body>`);
    await page.screenshot({ path: path.join(out, name + '.png') });
  }
  await browser.close();
  console.log('ok', Object.keys(variants).join(', '));
})();
