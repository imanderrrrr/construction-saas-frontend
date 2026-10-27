# BuildTrack se construye — plan de la animación del logo

Animación de ~5,6 s para el logo de la esquina superior izquierda de la landing (caja naranja con casco + «BuildTrack»).
Sin fondo (transparente). Una obra en miniatura: **una excavadora, una grúa torre y un camión de volteo** levantan el nombre
letra a letra; al terminar las máquinas se retiran y queda el logo.

Cada máquina la dibuja y anima **un chat distinto**, como pieza independiente, y se ensamblan al final.
Este documento es el contrato común: si algo no está aquí, decídelo tú; si algo sí está aquí, se cumple.

## 1. Guion (tiempos globales, en segundos)

```
0.0 ─ 0.8   BASE (Claude principal): el suelo se traza, la losa de hormigón sube, la caja naranja se asienta y el casco cae sobre ella.
0.2 ─ 1.0   EXCAVADORA entra por la izquierda y se coloca; junto a ella hay un montículo de tierra con las letras enterradas.
0.2 ─ 1.2   GRÚA: la torre se monta (se dibuja y se levanta), el carro corre por la pluma y baja el gancho.
1.2 ─ 2.0   CAMIÓN entra por la derecha DE REVERSA (la cabina queda a la derecha, la caja basculante a la izquierda).

            EXCAVADORA  B  ← llena de tierra en la cuchara                        listo a 1.4 s
            EXCAVADORA  u, i, l  ← segunda cuchara                                 listo a 2.1 s
            GRÚA        d                                                          listo a 2.4 s
            CAMIÓN      c                                                          listo a 2.5 s
            CAMIÓN      k                                                          listo a 3.0 s
            GRÚA        T  (la barra de arriba se iza aparte y se suelda)          listo a 3.1 s
            GRÚA        r                                                          listo a 3.7 s
            GRÚA        a  ← LA PIEZA ESTRELLA: se ARMA con 2–3 piezas, con chispas  listo a 4.5 s

3.6 ─ 3.8   la excavadora ya salió del lienzo (se va por la izquierda)
4.2 ─ 4.6   el camión ya salió del lienzo (se va por la derecha)
4.6 ─ 5.3   la grúa se retira o se desmonta (a su manera) y deja el cielo limpio
5.0 ─ 5.6   BASE: la losa y el suelo se desvanecen; queda solo caja naranja + BuildTrack
```

Las horas «listo a» son el instante en que la letra queda **quieta, entera y en su sitio**. Se admite ±0,15 s. Cada pieza
puede empezar a mostrarse antes de su ventana, pero no puede ocupar la zona de otra máquina (ver §3).

## 2. Escenario

Lienzo **1400 × 360 px**, 60 fps, 5,6 s, fondo **transparente**. 80 px = 1 em del texto del logo
(el logo real mide 32 px de caja y 20 px de texto: el lienzo se reduce a ¼ al ponerlo en la página, así que
un detalle de 4 px aquí mide 1 px allí; los volúmenes y siluetas mandan sobre los detallitos).
La fuente de verdad es `stage.json` (medidas) y `letters.json` (contornos).

```
 y=196 ┌───────┐                  (caja naranja 300..428 × 196..324, la dibuja la BASE)
       │ casco │  B u i l d T r a c k      línea de base y=290 (cara superior de la losa)
 y=290 │       │ ████████████████████████  losa de hormigón 447..858 (la dibuja la BASE)
 y=324 └───────┘═════════════════════════  SUELO y=324 (todas las máquinas apoyan aquí)
```

- Las **ruedas y orugas apoyan en y = 324**. La losa tiene 34 px de alto: su cara superior (y = 290) es donde se asientan las letras.
- Las máquinas pueden entrar/salir por los bordes del lienzo (x < 0 o x > 1400).
- Las máquinas NO tapan la caja naranja más de lo imprescindible ni por mucho tiempo (es la marca).

