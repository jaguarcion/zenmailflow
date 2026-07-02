const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const proxyManager = require('./proxyManager');

const tokenBans = new Map();

const RATE_LIMIT_HINTS = ['closed', 'reset', 'forcibly', 'connection was closed', 'aborted', 'eof', 'empty response', 'timeout', 'connection refused', 'timed out', 'remotely closed', 'socket hang up'];
const PROXY_ERROR_HINTS = ['tunnel', '407', 'proxy auth', 'proxy connect', '404 not found', 'not found: 404', 'connect failed', 'econnreset'];

function isProxyError(result) {
    // Любая ошибка на уровне сети/сокетов (http_code === 0) означает, что прокси отвалился
    if (result.http_code === 0) return true;

    
    // Иногда Adobe может вернуть 403 при бане IP, но чаще это 429
    if (result.http_code === 403 && !result.adobe_status) return true;
    
    return false;
}

async function doAdobeRequest(authToken, cleanCode, proxy, reqCookies) {
    let token = authToken;
    if (token.toLowerCase().startsWith('bearer ')) {
        token = token.slice(7);
    }
    
    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "x-api-key": "redemption_ui_client",
        "Origin": "https://redeem.adobe.com",
        "Referer": "https://redeem.adobe.com/",
        "Connection": "close"
    };
    
    if (token) headers["Authorization"] = token;
    
    if (reqCookies && Object.keys(reqCookies).length > 0) {
        headers["Cookie"] = Object.entries(reqCookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    
    let agent;
    if (proxy && proxy.url) {
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
    
    const payload = {
        redemption_code: cleanCode,
        redemption_locale: "ru_RU"
    };
    
    try {
        const resp = await axios.post('https://redeem-requests.adobe.io/v1', payload, {
            headers,
            httpsAgent: agent,
            timeout: 20000,
            validateStatus: () => true // Resolve on all HTTP codes
        });
        
        const adobeStatus = resp.headers['x-adobe-status'] || '';
        
        // Collect cookies
        const setCookieHeaders = resp.headers['set-cookie'] || [];
        for (const cookieStr of setCookieHeaders) {
            const pair = cookieStr.split(';')[0].trim();
            if (pair.includes('=')) {
                const [name, ...valParts] = pair.split('=');
                reqCookies[name.trim()] = valParts.join('=').trim();
            }
        }
        
        return {
            http_code: resp.status,
            adobe_status: adobeStatus,
            body: resp.data,
            _cookies: reqCookies
        };
    } catch (e) {
        return {
            http_code: 0,
            adobe_status: '',
            body: { message: e.message },
            _cookies: reqCookies
        };
    }
}

async function checkKey(data) {
    const config_auth_token = (data.auth_token || '').trim();
    const tokens = config_auth_token.split('\n').map(t=>t.trim()).filter(Boolean);
    const cookie_val = (data.cookie || '').trim();
    const code = (data.code || '').trim();
    const clean_code = code.replace(/ /g, '').toUpperCase();
    
    if (tokens.length === 0) {
        return { code, http_code: 400, adobe_status: '', body: { message: 'Токен не указан' } };
    }
    
    let keyCookies = {};
    
    // Parse cookie from plugin if provided
    if (cookie_val.startsWith('[') || cookie_val.startsWith('{')) {
        try {
            const items = JSON.parse(cookie_val);
            if (Array.isArray(items)) {
                for (const c of items) {
                    if (c.name && c.value) {
                        keyCookies[c.name] = c.value;
                    }
                }
            }
        } catch (e) {}
    } else if (cookie_val) {
        const pairs = cookie_val.split(';');
        for (const p of pairs) {
            if (p.includes('=')) {
                const [k, ...v] = p.split('=');
                keyCookies[k.trim()] = v.join('=').trim();
            }
        }
    }
    
    const result = { code, http_code: 0, adobe_status: '', body: {} };
    
    let token = tokens[0];
    
    for (let attempt = 0; attempt < 20; attempt++) {
        const proxy = proxyManager.getProxy();
        if (!proxy && attempt > 0) break;
        
        const t0 = Date.now();
        const parsed = await doAdobeRequest(token, clean_code, proxy, keyCookies);
        const latency_ms = Date.now() - t0;
        
        keyCookies = parsed._cookies || {};
        delete parsed._cookies;
        Object.assign(result, parsed);
        
        if (isProxyError(result)) {
            proxyManager.markProxyFailed(proxy, latency_ms);
            if (proxy && proxy.refresh) {
                await proxyManager.triggerProxyRefresh(proxy);
            } else {
                proxyManager.rotateProxy();
                await new Promise(r => setTimeout(r, 300));
            }
            continue;
        }
        
        proxyManager.markProxySuccess(proxy, latency_ms);
        break;
    }
    

    
    const masked = code.length > 12 ? code.slice(0, 4) + '...' + code.slice(-4) : '****';
    console.log(`[${masked.padEnd(14)}] HTTP ${result.http_code} ${result.adobe_status || '-'}`);
    
    return result;
}

module.exports = {
    checkKey
};
