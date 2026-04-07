/**
 * HPKE (Hybrid Public Key Encryption) Wrapper
 * 
 * A complete HPKE implementation wrapper for SvelteKit applications
 * providing end-to-end encryption between client and server.
 * 
 * @packageDocumentation
 */

// Core HPKE functionality
export {
	// HPKE Suite
	createHpkeSuite,
	createHpkeSuiteChaCha20,

	// Key Management
	generateKeyPair,
	exportKeyToBase64,
	importKeyFromBase64,

	// Encryption/Decryption
	hpkeEncrypt,
	hpkeDecrypt,
	hpkeDemo,

	// Utilities
	uint8ArrayToBase64,
	base64ToUint8Array,

	// Types
	type HpkeKeyPair,
	type HpkeEncryptedMessage,
	type HpkeSuiteConfig,
} from './hpke.js';

// Server utilities
export {
	createHpkeServer,
	type HpkeServerInstance,
	type HpkeServerConfig,
	type HpkeRequestContext,
	type HpkeResponseContext,
} from './server.js';

// Seal/Unseal operations
export {
	seal,
	unseal,
} from './operation.js';

// SvelteKit helpers
export {
	createHpkeEndpoint,
	type HpkeEndpointHandlers,
	type HpkeEndpointConfig,
} from './sveltekit.js';
