const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const PROXY_FILE = path.join(__dirname, '..', 'proxies.txt');
const AUTOUPDATE_FILE = path.join(__dirname, '..', 'proxy_autoupdate.json');

const QUARANTINE_AFTER_FAILS = 3;
const QUARANTINE_DURATION_SEC = 300;

let proxyState = {
    proxies: [],
    current: 0
};

let autoUpdateConfig = {
    url: '',
    interval_min: 0,
    last_refresh: 0,
    last_error: ''
};

let autoUpdateInterval = null;

function parseProxyLine(line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return null;

    let refresh = '';
    if (line.includes('[') && line.endsWith(']')) {
        const bi = line.lastIndexOf('[');
        refresh = line.slice(bi + 1, -1);
        line = line.slice(0, bi).replace(/:$/, '');
    }

    const match = line.match(/-x\s+(\S+)/);
    if (match) line = match[1];
    else line = line.split(' ')[0];

    const validHostPort = (host, port) => {
        if (!host || !port) return false;
        const p = parseInt(port, 10);
        return p >= 1 && p <= 65535;
    };

    let scheme = 'http://';
    if (line.startsWith('socks5://')) scheme = 'socks5://';
    else if (line.startsWith('socks4://')) scheme = 'socks4://';
    else if (line.startsWith('http://')) scheme = 'http://';
    else if (line.startsWith('https://')) scheme = 'https://';
    
    let rawLine = line;
    if (rawLine.includes('://')) {
        rawLine = rawLine.substring(rawLine.indexOf('://') + 3);
    }

    if (rawLine.includes('@')) {
        const at = rawLine.lastIndexOf('@');
        const creds = rawLine.slice(0, at);
        const hostPart = rawLine.slice(at + 1);
        const ci = creds.indexOf(':');
        const user = ci >= 0 ? creds.slice(0, ci) : creds;
        const pw = ci >= 0 ? creds.slice(ci + 1) : '';
        const parts = hostPart.split(':');
        if (parts.length < 2 || !validHostPort(parts[0], parts[1])) return null;
        return { url: `${scheme}${parts[0]}:${parts[1]}`, user, pw, refresh };
    } else {
        const parts = rawLine.split(':');
        if (parts.length === 2 && validHostPort(parts[0], parts[1])) {
            return { url: `${scheme}${parts[0]}:${parts[1]}`, user: '', pw: '', refresh };
        }
        if (parts.length === 4 && validHostPort(parts[0], parts[1])) {
            return { url: `${scheme}${parts[0]}:${parts[1]}`, user: parts[2], pw: parts[3], refresh };
        }
    }
    return null;
}

function withStats(p) {
    if (!p) return null;
    p.success = 0;
    p.fail = 0;
    p.cons_fail = 0;
    p.quarantine_until = 0;
    p.last_latency_ms = 0;
    return p;
}

function loadProxies(lines) {
    const parsed = lines.map(parseProxyLine).map(withStats).filter(Boolean);
    proxyState.proxies = parsed;
    proxyState.current = 0;
}

