#!/bin/sh
# Start EderveenGroup on Linux or a server: ./start.sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "EderveenGroup needs Node.js 20 or newer: https://nodejs.org/" >&2
  exit 1
fi
exec node server.js