### Letras: dónde deben quedar (px del lienzo; el trazo completo está en `letters.json`)

| letra | color | x (de..a) | y (de..a) | dueño |
|---|---|---|---|---|
| B | `#F8F3EB` hueso | 455.7 .. 499.0 | 233.9 .. 290.0 | excavadora |
| u | hueso | 506.9 .. 543.5 | 247.0 .. 290.8 | excavadora |
| i | hueso | 552.7 .. 562.8 | 232.5 .. 290.2 | excavadora |
| l | hueso | 572.8 .. 582.5 | 230.7 .. 290.4 | excavadora |
| d | hueso | 590.4 .. 632.3 | 230.8 .. 290.8 | grúa |
| T | `#F97316` naranja | 639.3 .. 685.0 | 233.9 .. 290.1 | grúa |
| r | naranja | 687.1 .. 715.2 | 246.4 .. 290.2 | grúa |
| a | naranja | 718.4 .. 760.3 | 246.3 .. 290.8 | grúa |
| c | naranja | 768.3 .. 805.0 | 246.2 .. 290.8 | camión |
| k | naranja | 812.3 .. 848.9 | 230.8 .. 290.2 | camión |

`letters.json` → `letters[i].d` es el contorno (relleno `fill-rule="evenodd"`, ya en coordenadas del lienzo, no hay que
escalar ni mover nada). Úsalo tal cual para la letra final; para llevarla en una cuchara o una caja, anímala con
`transform` sobre un `<g>` y deja el `<path>` intacto.

**Entrega exacta:** a partir de su hora «listo», la letra debe quedar en sus coordenadas originales (±0,5 px), opaca, del color
de la tabla, y **seguir visible hasta el último fotograma**. Antes de llegar puede estar tapada (tierra, grava, embalaje), pero al
quedar libre se ve limpia: la tierra, la grava y los escombros que caigan **deben desaparecer o ser retirados** antes de 5,2 s
(el logo final no lleva ni una mota).

## 3. Zonas (para que las máquinas no se pisen)

| zona | x | quién |
|---|---|---|
| izquierda | 0 … ~300 (cuerpo y montículo); el brazo puede salir hasta x ≈ 600 mientras entrega | excavadora |
| centro | pluma y carga sobre 560 … 860, siempre **por encima de y = 190** salvo para posar la carga | grúa (carga cuelga del gancho) |
| derecha | camión estacionado en 870 … ~1190 | camión |
| torre de la grúa | mástil en x ≈ 1215–1265 (contrapluma hasta ~1380) | grúa |

Cruces permitidos solo si no coinciden en el tiempo: la excavadora entrega u/i/l hasta 2.1 s en x ≈ 505–585; la grúa
no baja carga en esa franja antes de 2.1 s.

Orden de capas al ensamblar (de atrás hacia delante): base → camión → excavadora → grúa. Cada pieza dibuja sus propias letras.

## 4. Estilo

Ilustración vectorial plana con volumen: **3 tonos por superficie** (luz, base, sombra), reflejos duros, sombras proyectadas
suaves en el suelo, detalles mecánicos que se vean al ampliar (remaches, cilindros hidráulicos con vástago que entra y sale,
rodillos de oruga, llantas con tuercas, faros, rejilla, escape, cristal con brillo…). Piensa en una ilustración de maquinaria
de catálogo, no en un icono.

Paleta (de `stage.json`; puedes añadir matices, no cambiar la familia):

| uso | color |
|---|---|
| máquina: luz / base / sombra | `#FFD35C` / `#F6B21C` / `#D68A06` |
| acero claro / oscuro | `#A79B88` / `#4A423A` |
| caucho, orugas | `#0D0B09` (con llanta hueso `#F8F3EB`) |
| cristal | `#8DC3D6` (con brillo blanco) |
| tierra: luz / base / sombra | `#A07848` / `#7A5636` / `#4E3622` |
| marca (solo letras) | hueso `#F8F3EB`, naranja `#F97316` — **las máquinas son amarillas, no naranjas**, para que no se confundan con «Track» |

