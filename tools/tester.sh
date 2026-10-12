#!/bin/sh
# Run the tester's CDP scripts with Node 22 (built-in WebSocket) against a chosen port, from a copy (tester's dir untouched).
# Copies are tagged --sg-harness, stray tagged Chrome is killed before/after, and the run is capped (SG_TIMEOUT_S, default 900 s).
# Usage: [SG_TESTDIR=/workspace/starfall-test/m3-red] tools/tester.sh 8773 hold.js
PORT=$1; shift; SRC=${SG_TESTDIR:-/workspace/starfall-test/m3}; D=/tmp/sgt-$PORT-$(basename $SRC); mkdir -p $D
for f in $SRC/*.js; do sed -E -e "s/127.0.0.1:877[0-9]/127.0.0.1:$PORT/g" -e "s/spawn\('google-chrome', \[/spawn('google-chrome', ['--sg-harness', /" "$f" > $D/$(basename $f); done
pkill -9 -f -- '--sg-harness' 2>/dev/null
cd $D && timeout -k 10 ${SG_TIMEOUT_S:-900} /workspace/tools-node/node-v22.23.3-linux-x64/bin/node "$@"; rc=$?
pkill -9 -f -- '--sg-harness' 2>/dev/null; exit $rc
