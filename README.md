# mitmproxy + AI demo

Use [mitmproxy](https://mitmproxy.org) to capture HTTP traffic, look at it in the web UI, and let an AI agent analyse the same flows over MCP.

```
curl / browser ──► :3001 (reverse proxy) ──► demo app :3000 ──► :8080 (forward proxy) ──► jsonplaceholder.typicode.com
                              │                                        │
                              └──────────── mitmweb (one flow store) ──┘
                                     │                    │
                               UI :8081            MCP :8000/mcp ◄── Claude Code
```

The MCP server is [lups2000/mitmproxy-MCP](https://github.com/lups2000/mitmproxy-MCP) (MIT). It runs **inside** mitmweb, so the AI sees exactly what you see in the UI, and any flows it marks or comments on show up there live.

## Prerequisites

- Node 22+
- [uv](https://docs.astral.sh/uv/) (`brew install uv`). It installs Python 3.12 and mitmproxy for you.

## Setup (once)

```bash
npm run setup        # npm install + clones the pinned MCP addon into .tools/ and installs mitmproxy
```

To trust the mitmproxy CA so HTTPS can be decrypted, start the proxy once (it generates `~/.mitmproxy/`). The app uses the CA via `NODE_EXTRA_CA_CERTS`, so for the demo you don't need to trust it system-wide. For browsers, see http://mitm.it while you're proxied.

## Run (3 terminals)

```bash
npm run proxy          # mitmweb UI http://127.0.0.1:8081 (password: demo) + MCP on :8000
npm run start:proxied  # demo app on :3000, outbound calls go via :8080
npm run traffic        # fires good and bad requests through :3001
```

Then open Claude Code in this repo. `.mcp.json` already registers the `mitmproxy` MCP server, so approve it when prompted and check it with `/mcp`.

## The demo app's planted problems

| Endpoint | Problem |
|---|---|
| `GET /api/users/:id/dashboard` | N+1: one upstream call per post (about 12 calls per request) |
| `GET /api/todos/:id` | 1.5s server-side delay, and the same upstream resource fetched twice |
| `POST /api/orders` with `"quantity": "2"` | 500 error that leaks a stack trace |
| every upstream call | sends `authorization: Bearer demo-secret-token` (redaction demo) |

## Prompts to try

- "List the captured flows and summarise what the app is doing upstream."
- "Why is `/api/users/1/dashboard` slow? Look at the upstream calls it triggers."
- "Find any 5xx responses, tell me the root cause, and point to the line in `app/server.js`."
- "Diff the successful and failing `POST /api/orders` flows."
- "Mark every flow that leaks a secret or stack trace and comment why." Then watch them light up in mitmweb.
- "Replay the failing order with a numeric quantity."

## Troubleshooting: corporate VPN / TLS inspection

If you see `invalid peer certificate: UnknownIssuer`, your VPN is re-signing TLS traffic (check with `echo | openssl s_client -connect github.com:443 2>/dev/null | grep issuer`). The scripts handle this:

- **uv:** `UV_NATIVE_TLS=1` makes uv use the OS trust store.
- **mitmproxy upstream:** on macOS, setup exports the keychain trust store to `.tools/ca-bundle.pem`, and the proxy passes it as `ssl_verify_upstream_trusted_ca`. On Linux, set `UPSTREAM_CA_BUNDLE=/path/to/bundle.pem`.
- **Node (unproxied `npm start`):** `--use-system-ca`.

## Notes

- **Redaction:** the addon redacts auth headers, sensitive query params and body previews before handing them to the model. It's on by default, so leave it on when capturing real traffic.
- **Inbound vs outbound:** `:3001` captures clients calling your service, and `:8080` captures your service calling others. Point any app at `:8080` with `HTTP_PROXY`/`HTTPS_PROXY`.
- **Node and proxies:** Node's `fetch` ignores `HTTP_PROXY` by default, so the app uses undici's `EnvHttpProxyAgent`. On Node 24+ you can use `NODE_USE_ENV_PROXY=1` instead.
- **Alternative MCP server:** [snapspecter/mitmproxy-mcp](https://github.com/snapspecter/mitmproxy-mcp) (`uvx mitmproxy-mcp`) runs its own headless proxy, so its traffic doesn't appear in mitmweb. It's better suited to API discovery and security work (OpenAPI export, auth-pattern detection, fuzzing, replay) than to shared debugging.