Fondo de referencia: tinta `#17130F` (la landing es oscura). No dibujes fondo: tu pieza es transparente.

Movimiento (es lo que vende «render con detalle»): anticipación y rebote al arrancar/frenar, suspensión que se hunde con la
carga, cuerpo que se balancea, cilindros que se estiran de verdad (la longitud se calcula entre los dos pivotes, no es un
adorno), polvo al frenar, humo del escape, chispas en las soldaduras, la carga que se descuelga y oscila, sombras que siguen la
máquina. Curvas con carácter (`power2/3`, `back`, `elastic` contenido), nunca `linear` salvo ruedas/orugas.

## 5. Contrato técnico (todas las piezas)

- Carpeta propia: `parts/<pieza>/` (`excavadora`, `grua`, `camion`). **No toques nada fuera de ella**
  (ni `letters.json`, `stage.json`, `reference/`, `generator/`, `review.sh`, `part.sh`, ni las carpetas de otras piezas).
  **No hagas commits, ni cambies de rama, ni uses `git stash`**; yo (el chat principal) integro y hago el commit.
- La carpeta ya trae un proyecto HyperFrames en blanco (`index.html`, `hyperframes.json`, `meta.json`). Edita ese `index.html`.
- Una sola composición raíz: `data-composition-id="main"`, `data-width="1400"`, `data-height="360"`, `data-duration="5.6"`,
  timeline GSAP **en pausa** registrado en `window.__timelines['main']`, GSAP 3.14.2 desde el CDN que ya está en la plantilla.
- Todo SVG vectorial inline. **Sin imágenes, sin fuentes, sin otros archivos, sin red salvo GSAP.** Que sea determinista:
  nada de `Math.random()`, `Date`, ni `repeat: -1` (para ruedas/orugas anima el giro con una `to` de duración total y `ease: 'none'`).
- Prefija **todos** los `id` y clases con el código de tu pieza (`exc-`, `gru-`, `cam-`): luego se pueden fundir en un solo SVG.
- Fondo transparente: no pongas `background` en `html`, `body` ni `#root`.
- Los tweens repetidos sobre el mismo objetivo con `fromTo` necesitan `immediateRender: false` a partir del segundo (el lint lo avisa).
- Unidades: píxeles del lienzo. El origen es la esquina superior izquierda.

## 6. Cómo comprobar tu trabajo

Desde `tools/logo-animation/`:

```bash
./part.sh excavadora          # check + render del MOV transparente + revisión (cambia el nombre a tu pieza)
GRID=1 ./part.sh excavadora   # lo mismo, sobre el escenario con cuadrícula y coordenadas
```

Escribe en `parts/<pieza>/renders/<pieza>.mov` (ProRes 4444 con alfa) y en `review/`:
`<pieza>.mp4` (la pieza sobre el escenario de referencia), `<pieza>-hoja.png` (fotogramas cada 0,4 s) y
`<pieza>-real.png` (la escena **a tamaño real de logo**, ampliada ×3 sin suavizar: si ahí no se lee, no se lee).
Mira esas imágenes con `Read`. Para un instante concreto y con zoom:
`cd parts/<pieza> && npx --yes hyperframes@0.8.206 snapshot --at 2.1 --zoom 250,100,500,240 --zoom-scale 4`.
`ffmpeg -ss 2.1 -i review/<pieza>.mp4 -frames:v 1 f.png` saca un fotograma del vídeo de revisión.

## 7. Qué entregas

1. `parts/<pieza>/index.html` (la composición) y `parts/<pieza>/renders/<pieza>.mov` renderizado con la versión final.
2. `parts/<pieza>/NOTAS.md` (corto): los instantes reales «listo» de cada letra, cuándo entra/sale tu máquina, qué elementos
   dejan algo en pantalla al final (deben ser solo tus letras), y cualquier cosa que el ensamblaje deba saber.
