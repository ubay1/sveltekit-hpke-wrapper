# @ubay182/sveltekit-hpke-wrapper

HPKE (Hybrid Public Key Encryption) wrapper for SvelteKit applications with end-to-end encryption support.

## 🚀 Features

- ✅ **Complete HPKE Implementation** — RFC 9180 compliant
- ✅ **End-to-End Encryption** — Client ↔ Server encryption
- ✅ **SvelteKit Integration** — Ready-to-use API endpoint creators
- ✅ **TypeScript Support** — Full type definitions
- ✅ **X25519 Key Exchange** — Elliptic curve Diffie-Hellman
- ✅ **AES-128-GCM & ChaCha20-Poly1305** — Authenticated encryption

## 📦 Installation

```bash
npm install @ubay182/sveltekit-hpke-wrapper
# or
pnpm add @ubay182/sveltekit-hpke-wrapper
```

## 🎯 Quick Start

### 1. Client-Side (Svelte Component)

```svelte
<script lang="ts">
	import {
		generateKeyPair,
		hpkeEncrypt,
		hpkeDecrypt,
		uint8ArrayToBase64,
		base64ToUint8Array,
		createHpkeSuite
	} from '@ubay182/sveltekit-hpke-wrapper';

	let serverPubKey = $state<any>(null);
	let clientPrivKey = $state<any>(null);
	let clientPubKeyB64 = $state('');
	let decryptedText = $state('');

	// Step 1: Fetch server public key
	async function getServerKey() {
		const res = await fetch('/api/hpke-keys');
		const data = await res.json();

		const keyBytes = base64ToUint8Array(data.publicKey);
		const suite = createHpkeSuite();
		serverPubKey = await suite.kem.importKey('raw', keyBytes.buffer as ArrayBuffer, true);
	}

	// Step 2: Generate client key pair
	async function generateClientKeys() {
		const keys = await generateKeyPair();
		clientPrivKey = keys.privateKey;
		clientPubKeyB64 = uint8ArrayToBase64(keys.publicKeyRaw);
	}

	// Step 3: Encrypt & send
	async function encryptAndSend(payload: any) {
		const message = JSON.stringify(payload);
		const result = await hpkeEncrypt(message, serverPubKey);

		const ciphertext = uint8ArrayToBase64(new Uint8Array(result.ciphertext));
		const enc = uint8ArrayToBase64(new Uint8Array(result.enc));

		const res = await fetch('/api/hpke-proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ciphertext, enc, clientPublicKey: clientPubKeyB64 })
		});

		const data = await res.json();
		return data; // { ciphertext, enc }
	}

	// Step 4: Decrypt server response
	async function decryptResponse(encryptedData: { ciphertext: string; enc: string }) {
		const ct = base64ToUint8Array(encryptedData.ciphertext);
		const enc = base64ToUint8Array(encryptedData.enc);

		decryptedText = await hpkeDecrypt(
			ct.buffer as ArrayBuffer,
			enc.buffer as ArrayBuffer,
			clientPrivKey
		);
	}
</script>
```

### 2. Server-Side (SvelteKit Routes)

Create a shared HPKE server instance so all routes use the same key pair:

```typescript
// src/lib/hpke-server-instance.ts
import { createHpkeServer, type HpkeServerInstance } from '@ubay182/sveltekit-hpke-wrapper';

export const hpkeServer: HpkeServerInstance = createHpkeServer({ autoGenerateKeys: false });
```

```typescript
// src/routes/api/hpke-keys/+server.ts
import { hpkeServer } from '$lib/hpke-server-instance';

export async function GET() {
	const publicKey = await hpkeServer.init();

	return new Response(
		JSON.stringify({
			publicKey,
			algorithm: 'X25519-HKDF-SHA256',
			aead: 'AES-128-GCM'
		}),
		{
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
```

```typescript
// src/routes/api/hpke-proxy/+server.ts
import { hpkeServer } from '$lib/hpke-server-instance';

export async function POST({ request }: { request: Request }) {
	const body = await request.json();
	const { ciphertext, enc, clientPublicKey } = body;

	// Decrypt client message
	const decrypted = await hpkeServer.decrypt(ciphertext, enc, clientPublicKey);

	// ... process decrypted data, call external APIs, etc. ...

	// Encrypt response
	const encrypted = await hpkeServer.encrypt(responseData, clientPublicKey);

	return new Response(JSON.stringify(encrypted), {
		headers: { 'Content-Type': 'application/json' }
	});
}
```

