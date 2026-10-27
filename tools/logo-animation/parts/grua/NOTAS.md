# Pieza «grua» — notas para el ensamblaje

Entrega: `index.html` (composición `main`, 1400×360, 5,6 s, GSAP 3.14.2 en pausa, prefijo `gru-`) y `renders/grua.mov`
(ProRes 4444 con alfa, 60 fps, 336 fotogramas). Probado con `./part.sh grua` (hyperframes 0.8.206: `check` sin errores ni avisos).

## Cómo está hecha
- `index.html` se **genera**: `python3 parts/grua/src/gen.py` (marcado SVG de celosías/remaches) + `src/model.js` (calendario y
  física del péndulo) + `src/scene.js` (une el modelo con el DOM). Para retocar tiempos, editar `SCHED`/`ROW` en `model.js` y regenerar.
- Todo es función pura del tiempo (cada propiedad es un tween de toda la duración con `ease` que devuelve el valor absoluto):
  sin `Math.random`, sin relojes, sin `repeat:-1`, sin callbacks. Chispas y polvo usan un LCG con semilla fija.
- El script va dentro de una IIFE (no deja globales salvo `window.__timelines['main']`), por si se funden las tres piezas en un solo documento.
  Todos los `id`/clases llevan `gru-`.
- Idea de escena: la grúa llega **con las seis piezas ya eslingadas** colgando de seis carros (d, palo de la T, barra de la T, r, óvalo
  de la a, palo de la a). Salen de izquierda a derecha, así que los carros nunca se cruzan. Los carros se recogen con la pluma al final.

## Instantes reales (s)
| letra | toca la losa | «lista» (quieta, entera, en su sitio) |
|---|---|---|
| d | 2,30 | 2,43 |
| T | palo 2,52 · barra 2,98 (soldadura 2,98–3,1) | 3,12 (la T entera sustituye a las dos piezas) |
| r | 3,62 | 3,75 |
| a | óvalo 4,08 · palo 4,36 (soldadura corre por la junta 4,36–4,53) | 4,56 (la a entera sustituye a las dos piezas) |

Piezas de la a: óvalo («c» abierta, recorte de la `a` en x ≤ 750,78) y palo derecho (x ≥ 750,78). Las de la T: barra (y ≤ 243,2) y palo.
Las letras se posan exactamente en las coordenadas de `letters.json` (comprobado con el alfa del último fotograma: d 590–632, T 639–685,
r 687–715, a 718–760; y 230–291) y siguen opacas hasta el 5,6.

## Entrada y salida
- 0,10 zapata y sombra · 0,20–1,0 la cabeza sube y el mástil crece debajo · 0,58–1,14 la pluma sale de la torreta con la carga colgada ·
  0,90–1,20 contrapluma y contrapesos · 0,97 cabeza de la torre y tirantes · luz de aviso parpadea desde 1,25.
- 4,58–5,02 la pluma se recoge (con los carros) · 4,96–5,22 la cabeza baja por el mástil hasta desaparecer bajo el suelo · 5,00–5,23 la zapata se hunde.
- **Del 5,25 al final no queda nada salvo d, T, r, a** (comprobado: alfa > 0 solo dentro de x 590–761, y 230–291).
- Quitar al final: nada más; no hay polvo, chispas ni sombras después de 5,24.

## Para el ensamblaje (zonas y capas)
- Capa: la grúa va la última (delante de camión y excavadora). Las letras de la grúa están en su propio grupo `gru-letters`, debajo de la cabeza.
- Excavadora: antes de 2,1 s no hay nada en x < 590, y ≥ 70 (comprobado). La punta de la pluma está en x ≈ 566–578, y 38–64 (con la luz de la punta).
- **Camión (posible roce):** las piezas cuelgan en fila sobre x 976–1197, con la parte baja entre y 118 y y ≈ 186, desde ≈0,95 s hasta que
  cada una sale (d 1,46 · palo T 1,80 · barra T 2,30 · r 2,90 · óvalo a 3,30 · palo a 3,50). Si el camión levanta la caja y roza esa fila,
  se puede mover la fila (`ROW` en `model.js`) o adelantar la salida. El camión debe entrar **por detrás** del mástil (zapata x 1178–1302, mástil 1215–1265).
- Cabina x 1202–1238, y 74–100; contrapesos hasta x 1385, y 104; anemómetro x ≈ 1390. Todo dentro de 1400×360 (el halo de la luz del vértice se corta arriba).

## Qué miré
`review/grua-hoja.png` y `review/grua-real.png` en varias pasadas, más fotogramas ampliados (montaje, cuelgue de la d, soldadura de la T,
armado de la a, retirada) y tres comprobaciones con el alfa del MOV (último fotograma, zona de la excavadora, limpieza desde 5,25).

## Por pulir (si hay tiempo)
- A tamaño real las chispas y el polvo son de 1–2 px: lo que se lee es el destello de la soldadura y la silueta de los carros.
- Los seis carros parados bajo la pluma mientras se espera pueden verse densos en la fila (0,9–1,5 s); se aclararía separando más la fila.
- Sin ajuste fino con el camión real: depende de dónde levante la caja.
