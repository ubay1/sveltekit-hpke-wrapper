import { createHpkeServer, type HpkeServerInstance } from '@ubay182/sveltekit-hpke-wrapper';

// Shared singleton — both routes import this same instance
export const hpkeServer: HpkeServerInstance = createHpkeServer({ autoGenerateKeys: false });
