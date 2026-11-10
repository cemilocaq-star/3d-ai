export function createRateLimiter({ windowMs = 60_000, max = 20, now = () => Date.now() } = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError('windowMs must be positive.');
  if (!Number.isInteger(max) || max < 1) throw new TypeError('max must be a positive integer.');

  const clients = new Map();
  let requestCount = 0;

  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const currentTime = now();
    let record = clients.get(key);

    if (!record || currentTime - record.startedAt >= windowMs) {
      record = { startedAt: currentTime, count: 0 };
      clients.set(key, record);
    }

    record.count += 1;
    requestCount += 1;

    if (clients.size > 10_000 && requestCount % 256 === 0) {
      for (const [clientKey, client] of clients) {
        if (currentTime - client.startedAt >= windowMs) clients.delete(clientKey);
      }
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.startedAt + windowMs - currentTime) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (record.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: 'Too many AI requests. Please wait before trying again.' });
    }

    return next();
  };
}
