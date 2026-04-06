# @ubay182/sveltekit-hpke-wrapper

HPKE (Hybrid Public Key Encryption) wrapper for SvelteKit applications with end-to-end encryption support.

## 🚀 Features

- ✅ **Complete HPKE Implementation** — RFC 9180 compliant
- ✅ **End-to-End Encryption** — Client ↔ Server encryption
- ✅ **SvelteKit Integration** — Ready-to-use API endpoint creators
- ✅ **TypeScript Support** — Full type definitions
- ✅ **X25519 Key Exchange** — Elliptic curve Diffie-Hellman
- ✅ **AES-128-GCM & ChaCha20-Poly1305** — Authenticated encryption
- ✅ **Key Persistence** — Keys survive server restart (saved to file)
- ✅ **Key Rotation** — Auto-rotate keys with grace period for in-flight messages
- ✅ **Cookie Delivery** — Server public key delivered via cookie, no extra API call
- ✅ **API Key Auth** — Built-in authentication middleware
- ✅ **Rate Limiting** — Per-IP request limiting to prevent abuse

## 📦 Installation

```bash
npm install @ubay182/sveltekit-hpke-wrapper
# or
pnpm add @ubay182/sveltekit-hpke-wrapper
```

## 🎯 Quick Start

### 1. Server Setup (Auto-Generate Keys + Cookie)

Keys are generated at server startup and the public key is sent as a cookie — no separate API call needed.

```typescript
// src/lib/hpke-server-instance.ts
import { createHpkeServer, type HpkeServerInstance } from '@ubay182/sveltekit-hpke-wrapper';

// Auto-generate keys, persist to file, rotate every 24h
export const hpkeServer: HpkeServerInstance = createHpkeServer({
	autoGenerateKeys: true,
	persistKeys: true, // Save keys to .hpke-server-keys.json
	rotateKeys: true, // Auto-rotate every 24h
	rotationIntervalMs: 24 * 60 * 60 * 1000
});
```

```typescript
// src/hooks.server.ts
import { hpkeServer } from '$lib/hpke-server-instance';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	try {
		const publicKey = hpkeServer.getPublicKeyBase64();
		const headers = new Headers(response.headers);

		headers.append(
			'Set-Cookie',
			`hpke_server_public_key=${encodeURIComponent(publicKey)}; Path=/; SameSite=Lax`
		);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	} catch {
		// Keys not ready yet — skip cookie
	}

	return response;
};
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

### 2. Client-Side (Svelte Component)

Keys are auto-setup on page load — server key from cookie, client key generated. No extra API call needed.

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

	// Auto-setup on mount
	async function initKeys() {
		// Read server public key from cookie
		const cookie = document.cookie
			.split('; ')
			.find((row) => row.startsWith('hpke_server_public_key='));

		const publicKeyB64 = decodeURIComponent(cookie.split('=')[1]);
		const keyBytes = base64ToUint8Array(publicKeyB64);
		const suite = createHpkeSuite();
		serverPubKey = await suite.kem.importKey('raw', keyBytes.buffer as ArrayBuffer, true);

		// Generate client key pair
		const keys = await generateKeyPair();
		clientPrivKey = keys.privateKey;
		clientPubKeyB64 = uint8ArrayToBase64(keys.publicKeyRaw);
	}

	initKeys();

	// Encrypt & send
	async function encryptAndSend(payload: any) {
		const result = await hpkeEncrypt(JSON.stringify(payload), serverPubKey);

		const ciphertext = uint8ArrayToBase64(new Uint8Array(result.ciphertext));
		const enc = uint8ArrayToBase64(new Uint8Array(result.enc));

		// Combine into single encrypted string
		const encrypted = btoa(
			JSON.stringify({
				ciphertext,
				enc,
				clientPublicKey: clientPubKeyB64
			})
		);

		const res = await fetch('/api/hpke-proxy', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ encrypted })
		});

		const data = await res.json();
		// Decode response
		const resPayload = JSON.parse(atob(data.encrypted));
		return resPayload; // { ciphertext, enc }
	}

	// Decrypt response
	async function decryptResponse(data: { ciphertext: string; enc: string }) {
		const ct = base64ToUint8Array(data.ciphertext);
		const enc = base64ToUint8Array(data.enc);
		return await hpkeDecrypt(ct.buffer, enc.buffer, clientPrivKey);
	}
</script>
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
	persistKeys?: boolean; // Save keys to file (default: false)
	keysFilePath?: string; // Custom path (default: cwd + '/.hpke-server-keys.json')
	rotateKeys?: boolean; // Auto-rotate keys (default: false)
	rotationIntervalMs?: number; // Rotation interval (default: 24h)
}

interface HpkeServerInstance {
	init(): Promise<string>; // Generate keys, return public key as base64
	getPublicKeyBase64(): string;
	decrypt(ciphertext: string, enc: string, clientPublicKey: string): Promise<string>;
	encrypt(message: string, clientPublicKey: string): Promise<{ ciphertext: string; enc: string }>;
}
```

**Key Persistence**: When `persistKeys: true`, keys are saved to `.hpke-server-keys.json` and reloaded on restart.

**Key Rotation**: When `rotateKeys: true`, new keys are generated automatically. The old key is kept as "previous" for a grace period, so in-flight encrypted messages can still be decrypted.

### SvelteKit Integration

#### `createHpkeEndpoint(config?)`

Create complete GET/POST handlers for a SvelteKit route.

```typescript
const { GET, POST } = createHpkeEndpoint({
	onRequest: async (decryptedData, request) => {
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
  │  ◄── Page load ──────────────│
  │     (cookie set auto)        │  Keys generated at startup
  │                               │
  ├─── Read cookie ──────────────│  (no API call needed)
  ├─── generateKeyPair() ────────│  (auto on mount)
  │                               │
  ├─── hpkeEncrypt(payload) ────│
  │                               │
  ├─── POST { encrypted: "..." }─>│
  │                               │
  │                               ├─── decrypt() ──┐
  │                               │                 │
  │                               │<── Process ─────┘
  │                               │                 │
  │                               │<── encrypt() ───┘
  │                               │
  │<──── { encrypted: "..." } ───│
  │                               │
  └─── hpkeDecrypt(response) ────┘
```

## 🔐 Security Notes

This library includes built-in security features:

- ✅ **HPKE Encryption** — RFC 9180 compliant (X25519 + AES-128-GCM)
- ✅ **Key Persistence** — Keys saved to file, survive restarts
- ✅ **Key Rotation** — Auto-rotate with grace period for in-flight messages
- ✅ **API Key Auth** — `x-api-key` header validation
- ✅ **Rate Limiting** — Per-IP request limiting
- ✅ **Secure Cookies** — `Secure` flag auto-added in production

⚠️ **For production handling sensitive data**, also consider:

1. **Key Storage** — Use HSM, AWS KMS, or Azure Key Vault instead of file storage
2. **HTTPS** — Always use HTTPS in production
3. **Distributed Rate Limiting** — Use Redis for multi-instance deployments
4. **Audit Logging** — Log all requests for compliance
5. **Request Size Limits** — Validate payload sizes
6. **Security Audit** — Have security audits performed

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
