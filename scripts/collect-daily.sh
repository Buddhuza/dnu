#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export COLLECTION_DAY="${COLLECTION_DAY:-$(date -u +%Y-%m-%d)}"
export COLLECTION_RUN_ID="${COLLECTION_RUN_ID:-${COLLECTION_DAY}-$(date -u +%H%M%S)-$$}"
export NODE_USE_ENV_PROXY=1

node scripts/batch-listings.mjs
COLLECTION_PHASE=primary COLLECTION_BATCH_LISTINGS=1 node scripts/collect-window.mjs
COLLECTION_LISTING_MODE=alternate node scripts/batch-listings.mjs
COLLECTION_PHASE=fallback COLLECTION_BATCH_LISTINGS=1 COLLECTION_BATCH_ALTERNATE=1 node scripts/collect-window.mjs
node scripts/build-daily-update.mjs
