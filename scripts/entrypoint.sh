#!/bin/sh
PVC=/data/schellingpoints
EMBEDDINGS=$PVC/vocab-embeddings.json

if [ -d "$PVC" ]; then
  if [ ! -f "$EMBEDDINGS" ]; then
    echo "Generating vocab embeddings..."
    bunx tsx scripts/build-vocab-embeddings.ts
    mv data/vocab-embeddings.json "$EMBEDDINGS"
  fi
  ln -sf "$EMBEDDINGS" data/vocab-embeddings.json
fi

exec bunx tsx src/server.ts
