import { Resolver, promises as dnsPromises } from 'node:dns';
import { config } from './config.js';

// DNSExit publishes new records to its authoritative nameservers with a lag of
// ~20-40s, and the nameservers are briefly inconsistent (one may still answer
// NXDOMAIN). If mail is sent during that window it bounces with
// "domain not found". So before we hand an address to the user we confirm the
// MX is live on EVERY authoritative nameserver.

let nsIpsCache = null;

async function getNsIps() {
  if (nsIpsCache) return nsIpsCache;
  const names = await dnsPromises.resolveNs(config.baseDomain);
  const ips = [];
  for (const name of names) {
    try {
      const a = await dnsPromises.resolve4(name);
      if (a[0]) ips.push(a[0]);
    } catch {
      /* skip a nameserver we can't resolve */
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

// Resolve once the MX for `domain` points at `mailServer` on ALL authoritative
// nameservers, or `false` on timeout.
export async function waitForMx(domain, mailServer, { timeoutMs = 90000, intervalMs = 3000 } = {}) {
  const ips = await getNsIps();
  if (ips.length === 0) return false;
  const want = norm(mailServer);
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
