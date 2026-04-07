# HPKE Package - Complete Documentation

Complete guide for **@ubay182/sveltekit-hpke-wrapper** - HPKE (Hybrid Public Key Encryption) for SvelteKit with end-to-end encryption and seal/unseal obfuscation.

## 📦 Installation

```bash
npm install @ubay182/sveltekit-hpke-wrapper
# or
pnpm add @ubay182/sveltekit-hpke-wrapper
```

## 🚀 Features

✅ **Complete HPKE Implementation** — RFC 9180 compliant  
✅ **End-to-End Encryption** — Client ↔ Server encryption  
✅ **Seal/Unseal Obfuscation** — Hide HPKE structure with wrapped ciphertext  
✅ **X25519 Key Exchange** — Elliptic curve Diffie-Hellman  
✅ **AES-128-GCM & ChaCha20-Poly1305** — Authenticated encryption  
✅ **Key Persistence** — Keys survive server restart (saved to file)  
✅ **Key Rotation** — Auto-rotate keys with grace period  
✅ **API Key Auth** — Built-in authentication middleware  
✅ **Rate Limiting** — Per-IP request limiting  
✅ **TypeScript Support** — Full type definitions

---

## 📚 API Functions

### Core HPKE Functions

#### `generateKeyPair()`

Generate a new HPKE key pair.

```typescript
async function generateKeyPair(): Promise<{
	publicKey: any; // XCryptoKey
	privateKey: any; // XCryptoKey
	publicKeyRaw: Uint8Array; // Raw bytes for transmission
}>;
```

**Example:**

```typescript
const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();
```

---

#### `hpkeEncrypt(message, recipientPublicKey)`

Encrypt a message. Returns `{ ciphertext, enc }`.

```typescript
async function hpkeEncrypt(
	message: string,
	recipientPublicKey: any
): Promise<{
	ciphertext: ArrayBuffer;
	enc: ArrayBuffer;
}>;
```

**Example:**

```typescript
const { ciphertext, enc } = await hpkeEncrypt('Secret message', serverPublicKey);
```

---

#### `hpkeDecrypt(ciphertext, enc, recipientPrivateKey)`

Decrypt a message. Returns plaintext string.

```typescript
async function hpkeDecrypt(
	ciphertext: ArrayBuffer,
	enc: Uint8Array | ArrayBuffer,
	recipientPrivateKey: any
): Promise<string>;
```

**Example:**

```typescript
const decrypted = await hpkeDecrypt(ciphertext, enc, privateKey);
```

---

#### `createHpkeSuite()`

Create an HPKE suite with AES-128-GCM.

```typescript
function createHpkeSuite(): CipherSuite;
```

**Example:**

```typescript
const suite = createHpkeSuite();
const keyPair = await suite.kem.generateKeyPair();
const importedKey = await suite.kem.importKey('raw', keyBytes.buffer, true);
```

---

#### `createHpkeSuiteChaCha20()`

Create an HPKE suite with ChaCha20-Poly1305.

```typescript
function createHpkeSuiteChaCha20(): CipherSuite;
```

**Example:**

```typescript
const suite = createHpkeSuiteChaCha20();
```

---

#### `exportKeyToBase64(publicKey)`

Export a public key to base64 string.

```typescript
function exportKeyToBase64(publicKey: any): string;
```

**Example:**

```typescript
const b64 = exportKeyToBase64(publicKey);
// Returns: "QMcbC0m8H6K8oTonPrrQ1rLH+6MF12fuHWulugTCXUo="
```

---

#### `importKeyFromBase64(base64)`

Import a public key from base64 string.

```typescript
async function importKeyFromBase64(base64: string): Promise<any>;
```

**Example:**

```typescript
const publicKey = await importKeyFromBase64(base64String);
```

---

#### `uint8ArrayToBase64(data)` / `base64ToUint8Array(base64)`

Utility functions for encoding/decoding.

```typescript
function uint8ArrayToBase64(data: Uint8Array): string;
function base64ToUint8Array(base64: string): Uint8Array;
```

