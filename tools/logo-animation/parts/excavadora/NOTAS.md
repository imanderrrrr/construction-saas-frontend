# Excavadora (`exc-`) — notas de ensamblaje

Entrega: `index.html` (composición `main`, 1400×360, 5,6 s, 60 fps, GSAP 3.14.2 en pausa) y `renders/excavadora.mov` (ProRes 4444 con alfa, 336 fotogramas).

## Tiempos reales (segundos)

| Qué | Instante |
|---|---|
| El primer píxel de la máquina entra por la izquierda | ≈ 0,05 (el fotograma 0 está vacío) |
| Se planta (cuerpo centrado en x = 118, orugas 33–203) | 0,62 |
| Escarba 1 / carga la B | 0,56–0,72 (la B aparece en la cuchara a 0,66) |
| Suelta la B / aterriza | 1,115 / 1,22 |
| **B lista** (desviación < 0,5 px) | **1,35** |
| Escarba 2 / carga u, i, l | 1,38–1,52 (aparecen a 1,46) |
| Suelta u, i, l | 1,80 / 1,825 / 1,85 |
| Aterrizan u, i, l | 1,87 / 1,90 / 1,94 |
| **u, i, l listas** | **2,00 / 2,03 / 2,08** |
| Repliega el brazo y da media vuelta de torreta | 1,90–2,44 y 2,46–2,78 |
| Sale del lienzo (último píxel del contrapeso) | ≈ 3,47 |
| Humo y polvo, último residuo | 4,60 |
| Montículo hundido por completo | 2,60 (crece 0,04–0,42) |
| Terrones: el último desaparece | 2,17 |

## Qué queda en pantalla

- Desde 4,6 s solo las cuatro letras `exc-L0…L3` (B, u, i, l) en `#F8F3EB`, opacas hasta el último fotograma. El canal alfa de 5,2–5,59 s coincide con el de los cuatro contornos de `letters.json` (diferencia solo de antialiasing en el borde; 0 px de desplazamiento). En el navegador sin GPU es idéntico píxel a píxel.
- Las letras son el `<path>` original sin tocar; a partir de «listo» no llevan `transform`.
- Nada de tierra, polvo, humo, sombra ni montículo pasa de 4,6 s.

## Qué debe saber el ensamblaje

- Capa: esta pieza va **sobre** la base y el camión y **bajo** la grúa. Dentro de la pieza las letras están en la capa superior.
- La cuchara llega hasta la zona de la losa: el diente roza la cara superior (y ≈ 288) hasta x ≈ 540 a 1,1 s y hasta x ≈ 596 entre 1,8 y 1,95 s. La grúa no debe bajar nada en x < 620 antes de 2,1 s (a 2,08 la cuchara ya sube).
- Tapa la caja naranja muy poco: medido cada 0,05 s, el brazo cubre como máximo ≈ 8 % de la caja (en 1,0–1,1 s y en 1,7 s) y menos del 4 % el resto del tiempo; en la retirada (2,1–2,4 s) pasa por encima. El casco no se tapa en ningún instante.
- El humo del escape y el polvo son semitransparentes y se mezclan con el fondo: renderizar sobre cualquier color de fondo.
- Los avisos de `hyperframes check` son heurísticos y no afectan al resultado: `composition_file_too_large` (el archivo tiene ~840 líneas) y `rotation_pivot_drift` (las articulaciones giran sobre su pivote real; el verificador mide el centro de la caja). `check` termina en «passed».

## Cómo está hecha

- Un único tween lineal 0 → 5,6 s sobre un objeto cuya propiedad `t` llama a `render(t)`. Todo el estado es función pura del tiempo (seekable, sin `Math.random`, sin `Date`, sin `repeat:-1`). Aleatoriedad con mulberry32 de semilla fija.
- Cinemática: guion de la muñeca de la cuchara en coordenadas del lienzo → IK de dos eslabones (pluma 210, brazo 170) → ángulos. La cuchara gira con su propio ángulo; el eslabón en H y la biela se resuelven por intersección de círculos (longitud de biela fija). Los tres cilindros se estiran con la distancia real entre pivotes; el tubo mide el 80 % de su longitud mínima y el vástago asoma el resto.
- Cuerpo: cabeceo y hundimiento con un muelle amortiguado alimentado por la aceleración del cuerpo, el alcance del brazo y la carga. Torreta: media vuelta como escala X (coseno) sobre el eje de giro, las orugas no giran.
- Orugas: zapatas como tramos de trazo sobre un estadio (49 por oruga) cuyo desfase avanza con la distancia recorrida; ruedas, rodillos y rueda motriz giran con esa misma distancia.
- Carga: cada letra va anclada en el marco de la cuchara (calculado a partir de su pose de suelta, por eso aterriza exactamente en sus coordenadas), con tierra pegada recortada por su contorno, un montón en la cuchara y terrones balísticos que caen detrás de las letras y se hunden en la losa.
- Para depurar: `window.__exc` expone `stateAt`, `armAt`, `STATS` (rangos de cilindros y ángulos) y `letterPose`.

## Por pulir (si hay tiempo)

- El arco de transporte es muy rápido (hasta ~55 px por fotograma en la bajada); es el coste de entregar B a 1,4 s y u, i, l a 2,1 s.
- La cuchara es una sola pieza lisa; falta modelar la boca interior y el desgaste de los dientes.
- Las mangueras son estáticas (una sola, sobre la pluma).
- No hay marcas de oruga en el suelo ni sombra proyectada de la pluma sobre la caja.
