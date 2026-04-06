import {
	basicExample,
	keyExportImport,
	quickDemo,
	completeFlowExample,
	errorHandlingExample,
	chaCha20Example
} from './examples.js';

async function run(name: string, fn: () => Promise<void>) {
	console.log(`\n=== Running: ${name} ===`);
	try {
		await fn();
	} catch (err) {
		console.error(`❌ ${name} failed:`, err);
	}
}

await run('basicExample', basicExample);
await run('keyExportImport', keyExportImport);
await run('quickDemo', quickDemo);
await run('completeFlowExample', completeFlowExample);
await run('errorHandlingExample', errorHandlingExample);
await run('chaCha20Example', chaCha20Example);

console.log('\n✅ All examples finished.');
