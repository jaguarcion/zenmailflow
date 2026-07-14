const { Agent } = require('undici');
const { buildSocksProxyConnector } = require('@jsr/undicijs__proxy');
const { fetch } = require('undici');

async function test() {
  const dispatcher = new Agent({
    connect: buildSocksProxyConnector('socks5://4w99sxjb5s-corp.mobile.res-country-LV-hold-session-session-6a45848ec8ed4:ohh401aJwRYe8xuN@82.27.118.182:443')
  });

  try {
     console.log('Fetching pro100pochta...');
     const res = await fetch('https://pro100pochta.com/', { dispatcher });
     console.log('Pro100Pochta Status:', res.status);
  } catch(e) {
     console.error('Pro100Pochta Error:', e.message);
  }
}
test();
