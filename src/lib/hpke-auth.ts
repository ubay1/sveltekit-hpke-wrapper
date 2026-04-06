import { rateLimit } from './rate-limiter.js';

/**
 * Auth + rate limit check for HPKE endpoints.
 * Returns a Response if blocked, or null if allowed.
 *
 * @example
 * ```ts
 * const authError = hpkeAuth(event);
 * if (authError) return authError;
 * ```
 */
export function hpkeAuth(event: { request: Request; getClientAddress: () => string }): Response | null {
	// Simple API key for demo (in production, use env var + proper auth)
	const API_KEY = process.env.HPKE_API_KEY || 'demo-key-change-me';

	// 1. Check API key
	const authHeader = event.request.headers.get('x-api-key');
	if (!authHeader || authHeader !== API_KEY) {
		return new Response(
			JSON.stringify({ error: 'Unauthorized', details: 'Invalid or missing API key' }),
			{ status: 401, headers: { 'Content-Type': 'application/json' } }
		);
	}

	// 2. Rate limit by IP
	const ip = event.getClientAddress();
	const limit = rateLimit(ip, { maxRequests: 10, windowMs: 60 * 1000 });

	if (!limit.allowed) {
		return new Response(
			JSON.stringify({
				error: 'Too Many Requests',
				details: `Rate limit exceeded. Try again after ${new Date(limit.resetAt).toISOString()}`,
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'X-RateLimit-Remaining': String(limit.remaining),
					'X-RateLimit-Reset': String(limit.resetAt),
				},
			}
		);
	}

	return null; // Allowed
}
