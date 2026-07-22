#!/bin/bash
# Extract a representative frame from each use-case video at t=2s.
# Used by Playwright tests as a fallback when headless Chromium can't
# decode video frames to canvas (a known software-GL bug).

cd /home/z/my-project
mkdir -p public/sim/frames

VIDEOS=(
  uc-fire
  uc-graffiti
  uc-flood
  uc-crack
  uc-demolished
  uc-foggy-night
  uc-backpack
  uc-parking
  uc-night-parking
  uc-queue
  urban-intersection
  urban-crosswalk
  urban-street
  urban-pedestrians
)

for v in "${VIDEOS[@]}"; do
  if [ -f "public/sim/${v}.mp4" ]; then
    # Extract frame at 2s (or 1s for short clips). Use -update 1 to write single file.
    ffmpeg -y -ss 2 -i "public/sim/${v}.mp4" -frames:v 1 -update 1 -q:v 2 "public/sim/frames/${v}.jpg" 2>/dev/null
    if [ -f "public/sim/frames/${v}.jpg" ]; then
      SIZE=$(stat -c %s "public/sim/frames/${v}.jpg")
      echo "✓ ${v}.jpg (${SIZE} bytes)"
    else
      echo "✗ ${v}.jpg (extraction failed)"
    fi
  else
    echo "✗ ${v}.mp4 not found"
  fi
done

echo ""
echo "Extracted $(ls public/sim/frames/*.jpg 2>/dev/null | wc -l) frames"
