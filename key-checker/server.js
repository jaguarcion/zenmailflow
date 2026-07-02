const express = require('express');
const cors = require('cors');
const path = require('path');
const proxyManager = require('./src/proxyManager');
const adobeClient = require('./src/adobeClient');
const configManager = require('./src/configManager');

const app = express();
const PORT = 3015;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: proxyManager.getProxiesCount() });
});

app.get('/api/proxy-stats', (req, res) => {
    res.json(proxyManager.getStats());
});

app.post('/proxies', async (req, res) => {
    const proxies = req.body.proxies || [];
    proxyManager.loadProxies(proxies);
    await proxyManager.saveToFile();
    res.json({ count: proxyManager.getProxiesCount() });
});

app.delete('/proxies', async (req, res) => {
    proxyManager.loadProxies([]);
    await proxyManager.saveToFile();
    await proxyManager.setAutoUpdateConfig({ url: '', interval_min: 0 });
    res.json({ ok: true, count: 0 });
});

app.post('/fetch-proxies', async (req, res) => {
    const url = req.body.url;
    const result = await proxyManager.fetchProxiesFromUrl(url);
    if (result.ok && result.lines && result.lines.length > 0) {
        proxyManager.loadProxies(result.lines);
        await proxyManager.saveToFile();
        await proxyManager.setAutoUpdateConfig({ url, interval_min: 60 });
    }
    res.json(result);
});

app.get('/api/config', (req, res) => {
    res.json(configManager.getConfig());
});

app.post('/api/config', (req, res) => {
    configManager.saveConfig(req.body);
    res.json({ ok: true });
});

app.post('/test-proxy', async (req, res) => {
    const result = await proxyManager.testRandomProxy();
    res.json(result);
});

app.get('/proxy-autoupdate', (req, res) => {
    res.json(proxyManager.getAutoUpdateConfig());
});

app.post('/proxy-autoupdate', async (req, res) => {
    const config = req.body;
    await proxyManager.setAutoUpdateConfig(config);
    res.json({ ok: true });
});

app.post('/check', async (req, res) => {
    if (!req.body.auth_token) {
        req.body.auth_token = configManager.getConfig().auth_token;
    }
    if (!req.body.fingerprint_token) {
        req.body.fingerprint_token = configManager.getConfig().fingerprint_token;
    }
    const result = await adobeClient.checkKey(req.body);
    res.json(result);
});



app.post('/api/test-token', async (req, res) => {
    const { auth_token } = req.body;
    if (!auth_token) return res.json({ ok: false, message: 'Токен не передан' });
    
    const result = await adobeClient.checkKey({ auth_token, code: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' });
    
    if (result.http_code === 401 || result.http_code === 403) {
        res.json({ ok: false, message: 'Токен недействителен (HTTP ' + result.http_code + ')' });
    } else if (result.http_code > 0) {
        res.json({ ok: true, message: 'Токен валидный!' });
    } else {
        res.json({ ok: false, message: 'Ошибка сети / прокси (HTTP 0)' });
    }
});

let tokenLastChecked = 0;
let tokenStatusMessage = '';

async function autoCheckToken() {
    const cfg = configManager.getConfig();
    if (!cfg.auth_token) return;
    
    try {
        const result = await adobeClient.checkKey({ auth_token: cfg.auth_token, code: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' });
        tokenLastChecked = Date.now();
        if (result.http_code === 401 || result.http_code === 403) {
            tokenStatusMessage = 'Токен недействителен (HTTP ' + result.http_code + ')';
        } else if (result.http_code > 0) {
            tokenStatusMessage = 'Токен жив';
        } else {
            tokenStatusMessage = 'Ошибка сети при проверке';
        }
    } catch (e) {
        tokenStatusMessage = 'Ошибка при фоновой проверке';
    }
}

app.get('/api/token-status', (req, res) => {
    res.json({ last_checked: tokenLastChecked, message: tokenStatusMessage });
});

// No frontend serving needed
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

(async () => {
    await proxyManager.initialize();
    
    // Auto check token on startup, then every hour
    setTimeout(autoCheckToken, 3000);
    setInterval(autoCheckToken, 60 * 60 * 1000); // 1 hour
    
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`Adobe Key Checker server listening on http://127.0.0.1:${PORT}`);
    });
})();
