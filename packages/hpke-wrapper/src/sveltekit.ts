import type { RequestHandler } from '@sveltejs/kit';
import { createHpkeServer, type HpkeServerConfig, type HpkeServerInstance } from './server.js';

/**
 * HPKE Endpoint handlers
 */
export interface HpkeEndpointHandlers {
	/** GET handler - Returns server public key */
	GET?: RequestHandler;
	/** POST handler - Process sealed requests */
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
 * Uses seal/unseal for obfuscated encrypted payloads.
 *
 * @param config - Endpoint configuration
 * @returns Object with GET and POST request handlers
 *
 * @example
 * ```typescript
 * // src/routes/api/hpke/+server.ts
 * import { createHpkeEndpoint } from '$lib/sveltekit.js';
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
 *
 * @example Client usage
 * ```typescript
 * // Client sends: { data: "<sealed ciphertext with _clientPublicKey inside>" }
 * // Server responds: { data: "<sealed response>" }
 * ```
 */
export function createHpkeEndpoint(config: HpkeEndpointConfig = {}): HpkeEndpointHandlers {
	const server: HpkeServerInstance = createHpkeServer(config);

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
			const { data } = body;

			if (!data) {
				return new Response(
					JSON.stringify({ error: 'Missing data field' }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}

			// Decrypt client message (automatically unseals)
			const decryptedMessage = await server.decrypt(data);

			// Parse decrypted message and extract clientPublicKey
			let decryptedData: any;
			let clientPublicKey: string | undefined;
			try {
				const parsed = JSON.parse(decryptedMessage);
				clientPublicKey = parsed._clientPublicKey;
				delete parsed._clientPublicKey;
				decryptedData = parsed;
			} catch {
				decryptedData = { message: decryptedMessage };
			}

			if (!clientPublicKey) {
				return new Response(
					JSON.stringify({ error: 'Missing client public key in encrypted payload' }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}
				);
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

			// Encrypt response (automatically seals)
			const encryptedResponse = await server.encrypt(
				JSON.stringify(responseData),
				clientPublicKey
			);

			return new Response(
				JSON.stringify({ data: encryptedResponse }),
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