**Example:**

```typescript
const b64 = uint8ArrayToBase64(bytes);
const bytes = base64ToUint8Array(b64);
```

---

### Seal/Unseal Functions (Recommended)

Seal/unseal provides **obfuscated encryption** that hides the HPKE structure. Instead of exposing separate `ciphertext` and `enc` fields, everything is wrapped into a single string that appears to be random base64.

#### `seal(suite, publicKeyB64, plainText)`

Encrypt and wrap a message. Returns a single wrapped string.

```typescript
async function seal(suite: CipherSuite, publicKeyB64: string, plainText: string): Promise<string>;
```

**Example:**

```typescript
import {
	seal,
	createHpkeSuite,
	exportKeyToBase64
} from '@ubay182/sveltekit-hpke-wrapper/operation';

const suite = createHpkeSuite();
const serverPublicKeyB64 = exportKeyToBase64(serverPublicKey);

// Returns: "x7k2mSGVsbG8gV29ybGQ...x7k2m0" (obfuscated)
const wrappedCiphertext = await seal(suite, serverPublicKeyB64, 'Secret message');
```

**Benefits:**

- 🔒 **Obfuscation**: No visible HPKE structure (ciphertext + enc)
- 📦 **Simplified**: Single string instead of multiple fields
- 🎲 **Random prefix/suffix**: Adds extra obfuscation layer
- 🚀 **Easy to use**: One field to pass in JSON/HTTP headers

---

#### `unseal(suite, privateKeyB64, wrappedCiphertext)`

Decrypt and unwrap a wrapped message.

```typescript
async function unseal(
	suite: CipherSuite,
	privateKeyB64: string,
	wrappedCiphertext: string
): Promise<string>;
```

**Example:**

```typescript
import { unseal, createHpkeSuite } from '@ubay182/sveltekit-hpke-wrapper/operation';

const suite = createHpkeSuite();
const privateKeyJWK = await suite.kem.exportKey('jwk', clientPrivateKey);
const privateKeyB64 = btoa(JSON.stringify(privateKeyJWK));

// Returns: "Secret message"
const decrypted = await unseal(suite, privateKeyB64, wrappedCiphertext);
```

**How it works:**

```
Sealed Format:
┌─────────────┬──────────────────────────────┬─────────────┬────────┐
│ 5-char      │ Base64(header +              │ 5-char      │ Padding│
│ prefix      │ ciphertext + enc)            │ suffix      │ count  │
│ (random)    │                              │ (= prefix)  │ (0-2)  │
└─────────────┴──────────────────────────────┴─────────────┴────────┘

Example: "x7k2m" + "SGVsbG8gV29ybGQ=..." + "x7k2m" + "0"
```

**Internal Structure (after unwrapping):**

```
Base64(header + ciphertext + enc)
  ↓
[headerSize (1 byte)] + [header (ciphertext size)] + [ciphertext] + [encapsulated key]
```

---

### Server Functions

#### `createHpkeServer(config?)`

Create an HPKE server instance with key management. **Automatically uses seal/unseal** for encryption/decryption.

```typescript
interface HpkeServerConfig {
	autoGenerateKeys?: boolean; // Default: true
	persistKeys?: boolean; // Save keys to file (default: false)
	keysFilePath?: string; // Custom path (default: cwd + '/.hpke-server-keys.json')
	rotateKeys?: boolean; // Auto-rotate keys (default: false)
	rotationIntervalMs?: number; // Rotation interval (default: 24h)
}

interface HpkeServerInstance {
	init(): Promise<string>; // Generate keys, return public key
	getPublicKeyBase64(): string; // Get server public key
	decrypt(wrappedCiphertext: string): Promise<string>; // Auto-unseals
	encrypt(message: string, clientPublicKey: string): Promise<string>; // Auto-seals
}
```

**Example:**

