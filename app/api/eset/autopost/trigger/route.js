import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSetting } from '@/lib/db';

export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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

        // 1. Сгенерировать ключи через внутреннее API
        const generateUrl = new URL('/api/eset/external/generate', request.url);
        
        // Pass the auth token
        const authHeader = request.headers.get('Authorization');
        
        const genRes = await fetch(generateUrl.toString(), {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                count: count,
                source: 'api-telegram-autopost',
                user_info: 'manual_trigger'
            })
        });

        if (!genRes.ok) {
            throw new Error(`Ошибка генерации: ${genRes.statusText}`);
        }

        const keys = await genRes.json();

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
