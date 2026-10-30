#!/usr/bin/env bash
# Runs mitmweb with the MCP addon loaded.
#   :8080  forward proxy    (app outbound traffic, browsers, curl -x)
#   :3001  reverse proxy -> demo app on :3000 (inbound traffic)
#   :8081  mitmweb UI
#   :8000  MCP server (streamable HTTP at /mcp)
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/.tools/mitmproxy-mcp"
[ -d "$DIR" ] || { echo "Run 'npm run setup' first"; exit 1; }

APP_PORT="${APP_PORT:-3000}"
WEB_PASSWORD="${MITMWEB_PASSWORD:-demo}"

export UV_NATIVE_TLS=1

# Trust corporate CAs upstream (built by setup-proxy.sh); override with UPSTREAM_CA_BUNDLE.
CA_BUNDLE="${UPSTREAM_CA_BUNDLE:-$(dirname "$DIR")/ca-bundle.pem}"
EXTRA_ARGS=()
[ -s "$CA_BUNDLE" ] && EXTRA_ARGS+=(--set "ssl_verify_upstream_trusted_ca=$CA_BUNDLE")

echo "mitmweb UI:  http://127.0.0.1:8081  (password: $WEB_PASSWORD)"
echo "MCP server:  http://127.0.0.1:8000/mcp"

cd "$DIR"
exec uv run mitmweb \
  ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} \
  -s addon.py \
  --mode regular@8080 \
  --mode "reverse:http://127.0.0.1:${APP_PORT}@3001" \
  --set web_port=8081 \
  --set web_password="$WEB_PASSWORD" \
  --set mcp_transport=streamable-http \
  --set mcp_port=8000 \
  "$@"
