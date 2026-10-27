# «BuildTrack se construye» — el logo animado de la landing

Una obra en miniatura (excavadora, grúa torre y camión de volteo) arma «BuildTrack» letra a letra en 5,6 s, con fondo
transparente. La landing la reproduce una vez por navegador con `LogoBuildOverlay`
(`src/app/components/landing/LogoBuildOverlay.tsx`): grande en el centro de la pantalla y, al terminar, el último
fotograma vuela al logo de la esquina. `/?logo` la repite.

- `PLAN.md`: el guion, el escenario (lienzo 1400 × 360, 80 px = 1 em del logo) y el contrato de cada pieza.
- `stage.json` y `letters.json`: medidas y contornos de las letras. La caja naranja va en 300,196 · 128 px; si cambia,
  hay que cambiar `TILE` en `LogoBuildOverlay.tsx`.
- `parts/<pieza>/`: cada máquina es una composición HyperFrames propia (`base`, `excavadora`, `grua`, `camion`, `acabado`).
  `./part.sh <pieza>` la revisa y la renderiza a MOV con alfa.
- `INSTALL=1 ./assemble.sh`: funde las piezas, codifica los cuatro vídeos web (WebM VP9 con alfa y HEVC con alfa, a 1400
  y 700 px) y los copia a `public/logo-build/`. El HEVC con alfa (Safari) solo se puede generar en macOS.

`renders/`, `review/` y `.hyperframes/` no se versionan.