```typescript
import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper/server';

const server = createHpkeServer({
	persistKeys: true,
	rotateKeys: true,
	rotationIntervalMs: 24 * 60 * 60 * 1000 // 24 hours
});

// Initialize
const publicKey = await server.init();

// Decrypt client request (auto-unseals)
const decrypted = await server.decrypt(wrappedCiphertext);

// Encrypt response to client (auto-seals)
const wrappedResponse = await server.encrypt('Response data', clientPublicKeyB64);
```

**Key Persistence**: When `persistKeys: true`, keys are saved to `.hpke-server-keys.json` and reloaded on restart.

**Key Rotation**: When `rotateKeys: true`, new keys are generated automatically. The old key is kept as "previous" for a grace period, so in-flight encrypted messages can still be decrypted.

---

## 🔄 Encryption Flows

### 1. Standard HPKE Flow (Low-Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     STANDARD HPKE FLOW                               │
└─────────────────────────────────────────────────────────────────────┘

CLIENT                              SERVER                           API
  │                                   │                               │
  │──── GET /api/hpke-keys ─────────>│                               │
  │                                   │                               │
  │<──── Server Public Key (raw) ────│                               │
  │                                   │                               │
  │─── Generate Client Key Pair ─────│                               │
  │                                   │                               │
  │─── hpkeEncrypt(payload) ─────────│                               │
  │   Returns: { ciphertext, enc }   │                               │
  │                                   │                               │
  │──── POST { ciphertext, enc, ────>│                               │
  │         clientPublicKey }        │                               │
  │                                   │                               │
  │                                   │─── hpkeDecrypt() ────────────│
  │                                   │   (with server private key)   │
  │                                   │                               │
  │                                   │─── Call External API ───────>│
  │                                   │   POST /posts                 │
  │                                   │                               │
  │                                   │<──────── API Response ───────┤
  │                                   │   { id, title, body, ... }   │
  │                                   │                               │
  │                                   │─── hpkeEncrypt() ───────────│
  │                                   │   (with client public key)    │
  │                                   │   Returns: { ciphertext, enc }│
  │                                   │                               │
  │<──── { ciphertext, enc } ────────│                               │
  │                                   │                               │
  │─── hpkeDecrypt(response) ────────│                               │
  │   (with client private key)      │                               │
  │                                   │                               │
  └─── ✅ Display Decrypted Data ────┘                               │
```

**Data Format:**

```json
// Request
{
  "ciphertext": "IZ8VQlMQ...",
  "enc": "QsjTuAUU...",
  "clientPublicKey": "abc123..."
}

// Response
{
  "ciphertext": "XYZ789...",
  "enc": "DEF456..."
}
```

**Pros:**

- Full control over encryption parameters
- Access to raw ciphertext and encapsulated key
- Useful for custom protocols

**Cons:**

- ❌ Exposes HPKE structure
- ❌ Multiple fields to manage
- ❌ More error-prone

---

### 2. Seal/Unseal Flow (Recommended)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SEALED ENCRYPTION FLOW                           │
└─────────────────────────────────────────────────────────────────────┘

CLIENT                              SERVER                           API
  │                                   │                               │
  │──── GET /api/hpke-keys ─────────>│                               │
  │                                   │                               │
  │<──── Server Public Key (b64) ────│                               │
  │                                   │                               │
  │─── Generate Client Key Pair ─────│                               │
  │                                   │                               │
  │─── seal(suite, pubKey, msg) ─────│                               │
  │   Returns: "x7k2m...x7k2m0"      │                               │
  │                                   │                               │
  │──── POST { wrappedCiphertext, ──>│                               │
  │         clientPublicKey }        │                               │
  │                                   │                               │
  │                                   │─── decrypt() ────────────────│
  │                                   │   (auto-unseals)              │
  │                                   │                               │
  │                                   │─── Call External API ───────>│
  │                                   │   POST /posts                 │
  │                                   │                               │
  │                                   │<──────── API Response ───────┤
  │                                   │   { id, title, body, ... }   │
  │                                   │                               │
  │                                   │─── encrypt() ───────────────│
  │                                   │   (auto-seals)                │
  │                                   │   Returns: "p9q3r...p9q3r0"  │
  │                                   │                               │
  │<──── { wrappedCiphertext } ──────│                               │
  │                                   │                               │
  │─── unseal(suite, privKey, ───────│                               │
  │         wrappedCiphertext)       │                               │
  │                                   │                               │
  └─── ✅ Display Decrypted Data ────┘                               │
```

