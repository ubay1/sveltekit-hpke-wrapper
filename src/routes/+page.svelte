<script lang="ts">
	import { onMount } from 'svelte';
	import {
		generateKeyPair,
		uint8ArrayToBase64,
		base64ToUint8Array,
		createHpkeSuite,
		seal,
		unseal
	} from '@ubay182/sveltekit-hpke-wrapper';

	// Flow state: 0=ready, 1=encrypted, 2=server responded, 3=decrypted
	let step = $state(0);
	let loading = $state(false);
	let error = $state('');
	let logs = $state<string[]>([]);

	// Keys (auto-setup on mount)
	let clientPubKeyB64 = $state('');
	let serverPubKeyB64 = $state('');
	let clientPrivKey = $state<any>(null);
	let serverPubKey = $state<any>(null);

	// Data
	let requestPayload = $state({
		title: 'Hello from HPKE',
		body: 'This message is encrypted end-to-end',
		userId: 42
	});
	let wrappedCiphertext = $state('');
	let serverWrappedCiphertext = $state('');
	let decryptedText = $state('');

	function log(msg: string) {
		logs = [...logs, `[${new Date().toLocaleTimeString()}] ${msg}`];
	}

	function resetAll() {
		step = 0;
		loading = false;
		error = '';
		logs = [];
		wrappedCiphertext = '';
		serverWrappedCiphertext = '';
		decryptedText = '';
	}

	// Auto-setup keys on mount
	async function initKeys() {
		loading = true;
		error = '';
		try {
			// Read server public key from cookie
			const cookie = document.cookie
				.split('; ')
				.find((row) => row.startsWith('hpke_server_public_key='));

			if (!cookie) throw new Error('No server public key in cookie. Refresh the page.');

			const publicKeyB64 = decodeURIComponent(cookie.split('=')[1]);
			serverPubKeyB64 = publicKeyB64;

			const keyBytes = base64ToUint8Array(publicKeyB64);
			const suite = createHpkeSuite();
			serverPubKey = await suite.kem.importKey('raw', keyBytes.buffer as ArrayBuffer, true);

			// Generate client key pair
			const keys = await generateKeyPair();
			clientPrivKey = keys.privateKey;
			clientPubKeyB64 = uint8ArrayToBase64(keys.publicKeyRaw);

			log('✓ Keys ready — server key from cookie, client key generated');
		} catch (e: any) {
			error = e.message;
			log('✗ Key setup failed: ' + e.message);
		} finally {
			loading = false;
		}
	}

	// Run on mount (browser only)
	onMount(() => {
		initKeys();
	});

	async function encryptAndSend() {
		if (loading) return;
		loading = true;
		error = '';
		try {
			if (!serverPubKey || !clientPrivKey) {
				error = 'Keys not ready yet — wait a moment and try again';
				return;
			}

			const message = JSON.stringify(requestPayload);
			log('Encrypting payload with seal...');

			// Use seal to wrap ciphertext + enc into single obfuscated string
			// Use the base64 string we already have from cookie
			const suite = createHpkeSuite();

			wrappedCiphertext = await seal(suite, serverPubKeyB64, message);

			log('✓ Payload encrypted and wrapped');

			log('Sending encrypted request to server...');

			// Include clientPublicKey inside the encrypted payload (not visible in request body)
			const payloadWithKey = JSON.stringify({
				...requestPayload,
				_clientPublicKey: clientPubKeyB64 // Hidden inside encryption
			});

			const suite2 = createHpkeSuite();
			wrappedCiphertext = await seal(suite2, serverPubKeyB64, payloadWithKey);

			const res = await fetch('/api/hpke-proxy', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'demo-key-change-me'
				},
				body: JSON.stringify({ data: wrappedCiphertext })
			});

			if (!res.ok) {
				const errData = await res.json();
				throw new Error(errData.error || res.statusText);
			}

			const resData = await res.json();
			// Response now contains data (sealed)
			serverWrappedCiphertext = resData.data;
			step = 2;
			log('✓ Server responded with encrypted data');
		} catch (e: any) {
			error = e.message;
			log('✗ Failed: ' + e.message);
		} finally {
			loading = false;
		}
	}

	async function decryptResponse() {
		if (loading) return;
		loading = true;
		error = '';
		try {
			if (!clientPrivKey) {
				error = 'Missing client private key';
				return;
			}

			log('Decrypting server response with unseal...');

			// Use private key object directly (no JWK export needed)
			const suite = createHpkeSuite();
			const decrypted = await unseal(suite, clientPrivKey, serverWrappedCiphertext);

			decryptedText = decrypted;
			step = 3;
			log('✓ Server response decrypted successfully');
		} catch (e: any) {
			error = e.message;
			log('✗ Failed: ' + e.message);
		} finally {
			loading = false;
		}
	}

	async function runAll() {
		if (loading) return;
		await encryptAndSend();
		if (error) return;
		await decryptResponse();
	}
