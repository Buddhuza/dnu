#!/usr/bin/env bash
set -u

for attempt in 1 2; do
  echo "DNU collection attempt ${attempt}/2"
  if npm run collect:daily; then
    exit 0
  fi
  if [ "$attempt" -eq 1 ]; then
    echo 'First collection attempt failed; retrying immediately.'
    rm -f data/prepared-update.json data/native-collection-progress.json
  fi
done

echo 'DNU collection failed after two attempts.' >&2
exit 1
