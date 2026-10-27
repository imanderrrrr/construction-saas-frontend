// Capa superior «acabado»: un destello que barre la caja naranja y las letras al terminar (recortado a sus formas).
//   node generator/acabado.cjs  → parts/acabado/index.html
const fs = require('fs');
const path = require('path');
const L = require('../letters.json');
const S = L.stage;
const paths = L.letters.map((l) => `<path d="${l.d}" fill-rule="evenodd"/>`).join('');
const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1400, height=360" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1400px; height: 360px; overflow: hidden; background: transparent; }
      #root { position: relative; width: 1400px; height: 360px; background: transparent; }
      #root svg { position: absolute; left: 0; top: 0; overflow: visible; }
    </style>
  </head>
  <body>
    <!-- ACABADO (generado por generator/acabado.cjs): destello final recortado a la caja naranja y las letras. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${S.duration}" data-width="1400" data-height="360">
      <svg id="fin-stage" viewBox="0 0 1400 360" width="1400" height="360" aria-hidden="true">
        <defs>
          <clipPath id="fin-clip">
            <rect x="${S.tile.x}" y="${S.tile.y}" width="${S.tile.size}" height="${S.tile.size}" rx="${S.tile.radius}"/>
            ${paths}
          </clipPath>
          <linearGradient id="fin-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#FFF4E0" stop-opacity="0"/>
            <stop offset=".5" stop-color="#FFF4E0" stop-opacity=".92"/>
            <stop offset="1" stop-color="#FFF4E0" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <g clip-path="url(#fin-clip)">
          <rect id="fin-glint" x="-90" y="170" width="90" height="170" fill="url(#fin-band)" transform="skewX(-18)" opacity="0"/>
        </g>
      </svg>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      // barrido de izquierda a derecha sobre caja y palabra (x en el lienzo; el skew desplaza ~ y·tan(18°))
      tl.fromTo('#fin-glint', { x: 380, opacity: 0 }, { x: 1010, opacity: 1, duration: 0.5, ease: 'power2.inOut' }, 5.0);
      tl.to('#fin-glint', { opacity: 0, duration: 0.12, ease: 'power1.in' }, 5.42);
      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(__dirname, '..', 'parts', 'acabado', 'index.html'), html);
console.log('ok');
