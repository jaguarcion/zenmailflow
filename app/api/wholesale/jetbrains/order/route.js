import { NextResponse } from 'next/server';
import { insertJetBrainsOrder } from '@/lib/db';

const PASSWORD = process.env.WHOLESALE_PASSWORD || 'optovik';

export async function POST(request) {
  const auth = request.headers.get('x-wholesale-auth');
  if (auth !== PASSWORD) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { wooOrderId } = await request.json();

    if (!wooOrderId) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    let quantity = 0;
    const orderNumber = wooOrderId.replace(/\D/g, ''); // Extract only numbers

    try {
      const wooStoreUrl = process.env.WOO_STORE_URL || 'https://keysoft.store';
      const wooKey = process.env.WOO_CONSUMER_KEY;
      const wooSecret = process.env.WOO_CONSUMER_SECRET;
      const targetProductId = parseInt(process.env.WOO_JETBRAINS_PRODUCT_ID || '1613979');

      if (!wooKey || !wooSecret) {
        return NextResponse.json({ success: false, error: 'WooCommerce API keys not configured on server' }, { status: 500 });
      }

      const authHeader = 'Basic ' + Buffer.from(`${wooKey}:${wooSecret}`).toString('base64');
      const wcRes = await fetch(`${wooStoreUrl}/wp-json/wc/v3/orders/${orderNumber}`, {
        headers: { 'Authorization': authHeader }
      });
      
      if (!wcRes.ok) {
        return NextResponse.json({ success: false, error: 'Заказ не найден в WooCommerce' }, { status: 404 });
      }
      
      const wcData = await wcRes.json();
      
      if (wcData.status !== 'processing' && wcData.status !== 'completed') {
        return NextResponse.json({ success: false, error: `Заказ не оплачен (статус: ${wcData.status})` }, { status: 400 });
      }
      
      for (const item of wcData.line_items) {
        if (item.product_id === targetProductId) {
          quantity += item.quantity;
        }
      }
      
      if (quantity < 1) {
        return NextResponse.json({ success: false, error: 'В заказе нет товара JetBrains' }, { status: 400 });
      }
      
    } catch (e) {
      console.error('[WooCommerce API Error]', e);
      return NextResponse.json({ success: false, error: 'Ошибка связи с магазином' }, { status: 500 });
    }

    const orderId = insertJetBrainsOrder(orderNumber, quantity);

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
