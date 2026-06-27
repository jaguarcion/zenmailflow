import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { checkAdobeAccount } from '../lib/dongvanfb.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set in .env.local');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const dbPath = path.resolve(__dirname, '..', 'emails.db');
const db = new Database(dbPath);

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

console.log('[Bot] Started fetching updates...');

const supportModes = new Set(); // Stores chat_id of users in support mode

const KEYBOARD_MENU = {
    reply_markup: {
        keyboard: [
            [{ text: '👤 Мой аккаунт' }, { text: '📩 Письма' }],
            [{ text: '💬 Поддержка' }]
        ],
        resize_keyboard: true
    }
};

const ADMIN_KEYBOARD_MENU = {
    reply_markup: {
        keyboard: [
            [{ text: '👥 Статистика' }]
        ],
        resize_keyboard: true
    }
};

bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const linkToken = match[1];

    try {
        const client = db.prepare('SELECT id FROM clients WHERE bot_link_token = ?').get(linkToken);
        if (client) {
            db.prepare('UPDATE clients SET telegram_chat_id = ?, telegram_username = ?, telegram_first_name = ?, telegram_last_name = ? WHERE id = ?')
              .run(chatId.toString(), msg.from.username || null, msg.from.first_name || null, msg.from.last_name || null, client.id);
            bot.sendMessage(chatId, `✅ Привет, ${msg.from.first_name || 'друг'}! Ваш аккаунт успешно привязан. Выберите действие в меню ниже.`, KEYBOARD_MENU);
        } else {
            bot.sendMessage(chatId, '❌ Неверный или устаревший код привязки.');
        }
    } catch (e) {
        console.error(e);
        bot.sendMessage(chatId, '⚠️ Произошла ошибка. Попробуйте позже.');
    }
});

bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    if (ADMIN_IDS.includes(chatId.toString())) return; // Handled in 'message' event

    try {
        const existing = db.prepare('SELECT id FROM clients WHERE telegram_chat_id = ?').get(chatId.toString());
        if (existing) {
            return bot.sendMessage(chatId, 'Вы уже зарегистрированы!', KEYBOARD_MENU);
        }

        const token = crypto.randomUUID();
        db.prepare(`
            INSERT INTO clients (telegram_chat_id, telegram_username, telegram_first_name, telegram_last_name, bot_link_token) 
            VALUES (?, ?, ?, ?, ?)
        `).run(chatId.toString(), msg.from.username || null, msg.from.first_name || null, msg.from.last_name || null, token);

        bot.sendMessage(chatId, `Привет, ${msg.from.first_name || 'друг'}! Ваш профиль успешно создан.\n\nОжидайте, пока администратор проверит ваши данные и выдаст доступ к аккаунту.`, KEYBOARD_MENU);
    } catch (e) {
        console.error(e);
        bot.sendMessage(chatId, '⚠️ Произошла ошибка. Попробуйте позже.');
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands
    if (text && text.startsWith('/')) {
        // Special case: admin /start
        if (text === '/start' && ADMIN_IDS.includes(chatId.toString())) {
            return bot.sendMessage(chatId, 'Привет, Админ! Это панель управления.', ADMIN_KEYBOARD_MENU);
        }
        return;
    }

    // --- ADMIN LOGIC ---
    if (ADMIN_IDS.includes(chatId.toString())) {
        if (text === '👥 Статистика') {
            const clientsCount = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;
            const accountsCount = db.prepare('SELECT COUNT(*) as c FROM adobe_accounts').get().c;
            const activeAccs = db.prepare("SELECT COUNT(*) as c FROM adobe_accounts WHERE status = 'active'").get().c;
            return bot.sendMessage(chatId, `📊 **Статистика:**\n\nКлиентов: ${clientsCount}\nAdobe Аккаунтов: ${accountsCount} (из них активных: ${activeAccs})`, { parse_mode: 'Markdown', ...ADMIN_KEYBOARD_MENU });
        }

        // Check if admin is replying to a support message
        if (msg.reply_to_message && msg.reply_to_message.text) {
            const match = msg.reply_to_message.text.match(/\(ID:\s*(\d+)\)/);
            if (match && match[1]) {
                const clientId = parseInt(match[1]);
                const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
                if (client && client.telegram_chat_id) {
                    try {
                        db.prepare("INSERT INTO support_messages (client_id, sender, message, is_read) VALUES (?, 'admin', ?, 1)").run(client.id, text);
                        await bot.sendMessage(client.telegram_chat_id, `🧑‍💻 **Ответ от поддержки:**\n\n${text}`, { parse_mode: 'Markdown' });
                        return bot.sendMessage(chatId, '✅ Ответ отправлен клиенту.');
                    } catch (e) {
                        return bot.sendMessage(chatId, '⚠️ Ошибка при отправке ответа.');
                    }
                }
            }
        }
        return bot.sendMessage(chatId, 'Выберите действие в меню.', ADMIN_KEYBOARD_MENU);
    }
    // --- END ADMIN LOGIC ---

    // Get client
    const client = db.prepare('SELECT * FROM clients WHERE telegram_chat_id = ?').get(chatId.toString());
    if (!client) {
        if (!text.startsWith('/')) {
            bot.sendMessage(chatId, 'Вы не привязаны ни к какому аккаунту.');
        }
        return;
    }

    if (text === '👤 Мой аккаунт') {
        supportModes.delete(chatId);
        if (!client.adobe_account_id) {
            return bot.sendMessage(chatId, '❌ К вашему профилю не привязан ни один Adobe аккаунт. Напишите в поддержку.');
        }
        const acc = db.prepare('SELECT * FROM adobe_accounts WHERE id = ?').get(client.adobe_account_id);
        if (!acc) {
            return bot.sendMessage(chatId, '❌ Аккаунт не найден. Обратитесь в поддержку.');
        }

        const msgText = `👤 **Данные аккаунта:**
        
📧 Email: ${acc.email}
🔑 Пароль: ${acc.password || 'Нет'}
🔐 Пароль Adobe: ${acc.adobe_password || 'Нет'}
📊 Статус: ${acc.status === 'active' ? '🟢 Активен' : '🔴 Заблокирован'}`;
        return bot.sendMessage(chatId, msgText, { parse_mode: 'Markdown' });
    }

    if (text === '📩 Письма') {
        supportModes.delete(chatId);
        if (!client.adobe_account_id) {
            return bot.sendMessage(chatId, '❌ К вашему профилю не привязан ни один Adobe аккаунт.');
        }
        const acc = db.prepare('SELECT * FROM adobe_accounts WHERE id = ?').get(client.adobe_account_id);
        if (!acc) {
            return bot.sendMessage(chatId, '❌ Аккаунт не найден.');
        }

        bot.sendMessage(chatId, '⏳ Проверяем последние письма...');
        try {
            const result = await checkAdobeAccount(acc.email, acc.refresh_token, acc.device_id);
            let codes = [];
            
            if (result && result.isBanned && acc.status !== 'banned') {
                db.prepare("UPDATE adobe_accounts SET status = 'banned' WHERE id = ?").run(acc.id);
                bot.sendMessage(chatId, '🔴 Внимание: Ваш аккаунт заблокирован из-за обнаруженной мошеннической активности. Пожалуйста, обратитесь в поддержку.');
            }

            if (result && result.messages && Array.isArray(result.messages)) {
                codes = result.messages.filter(m => {
                    const subj = (m.subject || '').toLowerCase();
                    return subj.includes('verification code') || subj.includes('email address changed') || subj.includes('suspended');
                }).slice(0, 5);
            }
            
            if (codes.length === 0) {
                return bot.sendMessage(chatId, 'Писем с кодами не найдено.');
            }

            let responseText = '📩 **Последние важные письма:**\n\n';
            for (const m of codes) {
                const codeMatch = m.subject?.match(/\b\d{6}\b/);
                const code = codeMatch ? codeMatch[0] : (m.code || 'Код не найден (возможно просто уведомление)');
                responseText += `От: ${m.from?.address || m.from || 'Adobe'}\nТема: ${m.subject}\nКод: **${code}**\nВремя: ${m.date}\n---\n`;
            }
            return bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
        } catch (e) {
            return bot.sendMessage(chatId, '⚠️ Не удалось получить письма. Попробуйте позже.');
        }
    }

    if (text === '💬 Поддержка') {
        supportModes.add(chatId);
        return bot.sendMessage(chatId, '💬 Вы в режиме общения с поддержкой. Напишите ваш вопрос ниже:', {
            reply_markup: {
                keyboard: [[{ text: '❌ Выйти из поддержки' }]],
                resize_keyboard: true
            }
        });
    }

    if (text === '❌ Выйти из поддержки') {
        supportModes.delete(chatId);
        return bot.sendMessage(chatId, 'Вы вышли из режима поддержки.', KEYBOARD_MENU);
    }

    // Normal message handling (Support)
    if (supportModes.has(chatId) && text) {
        try {
            db.prepare('INSERT INTO support_messages (client_id, sender, message) VALUES (?, ?, ?)')
              .run(client.id, 'client', text);
            bot.sendMessage(chatId, '✅ Сообщение доставлено.');

            // Notify admins
            const clientName = client.telegram_first_name || client.telegram_username || client.email || `Клиент #${client.id}`;
            for (const adminId of ADMIN_IDS) {
                bot.sendMessage(adminId, `📨 **Новое сообщение от ${clientName}** (ID: ${client.id})\n\n${text}`, { parse_mode: 'Markdown' }).catch(() => {});
            }

        } catch (e) {
            console.error(e);
            bot.sendMessage(chatId, '⚠️ Не удалось отправить сообщение.');
        }
    } else {
        bot.sendMessage(chatId, 'Пожалуйста, используйте меню.', KEYBOARD_MENU);
    }
});
