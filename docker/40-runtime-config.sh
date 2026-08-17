#!/bin/sh
# nginx entrypoint drop-in: regenerates the SPA's runtime config from the
# container environment on every start, so the same image can point at any
# backend without rebuilding.
#
#   API_URL         e.g. https://api.example.com/api/v1   (default: /api/v1)
#   WS_URL          e.g. wss://api.example.com/ws         (default: /ws)
#   WS_MAX_RETRIES  reconnects before polling fallback    (default: 5)
#
# Unset variables are omitted, letting the bundle's build-time defaults apply.
set -eu

OUT=/usr/share/nginx/html/config.js

{
  echo "// Generated at container start from API_URL / WS_URL / WS_MAX_RETRIES."
  echo "window.__TRACEDOWN_ENV__ = {"
  if [ -n "${API_URL:-}" ]; then echo "  apiUrl: \"${API_URL}\","; fi
  if [ -n "${WS_URL:-}" ]; then echo "  wsUrl: \"${WS_URL}\","; fi
  if [ -n "${WS_MAX_RETRIES:-}" ]; then echo "  wsMaxRetries: \"${WS_MAX_RETRIES}\","; fi
  echo "};"
} > "$OUT"

echo "runtime config written to $OUT"
