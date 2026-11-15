/**
 * Very small in-memory limiter: allows `max` calls per key in each `windowMs`.
 * It resets when the server restarts, which is fine for a single-instance app.
 */
function createRateLimiter({ max, windowMs }) {
    const hits = new Map();

    return function allow(key) {
        const now = Date.now();
        const recent = (hits.get(key) || []).filter(time => now - time < windowMs);

        if (recent.length >= max) {
            hits.set(key, recent);
            return false;
        }

        recent.push(now);
        hits.set(key, recent);

        // keep the map from growing forever
        if (hits.size > 5000) {
            for (const [k, times] of hits) {
                if (times.every(time => now - time >= windowMs)) hits.delete(k);
            }
        }

        return true;
    };
}

module.exports = { createRateLimiter };
