import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './chat.js';

function response() {
  return {
    headers: {}, statusCode: 200, payload: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; }
  };
}

test('coach rejects anonymous requests without calling a model', async () => {
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { messages: [{role:'user',content:'Hi'}] } }, res);
  assert.equal(res.statusCode, 401);
});

test('coach rejects non-POST requests', async () => {
  const res = response();
  await handler({ method: 'GET', headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('coach rejects malformed authorization headers', async () => {
  const res = response();
  await handler({ method: 'POST', headers: {authorization:'Basic abc'}, body: {} }, res);
  assert.equal(res.statusCode, 401);
});

import { reserveQuota } from './chat.js';
test('quota fails closed when service key is not configured', async () => {
  const old = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const result = await reserveQuota('00000000-0000-0000-0000-000000000001');
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
  } finally {
    if (old !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = old;
  }
});
