import { createEmailApi } from './lib/eset/email/MailTm.js';

async function test() {
  const api = await createEmailApi('socks5://4w99sxjb5s-corp.mobile.res-country-LV-state-454311-hold-session-session-6a56a9ca21a90:ohh401aJwRYe8xuN@212.8.249.142:443');
  try {
     const res = await api.generateEmailAddress();
     console.log('Result:', res);
  } catch(e) {
     console.error('Error:', e);
  }
}
test();
