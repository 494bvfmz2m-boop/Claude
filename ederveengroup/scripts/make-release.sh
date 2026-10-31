#!/usr/bin/env bash
# Builds a ready-to-run zip from the last commit, with dependencies included,
# so it can be extracted and started without running npm install.
# Files sit at the root of the zip (no wrapping folder).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-ederveengroup.zip}"; case "$OUT" in /*) ;; *) OUT="$(pwd)/$OUT" ;; esac
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/ederveengroup"
git archive --format=tar HEAD . | tar -x -C "$TMP/ederveengroup"
[ -f "$TMP/ederveengroup/package.json" ] || { echo "archive came out empty" >&2; exit 1; }
perl -pi -e "s/\r?\n/\r\n/" "$TMP"/ederveengroup/*.bat
(cd "$TMP/ederveengroup" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null && rm -rf scripts tests)
rm -f "$OUT"
(cd "$TMP/ederveengroup" && zip -qr -9 -X "$OUT" .)
echo "Built $OUT ($(du -h "$OUT" | cut -f1))"
