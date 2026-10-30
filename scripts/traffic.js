// Generates a mix of good and bad requests through the reverse proxy (:3001 -> app).
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';

const calls = [
  ['GET', '/api/health'],
  ['GET', '/api/users/1/dashboard'],
  ['GET', '/api/todos/3'],
  ['POST', '/api/orders', { quantity: 2, price: 9.99 }],
  ['POST', '/api/orders', { quantity: '2', price: 9.99 }],
  ['GET', '/api/nope'],
];

for (const [method, path, body] of calls) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  console.log(`${res.status} ${method} ${path} ${Date.now() - started}ms`);
}
