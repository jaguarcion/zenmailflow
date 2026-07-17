import { NextResponse } from 'next/server';
import { authenticateWholesale } from '@/lib/wholesale-auth';
import { insertJetBrainsOrder, getJetBrainsOrderByWooId } from '@/lib/db';

export async function POST(request) {
  // Auth check via JWT cookie
  const auth = authenticateWholesale(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { wooOrderId } = await request.json();

    if (!wooOrderId) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    let quantity = 0;
    const orderNumber = String(wooOrderId).replace(/\D/g, ''); // Extract only numbers

    if (!orderNumber) {
      return NextResponse.json({ success: false, error: 'Некорректный номер заказа' }, { status: 400 });
    }

    try {
      const wooStoreUrl = process.env.WOO_STORE_URL;
      const wooKey = process.env.WOO_CONSUMER_KEY;
      const wooSecret = process.env.WOO_CONSUMER_SECRET;
      const targetProductId = parseInt(process.env.WOO_JETBRAINS_PRODUCT_ID || '0');

      if (!wooKey || !wooSecret || !wooStoreUrl) {
        return NextResponse.json({ success: false, error: 'WooCommerce API not configured on server' }, { status: 500 });
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

    let orderId;
    const existingOrder = getJetBrainsOrderByWooId(orderNumber);
    if (existingOrder) {
      orderId = existingOrder.id;
      return NextResponse.json({ success: true, orderId });
    }

    orderId = insertJetBrainsOrder(orderNumber, quantity);

    // Telegram notification — use sanitized orderNumber, not raw input
    const tgBotToken = process.env.ADMIN_TG_BOT_TOKEN;
    const tgChatId = process.env.ADMIN_TG_CHAT_ID;
    if (tgBotToken && tgChatId) {
      const safeOrderNumber = String(orderNumber).replace(/[^0-9]/g, '');
      const message = `📦 *Новый оптовый заказ JetBrains\\!*\n\nНомер Woo: \\#${safeOrderNumber}\nКоличество: ${quantity} шт\\.\nID заказа в системе: ${orderId}\n\nЗайдите в панель, чтобы запустить выполнение\\.`;
      try {
        fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgChatId, text: message, parse_mode: 'MarkdownV2' })
        }).catch(() => {});
      } catch (e) {}
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error('[Wholesale POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
