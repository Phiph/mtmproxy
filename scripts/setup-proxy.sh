#!/usr/bin/env bash
# Installs mitmproxy + the lups2000/mitmproxy-MCP addon into .tools/ (pinned commit).
set -euo pipefail

REPO=https://github.com/lups2000/mitmproxy-MCP
REF=96ed720 # pinned: bump deliberately
DIR="$(cd "$(dirname "$0")/.." && pwd)/.tools/mitmproxy-mcp"

command -v uv >/dev/null || { echo "uv is required: brew install uv  (or https://docs.astral.sh/uv/)"; exit 1; }

# Use the OS trust store so corporate TLS inspection (VPN root CA) works.
export UV_NATIVE_TLS=1

# mitmproxy verifies upstream certs with certifi, which lacks corporate CAs.
# Export the macOS trust store (incl. any VPN CA) for proxy.sh to use.
if [ "$(uname)" = "Darwin" ]; then
  mkdir -p "$(dirname "$DIR")"
  security find-certificate -a -p \
    /System/Library/Keychains/SystemRootCertificates.keychain \
    /Library/Keychains/System.keychain \
    > "$(dirname "$DIR")/ca-bundle.pem"
fi

if [ ! -d "$DIR/.git" ]; then
  git clone --quiet "$REPO" "$DIR"
fi
git -C "$DIR" fetch --quiet origin
git -C "$DIR" checkout --quiet "$REF"
uv sync --project "$DIR" --frozen

echo "✓ mitmproxy + MCP addon installed in .tools/mitmproxy-mcp"
echo "  Next: npm run proxy"
