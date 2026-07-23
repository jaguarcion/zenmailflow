const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

class BrowserService {
    async init() {
        const proxyConfig = require('./config').proxy;
        const launchArgs = [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ];

        // Chromium supports SOCKS5, but proxy-auth (username/password) via browser.newContext
        // is ONLY supported for HTTP/HTTPS proxies in Playwright. 
        // For SOCKS5, we either need to use a proxy without auth or pass it via args if it's supported.
        // As a workaround, we will try to use the proxy in HTTP format instead, if the proxy server supports it.
        // Let's pass proxy via launch args (which does not support auth, so we will still use context if HTTP).

        this.browser = await chromium.launch({
            headless: true,
            args: launchArgs
        });
        
        const contextOptions = {
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (proxyConfig && proxyConfig.server) {
            // Force HTTP instead of SOCKS5 to support authentication in Playwright
            const proxyServer = proxyConfig.server.replace('socks5://', 'http://');
            contextOptions.proxy = {
                server: proxyServer,
                username: proxyConfig.username,
                password: proxyConfig.password
            };
        }

        this.context = await this.browser.newContext(contextOptions);

        this.page = await this.context.newPage();
        return this.page;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = new BrowserService();
