import { hpkeServer } from '$lib/hpke-server-instance.js';

export async function POST({ request }: { request: Request }) {
	try {
		const body = await request.json();
		const { ciphertext, enc, clientPublicKey } = body;

		if (!ciphertext || !enc || !clientPublicKey) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

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

		// Encrypt response
		const responseData = JSON.stringify({
			success: true,
			data: apiData,
			serverMessage: 'Data has been encrypted on server'
		});

		const encryptedResponse = await hpkeServer.encrypt(responseData, clientPublicKey);

		return new Response(
			JSON.stringify(encryptedResponse),
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
