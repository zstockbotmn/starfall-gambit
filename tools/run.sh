#!/bin/sh
# Run one test/render script with stray harness Chrome killed first and a hard wall-clock limit (default 20 min).
# Usage: tools/run.sh [seconds] node test/m3/checks.js
case "$1" in [0-9]*) T=$1; shift;; *) T=1200;; esac
pkill -9 -f -- '--sg-harness' 2>/dev/null
timeout -k 10 "$T" "$@"; rc=$?
pkill -9 -f -- '--sg-harness' 2>/dev/null
exit $rc
