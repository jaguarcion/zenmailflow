import { NextResponse } from 'next/server';
import { insertJetBrainsOrder } from '@/lib/db';

const PASSWORD = process.env.WHOLESALE_PASSWORD || 'optovik';

export async function POST(request) {
  const auth = request.headers.get('x-wholesale-auth');
  if (auth !== PASSWORD) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { wooOrderId, quantity } = await request.json();

    if (!wooOrderId || !quantity || quantity < 1) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const orderId = insertJetBrainsOrder(wooOrderId, quantity);

    const tgBotToken = process.env.ADMIN_TG_BOT_TOKEN;
    const tgChatId = process.env.ADMIN_TG_CHAT_ID;
    if (tgBotToken && tgChatId) {
      const message = `📦 *Новый оптовый заказ JetBrains!*\n\nНомер Woo: #${wooOrderId}\nКоличество: ${quantity} шт.\nID заказа в системе: ${orderId}\n\nЗайдите в панель, чтобы запустить выполнение.`;
      try {
        fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text: message, parse_mode: 'Markdown' })
        }).catch(() => {}); // silent fail for telegram
      } catch (e) {}
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('[Wholesale POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
