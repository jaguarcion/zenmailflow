import { config } from './config.js';

const API_URL = 'https://api.dnsexit.com/dns/';

async function call(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.dnsexitApiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`DNSExit: non-JSON response: ${text}`);
  }
  // code 0 = success. Anything else is an error we surface to the caller.
  if (data.code !== 0) {
    throw new Error(`DNSExit error ${data.code}: ${data.message}`);
  }
  return data;
}

// Create/overwrite an MX record for <label>.<baseDomain> pointing at the
// static mail server. mail-zone is the label relative to the managed zone.
export function addMx(label) {
  return call({
    domain: config.baseDomain,
    add: {
      type: 'MX',
      'mail-zone': label,
      'mail-server': config.mailServer,
      priority: config.mxPriority,
      ttl: config.mxTtl,
      overwrite: true,
    },
  });
}

export function deleteMx(label) {
  return call({
    domain: config.baseDomain,
    delete: {
      type: 'MX',
      'mail-zone': label,
      'mail-server': config.mailServer,
      priority: config.mxPriority,
    },
  });
}
