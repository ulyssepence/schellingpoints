#!/bin/sh
PVC=/data/schellingpoints
EMBEDDINGS=$PVC/vocab-embeddings.json

if [ -d "$PVC" ]; then
  if [ ! -f "$EMBEDDINGS" ]; then
    echo "Generating vocab embeddings..."
    bun scripts/build-vocab-embeddings.ts
    mv data/vocab-embeddings.json "$EMBEDDINGS"
  fi
  ln -sf "$EMBEDDINGS" data/vocab-embeddings.json
  export DB_PATH=$PVC/schelling.db
  export APNS_KEY_PATH=$PVC/AuthKey.p8
  [ -f "$PVC/github-env" ] && . "$PVC/github-env"
fi

exec bun src/server.ts
