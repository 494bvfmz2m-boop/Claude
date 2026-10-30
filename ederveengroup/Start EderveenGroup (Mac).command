#!/bin/bash
# Double-click to start EderveenGroup on a Mac.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "EderveenGroup needs Node.js (free). Opening the download page..."
  open https://nodejs.org/
  read -r -p "Install the LTS version, then double-click this file again. Press Enter to close."
  exit 1
fi
OPEN_BROWSER=1 node server.js
