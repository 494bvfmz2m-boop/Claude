#!/usr/bin/env bash
# Builds a ready-to-run zip from the last commit, with dependencies included,
# so it can be extracted and started without running npm install.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-ederveengroup.zip}"; case "$OUT" in /*) ;; *) OUT="$(pwd)/$OUT" ;; esac
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/ederveengroup"
git archive --format=tar HEAD . | tar -x -C "$TMP/ederveengroup"
[ -f "$TMP/ederveengroup/package.json" ] || { echo "archive came out empty" >&2; exit 1; }
perl -pi -e "s/\r?\n/\r\n/" "$TMP"/ederveengroup/*.bat
(cd "$TMP/ederveengroup" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null && rm -rf scripts)
rm -f "$OUT"
(cd "$TMP" && zip -qr -9 -X "$OUT" ederveengroup)
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
