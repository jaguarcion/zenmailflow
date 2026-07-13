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
            [{ text: '🔑 Получить ключ' }, { text: '👤 Мой профиль' }]
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
        `👋 Привет, ${user.first_name || 'пользователь'}!\n\nЭто бот для бесплатной раздачи ключей ESET. Вы можете получить 1 ключ раз в сутки.`, 
        KEYBOARD_MENU
    );
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '👤 Мой профиль') {
        const user = getUser(msg);
        
        let resetText = "✅ Доступен 1 ключ";
        if (user.last_generation_at) {
            const lastGenTime = new Date(user.last_generation_at).getTime();
            const now = Date.now();
            const msPassed = now - lastGenTime;
            const msIn24Hours = 24 * 60 * 60 * 1000;
            
            if (msPassed < msIn24Hours) {
                const remaining = msIn24Hours - msPassed;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                resetText = `⏳ Обновление лимита через ${hours} ч. ${mins} мин.`;
            }
        }

        const profileText = `
👤 <b>Ваш профиль</b>

💎 <b>Статус:</b> Базовый (Бесплатный)
📅 <b>Регистрация:</b> ${new Date(user.created_at).toLocaleDateString('ru-RU')}
🔑 <b>Сгенерировано ключей:</b> ${user.keys_received}

🔄 <b>Лимит:</b> 1 ключ в сутки
${resetText}
        `.trim();

        bot.sendMessage(chatId, profileText, { parse_mode: 'HTML', ...KEYBOARD_MENU });
        return;
    }

    if (text === '🔑 Получить ключ') {
        const user = getUser(msg);
        
        if (user.last_generation_at) {
            const lastGenTime = new Date(user.last_generation_at).getTime();
            const now = Date.now();
            if (now - lastGenTime < 24 * 60 * 60 * 1000) {
                return bot.sendMessage(chatId, '❌ <b>Вы уже получали ключ за последние 24 часа!</b>\n\nПриходите завтра или проверьте точное время обновления лимита в профиле.', { parse_mode: 'HTML' });
            }
        }

        const waitMsg = await bot.sendMessage(chatId, '⏳ Отправлен запрос на генерацию. Пожалуйста, подождите (это может занять около 1 минуты)...');

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
✅ <b>Генерация успешна!</b>

Ваш ключ ESET:
<code>${keys[0]}</code>

<i>Следующий бесплатный ключ будет доступен ровно через 24 часа.</i>
                `.trim();
                bot.sendMessage(chatId, successMsg, { parse_mode: 'HTML' });
            } else {
                bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
                bot.sendMessage(chatId, '⚠️ Не удалось получить ключ от сервера, возможно закончились прокси. Попробуйте позже.');
            }
        } catch (err) {
            console.error('Generation err:', err);
            bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
            bot.sendMessage(chatId, '⚠️ Внутренняя ошибка сервера. Пожалуйста, обратитесь к администратору или попробуйте позже.');
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
🎁 <b>Свежая раздача ключей ESET!</b>

Забирайте ключи:
${keysFormatted}

<i>⚠️ Ключи разбирают очень быстро!</i>

🤖 <b>Не успели?</b>
Вы можете получить свой <b>личный бесплатный ключ</b> в нашем Telegram-боте: @eset_free_keys_bot
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
