# Camión de volteo — notas para el ensamblaje

Pieza: `parts/camion/index.html` (prefijo `cam-`) y `renders/camion.mov` (ProRes 4444 con alfa, 1400×360, 60 fps, 5,6 s).
`./part.sh camion` pasa `check` (solo avisos, ver abajo).

## Instantes reales (s)

| evento | t |
|---|---|
| asoma por el borde derecho (de reversa, luces de marcha atrás y baliza) | 1,12 |
| se detiene (cola de la caja en x≈864–874, losa acaba en 858; parachoques delantero en x≈1198) | 1,95 |
| la caja empieza a subir / compuerta se abre | 1,40 / 1,70–2,10 |
| **c**: sale de la caja / toca la losa (x≈824, inclinada) / se desliza y se asienta | 2,06 / 2,17 / ≈2,4 |
| **c** en su pose exacta y quieta | **2,59** |
| **k**: sale de la caja / toca la losa / pose exacta y quieta | 2,52 / 2,58 / **3,00** |
| caja arriba al máximo (41,5°) | 2,84 |
| baja la caja y cierra la compuerta | 3,08–3,56 |
| arranca (humo negro por el escape) y sale del lienzo (completamente fuera) | 3,62 → 4,49 |
| última grava desaparece (se hunde con polvo) | 3,53 |
| último polvo/humo | ≈5,0 |

Desde 5,0 s hasta 5,6 s el alfa de la pieza es **solo c y k**: caja de píxeles [768,231]–[848,290]. Verificado sobre el MOV
final: el centroide de ambas letras coincide con `reference/stage-final.png` a <0,001 px y quedan opacas hasta el último fotograma.

## Qué debe saber el ensamblaje

- Orden de capas: base → **camión** → excavadora → grúa. El camión cruza por detrás del mástil de la grúa (x≈1215–1265)
  entre 1,1 y 1,9 s; si la grúa va delante, la celosía lo deja ver.
- Extensión máxima con la caja arriba (2,6–3,0 s): el punto más alto del camión es y≈58 (x≈985). La pluma y los tirantes de la
  grúa no deberían pasar por debajo de y≈50 sobre x 880–1100 en ese intervalo, o se cruzarán con la caja.
- Entre 1,0 y 2,0 s las luces de marcha atrás proyectan un cono suave hacia la izquierda sobre la losa (hasta x≈700, alfa ≤0,3).
- Humo y polvo: gris cálido/tierra con alfa; sobre la tinta `#17130F` se leen, sobre fondo claro no.
- Las letras c y k son los `<path>` de `letters.json` (relleno `#F97316`, `evenodd`) en coordenadas originales; al llegar a su
  hora «listo» la transformación es la identidad exacta. Hay una copia «dentro de la caja» (más oscura, tapada por la tierra)
  que se funde con la copia libre en el instante de salida (2,03–2,11 y 2,49–2,57).

## Cómo está hecha

- Una sola composición `main` (1400×360, 5,6 s) con un único `gsap.timeline({paused:true})` que contiene **un** tween
  (`camSim`, plugin propio de GSAP) cuyo `render` llama a `pose(t)`: todo lo visible es función pura de `t`. No hay
  `Math.random` (PRNG con semilla fija), `Date`, `repeat:-1` ni callbacks. Con fotogramas sueltos o en cualquier orden da lo mismo.
- La cinemática (entrada, cabeceo y rebote de la suspensión, ángulo de la caja, compuerta, giro de las ruedas = x/r) son pistas
  con las mismas curvas de GSAP (`gsap.parseEase`). La longitud del pistón se calcula en cada fotograma entre el pivote base
  (chasis) y el pivote superior (caja); los tres tramos telescópicos reparten esa longitud.
- La grava (182 trozos) y las dos letras se integran de antemano (deslizamiento por el piso, salida por la boca, caída con
  gravedad, rebotes, hundimiento tras la losa recortada con `clipPath`) y se leen por tabla a 60 Hz.
- Para ensamblar en un solo SVG: todo el JS está en un IIFE al final de `index.html`; necesita `gsap` global y los `id` `cam-*`
  del SVG; registra `window.__timelines['main']` (renombrar al integrar). Los gradientes y clipPaths también llevan prefijo `cam-`.
- `check` avisa `composition_file_too_large` (una sola pieza por contrato) y varios `rotation_pivot_drift` sobre las ruedas y
  la caja: son falsos positivos (giran sobre sus pivotes reales; la bisagra de la caja no está en su centro).

## Por pulir (si hay tiempo)

- El humo se lee gris oscuro, no negro puro, para que no se pierda sobre la tinta; a tamaño real es una voluta fina.
- A tamaño real (¼) los remaches, tuercas y el conductor no se distinguen; la silueta, la caja que sube y las letras sí.
- La entrada hace unos 1100 px/s al asomar (es la ventana 1,1–1,95 s del guion); se nota rápida pero frena con rebote.
- Si la grúa necesita más aire arriba, bajar el tope de la caja (ángulos en `thT`) a 34–36° baja el punto más alto a y≈75.
