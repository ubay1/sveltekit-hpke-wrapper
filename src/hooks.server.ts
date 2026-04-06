import { hpkeServer } from '$lib/hpke-server-instance.js';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	try {
		const publicKey = hpkeServer.getPublicKeyBase64();
		const headers = new Headers(response.headers);
		const isProd = process.env.NODE_ENV === 'production';

		headers.append(
			'Set-Cookie',
			`hpke_server_public_key=${encodeURIComponent(publicKey)}; Path=/; SameSite=Lax${isProd ? '; Secure' : ''}`
		);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch {
		// Keys not ready yet — skip cookie
	}

	return response;
};
