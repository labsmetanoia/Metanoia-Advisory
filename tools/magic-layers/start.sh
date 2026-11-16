#!/usr/bin/env bash
# Magic Layers launcher for Linux (and macOS from a terminal). Double-click, or run: ./start.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Magic Layers needs Node.js (free). Install the LTS version from https://nodejs.org and run this again."
  read -r -p "Press Enter to close." _; exit 1
fi
if [ ! -f app/vendor/tesseract/tesseract.min.js ]; then
  echo "First start: installing the app's libraries (about a minute, needs internet once)..."
  npm install --no-audit --no-fund || { echo "Install failed. Check the internet connection and try again."; read -r -p "Press Enter to close." _; exit 1; }
fi
node server.mjs
