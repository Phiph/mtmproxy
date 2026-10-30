// Demo API with a few deliberately planted problems for AI-assisted debugging.
// Outbound calls go through HTTP(S)_PROXY when set (see `npm run start:proxied`).
import http from 'node:http';
import { EnvHttpProxyAgent, fetch } from 'undici';

const PORT = Number(process.env.PORT ?? 3000);
const UPSTREAM = 'https://jsonplaceholder.typicode.com';
const dispatcher = new EnvHttpProxyAgent();

// Planted: a "secret" sent upstream on every call (redaction demo).
const upstream = async (path) => {
  const res = await fetch(`${UPSTREAM}${path}`, {
    dispatcher,
    headers: { authorization: 'Bearer demo-secret-token', 'x-demo-app': 'mitmproxy-ai-demo' },
  });
  if (!res.ok) throw new Error(`Upstream ${path} -> ${res.status}`);
  return res.json();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readJson = async (req) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
};

const routes = {
  'GET /api/health': async () => ({ status: 'ok' }),

  // Planted: N+1 — one upstream call per post to fetch comments.
  'GET /api/users/:id/dashboard': async ({ id }) => {
    const user = await upstream(`/users/${id}`);
    const posts = await upstream(`/posts?userId=${id}`);
    const withComments = [];
    for (const post of posts) {
      const comments = await upstream(`/posts/${post.id}/comments`);
      withComments.push({ ...post, commentCount: comments.length });
    }
    return { user: user.name, posts: withComments.length, topPost: withComments[0] };
  },

  // Planted: slow, and fetches the same resource twice.
  'GET /api/todos/:id': async ({ id }) => {
    await sleep(1500);
    const todo = await upstream(`/todos/${id}`);
    const again = await upstream(`/todos/${id}`);
    return { ...todo, verified: todo.id === again.id };
  },

  // Planted: string quantities blow up with a 500 and leak a stack trace.
  'POST /api/orders': async (_params, req) => {
    const order = await readJson(req);
    const total = order.quantity.toFixed(2) * order.price;
    return { orderId: Date.now(), total };
  },
};

const match = (method, url) => {
  const path = new URL(url, 'http://localhost').pathname;
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const names = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), '([^/]+)'))}$`);
    const hit = path.match(re);
    if (hit) return { handler, params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])) };
  }
};

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const route = match(req.method, req.url);
    if (!route) return send(res, 404, { error: 'not found' });
    try {
      send(res, 200, await route.handler(route.params, req));
    } catch (err) {
      send(res, 500, { error: err.message, stack: err.stack });
    }
  })
  .listen(PORT, () => {
    const proxied = process.env.HTTPS_PROXY ? ` (outbound via ${process.env.HTTPS_PROXY})` : '';
    console.log(`demo app on http://localhost:${PORT}${proxied}`);
  });
