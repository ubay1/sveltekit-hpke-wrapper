/**
 * Simple in-memory rate limiter
 */
interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
	/** Max requests per window */
	maxRequests: number;
	/** Window size in milliseconds */
	windowMs: number;
}

export function rateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();
	let entry = rateLimitMap.get(key);

	if (!entry || now >= entry.resetAt) {
		entry = {
			count: 0,
			resetAt: now + config.windowMs,
		};
		rateLimitMap.set(key, entry);
	}

	entry.count++;

	return {
		allowed: entry.count <= config.maxRequests,
		remaining: Math.max(0, config.maxRequests - entry.count),
		resetAt: entry.resetAt,
	};
}

// Cleanup old entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitMap.entries()) {
		if (now >= entry.resetAt) {
			rateLimitMap.delete(key);
		}
	}
}, 5 * 60 * 1000);
