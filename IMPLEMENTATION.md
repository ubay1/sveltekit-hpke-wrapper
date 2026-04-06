# HPKE Client-Server Implementation

Implementasi **HPKE (Hybrid Public Key Encryption)** end-to-end antara Client dan Server dalam aplikasi SvelteKit.

## 🎯 Fitur Utama

✅ **End-to-End Encryption** - Data terenkripsi dari client ke server dan sebaliknya  
✅ **HPKE Standard** - Menggunakan RFC 9180 HPKE specification  
✅ **X25519 Key Exchange** - Elliptic curve Diffie-Hellman untuk key agreement  
✅ **AES-128-GCM Encryption** - Authenticated encryption  
✅ **API Integration** - Server decrypt payload, call external API, encrypt response  
✅ **Interactive Demo** - UI dengan step-by-step visualization  
✅ **Type Safe** - Full TypeScript, 0 errors

## 🔄 Encryption Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         COMPLETE FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

CLIENT                              SERVER                           API
  │                                   │                               │
  │──── GET /api/hpke-keys ─────────>│                               │
  │                                   │                               │
  │<──── Server Public Key (raw) ────│                               │
  │                                   │                               │
  │─── Generate Client Key Pair ─────│                               │
  │                                   │                               │
  │─── Encrypt Payload ──────────────│                               │
  │   (with server public key)       │                               │
  │                                   │                               │
  │──── POST Encrypted Data ────────>│                               │
  │     { ciphertext, enc,           │                               │
  │       clientPublicKey }          │                               │
  │                                   │                               │
  │                                   │─── Decrypt Payload ──────────│
  │                                   │   (with server private key)   │
  │                                   │                               │
  │                                   │─── Call External API ───────>│
  │                                   │   POST /posts                 │
  │                                   │                               │
  │                                   │<──────── API Response ───────┤
  │                                   │   { id, title, body, ... }   │
  │                                   │                               │
  │                                   │─── Encrypt Response ─────────│
  │                                   │   (with client public key)    │
  │                                   │                               │
  │<──── Encrypted Response ─────────│                               │
  │      { ciphertext, enc }         │                               │
  │                                   │                               │
  │─── Decrypt Response ─────────────│                               │
  │   (with client private key)      │                               │
  │                                   │                               │
  └─── ✅ Display Decrypted Data ────┘                               │
```

## 📁 File Structure

```
src/
├── lib/
│   ├── hpke.ts                    # HPKE utilities untuk client
│   ├── hpke-server.ts             # HPKE helper functions untuk server
│   ├── server-keys.ts             # Global server key storage
│   └── index.ts                   # Re-export public API
│
├── routes/
│   ├── +page.svelte              # Local HPKE demo page
│   │
│   ├── client-server/
│   │   └── +page.svelte          # Client-Server E2E demo page
│   │
│   └── api/
│       ├── hpke-keys/
│       │   └── +server.ts        # GET: Generate & return server public key
│       │
│       └── hpke-proxy/
│           └── +server.ts        # POST: Decrypt → Call API → Encrypt
```

## 🔧 Technical Details

### Algorithm Configuration

```typescript
{
  kem: DhkemX25519HkdfSha256,   // X25519 Elliptic Curve DH
  kdf: HkdfSha256,               // HKDF with SHA-256
  aead: Aes128Gcm                // AES-128-GCM authenticated encryption
}
```

### Key Management

**Important**: HPKE library (`@hpke/core`) menggunakan format key khusus yang disebut **XCryptoKey**, bukan standard `CryptoKey` dari Web Crypto API. Ini adalah perbedaan penting yang mempengaruhi implementasi.

#### Server Side

```typescript
// Generate keys menggunakan HPKE library
const suite = new CipherSuite({
	kem: new DhkemX25519HkdfSha256(),
	kdf: new HkdfSha256(),
	aead: new Aes128Gcm()
});

const keyPair = await suite.kem.generateKeyPair();
// Returns: { publicKey: XCryptoKey, privateKey: XCryptoKey }

