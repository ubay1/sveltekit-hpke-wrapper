# @ubay182/sveltekit-hpke-wrapper

HPKE (Hybrid Public Key Encryption) wrapper for SvelteKit applications with end-to-end encryption support and **seal/unseal** obfuscation.

## 📦 Installation

```bash
npm i @ubay182/sveltekit-hpke-wrapper
```

or

```bash
pnpm add @ubay182/sveltekit-hpke-wrapper
```

## 🚀 Quick Start

See a complete working example here: [src/routes/+page.svelte](https://github.com/ubay1/sveltekit-hpke-wrapper/blob/main/src/routes/%2Bpage.svelte)

## 📚 Documentation

For full API reference, seal/unseal documentation, security notes, and development instructions, see [packages/hpke-wrapper/README.md](./packages/hpke-wrapper/README.md).

## 🔐 What's New: Seal/Unseal

The latest version introduces **seal/unseal** functionality that obfuscates encrypted data to hide the HPKE structure:

### Before (Standard HPKE)

```json
{
	"ciphertext": "IZ8VQlMQ...",
	"enc": "QsjTuAUU..."
}
```

❌ Structure is visible after base64 decode

### After (Sealed)

```
"x7k2mSGVsbG8gV29ybGQ...x7k2m0"
```

✅ Looks like random gibberish, no visible structure

## 📄 License

MIT
