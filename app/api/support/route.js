import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');
  const db = require('@/lib/db');

  try {
    const _db = require('better-sqlite3')(require('path').resolve(process.cwd(), 'emails.db'));
    
    if (clientId) {
      // Mark as read
      _db.prepare("UPDATE support_messages SET is_read = 1 WHERE client_id = ? AND sender = 'client'").run(clientId);
      
      const messages = _db.prepare("SELECT * FROM support_messages WHERE client_id = ? ORDER BY created_at ASC").all(clientId);
      return NextResponse.json({ success: true, data: messages });
    }

    // Get summary of all clients with messages
    const stmt = _db.prepare(`
      SELECT c.id, c.email, c.telegram, c.telegram_username, c.telegram_first_name, c.telegram_last_name,
             MAX(sm.created_at) as last_message_time,
             SUM(CASE WHEN sm.is_read = 0 AND sm.sender = 'client' THEN 1 ELSE 0 END) as unread_count
      FROM clients c
      JOIN support_messages sm ON c.id = sm.client_id
      GROUP BY c.id
      ORDER BY last_message_time DESC
    `);
    const threads = stmt.all();
    return NextResponse.json({ success: true, data: threads });
  } catch (error) {
    console.error('[Support GET]', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { client_id, message } = await request.json();
    if (!client_id || !message) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
    }

    const _db = require('better-sqlite3')(require('path').resolve(process.cwd(), 'emails.db'));
    const client = _db.prepare("SELECT * FROM clients WHERE id = ?").get(client_id);
    if (!client || !client.telegram_chat_id) {
      return NextResponse.json({ success: false, error: 'Client has no Telegram connected' }, { status: 400 });
    }

    // Save to DB
    _db.prepare("INSERT INTO support_messages (client_id, sender, message, is_read) VALUES (?, ?, ?, 1)")
       .run(client_id, 'admin', message);

    // Send to Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: client.telegram_chat_id,
                text: `🧑‍💻 **Ответ от поддержки:**\n\n${message}`,
                parse_mode: 'Markdown'
            })
        });
        if (!tgRes.ok) {
            console.error('Telegram sending failed:', await tgRes.text());
        }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Support POST]', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
