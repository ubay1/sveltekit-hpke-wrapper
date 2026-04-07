import { CipherSuite } from '@hpke/core';
import { DhkemX25519HkdfSha256 } from '@hpke/dhkem-x25519';
import { HkdfSha256, Aes128Gcm } from '@hpke/core';
import { generateKeyPair, base64ToUint8Array, uint8ArrayToBase64 } from './hpke.js';
import { seal, unseal } from './operation.js';

/**
 * HPKE Server instance with key management
 */
export interface HpkeServerInstance {
	/** Initialize server keys (call this first) */
	init: () => Promise<string>;
	/** Get server public key as base64 */
	getPublicKeyBase64: () => string;
	/** Decrypt message from client (wrapped with seal) */
	decrypt: (wrappedCiphertext: string) => Promise<string>;
	/** Encrypt message to client (wrapped with seal) */
	encrypt: (message: string, clientPublicKey: string) => Promise<string>;
}

/**
 * Server configuration options
 */
export interface HpkeServerConfig {
	/** Auto-generate keys on initialization (default: true) */
	autoGenerateKeys?: boolean;
	/** Persist keys to file for survival across restarts (default: false) */
	persistKeys?: boolean;
	/** Path to store keys file (default: process.cwd() + '/.hpke-server-keys.json') */
	keysFilePath?: string;
	/** Enable automatic key rotation (default: false) */
	rotateKeys?: boolean;
	/** Key rotation interval in milliseconds (default: 24 hours) */
	rotationIntervalMs?: number;
}

/**
 * Request context for server-side processing
 */
export interface HpkeRequestContext {
	/** Wrapped ciphertext from client (sealed) */
	wrappedCiphertext: string;
}

/**
 * Response context for server-side encryption
 */
export interface HpkeResponseContext {
	/** Wrapped ciphertext (sealed) */
	wrappedCiphertext: string;
}

interface StoredKeyPair {
	publicKeyB64: string;
	privateKeyB64: string;
	createdAt: number;
}

interface StoredKeys {
	current: StoredKeyPair;
	previous?: StoredKeyPair;
}

