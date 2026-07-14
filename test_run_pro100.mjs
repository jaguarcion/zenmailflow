import { createEmailApi } from './lib/eset/email/Pro100Pochta.js';

async function test() {
  const api = await createEmailApi('socks5://ohh401aJwRYe8xuN:ohh401aJwRYe8xuN@82.27.118.182:443');
  try {
     const res = await api.generateEmailAddress();
     console.log('Result:', res);
  } catch(e) {
     console.error('Error:', e);
  }
}
test();