**Data Format:**

```json
// Request
{
  "wrappedCiphertext": "x7k2mSGVsbG8gV29ybGQ...x7k2m0",
  "clientPublicKey": "abc123..."
}

// Response
{
  "wrappedCiphertext": "p9q3rXYZ789...DEF456...p9q3r0"
}
```

**Pros:**

- ✅ **Obfuscation**: No visible HPKE structure
- ✅ **Simplified**: Single string field
- ✅ **Random prefix/suffix**: Extra obfuscation
- ✅ **Easier to use**: Less error-prone

**Cons:**

- Slightly more overhead (minimal)
- Less control over internals

---

### 3. Comparison: Standard vs Sealed

| Aspect             | Standard HPKE        | Sealed HPKE                |
| ------------------ | -------------------- | -------------------------- |
| **Fields**         | `ciphertext` + `enc` | Single `wrappedCiphertext` |
| **Visibility**     | Structure visible    | Random gibberish           |
| **Complexity**     | Higher               | Lower                      |
| **Obfuscation**    | ❌ None              | ✅ Random prefix/suffix    |
| **Use Case**       | Custom protocols     | General API                |
| **Recommendation** | Advanced users       | ✅ **Recommended**         |

---

## 💻 Complete Usage Examples

### Example 1: Basic Local Encryption

```typescript
import { generateKeyPair, hpkeEncrypt, hpkeDecrypt } from '@ubay182/sveltekit-hpke-wrapper';

// Generate keys
const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();

// Encrypt
const message = 'Hello HPKE!';
const { ciphertext, enc } = await hpkeEncrypt(message, publicKey);

// Decrypt
const decrypted = await hpkeDecrypt(ciphertext, enc, privateKey);

console.log('Original:', message);
console.log('Decrypted:', decrypted);
console.log('Match:', message === decrypted); // true
```

---

### Example 2: Seal/Unseal (Recommended)

```typescript
import {
	seal,
	unseal,
	createHpkeSuite,
	exportKeyToBase64,
	generateKeyPair
} from '@ubay182/sveltekit-hpke-wrapper';

// 1. Create suite and generate keys
const suite = createHpkeSuite();
const { publicKey, privateKey } = await generateKeyPair();
const publicKeyB64 = exportKeyToBase64(publicKey);

// 2. Seal (encrypt with obfuscation)
const message = 'Secret message with obfuscation';
const wrappedCiphertext = await seal(suite, publicKeyB64, message);

console.log('Sealed:', wrappedCiphertext);
// Output: "x7k2mSGVsbG8gV29ybGQ...x7k2m0"

// 3. Unseal (decrypt)
const privateKeyJWK = await suite.kem.exportKey('jwk', privateKey);
const privateKeyB64 = btoa(JSON.stringify(privateKeyJWK));
const decrypted = await unseal(suite, privateKeyB64, wrappedCiphertext);

console.log('Decrypted:', decrypted);
console.log('Match:', message === decrypted); // true
```

---

### Example 3: Client-Server End-to-End Encryption

