// Saca los contornos de «BuildTrack» (Quicksand 700) y los coloca en las coordenadas del escenario.
//
//   NODE_PATH=<node_modules con playwright-core y potrace> node generator/letters.cjs
//
// Cada letra se rasteriza a 10× en Chrome (así las curvas salen exactas), se vectoriza con potrace y se
// escribe en ../letters.json en píxeles de escenario. No hace falta descargar el archivo de la fuente.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');
const { Potrace } = require('potrace');
const S = require('../stage.json');

const WORD = 'BuildTrack';
const SS = 10;                                  // factor de supermuestreo del raster
const FONT_PX = S.pxPerEm * SS;                 // 800 px para 80 px/em
const PEN_X = 250, BASE_Y = 1000;               // origen de cada letra dentro del raster
const TRACKING_EM = -0.005;                     // tracking-[-0.005em] de BuildTrackLogo

function traceFile(file) {
  return new Promise((resolve, reject) => {
    const p = new Potrace({ turdSize: 20, alphaMax: 1.0, optCurve: true, optTolerance: 0.2, threshold: 128, blackOnWhite: true });
    p.loadImage(file, (err) => {
      if (err) return reject(err);
      const m = p.getSVG().match(/ d="([^"]+)"/);
      resolve(m ? m[1] : '');
    });
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btl-'));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setContent('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Quicksand:wght@700&display=swap"><body></body>');
  await page.evaluate(() => document.fonts.load('700 100px Quicksand'));
  await page.evaluate(() => document.fonts.ready);

  const m = await page.evaluate(({ word, fontPx, penX, baseY }) => {
    const out = { ok: document.fonts.check('700 100px Quicksand'), pre: [], adv: [], png: [] };
    const c100 = document.createElement('canvas').getContext('2d');
    c100.font = '700 100px Quicksand';
    for (let i = 0; i < word.length; i++) {
      const adv = c100.measureText(word[i]).width / 100;
      out.adv.push(adv);
      // posición de la pluma = ancho de la palabra hasta esta letra − su avance: así entra el kerning con la anterior (T–r)
      out.pre.push(c100.measureText(word.slice(0, i + 1)).width / 100 - adv);
    }
    out.total = c100.measureText(word).width / 100;
    for (const ch of word) {
      const cv = document.createElement('canvas');
      cv.width = 1300; cv.height = 1300;
      const g = cv.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1300, 1300);
      g.fillStyle = '#000'; g.font = `700 ${fontPx}px Quicksand`; g.textBaseline = 'alphabetic';
      g.fillText(ch, penX, baseY);
      out.png.push(cv.toDataURL('image/png').split(',')[1]);
    }
    return out;
  }, { word: WORD, fontPx: FONT_PX, penX: PEN_X, baseY: BASE_Y });
  await browser.close();
  if (!m.ok) throw new Error('Quicksand 700 no se cargó: sin red o Google Fonts bloqueado');

  const letters = [];
  for (let i = 0; i < WORD.length; i++) {
    const file = path.join(tmp, `l${i}.png`);
    fs.writeFileSync(file, Buffer.from(m.png[i], 'base64'));
    const raw = await traceFile(file);
    const penStage = S.word.x + (m.pre[i] + TRACKING_EM * i) * S.pxPerEm;
    let xs = [], ys = [], k = 0;
    const d = raw.replace(/-?\d+(\.\d+)?/g, (n) => {
      const v = parseFloat(n);
      const isX = k % 2 === 0; k++;
      const out = isX ? (v - PEN_X) / SS + penStage : (v - BASE_Y) / SS + S.word.baseline;
      (isX ? xs : ys).push(out);
      return out.toFixed(2);
    });
    letters.push({
      index: i, char: WORD[i], group: i < 5 ? 'build' : 'track',
      color: i < 5 ? S.palette.bone : S.palette.orange,
      penX: +penStage.toFixed(2), advance: +(m.adv[i] * S.pxPerEm).toFixed(2), baseline: S.word.baseline,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(2)),
      d,
    });
  }
  fs.writeFileSync(path.join(__dirname, '..', 'letters.json'), JSON.stringify({ stage: S, wordWidth: +(m.total * S.pxPerEm).toFixed(2), letters }, null, 1));
  console.log(letters.map((l) => `${l.char}  pen ${l.penX}  bbox ${l.bbox.join(' ')}`).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
