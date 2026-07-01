const { chromium } = require('playwright');
const url = require('url');

const PROXY_STRING = "http://4w99sxjb5s-corp.mobile.res-country-LV-hold-session-session-6a45848ec8ed4:ohh401aJwRYe8xuN@82.27.118.182:443:Latvia[https://api.sx.org/proxy/a6bc9af1-7592-11f1-ae21-bc24114c89e8/refresh-ip]";

let PROXY_OBJ = null;
let REFRESH_URL = null;
let LAST_REFRESH = 0;

function parseProxy() {
    if (PROXY_OBJ) return PROXY_OBJ;
    
    const match = PROXY_STRING.match(/(https?:\/\/.+?:\d+|socks5?:\/\/.+?:\d+)(?:.*\[(.*)\])?/);
    if (match) {
        const parsed = new url.URL(match[1]);
        PROXY_OBJ = {
            server: `${parsed.protocol}//${parsed.host}`,
            username: decodeURIComponent(parsed.username || ""),
            password: decodeURIComponent(parsed.password || "")
        };
        REFRESH_URL = match[2];
    }
    return PROXY_OBJ;
}

async function refreshProxyIp() {
    if (!REFRESH_URL) return;
    const now = Date.now();
    // Избегаем слишком частых рефрешей (минимум 15 секунд между запросами)
    if (now - LAST_REFRESH < 15000) return;
    
    try {
        console.log(`[*] Отправка запроса на смену IP прокси...`);
        const res = await fetch(REFRESH_URL);
        const text = await res.text();
        console.log(`[*] Ответ сервера смены IP: ${text}`);
        LAST_REFRESH = now;
        // Даем немного времени прокси на смену IP
        await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
        console.error(`[!] Ошибка при смене IP прокси: ${err.message}`);
    }
}

async function getYopmailAlias(targetUrl, headless = true, maxRetries = 10) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const proxyObj = parseProxy();
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
                    console.log("[!] Сработала защита (CAPTCHA). Меняем IP прокси...");
                    await browser.close();
                    await refreshProxyIp();
                    continue;
                }
                
                const bname = page.locator(".bname");
                if (await bname.count() === 0) {
                    console.log("[!] Страница ящика не загрузилась (блок или ошибка загрузки). Меняем IP прокси...");
                    await browser.close();
                    await refreshProxyIp();
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
                console.log("[!] Проблема с прокси (соединение не удалось). Меняем IP прокси...");
                await refreshProxyIp();
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
