import type { RequestHandler } from '@sveltejs/kit';
import { createHpkeServer, type HpkeServerConfig } from './server.js';

/**
 * HPKE Endpoint handlers
 */
export interface HpkeEndpointHandlers {
	/** GET handler - Returns server public key */
	GET?: RequestHandler;
	/** POST handler - Process encrypted requests */
	POST?: RequestHandler;
}

/**
 * HPKE Endpoint configuration
 */
export interface HpkeEndpointConfig extends HpkeServerConfig {
	/** Custom handler for decrypted requests */
	onRequest?: (decrypted: any, request: Request) => Promise<any>;
	/** Custom error handler */
	onError?: (error: Error, request: Request) => Promise<Response>;
}

/**
 * Create SvelteKit API endpoints for HPKE
 * 
 * Generates both GET and POST handlers for a complete HPKE API.
 * 
 * @param config - Endpoint configuration
 * @returns Object with GET and POST request handlers
 * 
 * @example
 * ```typescript
 * // src/routes/api/hpke/+server.ts
 * import { createHpkeEndpoint } from '@hpke/sveltekit-wrapper';
 * 
 * const { GET, POST } = createHpkeEndpoint({
 *   onRequest: async (decrypted) => {
 *     // Process decrypted request
 *     const response = await fetch('https://api.example.com/data', {
 *       method: 'POST',
 *       body: JSON.stringify(decrypted)
 *     });
 *     return await response.json();
 *   }
 * });
 * 
 * export { GET, POST };
 * ```
 */
export function createHpkeEndpoint(config: HpkeEndpointConfig = {}): HpkeEndpointHandlers {
	const server = createHpkeServer(config);

	const GET: RequestHandler = async () => {
		try {
			const publicKey = server.getPublicKeyBase64();
			
			return new Response(
				JSON.stringify({
					publicKey,
					algorithm: 'X25519-HKDF-SHA256',
					aead: 'AES-128-GCM',
				}),
				{
					headers: {
						'Content-Type': 'application/json',
					},
				}
			);
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: 'Failed to generate keys',
					details: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	};

	const POST: RequestHandler = async ({ request }) => {
		try {
			const body = await request.json();
			const { ciphertext, enc, clientPublicKey } = body;

			if (!ciphertext || !enc || !clientPublicKey) {
				return new Response(
					JSON.stringify({ error: 'Missing required fields' }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Decrypt client message
			const decryptedMessage = await server.decrypt(ciphertext, enc, clientPublicKey);
			
			// Parse decrypted message
			let decryptedData: any;
			try {
				decryptedData = JSON.parse(decryptedMessage);
			} catch {
				decryptedData = { message: decryptedMessage };
			}

			// Process with custom handler or return decrypted data
			let responseData: any;
			if (config.onRequest) {
				responseData = await config.onRequest(decryptedData, request);
			} else {
				responseData = {
					success: true,
					data: decryptedData,
					message: 'Request processed successfully',
				};
			}

			// Encrypt response
			const encrypted = await server.encrypt(
				JSON.stringify(responseData),
				clientPublicKey
			);

			return new Response(
				JSON.stringify(encrypted),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		} catch (error) {
			// Custom error handler or default
			if (config.onError) {
				return config.onError(error as Error, request);
			}

			return new Response(
				JSON.stringify({
					error: 'Failed to process request',
					details: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}
	};

	return { GET, POST };
}