## 📚 API Reference

### Core Functions

#### `generateKeyPair()`

Generate a new HPKE key pair.

```typescript
async function generateKeyPair(): Promise<{
	publicKey: any; // XCryptoKey
	privateKey: any; // XCryptoKey
	publicKeyRaw: Uint8Array; // Raw bytes for transmission
}>;
```

#### `hpkeEncrypt(message, recipientPublicKey)`

Encrypt a message. Returns `{ ciphertext: ArrayBuffer, enc: ArrayBuffer }`.

```typescript
const { ciphertext, enc } = await hpkeEncrypt('Secret message', serverPublicKey);
```

#### `hpkeDecrypt(ciphertext, enc, recipientPrivateKey)`

Decrypt a message. Returns plaintext string.

```typescript
const decrypted = await hpkeDecrypt(ciphertextBuffer, encBuffer, privateKey);
```

#### `createHpkeSuite()`

Create an HPKE suite with AES-128-GCM.

```typescript
const suite = createHpkeSuite();
const keyPair = await suite.kem.generateKeyPair();
const importedKey = await suite.kem.importKey('raw', keyBytes.buffer, true);
```

#### `createHpkeSuiteChaCha20()`

Create an HPKE suite with ChaCha20-Poly1305.

```typescript
const suite = createHpkeSuiteChaCha20();
```

#### `exportKeyToBase64(publicKey)`

Export public key to base64 string.

```typescript
const b64 = exportKeyToBase64(publicKey);
```

#### `importKeyFromBase64(base64)`

Import public key from base64 string.

```typescript
const publicKey = await importKeyFromBase64(b64String);
```

#### `uint8ArrayToBase64(data)` / `base64ToUint8Array(base64)`

Utility functions for encoding/decoding.

```typescript
const b64 = uint8ArrayToBase64(bytes);
const bytes = base64ToUint8Array(b64);
```

### Server Functions

#### `createHpkeServer(config?)`

Create an HPKE server instance with key management.

```typescript
interface HpkeServerConfig {
	autoGenerateKeys?: boolean; // Default: true
}

interface HpkeServerInstance {
	init(): Promise<string>; // Generate keys, return public key as base64
	getPublicKeyBase64(): string;
	decrypt(ciphertext: string, enc: string, clientPublicKey: string): Promise<string>;
	encrypt(message: string, clientPublicKey: string): Promise<{ ciphertext: string; enc: string }>;
}
```

### SvelteKit Integration

#### `createHpkeEndpoint(config?)`

Create complete GET/POST handlers for a SvelteKit route.

```typescript
const { GET, POST } = createHpkeEndpoint({
	onRequest: async (decryptedData, request) => {
		// Process decrypted request
		return await fetch('https://api.example.com/data', {
			method: 'POST',
			body: JSON.stringify(decryptedData)
		}).then((r) => r.json());
	}
});
```

## 🔐 How It Works

```
Client                          Server
  │                               │
  ├─── GET /api/hpke-keys ──────>│
  │                               │
  │<──── Public Key (base64) ────│
  │                               │
  ├─── generateKeyPair() ────────│  (client generates its own keys)
  │                               │
  ├─── hpkeEncrypt(payload) ────│
  │                               │
  ├─── POST { ciphertext, enc, ─>│
  │       clientPublicKey }      │
  │                               │
  │                               ├─── decrypt() ──┐
  │                               │                 │
  │                               │<── Process ─────┘
  │                               │                 │
  │                               │<── encrypt() ───┘
  │                               │
  │<──── { ciphertext, enc } ────│
  │                               │
  └─── hpkeDecrypt(response) ────┘
```

## 🔐 Security Notes

⚠️ **Important**: This is a convenience wrapper library. For production:

1. **Key Storage** — Use HSM, AWS KMS, or Azure Key Vault
2. **HTTPS** — Always use HTTPS in production
3. **Authentication** — Implement proper auth mechanisms
4. **Rate Limiting** — Add rate limiting to prevent abuse
5. **Key Rotation** — Implement regular key rotation
6. **Audit** — Have security audits performed

## 🧪 Development

```bash
# Build the package
npm run build

# Type check
npm run lint

# Watch mode
npm run dev
```

## 📄 License

MIT

## 📚 Resources

- [RFC 9180 — HPKE Specification](https://www.rfc-editor.org/rfc/rfc9180.html)
- [hpke-js Library](https://github.com/dajiaji/hpke-js)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
