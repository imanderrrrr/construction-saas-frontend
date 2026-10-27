#!/usr/bin/env bash
# Revisión de una pieza: pone su MOV transparente sobre el escenario de referencia.
#   ./review.sh parts/excavadora/renders/excavadora.mov [grid]
# Escribe review/<nombre>.mp4 (escenario completo), review/<nombre>-hoja.png (fotogramas cada 0,4 s)
# y review/<nombre>-real.png (la misma escena a tamaño real de logo, ampliada ×3 sin suavizar).
set -euo pipefail
cd "$(dirname "$0")"
MOV="$1"; REF="${REF:-reference/stage-ref${2:+-grid}.png}"
NAME="$(basename "${MOV%.*}")"
mkdir -p review
FPS=60
ffmpeg -v error -y -loop 1 -framerate $FPS -i "$REF" -i "$MOV" \
  -filter_complex "[0:v]format=rgba[bg];[1:v]format=rgba[fg];[bg][fg]overlay=shortest=1:format=auto,format=yuv420p" \
  -c:v libx264 -crf 16 -movflags +faststart "review/$NAME.mp4"
# hoja de fotogramas: uno cada 0,4 s, 3 columnas
ffmpeg -v error -y -i "review/$NAME.mp4" -vf "fps=2.5,scale=700:-1,tile=3x5:padding=6:color=0x333333" -frames:v 1 "review/$NAME-hoja.png"
# tamaño real: el lienzo a 25 % (80 px/em → texto de 20 px) y luego ×3 con vecino más cercano para poder mirarlo
ffmpeg -v error -y -i "review/$NAME.mp4" -vf "fps=2.5,scale=iw/4:-1:flags=lanczos,scale=iw*3:-1:flags=neighbor,tile=2x7:padding=6:color=0x333333" -frames:v 1 "review/$NAME-real.png"
echo "review/$NAME.mp4  review/$NAME-hoja.png  review/$NAME-real.png"
