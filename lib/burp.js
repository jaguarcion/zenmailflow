import { randomInt } from 'node:crypto';
import { Resolver, promises as dnsPromises } from 'node:dns';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomLabel(len) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  if (!/[a-z]/.test(out[0])) {
    out = ALPHABET[randomInt(26)] + out.slice(1);
  }
  return out;
}

export function getBurpConfig() {
  return {
    dnsexitApiKey: process.env.DNSEXIT_API_KEY,
    baseDomain: process.env.BURP_BASE_DOMAIN || 'bill.work.gd',
    mailServer: process.env.BURP_MAIL_SERVER || 'dfssdfsdfdsfgdg.work.gd',
    mxPriority: Number(process.env.BURP_MX_PRIORITY || 10),
    mxTtl: Number(process.env.BURP_MX_TTL || 28800)
  };
}

const API_URL = 'https://api.dnsexit.com/dns/';

async function callDnsExit(body) {
  const config = getBurpConfig();
  if (!config.dnsexitApiKey) {
    throw new Error('DNSEXIT_API_KEY is not configured');
  }

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
  if (data.code !== 0) {
    throw new Error(`DNSExit error ${data.code}: ${data.message}`);
  }
  return data;
}

export function addMx(label) {
  const config = getBurpConfig();
  return callDnsExit({
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
  const config = getBurpConfig();
  return callDnsExit({
    domain: config.baseDomain,
    delete: {
      type: 'MX',
      'mail-zone': label,
      'mail-server': config.mailServer,
      priority: config.mxPriority,
    },
  });
}

let nsIpsCache = null;

async function getNsIps(baseDomain) {
  if (nsIpsCache) return nsIpsCache;
  const names = await dnsPromises.resolveNs(baseDomain);
  const ips = [];
  for (const name of names) {
    try {
      const a = await dnsPromises.resolve4(name);
      if (a[0]) ips.push(a[0]);
    } catch {
      // skip
    }
  }
  nsIpsCache = ips;
  return ips;
}

function queryMxAt(ip, domain) {
  return new Promise((resolve) => {
    const r = new Resolver({ timeout: 3000, tries: 1 });
    r.setServers([ip]);
    r.resolveMx(domain, (err, records) => resolve(err ? null : records));
  });
}

const norm = (h) => h.replace(/\.$/, '').toLowerCase();

export async function waitForMx(domain, { timeoutMs = 90000, intervalMs = 3000 } = {}) {
  const config = getBurpConfig();
  const ips = await getNsIps(config.baseDomain);
  if (ips.length === 0) return false;
  const want = norm(config.mailServer);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const results = await Promise.all(ips.map((ip) => queryMxAt(ip, domain)));
    const allLive = results.every(
      (recs) => Array.isArray(recs) && recs.some((r) => norm(r.exchange) === want)
    );
    if (allLive) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}
