import { hpkeServer } from '$lib/hpke-server-instance.js';
import { hpkeAuth } from '$lib/hpke-auth.js';
import miniSuperFetch from '@ubay182/mini-super-fetch';

export async function POST({ request, getClientAddress }: { request: Request; getClientAddress: () => string }) {
	// Auth + rate limit check
	const authError = hpkeAuth({ request, getClientAddress });
	if (authError) return authError;

	try {
		const body = await request.json();
		const { data } = body;

		console.log('📦 Received sealed request');
		console.log('📊 data length:', data?.length);

		if (!data) {
			return new Response(
				JSON.stringify({ error: 'Missing data field' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Decrypt client message using unseal
		console.log('🔓 Attempting to decrypt...');
		const decryptedMessage = await hpkeServer.decrypt(data);
		console.log('✓ Decrypted client message:', decryptedMessage);

		// Parse the decrypted message and extract clientPublicKey
		let requestPayload;
		let clientPublicKey;
		try {
			const parsed = JSON.parse(decryptedMessage);
			// Extract clientPublicKey from inside the encrypted payload
			clientPublicKey = parsed._clientPublicKey;
			// Remove the internal field before processing
			delete parsed._clientPublicKey;
			requestPayload = parsed;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (e) {
			requestPayload = { title: decryptedMessage, body: '', userId: 1 };
		}

		if (!clientPublicKey) {
			return new Response(
				JSON.stringify({ error: 'Missing client public key in encrypted payload' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		console.log('🔑 Client public key extracted from encrypted payload');

		// Call external API
		// const apiResponse = await fetch('https://jsonplaceholder.typicode.com/posts', {
		// 	method: 'POST',
		// 	headers: { 'Content-Type': 'application/json' },
		// 	body: JSON.stringify(requestPayload)
		// });

		const res = await miniSuperFetch.post<{
			title: string
			body: string
			userId: number
			id: number
		}>('https://jsonplaceholder.typicode.com/posts', requestPayload, {
			headers: { 'Content-Type': 'application/json' },
			timeout: 1000,
			retries: 3,
			retryDelay: 1000,
		})

		// const apiData = await apiResponse.json();
		console.log('✓ API Response received:', res.data);

		// Encrypt response using seal
		const responseData = JSON.stringify({
			success: true,
			data: res.data,
			serverMessage: 'Data has been encrypted on server'
		});

		const wrappedResponse = await hpkeServer.encrypt(responseData, clientPublicKey);

		return new Response(
			JSON.stringify({
				data: wrappedResponse
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error: unknown) {
		console.error('❌ Server error:', error);
		console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
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