const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 40;
const clients = new Map();

export default function publicTrackingRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  let entry = clients.get(key);
  if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + WINDOW_MS };
  entry.count += 1;
  clients.set(key, entry);

  if (clients.size > 10000) {
    for (const [client, value] of clients) if (value.resetAt <= now) clients.delete(client);
  }
  res.setHeader("RateLimit-Limit", MAX_REQUESTS);
  res.setHeader("RateLimit-Remaining", Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader("RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
  if (entry.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ success: false, message: "Too many tracking requests. Please try again later." });
  }
  return next();
}
