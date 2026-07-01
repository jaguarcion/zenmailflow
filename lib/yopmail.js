const { chromium } = require('playwright');
const url = require('url');

const PROXY_URL = "https://sx-list.org/NK5fxgZA7Wew5f6hh3NcBvBl8kPGhAf7.txt?limit=20&template_id=2";
let PROXIES = [];
let LAST_PROXY_UPDATE = 0;

async function getProxyList() {
    const now = Date.now();
    // Кешируем на 1 минуту (60000 мс), так как бесплатные прокси быстро умирают
    if (now - LAST_PROXY_UPDATE > 60000 || PROXIES.length === 0) {
        try {
            const response = await fetch(PROXY_URL);
            const text = await response.text();
            PROXIES = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            LAST_PROXY_UPDATE = now;
            console.log(`[*] Загружено ${PROXIES.length} прокси.`);
        } catch (err) {
            console.error(`[!] Ошибка загрузки прокси: ${err.message}`);
        }
    }
    return PROXIES;
}

async function getRandomProxy() {
    const proxies = await getProxyList();
    if (proxies.length === 0) return null;
    
    let proxyStr = proxies[Math.floor(Math.random() * proxies.length)];
    
    if (proxyStr.startsWith("socks5://")) {
        proxyStr = proxyStr.replace("socks5://", "http://");
    } else if (!proxyStr.startsWith("http://") && !proxyStr.startsWith("https://")) {
        proxyStr = "http://" + proxyStr;
    }
    
    const parsed = new url.URL(proxyStr);
    return {
        server: `${parsed.protocol}//${parsed.host}`, // host включает порт
        username: decodeURIComponent(parsed.username || ""),
        password: decodeURIComponent(parsed.password || "")
    };
}

async function getYopmailAlias(targetUrl, headless = true, maxRetries = 10) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const proxyObj = await getRandomProxy();
        let browser;
        
        try {
            if (proxyObj) {
                console.log(`[*] Попытка ${attempt}/${maxRetries}. Используется прокси: ${proxyObj.server}`);
                browser = await chromium.launch({ headless, proxy: proxyObj });
            } else {
                console.log(`[*] Попытка ${attempt}/${maxRetries}. Без прокси.`);
                browser = await chromium.launch({ headless });
            }
            
            const context = await browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale: "ru-RU",
                viewport: { width: 1280, height: 720 }
            });
            const page = await context.newPage();
            
            // Парсинг URL
            let login = "";
            let finalUrl = targetUrl;
            
            if (targetUrl.includes("?") && targetUrl.includes("picnic-")) {
                if (targetUrl.startsWith("https://yopmail.com?")) {
                    login = targetUrl.split("?")[1].split("&")[0];
                    finalUrl = `https://yopmail.com/ru/?login=${login}`;
                }
            } else if (targetUrl.includes("?") && targetUrl.split("?")[1].includes("-")) {
                login = targetUrl.split("?")[1].split("&")[0];
                finalUrl = `https://yopmail.com/ru/?login=${login}`;
            }
            
            console.log(`[*] Переход по ссылке: ${finalUrl}`);
            await page.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
            
            console.log("[*] Ожидание загрузки алиаса...");
            const aliasLocator = page.locator("#autoaltcpt");
            
            try {
                await aliasLocator.waitFor({ state: "visible", timeout: 10000 });
                const aliasText = await aliasLocator.innerText();
                await browser.close();
                return aliasText;
            } catch (err) {
                // Проверяем наличие CAPTCHA
                const captcha = page.locator("text='Complete the CAPTCHA to continue'");
                if (await captcha.count() > 0 && await captcha.first().isVisible()) {
                    console.log("[!] Сработала защита (CAPTCHA). Пробуем другой прокси.");
                    await browser.close();
                    continue;
                }
                
                const bname = page.locator(".bname");
                if (await bname.count() === 0) {
                    console.log("[!] Страница ящика не загрузилась (блок или ошибка загрузки). Пробуем другой прокси.");
                    await browser.close();
                    continue;
                }
                
                throw new Error("Таймаут ожидания алиаса.");
            }
        } catch (err) {
            const errorMsg = err.message;
            console.log(`[!] Ошибка при обработке ${targetUrl}: ${errorMsg}`);
            
            if (browser) {
                await browser.close().catch(() => {});
            }
            
            if (errorMsg.includes("net::ERR_") || errorMsg.includes("Timeout") || errorMsg.includes("Target page, context or browser has been closed")) {
                console.log("[!] Проблема с прокси (соединение не удалось). Переход к следующей попытке...");
                continue;
            } else {
                throw err;
            }
        }
    }
    
    throw new Error("Не удалось получить алиас после нескольких попыток из-за неработающих прокси или блокировок.");
}

module.exports = {
    getYopmailAlias
};
