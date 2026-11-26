#!/usr/bin/env bash
# Fetches Apple's official device bezels (Apple Design Resources, developer.apple.com/design/resources/#product-bezels) into bezels/.
# They are Apple's files under Apple's license: bezels/ is git-ignored, never commit or redistribute them. Use them as is (no shadow, tilt or crop).
# Needs network. macOS mounts the .dmg with hdiutil; Linux extracts it with 7z (apt-get install 7zip).
set -euo pipefail
cd "$(dirname "$0")/.."; mkdir -p bezels; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
CDN=https://devimages-cdn.apple.com/design/resources/download
get() {   # get <dmg name> <path inside the dmg> <out name>
  [ -f "bezels/$3" ] && { echo "have bezels/$3"; return; }
  [ -f "$tmp/$1.dmg" ] || curl -fsSL -o "$tmp/$1.dmg" "$CDN/$1.dmg"
  if command -v hdiutil >/dev/null; then
    [ -d "$tmp/$1" ] || hdiutil attach -nobrowse -readonly -quiet -mountpoint "$tmp/$1" "$tmp/$1.dmg"
    cp "$tmp/$1/$2" "bezels/$3"
  else
    7z x -y -o"$tmp/x" "$tmp/$1.dmg" "*/$2" -r >/dev/null
    cp "$(find "$tmp/x" -path "*/$2" | head -1)" "bezels/$3"
  fi
  echo "got bezels/$3"
}
get Bezel-iPhone-18 "PNG/iPhone 18 Pro/iPhone 18 Pro - Black - Portrait.png" iphone-18-pro-black.png
get Bezel-MacBook-Pro-M5 "PNG/MacBook Pro M5 14-inch Space Black.png" macbook-pro-14-space-black.png
if command -v hdiutil >/dev/null; then for m in "$tmp"/Bezel-*; do [ -d "$m" ] && hdiutil detach -quiet "$m" || true; done; fi
