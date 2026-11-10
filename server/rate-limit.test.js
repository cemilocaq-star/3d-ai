import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rate-limit.js';

function makeResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('allows requests up to the configured limit and rejects the next request', () => {
  let time = 1_000;
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, now: () => time });
  const req = { ip: 'client-a' };
  let passed = 0;

  for (let i = 0; i < 2; i += 1) {
    limiter(req, makeResponse(), () => { passed += 1; });
  }

  const response = makeResponse();
  limiter(req, response, () => { passed += 1; });

  assert.equal(passed, 2);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.error, 'Too many AI requests. Please wait before trying again.');
  assert.equal(response.headers['Retry-After'], '60');
  assert.equal(response.headers['RateLimit-Remaining'], '0');
});

test('resets a client window after the configured duration', () => {
  let time = 5_000;
  const limiter = createRateLimiter({ windowMs: 1_000, max: 1, now: () => time });
  const req = { ip: 'client-a' };
  let passed = 0;

  limiter(req, makeResponse(), () => { passed += 1; });
  time += 1_000;
  const response = makeResponse();
  limiter(req, response, () => { passed += 1; });

  assert.equal(passed, 2);
  assert.equal(response.statusCode, 200);
});

test('tracks clients independently', () => {
  const limiter = createRateLimiter({ max: 1 });
  let passed = 0;

  limiter({ ip: 'client-a' }, makeResponse(), () => { passed += 1; });
  const response = makeResponse();
  limiter({ ip: 'client-b' }, response, () => { passed += 1; });

  assert.equal(passed, 2);
  assert.equal(response.statusCode, 200);
});

test('rejects invalid limiter configuration', () => {
  assert.throws(() => createRateLimiter({ windowMs: 0 }), /windowMs/);
  assert.throws(() => createRateLimiter({ max: 0 }), /max/);
});
