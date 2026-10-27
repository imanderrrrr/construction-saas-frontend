#!/usr/bin/env bash
# Comprueba y renderiza una pieza (MOV transparente) y genera su revisión sobre el escenario de referencia.
#   ./part.sh excavadora          GRID=1 ./part.sh excavadora
set -euo pipefail
cd "$(dirname "$0")"
P="${1:?pieza: excavadora | grua | camion | base}"
HF="npx --yes hyperframes@0.8.206"
( cd "parts/$P" && $HF check && mkdir -p renders && $HF render --fps 60 --format mov --quiet -o "renders/$P.mov" )
if [ "${GRID:-0}" = "1" ]; then ./review.sh "parts/$P/renders/$P.mov" grid; else ./review.sh "parts/$P/renders/$P.mov"; fi
