# @ubay182/sveltekit-hpke-wrapper

HPKE (Hybrid Public Key Encryption) wrapper for SvelteKit applications with end-to-end encryption support.

## 🚀 Features

- ✅ **Complete HPKE Implementation** — RFC 9180 compliant
- ✅ **End-to-End Encryption** — Client ↔ Server encryption
- ✅ **Seal/Unseal Obfuscation** — Hide HPKE structure with wrapped ciphertext
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

See a complete working example here: [src/routes/+page.svelte](https://github.com/ubay1/sveltekit-hpke-wrapper/blob/main/src/routes/%2Bpage.svelte)

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

**Example:**

```typescript
const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();
```

---

#### `hpkeEncrypt(message, recipientPublicKey)`

Encrypt a message. Returns `{ ciphertext: ArrayBuffer, enc: ArrayBuffer }`.

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

Export public key to base64 string.

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

Import public key from base64 string.

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

### Seal/Unseal Functions

The seal/unseal functionality provides **obfuscated encryption** that hides the HPKE structure. Instead of exposing separate `ciphertext` and `enc` fields, it wraps everything into a single string that looks like random base64.

#### `seal(suite, publicKeyB64, plainText)`

Encrypt and wrap a message. Returns a single wrapped string.

```typescript
async function seal(suite: CipherSuite, publicKeyB64: string, plainText: string): Promise<string>;
```

**Example:**

```typescript
import { seal, createHpkeSuite, exportKeyToBase64 } from '@ubay182/sveltekit-hpke-wrapper';

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
import { unseal, createHpkeSuite } from '@ubay182/sveltekit-hpke-wrapper';

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

**Key Persistence**: When `persistKeys: true`, keys are saved to `.hpke-server-keys.json` and reloaded on restart.

**Key Rotation**: When `rotateKeys: true`, new keys are generated automatically. The old key is kept as "previous" for a grace period, so in-flight encrypted messages can still be decrypted.

**Example:**

```typescript
import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper';

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

---

### SvelteKit Integration

#### `createHpkeEndpoint(config?)`

Create complete GET/POST handlers for a SvelteKit route. This is the easiest way to integrate HPKE into your SvelteKit app.

```typescript
interface HpkeEndpointConfig extends HpkeServerConfig {
	onRequest?: (decrypted: any, request: Request) => Promise<any>;
	onError?: (error: Error, request: Request) => Promise<Response>;
}

function createHpkeEndpoint(config?: HpkeEndpointConfig): {
	GET: RequestHandler;
	POST: RequestHandler;
};
```

**Example:**

```typescript
// src/routes/api/hpke/+server.ts
import { createHpkeEndpoint } from '@ubay182/sveltekit-hpke-wrapper';

const { GET, POST } = createHpkeEndpoint({
	onRequest: async (decryptedData, request) => {
		// Process decrypted request
		const response = await fetch('https://api.example.com/data', {
			method: 'POST',
			body: JSON.stringify(decryptedData)
		});
		return await response.json();
	}
});

export { GET, POST };
```

**How it works:**

- **GET endpoint**: Returns server public key
- **POST endpoint**: Receives sealed data, decrypts, calls your handler, seals response

**Request Format:**

```json
{
	"data": "x7k2m<sealed ciphertext with _clientPublicKey inside>...x7k2m0"
}
```

**Response Format:**

```json
{
	"data": "p9q3r<sealed response>...p9q3r0"
}
```

**Note:** The client public key is embedded inside the sealed payload as `_clientPublicKey` field, so you only need to send the sealed ciphertext in the `data` field.

---

## 🔐 How It Works

### Standard HPKE Flow (Low-Level)

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
  │   Returns: { ciphertext, enc }│
  │                               │
  ├─── POST { ciphertext, enc, ──>│
  │         clientPublicKey }     │
  │                               │
  │                               ├─── hpkeDecrypt() ──┐
  │                               │                     │
  │                               │<── Process ─────────┘
  │                               │                     │
  │                               │<── hpkeEncrypt() ───┘
  │                               │   Returns: { ciphertext, enc }
  │<──── { ciphertext, enc } ────│
  │                               │
  └─── hpkeDecrypt(response) ────┘
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

---

### Seal/Unseal Flow (Recommended)

```
Client                          Server
  │                               │
  │  ◄── Page load ──────────────│
  │     (cookie set auto)        │  Keys generated at startup
  │                               │
  ├─── Read cookie ──────────────│  (no API call needed)
  ├─── generateKeyPair() ────────│  (auto on mount)
  │                               │
  ├─── seal(suite, pubKey, msg) ─│
  │   Returns: "x7k2m...x7k2m0"  │
  │                               │
  ├─── POST { data: sealed } ───>│
  │   (with _clientPublicKey)     │
  │                               │
  │                               ├─── decrypt() ──────┐
  │                               │  (auto-unseals)     │
  │                               │                     │
  │                               │<── Process ─────────┘
  │                               │                     │
  │                               │<── encrypt() ───────┘
  │                               │  (auto-seals)       │
  │                               │  Returns: "p9q3r..."│
  │<──── { data: sealed } ───────│
  │                               │
  └─── unseal(suite, privKey, ───┘
         sealed)
```

**Data Format:**

```json
// Request
{
  "data": "x7k2m<sealed ciphertext with _clientPublicKey>...x7k2m0"
}

// Response
{
  "data": "p9q3r<sealed response>...p9q3r0"
}
```

---

## 📊 Comparison: Standard vs Sealed

| Aspect             | Standard HPKE                            | Sealed HPKE             |
| ------------------ | ---------------------------------------- | ----------------------- |
| **Fields**         | `ciphertext` + `enc` + `clientPublicKey` | Single `data` field     |
| **Visibility**     | Structure visible                        | Random gibberish        |
| **Complexity**     | Higher                                   | Lower                   |
| **Obfuscation**    | ❌ None                                  | ✅ Random prefix/suffix |
| **Use Case**       | Custom protocols                         | General API             |
| **Recommendation** | Advanced users                           | ✅ **Recommended**      |

### Standard HPKE (Low-Level)

**Pros:**

- Full control over encryption parameters
- Access to raw ciphertext and encapsulated key
- Useful for custom protocols

**Cons:**

- Exposes HPKE structure
- Multiple fields to manage
- Easier to misuse

**Example:**

```typescript
const { ciphertext, enc } = await hpkeEncrypt(message, publicKey);
// Send: { ciphertext: "IZ8VQlMQ...", enc: "QsjTuAUU...", clientPublicKey: "abc..." }
```

### Sealed (Recommended)

**Pros:**

- 🔒 Obfuscated structure
- 📦 Single string field
- 🎲 Random prefix/suffix
- 🚀 Easier to use
- ✅ Less error-prone

**Cons:**

- Slightly more overhead (minimal)
- Less control over internals

**Example:**

```typescript
const wrapped = await seal(suite, publicKeyB64, message);
// Send: { data: "x7k2mSGVsbG8gV29ybGQ...x7k2m0" }
```

---

## 🔄 Migration Guide

### From Standard HPKE to Seal/Unseal

#### Client-Side Changes

**Before:**

```typescript
import { hpkeEncrypt, hpkeDecrypt } from '@ubay182/sveltekit-hpke-wrapper';

// Encrypt
const { ciphertext, enc } = await hpkeEncrypt(message, serverPublicKey);
const encrypted = btoa(
	JSON.stringify({
		ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
		enc: uint8ArrayToBase64(new Uint8Array(enc)),
		clientPublicKey: clientPublicKeyB64
	})
);

// Decrypt
const decrypted = await hpkeDecrypt(ciphertext, enc, clientPrivateKey);
```

**After:**

```typescript
import { seal, unseal, createHpkeSuite, exportKeyToBase64 } from '@ubay182/sveltekit-hpke-wrapper';

// Encrypt
const suite = createHpkeSuite();
const serverPubKeyB64 = exportKeyToBase64(serverPublicKey);
const wrappedCiphertext = await seal(suite, serverPubKeyB64, message);

// Decrypt
const privateKeyJWK = await suite.kem.exportKey('jwk', clientPrivateKey);
const privateKeyB64 = btoa(JSON.stringify(privateKeyJWK));
const decrypted = await unseal(suite, privateKeyB64, wrappedCiphertext);
```

#### Server-Side Changes

**Before:**

```typescript
// Decrypt
const decrypted = await server.decrypt(ciphertext, enc, clientPublicKey);

// Encrypt
const { ciphertext, enc } = await server.encrypt(message, clientPublicKey);
return { ciphertext, enc };
```

**After:**

```typescript
// Decrypt (auto-unseals)
const decrypted = await server.decrypt(wrappedCiphertext);

// Encrypt (auto-seals)
const wrappedResponse = await server.encrypt(message, clientPublicKeyB64);
return { data: wrappedResponse };
```

---

## 🧪 Complete Examples

### Example 1: Using createHpkeEndpoint (Easiest)

```typescript
// ===== SERVER SIDE =====
// src/routes/api/hpke/+server.ts
import { createHpkeEndpoint } from '@ubay182/sveltekit-hpke-wrapper';

const { GET, POST } = createHpkeEndpoint({
	persistKeys: true,
	onRequest: async (decryptedData, request) => {
		// Process decrypted request
		const response = await fetch('https://api.example.com/data', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(decryptedData)
		});
		return await response.json();
	}
});

export { GET, POST };
```

```typescript
// ===== CLIENT SIDE =====
import {
	seal,
	unseal,
	createHpkeSuite,
	exportKeyToBase64,
	generateKeyPair
} from '@ubay182/sveltekit-hpke-wrapper';

// 1. Get server public key
const keyResponse = await fetch('/api/hpke');
const { publicKey: serverPublicKeyB64 } = await keyResponse.json();

// 2. Create suite and generate client keys
const suite = createHpkeSuite();
const { publicKey, privateKey } = await generateKeyPair();
const clientPublicKeyB64 = exportKeyToBase64(publicKey);

// 3. Prepare message with client public key
const message = JSON.stringify({
	...requestData,
	_clientPublicKey: clientPublicKeyB64 // Important: embed public key
});

// 4. Seal and send
const wrappedCiphertext = await seal(suite, serverPublicKeyB64, message);
const response = await fetch('/api/hpke', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ data: wrappedCiphertext })
});

const { data: responseWrapped } = await response.json();

// 5. Unseal response
const privateKeyJWK = await suite.kem.exportKey('jwk', privateKey);
const privateKeyB64 = btoa(JSON.stringify(privateKeyJWK));
const decryptedResponse = await unseal(suite, privateKeyB64, responseWrapped);

console.log(JSON.parse(decryptedResponse));
```

---

### Example 2: Manual Server Setup

```typescript
// ===== SERVER SIDE =====
import { createHpkeServer } from '@ubay182/sveltekit-hpke-wrapper';

const server = createHpkeServer({
	persistKeys: true,
	rotateKeys: true
});

// Initialize
const publicKey = await server.init();

// In API endpoint:
async function handleRequest(wrappedCiphertext: string, clientPublicKeyB64: string) {
	// 1. Decrypt client request (auto-unseals)
	const decryptedRequest = await server.decrypt(wrappedCiphertext);
	const requestData = JSON.parse(decryptedRequest);

	// 2. Process request
	const apiResponse = await fetch('https://api.example.com/data', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: decryptedRequest
	});
	const responseData = await apiResponse.json();

	// 3. Encrypt response (auto-seals)
	const wrappedResponse = await server.encrypt(JSON.stringify(responseData), clientPublicKeyB64);

	// 4. Return to client
	return { data: wrappedResponse };
}
```

---

### Example 3: Basic Local Encryption

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

### Example 4: Seal/Unseal Only

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

## 🔐 Security Notes

This library includes built-in security features:

- ✅ **HPKE Encryption** — RFC 9180 compliant (X25519 + AES-128-GCM)
- ✅ **Seal/Unseal Obfuscation** — Hides encrypted data structure
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

---

## 🛠️ Development

```bash
# Build the package
npm run build

# Type check
npm run lint

# Watch mode
npm run dev
```

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

## 📄 License

MIT

## 📚 Resources

- [RFC 9180 — HPKE Specification](https://www.rfc-editor.org/rfc/rfc9180.html)
- [hpke-js Library](https://github.com/dajiaji/hpke-js)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Complete HPKE Guide](../../HPKE-COMPLETE-GUIDE.md)
