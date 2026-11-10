#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec node --use-env-proxy collector/run.js "$@"