// Export public key sebagai raw bytes untuk dikirim ke client
const publicKeyRaw = new Uint8Array(Object.values(keyPair.publicKey.key));
const publicKeyBase64 = btoa(String.fromCharCode(...publicKeyRaw));
```

#### Client Side

```typescript
// Import server public key dari base64
const keyBytes = base64ToUint8Array(serverPublicKeyBase64);

// Import menggunakan HPKE KEM method (BUKAN Web Crypto API)
const suite = createHpkeSuite();
serverPublicKey = await suite.kem.importKey('raw', keyBytes.buffer, true);
// Returns: XCryptoKey (compatible dengan HPKE operations)
```

### Key Format Conversion

```
Server Generate: XCryptoKey (HPKE internal format)
   ↓
Export: XCryptoKey.key → Uint8Array → base64
   ↓
Transmit: base64 string
   ↓
Client Import: base64 → Uint8Array → ArrayBuffer
   ↓
Import: suite.kem.importKey('raw', buffer, true) → XCryptoKey
   ↓
Use: HPKE encryption/decryption
```

### ⚠️ Important Notes

1. **Jangan gunakan `crypto.subtle.exportKey()` atau `crypto.subtle.importKey()`** dengan HPKE keys
   - HPKE library menggunakan `XCryptoKey` format khusus
   - Gunakan `suite.kem.importKey()` dan `suite.kem.exportKey()`

2. **Raw key bytes ada di `.key` property**

   ```typescript
   const rawBytes = new Uint8Array(Object.values(xCryptoKey.key));
   ```

3. **Parameter `enc` di decrypt function**
   - Pass `Uint8Array` langsung, bukan `.buffer`
   - Example: `hpkeDecrypt(ciphertext.buffer, enc, privateKey)`

4. **GenerateKeyPair returns XCryptoKey**
   ```typescript
   const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();
   // publicKey & privateKey: XCryptoKey untuk HPKE operations
   // publicKeyRaw: Uint8Array untuk transmission
   ```

## 🚀 Usage

### Start Development Server

```bash
pnpm dev
```

- **Local Demo**: http://localhost:5173/
- **Client-Server Demo**: http://localhost:5173/client-server

### API Endpoints

#### GET `/api/hpke-keys`

Generate server key pair dan return public key.

**Response:**

```json
{
	"publicKey": "QMcbC0m8H6K8oTonPrrQ1rLH+6MF12fuHWulugTCXUo=",
	"algorithm": "X25519-HKDF-SHA256",
	"aead": "AES-128-GCM"
}
```

#### POST `/api/hpke-proxy`

Receive encrypted payload, decrypt, call external API, encrypt response.

**Request:**

```json
{
	"ciphertext": "<base64-encoded ciphertext>",
	"enc": "<base64-encoded encapsulated key>",
	"clientPublicKey": "<base64-encoded client public key>"
}
```

**Response:**

```json
{
	"ciphertext": "<base64-encoded encrypted response>",
	"enc": "<base64-encoded encapsulated key>"
}
```

### Programmatic Usage

#### Client-Side Encryption

```typescript
import {
	generateKeyPair,
	hpkeEncrypt,
	hpkeDecrypt,
	uint8ArrayToBase64,
	base64ToUint8Array,
	createHpkeSuite
} from '$lib/hpke.js';

// 1. Get server public key
const keyResponse = await fetch('/api/hpke-keys');
const { publicKey: serverPublicKeyBase64 } = await keyResponse.json();

// 2. Import server public key using HPKE KEM (NOT Web Crypto API)
const serverKeyBytes = base64ToUint8Array(serverPublicKeyBase64);
const suite = createHpkeSuite();
const serverPublicKey = await suite.kem.importKey('raw', serverKeyBytes.buffer, true);

// 3. Generate client key pair (returns XCryptoKey objects)
const { publicKey, privateKey, publicKeyRaw } = await generateKeyPair();
const clientPublicKeyBase64 = uint8ArrayToBase64(publicKeyRaw);

// 4. Encrypt payload
const { ciphertext, enc } = await hpkeEncrypt(
	JSON.stringify({ title: 'Hello', body: 'World' }),
	serverPublicKey
);

// 5. Send to server
const response = await fetch('/api/hpke-proxy', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
		enc: uint8ArrayToBase64(new Uint8Array(enc)),
		clientPublicKey: clientPublicKeyBase64
	})
});