```typescript
import {
	seal,
	unseal,
	createHpkeSuite,
	exportKeyToBase64,
	generateKeyPair
} from '@ubay182/sveltekit-hpke-wrapper';

// ===== CLIENT SIDE =====

// 1. Get server public key (from cookie or API)
const keyResponse = await fetch('/api/hpke-keys');
const { publicKey: serverPublicKeyBase64 } = await keyResponse.json();

// 2. Create suite and generate client keys
const suite = createHpkeSuite();
const { publicKey: clientPublicKey, privateKey: clientPrivateKey } = await generateKeyPair();
const clientPublicKeyB64 = exportKeyToBase64(clientPublicKey);

// 3. Seal request
const requestData = JSON.stringify({
	title: 'Hello',
	body: 'World'
});
const wrappedRequest = await seal(suite, serverPublicKeyBase64, requestData);

// 4. Send to server
const response = await fetch('/api/hpke-proxy', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		wrappedCiphertext: wrappedRequest,
		clientPublicKey: clientPublicKeyB64
	})
});

const { wrappedCiphertext: wrappedResponse } = await response.json();

// 5. Unseal response
const clientPrivateKeyJWK = await suite.kem.exportKey('jwk', clientPrivateKey);
const clientPrivateKeyB64 = btoa(JSON.stringify(clientPrivateKeyJWK));
const decryptedResponse = await unseal(suite, clientPrivateKeyB64, wrappedResponse);

console.log('Decrypted Response:', JSON.parse(decryptedResponse));

// ===== SERVER SIDE =====
// (In API endpoint /api/hpke-proxy)

import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper/server';

const server = createHpkeServer({
	persistKeys: true,
	rotateKeys: true
});

// Initialize server keys
const serverPublicKey = await server.init();

// In request handler:
async function handleRequest(wrappedCiphertext: string, clientPublicKeyB64: string) {
	// 1. Decrypt client request (auto-unseals)
	const decryptedRequest = await server.decrypt(wrappedCiphertext);
	const requestData = JSON.parse(decryptedRequest);

	// 2. Process request (call external API)
	const apiResponse = await fetch('https://jsonplaceholder.typicode.com/posts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: decryptedRequest
	});
	const responseData = await apiResponse.json();

	// 3. Encrypt response (auto-seals)
	const wrappedResponse = await server.encrypt(JSON.stringify(responseData), clientPublicKeyB64);

	// 4. Return to client
	return { wrappedCiphertext: wrappedResponse };
}
```

---

### Example 4: Server with Key Persistence & Rotation

```typescript
import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper/server';

// Create server with persistence and rotation
const server = createHpkeServer({
	persistKeys: true, // Save keys to file
	keysFilePath: '/secure/path/.keys', // Custom path (optional)
	rotateKeys: true, // Auto-rotate keys
	rotationIntervalMs: 24 * 60 * 60 * 1000 // 24 hours
});

// Initialize (generate or load existing keys)
const publicKey = await server.init();

console.log('Server public key:', publicKey);

// Keys are automatically saved to .hpke-server-keys.json
// On restart, keys will be loaded from file
// Every 24 hours, keys are rotated (old key can still decrypt for grace period)
```

---

### Example 5: Using ChaCha20-Poly1305

```typescript
import {
	seal,
	unseal,
	createHpkeSuiteChaCha20,
	exportKeyToBase64,
	generateKeyPair
} from '@ubay182/sveltekit-hpke-wrapper';

// Create suite with ChaCha20-Poly1305 (instead of AES-128-GCM)
const suite = createHpkeSuiteChaCha20();

const { publicKey, privateKey } = await generateKeyPair();
const publicKeyB64 = exportKeyToBase64(publicKey);

// Seal/Unseal works the same way
const wrapped = await seal(suite, publicKeyB64, 'Message with ChaCha20');
const decrypted = await unseal(
	suite,
	btoa(JSON.stringify(await suite.kem.exportKey('jwk', privateKey))),
	wrapped
);
```

---

### Example 6: Complete SvelteKit Integration

```typescript
// src/routes/api/hpke-proxy/+server.ts
import { json } from '@sveltejs/kit';
import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper/server';

// Create singleton server instance
const hpkeServer = createHpkeServer({
	persistKeys: true,
	rotateKeys: true
});

// Initialize on first load
let initialized = false;

export async function POST({ request }) {
	// Initialize if needed
	if (!initialized) {
		await hpkeServer.init();
		initialized = true;
	}

	try {
		// Parse request
		const { wrappedCiphertext, clientPublicKey } = await request.json();

		// Decrypt client request
		const decryptedRequest = await hpkeServer.decrypt(wrappedCiphertext);
		const requestData = JSON.parse(decryptedRequest);

		// Process request (call external API)
		const apiResponse = await fetch('https://api.example.com/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: decryptedRequest
		});
		const responseData = await apiResponse.json();

		// Encrypt response
		const wrappedResponse = await hpkeServer.encrypt(JSON.stringify(responseData), clientPublicKey);

		// Return encrypted response
		return json({ wrappedCiphertext: wrappedResponse });
	} catch (error) {
		console.error('HPKE Proxy Error:', error);
		return json({ error: 'Failed to process request' }, { status: 500 });
	}
}
```

