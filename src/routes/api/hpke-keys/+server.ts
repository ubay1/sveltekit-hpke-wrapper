import { hpkeServer } from '$lib/hpke-server-instance.js';

export async function GET() {
	try {
		const publicKeyBase64 = hpkeServer.getPublicKeyBase64();

		return new Response(
			JSON.stringify({
				publicKey: publicKeyBase64,
				algorithm: 'X25519-HKDF-SHA256',
				aead: 'AES-128-GCM'
			}),
			{
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return new Response(
			JSON.stringify({
				error: 'Server keys not ready',
				details: errorMessage
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