const { ciphertext: responseCiphertext, enc: responseEnc } = await response.json();

// 6. Decrypt server response
// IMPORTANT: Pass enc as Uint8Array, NOT enc.buffer
const decrypted = await hpkeDecrypt(
	base64ToUint8Array(responseCiphertext).buffer,
	base64ToUint8Array(responseEnc),
	privateKey
);
```

````

## 🧪 Testing

```bash
# Type checking
pnpm check

# Build
pnpm build

# Lint
pnpm lint
````

**Current Status:**

- ✅ TypeScript: 0 errors, 0 warnings
- ✅ Build: Success
- ✅ Endpoints: Working
- ✅ Full Flow: Tested & Working

## 🐛 Troubleshooting

### Common Errors

#### 1. `Failed to execute 'exportKey' on 'SubtleCrypto': parameter 2 is not of type 'CryptoKey'`

**Cause**: Trying to use Web Crypto API with HPKE XCryptoKey objects.

**Solution**: Use HPKE library's key export method:

```typescript
// ❌ WRONG
const jwk = await crypto.subtle.exportKey('jwk', hpkeKey);

// ✅ CORRECT
const rawBytes = new Uint8Array(Object.values(hpkeKey.key));
```

#### 2. `"uCoordinate" expected Uint8Array of length 32, got type=object`

**Cause**: Manually constructing key objects instead of using KEM's importKey method.

**Solution**: Use proper import method:

```typescript
// ❌ WRONG
const keyObj = { key: ..., type: 'public', ... };

// ✅ CORRECT
const key = await suite.kem.importKey('raw', keyBytes.buffer, true);
```

#### 3. `The provided data is too small`

**Cause**: Passing `.buffer` property which includes extra bytes from ArrayBuffer view.

**Solution**: Pass Uint8Array directly for `enc` parameter:

```typescript
// ❌ WRONG
await hpkeDecrypt(ciphertext.buffer, enc.buffer, privateKey);

// ✅ CORRECT
await hpkeDecrypt(ciphertext.buffer, enc, privateKey);
```

## 🔐 Security Considerations

### ⚠️ Demo Implementation

Implementasi ini untuk **demo/learning purposes**. Untuk production:

1. **Key Storage**:
   - ❌ Current: In-memory (hilang saat restart)
   - ✅ Production: HSM, AWS KMS, Azure Key Vault

2. **Authentication**:
   - ❌ Current: No authentication
   - ✅ Production: JWT, OAuth, API keys

3. **Rate Limiting**:
   - ❌ Current: No rate limiting
   - ✅ Production: Implement rate limiter

4. **HTTPS**:
   - ❌ Current: HTTP (development only)
   - ✅ Production: HTTPS required

5. **Key Rotation**:
   - ❌ Current: Static keys
   - ✅ Production: Regular key rotation

6. **Audit Logging**:
   - ❌ Current: Console logs only
   - ✅ Production: Structured logging & monitoring

## 📚 Dependencies

```json
{
	"@hpke/core": "^1.9.0",
	"@hpke/dhkem-x25519": "^1.8.0",
	"@hpke/chacha20poly1305": "^1.8.0"
}
```

## 📖 References

- [RFC 9180 - HPKE Specification](https://www.rfc-editor.org/rfc/rfc9180.html)
- [hpke-js Library](https://github.com/dajiaji/hpke-js)
- [X25519 Key Exchange](https://en.wikipedia.org/wiki/Curve25519)
- [AES-GCM Authenticated Encryption](https://en.wikipedia.org/wiki/Galois/Counter_Mode)

## 🎓 Learning Outcomes

Dari implementasi ini, Anda akan memahami:

1. **HPKE Concept**: Hybrid Public Key Encryption
2. **Key Exchange**: X25519 Elliptic Curve Diffie-Hellman
3. **Authenticated Encryption**: AES-128-GCM
4. **Client-Server Cryptography**: End-to-end encryption patterns
5. **Key Management**: Generation, storage, export/import
6. **Web Cryptography API**: Browser crypto operations
7. **SvelteKit Server Routes**: API endpoints with cryptography

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT
