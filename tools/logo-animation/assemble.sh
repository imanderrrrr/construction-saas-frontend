#!/usr/bin/env bash
# Funde las piezas (MOV con alfa) en una sola animación transparente y la codifica para la web.
#   ./assemble.sh                 → renders/logo-build.mov + renders/logo-build-{1400,700}.{webm,hevc.mov} + review/logo-build.mp4
#   INSTALL=1 ./assemble.sh       → además copia los cuatro vídeos web a public/logo-build/ (los que reproduce LogoBuildOverlay)
# Orden de capas, de atrás hacia delante: base, camión, excavadora, grúa, acabado (si existe).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p renders review
LAYERS=(base camion excavadora grua acabado)
IN=(); F=""; N=0; PREV="[bg]"
for L in "${LAYERS[@]}"; do
  M="parts/$L/renders/$L.mov"; [ -f "$M" ] || { echo "· sin $L"; continue; }
  IN+=(-i "$M"); N=$((N+1))
  F+="[${N}:v]format=rgba[l${N}];${PREV}[l${N}]overlay=format=auto:shortest=0[o${N}];"
  PREV="[o${N}]"
done
[ "$N" -gt 0 ] || { echo "no hay piezas renderizadas"; exit 1; }
# lienzo transparente de la duración exacta
D="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "parts/base/renders/base.mov")"
ffmpeg -v error -y -f lavfi -i "color=c=black@0.0:s=1400x360:r=60:d=${D},format=rgba" "${IN[@]}" \
  -filter_complex "[0:v]format=rgba[bg];${F%;}" -map "${PREV}" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le renders/logo-build.mov
# Web: dos anchos (1400 px para pantallas anchas, 700 px para teléfonos), cada uno en WebM VP9 con alfa
# (Chrome, Edge, Firefox) y en HEVC con alfa (Safari; solo VideoToolbox de macOS sabe escribirlo).
# Pesos al 2026-10-26: 2,1 / 2,4 MB a 1400 px y 1,2 / 0,9 MB a 700 px.
web() { # ancho crf-vp9 bitrate-hevc
  local OUT="renders/logo-build-$1"
  ffmpeg -v error -y -i renders/logo-build.mov -vf "scale=$1:-2:flags=lanczos" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf "$2" -auto-alt-ref 0 -row-mt 1 -an "$OUT.webm"
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q hevc_videotoolbox; then
    ffmpeg -v error -y -i renders/logo-build.mov -vf "scale=$1:-2:flags=lanczos" \
      -c:v hevc_videotoolbox -alpha_quality 0.5 -b:v "$3" -tag:v hvc1 -an "$OUT.hevc.mov" || echo "· HEVC con alfa a $1 px: falló"
  else
    echo "· sin hevc_videotoolbox: el HEVC con alfa (Safari) solo se genera en macOS"
  fi
}
web 1400 42 1M
web 700 32 600k
# revisión: sobre fondo oscuro de la landing, a lienzo completo
ffmpeg -v error -y -f lavfi -i "color=c=0x17130F:s=1400x360:r=60:d=${D}" -i renders/logo-build.mov \
  -filter_complex "[0:v]format=rgba[bg];[1:v]format=rgba[fg];[bg][fg]overlay=shortest=1:format=auto,format=yuv420p" \
  -c:v libx264 -crf 16 -movflags +faststart review/logo-build.mp4
if [ "${INSTALL:-0}" = "1" ]; then
  mkdir -p ../../public/logo-build
  cp renders/logo-build-1400.webm renders/logo-build-1400.hevc.mov renders/logo-build-700.webm renders/logo-build-700.hevc.mov ../../public/logo-build/
fi
ls -la renders/logo-build* review/logo-build.mp4
echo "Si cambia la duración, actualiza LOGO_BUILD_DURATION_MS en src/app/components/landing/LogoBuildOverlay.tsx."
