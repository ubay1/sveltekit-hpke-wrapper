/**
 * Example: Using @hpke/sveltekit-wrapper in a SvelteKit app
 * 
 * This file shows how to use the package in different scenarios.
 */

// ============================================
// 1. CLIENT-SIDE USAGE
// ============================================

import {
	generateKeyPair,
	hpkeEncrypt,
	hpkeDecrypt,
	exportKeyToBase64,
	importKeyFromBase64,
	hpkeDemo
} from '@hpke/sveltekit-wrapper';

// Example 1.1: Basic encryption/decryption
async function basicExample() {
	const { publicKey, privateKey } = await generateKeyPair();
	
	const message = 'Hello World!';
	const { ciphertext, enc } = await hpkeEncrypt(message, publicKey);
	const decrypted = await hpkeDecrypt(ciphertext, enc, privateKey);
	
	console.log('Original:', message);
	console.log('Decrypted:', decrypted);
	console.log('Match:', message === decrypted);
}

// Example 1.2: Export/Import keys
async function keyExportImport() {
	const { publicKey } = await generateKeyPair();
	
	// Export to base64
	const base64 = exportKeyToBase64(publicKey);
	console.log('Exported key:', base64);
	
	// Import from base64
	const importedKey = await importKeyFromBase64(base64);
	console.log('Key imported successfully');
}

// Example 1.3: Quick demo
async function quickDemo() {
	const result = await hpkeDemo();
	console.log('Demo result:', result);
}


// ============================================
// 2. SERVER-SIDE USAGE (SvelteKit API Routes)
// ============================================

// Example 2.1: Simple API endpoint
// File: src/routes/api/hpke/+server.ts
/*
import { createHpkeEndpoint } from '@hpke/sveltekit-wrapper';

const { GET, POST } = createHpkeEndpoint();

export { GET, POST };
*/

// Example 2.2: API with custom request handler
// File: src/routes/api/hpke-advanced/+server.ts
/*
import { createHpkeEndpoint } from '@hpke/sveltekit-wrapper';

const { GET, POST } = createHpkeEndpoint({
	onRequest: async (decryptedData, request) => {
		// Process the decrypted request
		console.log('Received decrypted data:', decryptedData);
		
		// Call external API or database
		const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(decryptedData)
		});
		
		const data = await response.json();
		
		// Return data (will be encrypted automatically)
		return {
			success: true,
			data,
			timestamp: new Date().toISOString()
		};
	},
	
	onError: async (error, request) => {
		console.error('HPKE Error:', error);
		
		return new Response(
			JSON.stringify({
				error: 'Processing failed',
				message: error.message
			}),
			{ status: 500 }
		);
	}
});

export { GET, POST };
*/

// Example 2.3: Manual server control
// File: src/routes/api/hpke-manual/+server.ts
/*
import { createHpkeServer } from '@hpke/sveltekit-wrapper';
import type { RequestHandler } from '@sveltejs/kit';

const server = createHpkeServer({ autoGenerateKeys: true });

export const GET: RequestHandler = async () => {
	return new Response(
		JSON.stringify({
			publicKey: server.getPublicKeyBase64(),
			algorithm: 'X25519-HKDF-SHA256'
		}),
		{ headers: { 'Content-Type': 'application/json' } }
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { ciphertext, enc, clientPublicKey } = body;
	
	// Decrypt
	const decrypted = await server.decrypt(ciphertext, enc, clientPublicKey);
	const data = JSON.parse(decrypted);
	
	// Process
	const result = { success: true, data };
	
	// Encrypt response
	const encrypted = await server.encrypt(JSON.stringify(result), clientPublicKey);
	
	return new Response(
		JSON.stringify(encrypted),
		{ headers: { 'Content-Type': 'application/json' } }
	);
};
*/


// ============================================
// 3. COMPLETE CLIENT-SERVER FLOW
// ============================================

async function completeFlowExample() {
	// Simulate server public key fetch
	const serverPublicKeyBase64 = 'example-base64-key';
	
	// Step 1: Import server's public key
	const serverPublicKey = await importKeyFromBase64(serverPublicKeyBase64);
	
	// Step 2: Generate client key pair
	const { publicKey: clientPublicKey, privateKey: clientPrivateKey, publicKeyRaw } = await generateKeyPair();
	const clientPublicKeyBase64 = exportKeyToBase64(clientPublicKey);
	
	// Step 3: Encrypt request
	const requestData = {
		title: 'Encrypted Request',
		body: 'This data is encrypted end-to-end',
		userId: 1
	};
	
	const { ciphertext, enc } = await hpkeEncrypt(
		JSON.stringify(requestData),
		serverPublicKey
	);
	
	// Step 4: Send to server (simulated)
	// In real app: const response = await fetch('/api/hpke', { ... })
	// For now, we'll simulate the response
	
	// Step 5: Decrypt server response (simulated)
	// const response = await response.json();
	// const decryptedResponse = await hpkeDecrypt(
	//   response.ciphertext,
	//   response.enc,
	//   clientPrivateKey
	// );
	
	console.log('Flow completed!');
}


// ============================================
// 4. ERROR HANDLING
// ============================================

async function errorHandlingExample() {
	try {
		const { publicKey, privateKey } = await generateKeyPair();
		const { ciphertext, enc } = await hpkeEncrypt('Test', publicKey);
		const decrypted = await hpkeDecrypt(ciphertext, enc, privateKey);
		
		console.log('Success:', decrypted);
	} catch (error) {
		console.error('Encryption failed:', error);
		
		if (error instanceof Error) {
			console.error('Error message:', error.message);
			console.error('Stack:', error.stack);
		}
	}
}


// ============================================
// 5. CUSTOM ALGORITHM
// ============================================

import { createHpkeSuiteChaCha20 } from '@hpke/sveltekit-wrapper';

async function chaCha20Example() {
	const suite = createHpkeSuiteChaCha20();
	const keyPair = await suite.kem.generateKeyPair();
	
	// Use the suite for encryption
	const sender = await suite.createSenderContext({
		recipientPublicKey: keyPair.publicKey
	});
	
	const encrypted = await sender.seal(
		new TextEncoder().encode('ChaCha20 encrypted!')
	);
	
	console.log('ChaCha20 encryption successful!');
}


// ============================================
// EXPORTS FOR TESTING
// ============================================

export {
	basicExample,
	keyExportImport,
	quickDemo,
	completeFlowExample,
	errorHandlingExample,
	chaCha20Example
};
