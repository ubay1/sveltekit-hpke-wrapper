import { hpkeServer } from '$lib/hpke-server-instance.js';
import { hpkeAuth } from '$lib/hpke-auth.js';

export async function POST({ request, getClientAddress }: { request: Request; getClientAddress: () => string }) {
	// Auth + rate limit check
	const authError = hpkeAuth({ request, getClientAddress });
	if (authError) return authError;

	try {
		const body = await request.json();
		const { encrypted } = body;

		if (!encrypted) {
			return new Response(
				JSON.stringify({ error: 'Missing encrypted field' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Decode: base64 → JSON → { ciphertext, enc, clientPublicKey }
		const payload = JSON.parse(atob(encrypted));
		const { ciphertext, enc, clientPublicKey } = payload;

		console.log('📦 Received encrypted request');

		// Decrypt client message
		const decryptedMessage = await hpkeServer.decrypt(ciphertext, enc, clientPublicKey);
		console.log('✓ Decrypted client message:', decryptedMessage);

		// Parse the decrypted message
		let requestPayload;
		try {
			requestPayload = JSON.parse(decryptedMessage);
		} catch (e) {
			requestPayload = { title: decryptedMessage, body: '', userId: 1 };
		}

		// Call external API
		const apiResponse = await fetch('https://jsonplaceholder.typicode.com/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestPayload)
		});

		const apiData = await apiResponse.json();
		console.log('✓ API Response received:', apiData.id);

		// Encrypt response → encode as single base64 string
		const responseData = JSON.stringify({
			success: true,
			data: apiData,
			serverMessage: 'Data has been encrypted on server'
		});

		const encryptedResponse = await hpkeServer.encrypt(responseData, clientPublicKey);

		return new Response(
			JSON.stringify({
				encrypted: btoa(JSON.stringify(encryptedResponse))
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error: unknown) {
		console.error('❌ Server error:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);

		return new Response(
			JSON.stringify({
				error: 'Failed to process request',
				details: errorMessage
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