---

## 🔐 Security Notes

### What's Included

✅ **HPKE Encryption** — RFC 9180 compliant (X25519 + AES-128-GCM)  
✅ **Seal/Unseal Obfuscation** — Hides encrypted data structure  
✅ **Key Persistence** — Keys saved to file, survive restarts  
✅ **Key Rotation** — Auto-rotate with grace period for in-flight messages  
✅ **API Key Auth** — `x-api-key` header validation  
✅ **Rate Limiting** — Per-IP request limiting  
✅ **Secure Cookies** — `Secure` flag auto-added in production

### Production Recommendations

⚠️ **For production handling sensitive data**, also consider:

1. **Key Storage** — Use HSM, AWS KMS, or Azure Key Vault (instead of file)
2. **HTTPS** — Always use HTTPS in production
3. **Distributed Rate Limiting** — Use Redis for multi-instance deployments
4. **Audit Logging** — Log all requests for compliance
5. **Request Size Limits** — Validate payload sizes
6. **Security Audit** — Have security audits performed

---

## 🛠️ Development

```bash
# Build package
npm run build

# Type check
npm run lint

# Watch mode
npm run dev

# Run tests
npm test
```

---

## 📊 Algorithm Configuration

```typescript
{
  kem: DhkemX25519HkdfSha256,   // X25519 Elliptic Curve DH
  kdf: HkdfSha256,               // HKDF with SHA-256
  aead: Aes128Gcm                // AES-128-GCM authenticated encryption
}
```

**Alternative AEAD:**

- `Chacha20Poly1305` — For ChaCha20-Poly1305 (better for mobile)

---

## ⚠️ Important Notes

### XCryptoKey vs CryptoKey

**Important**: HPKE library (`@hpke/core`) uses a special key format called **XCryptoKey**, not the standard `CryptoKey` from Web Crypto API.

```typescript
// ❌ WRONG - Don't use Web Crypto API with HPKE keys
const jwk = await crypto.subtle.exportKey('jwk', hpkeKey);

// ✅ CORRECT - Use HPKE library methods
const rawBytes = new Uint8Array(Object.values(hpkeKey.key));
const b64 = uint8ArrayToBase64(rawBytes);
```

### Key Import/Export

```typescript
// Generate key pair (returns XCryptoKey)
const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();

// Export public key for transmission
const publicKeyB64 = exportKeyToBase64(publicKey);

// Import public key from base64
const importedKey = await importKeyFromBase64(publicKeyB64);
```

### Common Errors

#### 1. `Failed to execute 'exportKey' on 'SubtleCrypto'`

**Cause**: Using Web Crypto API with HPKE XCryptoKey.

**Solution**:

```typescript
// ✅ Use HPKE library method
const rawBytes = new Uint8Array(Object.values(hpkeKey.key));
```

#### 2. `"uCoordinate" expected Uint8Array of length 32`

**Cause**: Manually constructing key objects.

**Solution**:

```typescript
// ✅ Use proper import method
const key = await suite.kem.importKey('raw', keyBytes.buffer, true);
```

---

## 📚 Resources

- [RFC 9180 — HPKE Specification](https://www.rfc-editor.org/rfc/rfc9180.html)
- [hpke-js Library](https://github.com/dajiaji/hpke-js)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [X25519 Key Exchange](https://en.wikipedia.org/wiki/Curve25519)
- [AES-GCM Authenticated Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)

---

## 📄 License

MIT
