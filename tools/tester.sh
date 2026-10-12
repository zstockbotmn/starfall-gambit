#!/bin/sh
# Run the tester's CDP scripts (/workspace/starfall-test/m3) with Node 22 (built-in WebSocket) against a chosen port.
# Usage: tools/tester.sh 8772 hit.js 3d 390 844   (copies scripts to /tmp/sgt-<port> with the port swapped; the tester's dir is untouched)
PORT=$1; shift; D=/tmp/sgt-$PORT; mkdir -p $D
SRC=${SG_TESTDIR:-/workspace/starfall-test/m3}; for f in $SRC/*.js; do sed -E "s/127.0.0.1:877[0-9]/127.0.0.1:$PORT/g" "$f" > $D/$(basename $f); done
cd $D && exec /workspace/tools-node/node-v22.23.3-linux-x64/bin/node "$@"
