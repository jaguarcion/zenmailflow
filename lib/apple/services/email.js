const axios = require('axios');
const { faker } = require('@faker-js/faker');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config');

class EmailService {
    constructor() {
        this.proxyAgent = null;
        if (config.browser && config.browser.proxy && config.browser.proxy.server) {
            try {
                const proxyUrl = new URL(config.browser.proxy.server);
                proxyUrl.username = config.browser.proxy.username;
                proxyUrl.password = config.browser.proxy.password;
                this.proxyAgent = new HttpsProxyAgent(proxyUrl.toString());
            } catch (e) {
                console.error('Proxy config error for EmailService:', e.message);
            }
        }
    }

    async generateEmail() {
        const login = faker.word.noun().toLowerCase().replace(/[^a-z]/g, '') + Math.floor(Math.random() * 10000);
        const url = `https://pro100pochta.com/?${login}`;
        
        try {
            const res = await axios.get(url, { httpsAgent: this.proxyAgent, timeout: 10000 });
            // In the HTML: <div class="d-flex align-items-center">Почта: unk.jgc-0woou9@pro100pochta.com
            const match = res.data.match(/Почта:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
            if (match) {
                return { login, email: match[1] };
            }
            throw new Error('Could not parse email address from response');
        } catch (e) {
            console.error('Pro100pochta generateEmail error:', e.message);
            throw new Error('Failed to generate email from Pro100pochta');
        }
    }

    async getAppleVerificationCode(login, timeoutMs = 120000) {
        const startTime = Date.now();
        console.log(`Waiting for Apple verification email for login: ${login}`);

        while (Date.now() - startTime < timeoutMs) {
            try {
                const listRes = await axios.get(`https://pro100pochta.com/api/get-list-new.php?m=${login}`, { 
                    httpsAgent: this.proxyAgent,
                    timeout: 10000 
                });

                if (Array.isArray(listRes.data)) {
                    for (let msg of listRes.data) {
                        if (msg.from && msg.from.toLowerCase().includes('apple')) {
                            // Fetch full message
                            const msgRes = await axios.get(`https://pro100pochta.com/api/get-one-new.php?m=${login}&i=${encodeURIComponent(msg.id)}`, {
                                httpsAgent: this.proxyAgent,
                                timeout: 10000
                            });

                            const content = msgRes.data.content || '';
                            // Apple codes are usually 6 digits
                            const codeMatch = content.match(/\b\d{6}\b/);
                            if (codeMatch) {
                                return codeMatch[0];
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore temporary fetch errors during polling
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('Timeout waiting for Apple verification email');
    }
}

module.exports = new EmailService();