</script>

<svelte:head>
	<title>E2E Encryption Demo</title>
</svelte:head>

<div class="container">
	<h1>🔐 End-to-End Encryption Demo</h1>
	<p class="subtitle">
		Client encrypt → Server decrypt → Server calls API → Server encrypt → Client decrypt
	</p>

	<!-- Flow Diagram -->
	<div class="flow-bar">
		<div class="flow-node {step >= 0 ? 'active' : ''}">
			<span class="emoji">🔑</span>
			<span class="label">Keys Ready</span>
		</div>
		<div class="flow-line {step >= 1 ? 'active' : ''}"></div>
		<div class="flow-node {step >= 1 ? 'active' : ''}">
			<span class="emoji">🔒</span>
			<span class="label">Client Encrypt</span>
		</div>
		<div class="flow-line {step >= 2 ? 'active' : ''}"></div>
		<div class="flow-node {step >= 2 ? 'active' : ''}">
			<span class="emoji">🔓</span>
			<span class="label">Server Decrypt</span>
		</div>
		<div class="flow-line {step >= 2 ? 'active' : ''}"></div>
		<div class="flow-node {step >= 2 ? 'active' : ''}">
			<span class="emoji">🌐</span>
			<span class="label">API Call</span>
		</div>
		<div class="flow-line {step >= 2 ? 'active' : ''}"></div>
		<div class="flow-node {step >= 2 ? 'active' : ''}">
			<span class="emoji">🔒</span>
			<span class="label">Server Encrypt</span>
		</div>
		<div class="flow-line {step >= 3 ? 'active' : ''}"></div>
		<div class="flow-node {step >= 3 ? 'active' : ''} {step >= 3 ? 'done' : ''}">
			<span class="emoji">🔓</span>
			<span class="label">Client Decrypt</span>
		</div>
	</div>

	{#if error}
		<div class="error-box">❌ {error}</div>
	{/if}

	<!-- Controls -->
	<div class="controls">
		<button class="btn primary" onclick={runAll} disabled={loading || step >= 3}>
			{loading ? '⏳ Processing...' : '▶ Encrypt & Send'}
		</button>
		<button class="btn" onclick={encryptAndSend} disabled={loading || step >= 2}>
			1️⃣ Encrypt & Send
		</button>
		<button class="btn" onclick={decryptResponse} disabled={loading || step >= 3}>
			2️⃣ Decrypt Response
		</button>
		<button class="btn secondary" onclick={resetAll} disabled={loading}> 🔄 Reset </button>
	</div>

	<!-- Keys Info -->
	{#if serverPubKeyB64 && clientPubKeyB64}
		<div class="panel">
			<h2>🔑 Keys (Auto-Loaded)</h2>
			<label for="server-pubkey">Server Public Key (from cookie)</label>
			<code id="server-pubkey" class="key-box">{serverPubKeyB64}</code>
			<label for="client-pubkey">Client Public Key</label>
			<code id="client-pubkey" class="key-box">{clientPubKeyB64}</code>
		</div>
	{/if}

	<!-- Request Payload -->
	<div class="panel">
		<h2>📝 Request Payload</h2>
		<label for="req-title">Title</label>
		<input id="req-title" bind:value={requestPayload.title} disabled={loading} />
		<label for="req-body">Body</label>
		<textarea id="req-body" bind:value={requestPayload.body} disabled={loading} rows={2}></textarea>
		<label for="req-userid">User ID</label>
		<input id="req-userid" type="number" bind:value={requestPayload.userId} disabled={loading} />
	</div>

	{#if wrappedCiphertext}
		<div class="panel encrypted">
			<h2>🔒 Encrypted Request (Client → Server) - Sealed</h2>
			<label for="wrapped-req">Wrapped Ciphertext (obfuscated base64)</label>
			<code id="wrapped-req" class="data-box">{wrappedCiphertext}</code>
		</div>
	{/if}

	{#if serverWrappedCiphertext}
		<div class="panel encrypted">
			<h2>🔒 Encrypted Response (Server → Client) - Sealed</h2>
			<label for="wrapped-res">Wrapped Ciphertext (obfuscated base64)</label>
			<code id="wrapped-res" class="data-box">{serverWrappedCiphertext}</code>
		</div>
	{/if}

	{#if decryptedText}
		<div class="panel decrypted">
			<h2>✅ Decrypted Server Response</h2>
			<pre class="data-box success">{JSON.stringify(JSON.parse(decryptedText), null, 2)}</pre>
		</div>
	{/if}

	<!-- Log -->
	<div class="panel log-panel">
		<h2>📋 Activity Log</h2>
		<div class="log-box">
			{#each logs as logEntry}
				<div class="log-line">{logEntry}</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		font-family: system-ui, sans-serif;
	}

	h1 {
		text-align: center;
		font-size: 2rem;
		margin-bottom: 0.25rem;
	}

	.subtitle {
		text-align: center;
		color: #666;
		margin-bottom: 1.5rem;
	}

	/* Flow bar */
	.flow-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}

	.flow-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		background: #f0f0f0;
		opacity: 0.4;
		transition: all 0.3s;
		min-width: 80px;
	}

	.flow-node.active {
		opacity: 1;
		background: #e0e7ff;
	}

	.flow-node.done {
		background: #d4edda;
	}

	.flow-node .emoji {
		font-size: 1.5rem;
	}

	.flow-node .label {
		font-size: 0.7rem;
		font-weight: 600;
		margin-top: 0.25rem;
	}

	.flow-line {
		width: 30px;
		height: 3px;
		background: #ccc;
		border-radius: 2px;
		transition: background 0.3s;
	}

	.flow-line.active {
		background: #667eea;
	}

	/* Controls */
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.btn {
		padding: 0.6rem 1.2rem;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		background: #e8e8e8;
		transition: all 0.2s;
	}

	.btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	.btn.primary {
		background: linear-gradient(135deg, #667eea, #764ba2);
		color: white;
	}

	.btn.secondary {
		background: #ffc107;
		color: #333;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Error */
	.error-box {
		background: #f8d7da;
		color: #721c24;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		margin-bottom: 1rem;
		border: 1px solid #f5c6cb;
	}

	/* Panels */
	.panel {
		background: white;
		border-radius: 10px;
		padding: 1.25rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		margin-bottom: 1rem;
	}

	.panel h2 {
		margin: 0 0 0.75rem;
		font-size: 1.1rem;
	}

	.panel label {
		display: block;
		font-weight: 600;
		font-size: 0.8rem;
		color: #555;
		margin-bottom: 0.25rem;
		margin-top: 0.5rem;
	}

	.panel input,
	.panel textarea {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		font-family: inherit;
	}

	.panel input:disabled,
	.panel textarea:disabled {
		background: #f5f5f5;
	}

	.key-box,
	.data-box {
		display: block;
		background: #f8f9fa;
		padding: 0.75rem;
		border-radius: 6px;
		font-size: 0.75rem;
		word-break: break-all;
		white-space: pre-wrap;
		border: 1px solid #e0e0e0;
		overflow-x: auto;
	}

	.encrypted {
		border-left: 4px solid #ffc107;
	}

	.encrypted .data-box {
		background: #fff3cd;
		border-color: #ffc107;
		color: #856404;
	}

	.decrypted {
		border-left: 4px solid #28a745;
	}

	.decrypted .data-box.success {
		background: #d4edda;
		border-color: #28a745;
		color: #155724;
	}

	/* Log */
	.log-box {
		background: #1e1e1e;
		color: #d4d4d4;
		padding: 0.75rem;
		border-radius: 6px;
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.75rem;
		max-height: 250px;
		overflow-y: auto;
	}

	.log-line {
		padding: 2px 0;
		border-bottom: 1px solid #2a2a2a;
	}
</style>