async function saveToFile() {
    try {
        const lines = proxyState.proxies.map(p => {
            let base = p.user ? `${p.user}:${p.pw}@${p.url.replace(/^.*?:\/\//, '')}` : p.url.replace(/^.*?:\/\//, '');
            if (p.url.startsWith('socks')) base = p.url.split('://')[0] + '://' + base;
            if (p.refresh) base += `[${p.refresh}]`;
            return base;
        });
        fs.writeFileSync(PROXY_FILE, lines.join('\n'), 'utf8');
    } catch (e) {
        console.error('Failed to save proxies to file', e);
    }
}

async function initialize() {
    try {
        if (fs.existsSync(PROXY_FILE)) {
            const raw = fs.readFileSync(PROXY_FILE, 'utf8');
            const lines = raw.split('\n').filter(l => l.trim());
            loadProxies(lines);
            console.log(`[proxy] loaded ${proxyState.proxies.length} proxies`);
        }
    } catch (e) {
        console.error('Failed to load proxy file', e);
    }
    
    try {
        if (fs.existsSync(AUTOUPDATE_FILE)) {
            const data = JSON.parse(fs.readFileSync(AUTOUPDATE_FILE, 'utf8'));
            autoUpdateConfig.url = data.url || '';
            autoUpdateConfig.interval_min = data.interval_min || 0;
            autoUpdateConfig.last_refresh = data.last_refresh || 0;
            startAutoUpdate();
        }
    } catch (e) {
        console.error('Failed to load autoupdate config', e);
    }
}

async function fetchProxiesFromUrl(url) {
    try {
        const resp = await axios.get(url, { timeout: 15000, maxContentLength: 1024 * 1024 });
        const lines = resp.data.split('\n').map(l => l.trim()).filter(Boolean);
        return { ok: true, lines, count: lines.length };
    } catch (e) {
        return { ok: false, error: e.message, lines: [] };
    }
}

async function doProxyRefresh() {
    if (!autoUpdateConfig.url) return;
    try {
        const res = await fetchProxiesFromUrl(autoUpdateConfig.url);
        if (res.ok && res.lines.length > 0) {
            loadProxies(res.lines);
            await saveToFile();
            autoUpdateConfig.last_refresh = Date.now();
            autoUpdateConfig.last_error = '';
            saveAutoUpdateConfig();
            console.log(`[autoupdate] refreshed ${res.lines.length} proxies`);
        } else {
            throw new Error(res.error || 'Empty response');
        }
    } catch (e) {
        autoUpdateConfig.last_error = e.message;
        console.error(`[autoupdate] failed: ${e.message}`);
    }
}

function startAutoUpdate() {
    if (autoUpdateInterval) clearInterval(autoUpdateInterval);
    if (autoUpdateConfig.interval_min > 0 && autoUpdateConfig.url) {
        autoUpdateInterval = setInterval(async () => {
            const now = Date.now();
            const elapsedMin = (now - autoUpdateConfig.last_refresh) / 60000;
            if (elapsedMin >= autoUpdateConfig.interval_min) {
                await doProxyRefresh();
            }
        }, 60000);
    }
}

function saveAutoUpdateConfig() {
    fs.writeFileSync(AUTOUPDATE_FILE, JSON.stringify({
        url: autoUpdateConfig.url,
        interval_min: autoUpdateConfig.interval_min,
        last_refresh: autoUpdateConfig.last_refresh
    }), 'utf8');
}

async function setAutoUpdateConfig(config) {
    autoUpdateConfig.url = config.url || '';
    autoUpdateConfig.interval_min = Math.max(0, parseInt(config.interval_min) || 0);
    saveAutoUpdateConfig();
    startAutoUpdate();
}

function getAutoUpdateConfig() {
    return autoUpdateConfig;
}

function getProxiesCount() {
    return proxyState.proxies.length;
}

function getStats() {
    const now = Date.now() / 1000;
    const total = proxyState.proxies.length;
    let alive = 0;
    let latencies = [];
    
    for (const p of proxyState.proxies) {
        if (p.quarantine_until < now) alive++;
        if (p.success > 0 && p.last_latency_ms > 0) latencies.push(p.last_latency_ms);
    }
    
    const quarantined = total - alive;
    const avg_latency_ms = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    
    return { total, alive, quarantined, avg_latency_ms };
}

function getProxy() {
    const lst = proxyState.proxies;
    if (!lst.length) return null;
    
    const now = Date.now() / 1000;
    for (let offset = 0; offset < lst.length; offset++) {
        const p = lst[(proxyState.current + offset) % lst.length];
        if (p.quarantine_until < now) {
            return p;
        }
    }
    return lst[proxyState.current % lst.length];
}

function rotateProxy() {
    const lst = proxyState.proxies;
    if (!lst.length) return null;
    proxyState.current++;
    return lst[proxyState.current % lst.length];
}

function markProxyFailed(proxy, latency_ms) {
    if (!proxy) return;
    const p = proxyState.proxies.find(x => x.url === proxy.url);
    if (p) {
        p.fail++;
        p.cons_fail++;
        p.last_latency_ms = latency_ms;
        if (p.cons_fail >= QUARANTINE_AFTER_FAILS) {
            p.quarantine_until = (Date.now() / 1000) + QUARANTINE_DURATION_SEC;
            console.log(`[proxy] quarantined ${p.url} for 5m`);
        }
    }
}

function markProxySuccess(proxy, latency_ms) {
    if (!proxy) return;
    const p = proxyState.proxies.find(x => x.url === proxy.url);
    if (p) {
        p.success++;
        p.cons_fail = 0;
        p.quarantine_until = 0;
        p.last_latency_ms = latency_ms;
    }
}

async function testRandomProxy() {
    const proxy = getProxy();
    if (!proxy) return { ok: false, info: 'Нет доступных прокси' };
    
    try {
        let agent;
        if (proxy.url) {
            const parsed = new URL(proxy.url);
            if (proxy.user) {
                parsed.username = encodeURIComponent(proxy.user);
                parsed.password = encodeURIComponent(proxy.pw);
            }
            if (proxy.url.startsWith('socks')) {
                agent = new SocksProxyAgent(parsed.toString());
            } else {
                agent = new HttpsProxyAgent(parsed.toString());
            }
        }
        
        const res = await axios.get('https://api.ipify.org/?format=json', {
            httpsAgent: agent,
            timeout: 15000
        });
        
        let info = `IP: ${res.data.ip}`;
        if (res.data.country) {
            info += ` (${res.data.country} ${res.data.cc || ''})`;
        }
        
        // Hide password from proxy_url before returning
        let safeUrl = proxy.url;
        if (proxy.user) {
            const parsed = new URL(proxy.url);
            safeUrl = `${parsed.protocol}//${proxy.user}:***@${parsed.host}`;
        }
        
        return { ok: true, info, proxy_url: safeUrl };
    } catch (e) {
        let safeUrl = proxy.url;
        if (proxy.user) {
            const parsed = new URL(proxy.url);
            safeUrl = `${parsed.protocol}//${proxy.user}:***@${parsed.host}`;
        }
        return { ok: false, info: e.message, proxy_url: safeUrl };
    }
}

async function triggerProxyRefresh(proxy) {
    if (proxy && proxy.refresh) {
        console.log(`[proxy] refreshing IP via URL: ${proxy.refresh}`);
        try {
            await axios.get(proxy.refresh, { timeout: 10000 });
            // Wait for IP to actually change on provider side
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.error(`[proxy] refresh failed: ${e.message}`);
        }
    }
}

module.exports = {
    initialize,
    loadProxies,
    saveToFile,
    fetchProxiesFromUrl,
    setAutoUpdateConfig,
    getAutoUpdateConfig,
    getProxiesCount,
    getStats,
    getProxy,
    rotateProxy,
    markProxyFailed,
    markProxySuccess,
    testRandomProxy,
    triggerProxyRefresh
};
