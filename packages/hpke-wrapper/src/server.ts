import { CipherSuite } from '@hpke/core';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';
import { HkdfSha256, Aes128Gcm } from '@hpke/core';
import { generateKeyPair, base64ToUint8Array, uint8ArrayToBase64 } from './hpke.js';

/**
 * HPKE Server instance with key management
 */
export interface HpkeServerInstance {
	/** Initialize server keys (call this first) */
	init: () => Promise<string>;
	/** Get server public key as base64 */
	getPublicKeyBase64: () => string;
	/** Decrypt message from client */
	decrypt: (ciphertext: string, enc: string, clientPublicKey: string) => Promise<string>;
	/** Encrypt message to client */
	encrypt: (message: string, clientPublicKey: string) => Promise<{ ciphertext: string; enc: string }>;
}

/**
 * Server configuration options
 */
export interface HpkeServerConfig {
	/** Auto-generate keys on initialization (default: true) */
	autoGenerateKeys?: boolean;
}

/**
 * Request context for server-side processing
 */
export interface HpkeRequestContext {
	/** Encrypted ciphertext from client */
	ciphertext: string;
	/** Encapsulated key */
	enc: string;
	/** Client's public key */
	clientPublicKey: string;
}

/**
 * Response context for server-side encryption
 */
export interface HpkeResponseContext {
	/** Encrypted ciphertext */
	ciphertext: string;
	/** Encapsulated key */
	enc: string;
}

/**
 * Create HPKE server instance with key management
 *
 * @param config - Server configuration options
 * @returns HpkeServerInstance with encryption/decryption methods
 *
 * @example
 * ```typescript
 * const server = createHpkeServer();
 * 
 * // Initialize keys (async)
 * const publicKey = await server.init();
 * 
 * // In your API endpoint:
 * const decrypted = await server.decrypt(ciphertext, enc, clientPublicKey);
 * const response = await server.encrypt(responseData, clientPublicKey);
 * ```
 */
export function createHpkeServer(config: HpkeServerConfig = {}): HpkeServerInstance {
	const { autoGenerateKeys = true } = config;

	let serverKeyPair: { publicKey: any; privateKey: any } | null = null;

	const instance: HpkeServerInstance = {
		/**
		 * Initialize server keys
		 */
		async init(): Promise<string> {
			const keys = await generateKeyPair();
			serverKeyPair = {
				publicKey: keys.publicKey,
				privateKey: keys.privateKey,
			};
			return instance.getPublicKeyBase64();
		},

		/**
		 * Get server public key as base64 string
		 */
		getPublicKeyBase64(): string {
			if (!serverKeyPair) {
				throw new Error('Server keys not initialized. Call init() first.');
			}
			const publicKeyRaw = new Uint8Array(Object.values(serverKeyPair.publicKey.key));
			return uint8ArrayToBase64(publicKeyRaw);
		},

		/**
		 * Decrypt message from client
		 *
		 * @param ciphertext - Base64 encoded ciphertext
		 * @param enc - Base64 encoded encapsulated key
		 * @param clientPublicKey - Base64 encoded client public key
		 * @returns Decrypted plaintext message
		 */
		async decrypt(
			ciphertext: string,
			enc: string,
			_clientPublicKey: string
		): Promise<string> {
			if (!serverKeyPair) {
				throw new Error('Server keys not initialized. Call init() first.');
			}

			const suite = new CipherSuite({
				kem: new DhkemX25519HkdfSha256(),
				kdf: new HkdfSha256(),
				aead: new Aes128Gcm(),
			});

			const ciphertextBytes = base64ToUint8Array(ciphertext);
			const encBytes = base64ToUint8Array(enc);

			const recipient = await suite.createRecipientContext({
				recipientKey: serverKeyPair.privateKey,
				enc: encBytes,
			});

			const plaintext = await recipient.open(ciphertextBytes.buffer);
			return new TextDecoder().decode(plaintext);
		},

		/**
		 * Encrypt message to client
		 *
		 * @param message - Plaintext message to encrypt
		 * @param clientPublicKeyBase64 - Base64 encoded client public key
		 * @returns Encrypted message with base64 encoded ciphertext and enc
		 */
		async encrypt(
			message: string,
			clientPublicKeyBase64: string
		): Promise<{ ciphertext: string; enc: string }> {
			const suite = new CipherSuite({
				kem: new DhkemX25519HkdfSha256(),
				kdf: new HkdfSha256(),
				aead: new Aes128Gcm(),
			});

			const clientKeyBytes = base64ToUint8Array(clientPublicKeyBase64);
			const clientPublicKey = await suite.kem.importKey(
				'raw',
				clientKeyBytes.buffer as ArrayBuffer,
				true
			);

			const sender = await suite.createSenderContext({
				recipientPublicKey: clientPublicKey,
			});

			const encrypted = await sender.seal(new TextEncoder().encode(message));

			return {
				ciphertext: uint8ArrayToBase64(new Uint8Array(encrypted)),
				enc: uint8ArrayToBase64(new Uint8Array(sender.enc)),
			};
		},
	};

	// Auto-generate keys if enabled
	if (autoGenerateKeys) {
		instance.init().catch(err => {
			console.error('Failed to auto-initialize server keys:', err);
		});
	}

	return instance;
}