3. En tu último mensaje: resumen de lo hecho, qué miraste (hoja y tamaño real) y qué quedó por pulir. Sin adjetivos de más.

## 8. Piezas

### excavadora — `parts/excavadora/` (prefijo `exc-`)
Excavadora de orugas, de perfil, mirando a la derecha. Entra por la izquierda (orugas girando, polvo), se planta con el frente
en x ≈ 300 como mucho y su montículo de tierra en la franja libre entre ella y la caja naranja (x ≈ 190–295; la caja empieza
en 300). Las letras B, u, i, l están **enterradas** en el montículo. Cuchara 1: escarba, sale cargada de tierra con la **B**
dentro, gira el brazo por encima de la caja naranja y la posa sobre la losa en x ≈ 455–499; la cuchara voltea, la tierra cae
(se retira o se hunde) y la B queda limpia. Cuchara 2: lo mismo con **u, i, l** (que quedan en x ≈ 507–583, uno detrás de otro,
bien asentados). Luego se retrae, da media vuelta de brazo y sale por la izquierda. El brazo es largo (alcance ≈ 350–400 px) y
tiene articulación de pluma + brazo + cuchara con cilindros hidráulicos; que el cuerpo (cabina con operario visible, contrapeso,
escape, orugas con rodillos) se vea bien aunque el cuadro sea pequeño.

### grua — `parts/grua/` (prefijo `gru-`)
Grúa torre con celosía (la del intro del sitio es la referencia de estilo: mástil de celosía, pluma, contrapluma, tirante, cabina,
contrapesos, carro con cable y gancho — pero ahora en amarillo con más volumen y detalle). Mástil en x ≈ 1215–1265 sobre el suelo,
pluma hacia la izquierda con alcance suficiente para llegar a x ≈ 580 (la letra d). Se monta (el mástil crece, la pluma se tiende),
y luego iza y posa, en este orden: **d** (2.4 s), **T** (3.1 s; la barra de arriba se iza aparte y se suelda sobre el palo),
**r** (3.7 s) y **a** (4.5 s). La **a** es la pieza estrella: se arma con dos o tres piezas (por ejemplo el palo derecho y el óvalo),
cada una izada con eslingas, con chispas y destello al soldar; el último gesto de la obra. Las letras que cuelgan del gancho
oscilan y se amortiguan. Después de 4.5 s se retira o se desmonta a su manera y deja el cielo limpio antes de 5.3 s
(el mástil puede plegarse, descender, desmontarse por tramos… como el andamio del intro). Mientras trabaja no cuelga carga
sobre y > 190 del lado de la excavadora (x < 590) antes de 2.1 s.

### camion — `parts/camion/` (prefijo `cam-`)
Camión de volteo pesado, de perfil, con la cabina a la derecha (mira a la derecha pero entra **de reversa**, marchando hacia la
izquierda con el avisador de marcha atrás y las luces de reversa), caja basculante a la izquierda, cargada de grava y tierra
con las letras **c** y **k** enterradas. Frena con rebote de suspensión en x ≈ 870–1190 (la caja trasera casi tocando la losa,
que acaba en x ≈ 858), levanta la caja con el pistón telescópico, la compuerta trasera se abre, la carga se desliza y cae sobre
la losa dejando **c** (x ≈ 768–805) y luego **k** (x ≈ 812–849) en su sitio; el resto de la grava sale por detrás y se retira
(desaparece con polvo o se hunde) — sobre la losa no puede quedar nada que no sean las dos letras. Baja la caja, cierra la
compuerta, arranca (humo negro del escape) y sale por la derecha. Ruedas dobles traseras, defensa, depósito, escalón, faro, espejo.

### base — (la hago yo)
Suelo, losa, caja naranja y casco, y el desvanecimiento final. Además ensamblo, cuadro a cuadro, el WebM con alfa para
Chrome/Firefox y el HEVC con alfa para Safari.
