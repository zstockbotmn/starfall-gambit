#!/bin/sh
# Run the tester's CDP scripts (/workspace/starfall-test/m3) with Node 22 (built-in WebSocket) against a chosen port.
# Usage: tools/tester.sh 8772 hit.js 3d 390 844   (copies scripts to /tmp/sgt-<port> with the port swapped; the tester's dir is untouched)
PORT=$1; shift; D=/tmp/sgt-$PORT; mkdir -p $D
for f in /workspace/starfall-test/m3/*.js; do sed "s/127.0.0.1:8771/127.0.0.1:$PORT/g" "$f" > $D/$(basename $f); done
cd $D && exec /workspace/tools-node/node-v22.23.3-linux-x64/bin/node "$@"
