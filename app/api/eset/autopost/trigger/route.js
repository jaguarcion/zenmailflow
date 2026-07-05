import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import db, { getSetting } from '@/lib/db';
import crypto from 'crypto';
import { startBatchEsetActivate } from '@/lib/eset/batchEsetActivate';

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const channelId = getSetting('eset_autopost_channel') || process.env.ESET_TELEGRAM_CHANNEL_ID || '';
        const count = parseInt(getSetting('eset_autopost_count'), 10) || 5;
        const botToken = process.env.ESET_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

        if (!channelId) {
            return NextResponse.json({ status: 'error', error: 'Не указан ID канала для автопостинга' }, { status: 400 });
        }
        if (!botToken) {
            return NextResponse.json({ status: 'error', error: 'Не указан токен бота (ESET_TELEGRAM_BOT_TOKEN)' }, { status: 400 });
        }

        // 1. Сгенерировать ключи (прямой вызов логики)
        const taskId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO eset_tasks (id, total, status, items_json, source, user_info)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(taskId, count, 'processing', '[]', 'api-telegram-autopost', 'manual_trigger');

        const concurrency = parseInt(getSetting('eset_concurrency'), 10) || 2;
        await startBatchEsetActivate(taskId, count, concurrency);

        const finalTask = db.prepare('SELECT items_json FROM eset_tasks WHERE id = ?').get(taskId);
        const items = JSON.parse(finalTask?.items_json || '[]');
        const keys = items.map(item => item.licenseKey).filter(Boolean);

        if (!Array.isArray(keys) || keys.length === 0) {
            throw new Error('Генератор не вернул ни одного ключа');
        }

        // 2. Отправить в Telegram
        const keysFormatted = keys.map(k => `<code>${k}</code>`).join('\n');
        const successMsg = `
🎁 <b>Свежая раздача ключей ESET!</b>

Забирайте ключи:
${keysFormatted}

<i>⚠️ Ключи разбирают очень быстро!</i>

🤖 <b>Не успели?</b>
Вы можете получить свой <b>личный бесплатный ключ</b> в нашем Telegram-боте: @eset_free_keys_bot
        `.trim();

        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: channelId,
                text: successMsg,
                parse_mode: 'HTML'
            })
        });

        const tgData = await tgRes.json();
        if (!tgData.ok) {
            throw new Error(`Ошибка Telegram API: ${tgData.description}`);
        }

        return NextResponse.json({ status: 'success', keysCount: keys.length });
    } catch (err) {
        console.error("Autopost trigger error:", err);
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
