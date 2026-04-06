# HPKE Implementation in SvelteKit

Implementasi HPKE (Hybrid Public Key Encryption) menggunakan library [@hpke/core](https://github.com/dajiaji/hpke-js) dalam aplikasi SvelteKit dengan enkripsi end-to-end antara client dan server.

## 🚀 Features

✅ **Local Encryption/Demo** - Enkripsi/dekripsi lokal untuk testing  
✅ **Client-Server End-to-End Encryption** - Full flow enkripsi antara client dan server  
✅ **API Integration** - Server decrypt payload, call external API, encrypt response  
✅ **Interactive UI** - Demo page dengan step-by-step visualization  
✅ **Type Safe** - Full TypeScript support  
✅ **Zero Errors** - Lulus type checking (0 errors, 0 warnings)  

## 📦 Installation

Dependencies sudah terinstall:

```bash
@hpke/core          # Core HPKE implementation
@hpke/dhkem-x25519  # X25519 key exchange
@hpke/chacha20poly1305  # ChaCha20-Poly1305 encryption
```

## 🏗️ Architecture

### Flow Diagram

```
┌─────────┐         ┌────────┐         ┌─────┐         ┌────────┐         ┌─────────┐
│  Client │         │ Server │         │ API │         │ Server │         │  Client │
│         │         │        │         │     │         │        │         │         │
│ Encrypt │ ──────> │ Decrypt│ ──────> │Call │ ──────> │Encrypt │ ──────> │ Decrypt │
│ Message │         │ Message│         │     │         │Response│         │ Response│
└─────────┘         └────────┘         └─────┘         └────────┘         └─────────┘
```

### Detailed Flow

1. **Client** mendapat server public key dari `/api/hpke-keys`
2. **Client** generate key pair (public + private)
3. **Client** encrypt payload dengan server public key
4. **Client** kirim encrypted payload + client public key ke `/api/hpke-proxy`
5. **Server** decrypt payload menggunakan server private key
6. **Server** call external API (jsonplaceholder.typicode.com) dengan decrypted payload
7. **Server** encrypt API response menggunakan client public key
8. **Server** kirim encrypted response ke client
9. **Client** decrypt response menggunakan client private key
10. **Client** display decrypted data

## 📁 Project Structure

```
src/
├── lib/
│   ├── hpke.ts              # HPKE utility functions
│   └── index.ts             # Re-export HPKE functions
│
├── routes/
│   ├── +page.svelte         # Local HPKE demo
│   ├── client-server/
│   │   └── +page.svelte     # Client-Server end-to-end demo
│   │
│   └── api/
│       ├── hpke-keys/
│       │   └── +server.ts   # Endpoint: Generate server keys
│       └── hpke-proxy/
│           └── +server.ts   # Endpoint: Process encrypted requests
```

## 🔧 HPKE Utility Functions

### Available in `$lib/hpke.ts`

```typescript
// Create HPKE suite (AES-128-GCM)
createHpkeSuite()

// Create HPKE suite (ChaCha20-Poly1305)
createHpkeSuiteChaCha20()

// Generate key pair
generateKeyPair(): { publicKey: CryptoKey, privateKey: CryptoKey }

// Encrypt message
hpkeEncrypt(
  message: string,
  recipientPublicKey: CryptoKey
): { ciphertext: ArrayBuffer, enc: ArrayBuffer }

// Decrypt message
hpkeDecrypt(
  ciphertext: ArrayBuffer,
  enc: ArrayBuffer,
  recipientPrivateKey: CryptoKey
): string

// Demo function
hpkeDemo(): { original, decrypted, match }

// Helper functions
uint8ArrayToBase64(data: Uint8Array): string
base64ToUint8Array(base64: string): Uint8Array
```

## 🎮 Usage

### Start Development Server

```bash
pnpm dev
```

- **Local Demo**: http://localhost:5173/
- **Client-Server Demo**: http://localhost:5173/client-server

### Programmatic Usage

#### Local Encryption

```typescript
import { generateKeyPair, hpkeEncrypt, hpkeDecrypt } from '$lib/hpke.js';

// Generate keys
const { publicKey, privateKey } = await generateKeyPair();

// Encrypt
const { ciphertext, enc } = await hpkeEncrypt('Secret message', publicKey);

// Decrypt
const decrypted = await hpkeDecrypt(ciphertext, enc, privateKey);
```

#### Client-Server Encryption

```typescript
// 1. Get server public key
const keyResponse = await fetch('/api/hpke-keys');
const { publicKey: serverPublicKeyJwk } = await keyResponse.json();

// 2. Generate client keys
const { publicKey, privateKey } = await generateKeyPair();
const publicKeyExported = await crypto.subtle.exportKey('jwk', publicKey);

// 3. Encrypt payload
const { ciphertext, enc } = await hpkeEncrypt(
  JSON.stringify({ title: 'Hello', body: 'World' }),
  serverPublicKey
);

// 4. Send to server
const response = await fetch('/api/hpke-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
    enc: uint8ArrayToBase64(new Uint8Array(enc)),
    clientPublicKey: publicKeyExported
  })
});

// 5. Decrypt server response
const { ciphertext: responseCiphertext, enc: responseEnc } = await response.json();
const decryptedResponse = await hpkeDecrypt(
  base64ToUint8Array(responseCiphertext).buffer,
  base64ToUint8Array(responseEnc).buffer,
  privateKey
);
```

## 🔐 Security Notes

### Algorithm Configuration

- **KEM**: X25519-HKDF-SHA256 (Elliptic Curve Diffie-Hellman)
- **KDF**: HKDF-SHA256
- **AEAD**: AES-128-GCM

### Important Considerations

⚠️ **Production Readiness**:
- Implementasi ini untuk demo/learning purposes
- Key storage menggunakan in-memory (akan hilang saat server restart)
- Untuk production, gunakan proper key management system
- Belum melalui security audit

🔒 **Security Best Practices**:
- Gunakan HTTPS untuk production
- Implement proper authentication/authorization
- Add rate limiting untuk API endpoints
- Use secure key storage (HSM, AWS KMS, dll)
- Add request validation dan sanitization

## 🧪 Testing

Run type checking:

```bash
pnpm check
```

Build project:

```bash
pnpm build
```

## 📚 API Endpoints

### GET `/api/hpke-keys`

Generate server key pair and return public key.

**Response:**
```json
{
  "publicKey": { /* JWK format */ },
  "algorithm": "X25519-HKDF-SHA256",
  "aead": "AES-128-GCM"
}
```

### POST `/api/hpke-proxy`

Receive encrypted payload, decrypt, call external API, encrypt response.

**Request Body:**
```json
{
  "ciphertext": "base64-encoded ciphertext",
  "enc": "base64-encoded encapsulated key",
  "clientPublicKey": { /* Client public key in JWK */ }
}
```

**Response:**
```json
{
  "ciphertext": "base64-encoded encrypted response",
  "enc": "base64-encoded encapsulated key"
}
```

## 🎨 UI Features

- ✅ Step-by-step visualization
- ✅ Real-time encryption/decryption
- ✅ Interactive form inputs
- ✅ Encrypted data preview
- ✅ Error handling dan feedback
- ✅ Responsive design
- ✅ Flow diagram

## 🛠️ Tech Stack

- **Framework**: SvelteKit 5
- **Language**: TypeScript
- **Encryption**: HPKE (@hpke/core)
- **Styling**: Custom CSS
- **Build Tool**: Vite

## 📖 References

- [HPKE Specification (RFC 9180)](https://www.rfc-editor.org/rfc/rfc9180.html)
- [hpke-js Library](https://github.com/dajiaji/hpke-js)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT
