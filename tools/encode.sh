#!/bin/bash
# Encode rendered frames to an mp4 and a frame sheet.   usage: bash encode.sh <framesDir> <out.mp4> [crf=19] [tiles=32]
# Frames are r%04d.jpg from render.cjs film. Run with bash (the project-files mount is noexec).
set -e; D="$1"; OUT="$2"; CRF="${3:-19}"; TILES="${4:-32}"
FIRST=$(ls "$D" | grep -E '^r[0-9]{4}\.jpg$' | sort | head -1 | sed -E 's/r0*([0-9]+)\.jpg/\1/'); FIRST=${FIRST:-0}
N=$(ls "$D" | grep -cE '^r[0-9]{4}\.jpg$')
ffmpeg -v error -y -framerate 60 -start_number "$FIRST" -i "$D/r%04d.jpg" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf "$CRF" -preset slow -movflags +faststart "$OUT"
# sheet: TILES frames spread over the film, 8 per row, frame number burned in
EVERY=$(( N / TILES )); [ "$EVERY" -lt 1 ] && EVERY=1; ROWS=$(( (TILES + 7) / 8 ))
ffmpeg -v error -y -i "$OUT" -vf "drawtext=text='%{n}':x=10:y=10:fontsize=40:fontcolor=white:box=1:boxcolor=black@0.6,select='not(mod(n\,$EVERY))',scale=360:-1,tile=8x$ROWS" -frames:v 1 -fps_mode vfr "${OUT%.mp4}-sheet.jpg"
echo "$N frames -> $OUT ($(du -h "$OUT" | cut -f1)), sheet ${OUT%.mp4}-sheet.jpg"
