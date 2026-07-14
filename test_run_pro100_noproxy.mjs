import { createEmailApi } from './lib/eset/email/Pro100Pochta.js';

async function test() {
  const api = await createEmailApi(); // NO PROXY
  try {
     const res = await api.generateEmailAddress();
     console.log('Result:', res);
  } catch(e) {
     console.error('Error:', e);
  }
}
test();
