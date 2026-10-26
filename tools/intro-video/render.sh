#!/usr/bin/env bash
# Renders «Del plano a la obra» (ArchLogic → BuildTrack) into renders/.
# INSTALL=1 ./render.sh also copies the result to public/intro/ (the files IntroOverlay plays).
# Needs Chrome (HyperFrames downloads its own) and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

HF="npx --yes hyperframes@0.8.206"
NAME="${NAME:-archlogic-buildtrack-intro}"
mkdir -p renders

$HF check
$HF render --fps 60 --crf 22 --format mp4  -o "renders/$NAME.raw.mp4"
$HF render --fps 60 --crf 34 --format webm -o "renders/$NAME.raw.webm"

# mp4: moov atom first, so playback starts before the download ends. The renderer captures sRGB but tags
# the stream BT.709; Chrome then "corrects" it and the paper ends up 3 levels lighter than the page around
# it (a faint frame). Tagging the transfer as sRGB (code 13) makes the paper match the overlay exactly.
# webm: the renderer streams it without a duration header; a copy-remux writes it.
ffmpeg -v error -y -i "renders/$NAME.raw.mp4"  -c copy -bsf:v h264_metadata=transfer_characteristics=13 -movflags +faststart "renders/$NAME.mp4"
ffmpeg -v error -y -i "renders/$NAME.raw.webm" -c copy                      "renders/$NAME.webm"
rm -f "renders/$NAME.raw.mp4" "renders/$NAME.raw.webm"

if [ "${INSTALL:-0}" = "1" ]; then
  cp "renders/$NAME.mp4" "renders/$NAME.webm" ../../public/intro/
fi
ls -la renders/"$NAME".*
echo "If the length changed, update INTRO_VIDEO_DURATION_MS in src/app/components/IntroOverlay.tsx."
