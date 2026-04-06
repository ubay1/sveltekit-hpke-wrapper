import { hpkeServer } from '$lib/hpke-server-instance.js';

export async function GET() {
	try {
		console.log('🔑 Generating server HPKE keys...');

		const publicKeyBase64 = await hpkeServer.init();

		console.log('✓ Server HPKE keys generated');
		console.log('  Public key:', publicKeyBase64.substring(0, 50) + '...');

		return new Response(
			JSON.stringify({
				publicKey: publicKeyBase64,
				algorithm: 'X25519-HKDF-SHA256',
				aead: 'AES-128-GCM'
			}),
			{
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		console.error('❌ Failed to generate server HPKE keys:', errorMessage);

		return new Response(
			JSON.stringify({
				error: 'Failed to generate keys',
				details: errorMessage
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
