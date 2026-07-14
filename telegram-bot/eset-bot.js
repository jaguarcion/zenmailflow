import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import cron from 'node-cron';
import crypto from 'crypto';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const token = process.env.ESET_TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
    console.error('ESET_TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
}

const APP_TOKEN = process.env.APP_ACCESS_TOKEN?.trim();
if (!APP_TOKEN) {
    console.error('APP_ACCESS_TOKEN is not set in .env.local');
    process.exit(1);
}

const BASE_URL = process.env.APP_BASE_URL?.trim() || 'https://mail.cdk-gpt.ru';

const bot = new TelegramBot(token, { polling: true });
const dbPath = path.resolve(__dirname, '..', 'emails.db');
const db = new Database(dbPath);

console.log('[ESET Bot] Started fetching updates...');

const KEYBOARD_MENU = {
    reply_markup: {
        keyboard: [
            [{ text: 'рџ”‘ РџРѕР»СѓС‡РёС‚СЊ РєР»СЋС‡' }, { text: 'рџ‘¤ РњРѕР№ РїСЂРѕС„РёР»СЊ' }]
        ],
        resize_keyboard: true
    }
};

function getUser(msg) {
    const tgId = msg.chat.id.toString();
    const user = db.prepare('SELECT * FROM eset_tg_users WHERE tg_id = ?').get(tgId);
    if (!user) {
        const info = db.prepare(`
            INSERT INTO eset_tg_users (tg_id, username, first_name)
            VALUES (?, ?, ?)
            RETURNING *
        `).get(tgId, msg.from.username || null, msg.from.first_name || null);
        return info;
    }
    return user;
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUser(msg);
    bot.sendMessage(
        chatId, 
        `рџ‘‹ РџСЂРёРІРµС‚, ${user.first_name || 'РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ'}!\n\nР­С‚Рѕ Р±РѕС‚ РґР»СЏ Р±РµСЃРїР»Р°С‚РЅРѕР№ СЂР°Р·РґР°С‡Рё РєР»СЋС‡РµР№ ESET. Р’С‹ РјРѕР¶РµС‚Рµ РїРѕР»СѓС‡РёС‚СЊ 1 РєР»СЋС‡ СЂР°Р· РІ СЃСѓС‚РєРё.`, 
        KEYBOARD_MENU
    );
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === 'рџ‘¤ РњРѕР№ РїСЂРѕС„РёР»СЊ') {
        const user = getUser(msg);
        
        let resetText = "вњ… Р”РѕСЃС‚СѓРїРµРЅ 1 РєР»СЋС‡";
        if (user.last_generation_at) {
            const lastGenTime = new Date(user.last_generation_at).getTime();
            const now = Date.now();
            const msPassed = now - lastGenTime;
            const msIn24Hours = 24 * 60 * 60 * 1000;
            
            if (msPassed < msIn24Hours) {
                const remaining = msIn24Hours - msPassed;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                resetText = `вЏі РћР±РЅРѕРІР»РµРЅРёРµ Р»РёРјРёС‚Р° С‡РµСЂРµР· ${hours} С‡. ${mins} РјРёРЅ.`;
            }
        }

        const profileText = `
рџ‘¤ <b>Р’Р°С€ РїСЂРѕС„РёР»СЊ</b>

рџ’Ћ <b>РЎС‚Р°С‚СѓСЃ:</b> Р‘Р°Р·РѕРІС‹Р№ (Р‘РµСЃРїР»Р°С‚РЅС‹Р№)
рџ“… <b>Р РµРіРёСЃС‚СЂР°С†РёСЏ:</b> ${new Date(user.created_at).toLocaleDateString('ru-RU')}
рџ”‘ <b>РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРѕ РєР»СЋС‡РµР№:</b> ${user.keys_received}

рџ”„ <b>Р›РёРјРёС‚:</b> 1 РєР»СЋС‡ РІ СЃСѓС‚РєРё
${resetText}
        `.trim();

        bot.sendMessage(chatId, profileText, { parse_mode: 'HTML', ...KEYBOARD_MENU });
        return;
    }

    if (text === 'рџ”‘ РџРѕР»СѓС‡РёС‚СЊ РєР»СЋС‡') {
        const user = getUser(msg);
        
        if (user.last_generation_at) {
            const lastGenTime = new Date(user.last_generation_at).getTime();
            const now = Date.now();
            if (now - lastGenTime < 24 * 60 * 60 * 1000) {
                return bot.sendMessage(chatId, 'вќЊ <b>Р’С‹ СѓР¶Рµ РїРѕР»СѓС‡Р°Р»Рё РєР»СЋС‡ Р·Р° РїРѕСЃР»РµРґРЅРёРµ 24 С‡Р°СЃР°!</b>\n\nРџСЂРёС…РѕРґРёС‚Рµ Р·Р°РІС‚СЂР° РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ С‚РѕС‡РЅРѕРµ РІСЂРµРјСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ Р»РёРјРёС‚Р° РІ РїСЂРѕС„РёР»Рµ.', { parse_mode: 'HTML' });
            }
        }

        const waitMsg = await bot.sendMessage(chatId, 'вЏі РћС‚РїСЂР°РІР»РµРЅ Р·Р°РїСЂРѕСЃ РЅР° РіРµРЅРµСЂР°С†РёСЋ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїРѕРґРѕР¶РґРёС‚Рµ (СЌС‚Рѕ РјРѕР¶РµС‚ Р·Р°РЅСЏС‚СЊ РѕРєРѕР»Рѕ 1 РјРёРЅСѓС‚С‹)...');

        try {
            // Use native fetch (Node.js 18+)
            const userInfo = user.username ? `@${user.username}` : user.first_name;
            const res = await fetch(`${BASE_URL}/api/eset/external/generate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${APP_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    count: 1, 
                    source: 'api-telegram',
                    user_info: userInfo 
                })
            });

            if (!res.ok) {
                throw new Error(`API Error: ${res.status}`);
            }

            const keys = await res.json();
            
            if (Array.isArray(keys) && keys.length > 0) {
                // Update DB limits
                db.prepare(`
                    UPDATE eset_tg_users 
                    SET keys_received = keys_received + 1, last_generation_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                `).run(user.id);

                bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
                
                const successMsg = `
вњ… <b>Р“РµРЅРµСЂР°С†РёСЏ СѓСЃРїРµС€РЅР°!</b>

Р’Р°С€ РєР»СЋС‡ ESET:
<code>${keys[0]}</code>

<i>РЎР»РµРґСѓСЋС‰РёР№ Р±РµСЃРїР»Р°С‚РЅС‹Р№ РєР»СЋС‡ Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРµРЅ СЂРѕРІРЅРѕ С‡РµСЂРµР· 24 С‡Р°СЃР°.</i>
                `.trim();
                bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' });
            } else {
                bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
                bot.sendMessage(chatId, 'вљ пёЏ РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РєР»СЋС‡ РѕС‚ СЃРµСЂРІРµСЂР°, РІРѕР·РјРѕР¶РЅРѕ Р·Р°РєРѕРЅС‡РёР»РёСЃСЊ РїСЂРѕРєСЃРё. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.');
            }
        } catch (err) {
            console.error('Generation err:', err);
            bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
            bot.sendMessage(chatId, 'вљ пёЏ Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ РѕС€РёР±РєР° СЃРµСЂРІРµСЂР°. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РѕР±СЂР°С‚РёС‚РµСЃСЊ Рє Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ РёР»Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.');
        }
        return;
    }
});

let currentCronJob = null;
let currentCronStr = null;
let currentChannelId = null;
let currentCount = 5;
let currentIsEnabled = true;

function reloadAutopostSettings() {
    try {
        const channelRow = db.prepare("SELECT value FROM app_settings WHERE key = 'eset_autopost_channel'").get();
        const cronRow = db.prepare("SELECT value FROM app_settings WHERE key = 'eset_autopost_cron'").get();
        const countRow = db.prepare("SELECT value FROM app_settings WHERE key = 'eset_autopost_count'").get();
        const enabledRow = db.prepare("SELECT value FROM app_settings WHERE key = 'eset_autopost_enabled'").get();

        const channelId = channelRow?.value || process.env.ESET_TELEGRAM_CHANNEL_ID?.trim();
        const cronStr = cronRow?.value || process.env.ESET_AUTOPOST_CRON?.trim() || '0 12 * * *';
        const count = parseInt(countRow?.value, 10) || 5;
        const isEnabled = enabledRow?.value !== 'false';

        currentCount = count;

        if (currentCronStr !== cronStr || currentChannelId !== channelId || currentIsEnabled !== isEnabled) {
            currentCronStr = cronStr;
            currentChannelId = channelId;
            currentIsEnabled = isEnabled;

            if (currentCronJob) {
                currentCronJob.stop();
                currentCronJob = null;
            }

            if (isEnabled && channelId && cronStr) {
                console.log(`[ESET Bot] Auto-posting configured for ${channelId} at ${cronStr} (count: ${count})`);
                currentCronJob = cron.schedule(cronStr, async () => {
                    console.log(`[ESET Bot] Running auto-posting job (count: ${currentCount})...`);
                    try {
                        let generatedKeys = [];
                        for (let i = 0; i < currentCount; i++) {
                            try {
                                const res = await fetch(`${BASE_URL}/api/eset/external/generate`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${APP_TOKEN}`,
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ 
                                        count: 1, 
                                        source: 'api-telegram-autopost',
                                        user_info: `channel_autopost_${i+1}_of_${currentCount}`
                                    })
                                });

                                if (!res.ok) {
                                    console.warn(`[ESET Bot] Error fetching key ${i+1}/${currentCount}: ${res.status}`);
                                    continue;
                                }

                                const keys = await res.json();
                                if (Array.isArray(keys) && keys.length > 0) {
                                    generatedKeys.push(...keys);
                                }
                            } catch (e) {
                                console.error(`[ESET Bot] Exception fetching key ${i+1}/${currentCount}:`, e.message);
                            }
                        }
                        
                        if (generatedKeys.length > 0) {
                            const keysFormatted = generatedKeys.map(k => `<code>${k}</code>`).join('\n');
                            const successMsg = `
рџЋЃ <b>РЎРІРµР¶Р°СЏ СЂР°Р·РґР°С‡Р° РєР»СЋС‡РµР№ ESET!</b>

Р—Р°Р±РёСЂР°Р№С‚Рµ РєР»СЋС‡Рё:
${keysFormatted}

<i>вљ пёЏ РљР»СЋС‡Рё СЂР°Р·Р±РёСЂР°СЋС‚ РѕС‡РµРЅСЊ Р±С‹СЃС‚СЂРѕ!</i>

рџ¤– <b>РќРµ СѓСЃРїРµР»Рё?</b>
Р’С‹ РјРѕР¶РµС‚Рµ РїРѕР»СѓС‡РёС‚СЊ СЃРІРѕР№ <b>Р»РёС‡РЅС‹Р№ Р±РµСЃРїР»Р°С‚РЅС‹Р№ РєР»СЋС‡</b> РІ РЅР°С€РµРј Telegram-Р±РѕС‚Рµ: @eset_free_keys_bot
                            `.trim();
                            
                            await bot.sendMessage(channelId, successMsg, { parse_mode: 'HTML' });
                            console.log(`[ESET Bot] Successfully auto-posted ${generatedKeys.length} keys to ${channelId}`);
                        } else {
                            console.warn('[ESET Bot] Auto-posting skipped: no keys generated or proxies exhausted.');
                        }
                    } catch (err) {
                        console.error('[ESET Bot] Auto-posting err:', err);
                    }
                });
            }
        }
    } catch (err) {
        // Table might not exist yet if DB is completely fresh, ignore safely
        if (!err.message.includes('no such table')) {
            console.error('[ESET Bot] Error reloading autopost settings:', err);
        }
    }
}

reloadAutopostSettings();
setInterval(reloadAutopostSettings, 60000);

// --- Background Proxy Checker ---
async function checkProxyHealth() {
    try {
        const proxyRow = db.prepare("SELECT value FROM app_settings WHERE key = 'eset_proxy'").get();
        if (!proxyRow || !proxyRow.value) return;

        const proxyStr = proxyRow.value;
        console.log('[ESET Bot] Running background proxy check...');
        
        const res = await fetch(BASE_URL + '/api/eset/proxy/check', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + APP_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ proxy: proxyStr })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                console.log('[ESET Bot] Proxy is HEALTHY. IP: ' + data.ip + ' (' + data.timeMs + 'ms)');
            } else {
                console.warn('[ESET Bot] Proxy is DEAD. Error: ' + data.error);
                if (data.refreshed) {
                    console.log('[ESET Bot] Successfully hit refresh_url to get new IP.');
                }
            }
        }
    } catch (err) {
        console.error('[ESET Bot] Background proxy check failed:', err.message);
    }
}

// Run every 1 hour (cron format: 0 * * * *)
cron.schedule('0 * * * *', checkProxyHealth);
// Also run once on startup after 10s
setTimeout(checkProxyHealth, 10000);

