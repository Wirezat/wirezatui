#!/usr/bin/env bash
# Minimal static file server for running wirezatUI's dev/test-*.html harness
# pages standalone (wirezatUI has no backend, no build step, no package.json).
cd "$(dirname "$0")/.."
exec python3 -m http.server "${1:-8090}"