function createSuite() {
	return new CipherSuite({
		kem: new DhkemX25519HkdfSha256(),
		kdf: new HkdfSha256(),
		aead: new Aes128Gcm(),
	});
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
 *
 * @example With persistence and rotation
 * ```typescript
 * const server = createHpkeServer({
 *   persistKeys: true,
 *   rotateKeys: true,
 *   rotationIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
 * });
 * ```
 */
export function createHpkeServer(config: HpkeServerConfig = {}): HpkeServerInstance {
	const {
		autoGenerateKeys = true,
		persistKeys = false,
		keysFilePath,
		rotateKeys = false,
		rotationIntervalMs = 24 * 60 * 60 * 1000,
	} = config;

	let serverKeyPair: { publicKey: any; privateKey: any } | null = null;
	let previousKeyPair: { publicKey: any; privateKey: any } | null = null;

	const resolvedPath = keysFilePath || (typeof process !== 'undefined' ? process.cwd() + '/.hpke-server-keys.json' : '.hpke-server-keys.json');

	function saveKeys() {
		if (!serverKeyPair || typeof globalThis.process === 'undefined') return;
		try {
			const { readFileSync, writeFileSync } = globalThis.require('fs');
			const publicKeyRaw = new Uint8Array(Object.values(serverKeyPair.publicKey.key));
			const privateKeyRaw = new Uint8Array(Object.values(serverKeyPair.privateKey.key));

			const data: StoredKeys = {
				current: {
					publicKeyB64: uint8ArrayToBase64(publicKeyRaw),
					privateKeyB64: uint8ArrayToBase64(privateKeyRaw),
					createdAt: Date.now(),
				},
			};
			if (previousKeyPair) {
				const prevPubRaw = new Uint8Array(Object.values(previousKeyPair.publicKey.key));
				const prevPrivRaw = new Uint8Array(Object.values(previousKeyPair.privateKey.key));
				data.previous = {
					publicKeyB64: uint8ArrayToBase64(prevPubRaw),
					privateKeyB64: uint8ArrayToBase64(prevPrivRaw),
					createdAt: Date.now(),
				};
			}
			writeFileSync(resolvedPath, JSON.stringify(data, null, 2));
		} catch (err) {
			console.error('Failed to save server keys:', err);
		}
	}

	function loadKeys(): boolean {
		if (typeof globalThis.process === 'undefined') return false;
		try {
			const { readFileSync, existsSync } = globalThis.require('fs');
			if (!existsSync(resolvedPath)) return false;

			const data: StoredKeys = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
			const suite = createSuite();

			const pubBytes = base64ToUint8Array(data.current.publicKeyB64);
			const privBytes = base64ToUint8Array(data.current.privateKeyB64);

			serverKeyPair = {
				publicKey: suite.kem.importKey('raw', pubBytes.buffer as ArrayBuffer, true),
				privateKey: suite.kem.importKey('raw', privBytes.buffer as ArrayBuffer, false),
			};

			if (data.previous) {
				const prevPubBytes = base64ToUint8Array(data.previous.publicKeyB64);
				const prevPrivBytes = base64ToUint8Array(data.previous.privateKeyB64);
				previousKeyPair = {
					publicKey: suite.kem.importKey('raw', prevPubBytes.buffer as ArrayBuffer, true),
					privateKey: suite.kem.importKey('raw', prevPrivBytes.buffer as ArrayBuffer, false),
				};
			}

			return true;
		} catch {
			return false;
		}
	}

	async function generateNewKeys() {
		const keys = await generateKeyPair();

		// Rotate: current → previous
		if (serverKeyPair) {
			previousKeyPair = serverKeyPair;
		}

		serverKeyPair = {
			publicKey: keys.publicKey,
			privateKey: keys.privateKey,
		};

		if (persistKeys) {
			saveKeys();
		}
	}

	const instance: HpkeServerInstance = {
		/**
		 * Initialize server keys
		 */
		async init(): Promise<string> {
			await generateNewKeys();
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
		 * Decrypt message from client (wrapped with seal)
		 *
		 * @param wrappedCiphertext - Base64 encoded wrapped ciphertext (from seal)
		 * @returns Decrypted plaintext message
		 */
		async decrypt(wrappedCiphertext: string): Promise<string> {
			if (!serverKeyPair) {
				throw new Error('Server keys not initialized. Call init() first.');
			}

			const suite = createSuite();

			// Try current key
			try {
				return await unseal(suite, serverKeyPair.privateKey, wrappedCiphertext);
			} catch {
				// Try previous key (grace period for rotated keys)
				if (previousKeyPair) {
					try {
						return await unseal(suite, previousKeyPair.privateKey, wrappedCiphertext);
					} catch {
						// fall through
					}
				}
				throw new Error('Failed to decrypt with any available key');
			}
		},

		/**
		 * Encrypt message to client (wrapped with seal)
		 *
		 * @param message - Plaintext message to encrypt
		 * @param clientPublicKeyBase64 - Base64 encoded client public key
		 * @returns Wrapped ciphertext (sealed) that looks like random base64
		 */
		async encrypt(message: string, clientPublicKeyBase64: string): Promise<string> {
			const suite = createSuite();
			return await seal(suite, clientPublicKeyBase64, message);
		},
	};

	// Load persisted keys or generate new
	if (persistKeys && loadKeys()) {
		// Keys loaded from file
	} else if (autoGenerateKeys) {
		generateNewKeys().catch(err => {
			console.error('Failed to auto-initialize server keys:', err);
		});
	}

	// Schedule key rotation
	if (rotateKeys) {
		setInterval(() => {
			generateNewKeys().catch(err => {
				console.error('Key rotation failed:', err);
			});
		}, rotationIntervalMs);
	}

	return instance;
}
