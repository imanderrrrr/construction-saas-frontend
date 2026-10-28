#!/usr/bin/env bash
# Web versions of BT-V00, the narrated welcome film, for the first tab of the
# landing's video player (src/app/components/landing/DemoVideos.tsx).
#
#   tools/welcome-video/encode.sh <lang> <master.mp4> <captions.vtt> <poster.jpg>
#
# The film is made in the infra repo (branch video/bienvenida, videos/bienvenida/):
# 1920x1200, 60 fps, voice and music, ~15 MB per master. The landing ships
# 1440x900 — the player is never wider than ~870 CSS px, and the smallest text of
# the panel screens in the film still reads at that size — at ~7 MB per file:
#   mp4   H.264 CRF 25, tuned for flat drawings, AAC 128k. moov first (+faststart)
#         and the transfer tagged sRGB, as in tools/intro-video/render.sh: tagged
#         BT.709, Chrome "corrects" the paper a few levels lighter than it is.
#   webm  VP9 constant quality (two passes) + Opus, for browsers without H.264.
#         At this size VP9 needs CRF 38 to weigh what H.264 does at 25.
#   jpg   the poster: the master's own (the closing frame), scaled.
#   vtt   the captions exactly as the edit delivers them.
# Writes public/demos/<lang>/bienvenida.{mp4,webm,jpg,vtt}. If the length changed,
# update durationSec in the "welcome" block of public/demos/manifest.json.
set -euo pipefail

if [ $# -ne 4 ]; then
  echo "usage: $0 <lang> <master.mp4> <captions.vtt> <poster.jpg>" >&2
  exit 2
fi
lang=$1; master=$2; vtt=$3; poster=$4
cd "$(dirname "$0")/../.."
out="public/demos/$lang/bienvenida"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

SIZE=1440:900
color=(-color_primaries bt709 -color_trc bt709 -colorspace bt709)

ffmpeg -v error -y -i "$master" -map 0:v:0 -map 0:a:0 -vf "scale=$SIZE:flags=lanczos" \
  -c:v libx264 -preset veryslow -tune animation -crf 25 -pix_fmt yuv420p -profile:v high -level 4.1 \
  -x264-params keyint=240:min-keyint=60 "${color[@]}" \
  -c:a aac -b:a 128k -ac 2 -ar 48000 "$tmp/raw.mp4"
ffmpeg -v error -y -i "$tmp/raw.mp4" -c copy -bsf:v h264_metadata=transfer_characteristics=13 \
  -movflags +faststart "$out.mp4"

vp9=(-vf "scale=$SIZE:flags=lanczos" -c:v libvpx-vp9 -b:v 0 -crf 38 -pix_fmt yuv420p
     -row-mt 1 -tile-columns 2 -g 240 -deadline good -cpu-used 2 "${color[@]}")
ffmpeg -v error -y -i "$master" -map 0:v:0 "${vp9[@]}" -pass 1 -passlogfile "$tmp/vp9" -an -f null /dev/null
ffmpeg -v error -y -i "$master" -map 0:v:0 -map 0:a:0 "${vp9[@]}" -pass 2 -passlogfile "$tmp/vp9" \
  -c:a libopus -b:a 112k -ac 2 "$out.webm"

ffmpeg -v error -y -i "$poster" -vf "scale=$SIZE:flags=lanczos" -q:v 3 "$out.jpg"
cp "$vtt" "$out.vtt"

ls -la "$out".*
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out.mp4" | xargs printf 'durationSec %s\n'
