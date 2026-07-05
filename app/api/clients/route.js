import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { getAllClients, insertClient } from '@/lib/db';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const clients = getAllClients();
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    console.error('[Clients GET]', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { email, telegram, subscription_ends_at } = body;

    // [SECURITY] M-01: Validate email format
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    // [SECURITY] M-01: Sanitize optional fields
    const safeTelegram = telegram ? String(telegram).slice(0, 100) : null;
    const safeSubStartDate = body.subscription_starts_at ? String(body.subscription_starts_at).slice(0, 10) : null;
    const safeSubDate = subscription_ends_at ? String(subscription_ends_at).slice(0, 10) : null;

    const result = insertClient(email, safeTelegram, safeSubStartDate, safeSubDate);
    
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('[Clients POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { id, email, telegram, subscription_ends_at } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    const safeTelegram = telegram ? String(telegram).slice(0, 100) : null;
    const safeSubStartDate = body.subscription_starts_at ? String(body.subscription_starts_at).slice(0, 10) : null;
    const safeSubDate = subscription_ends_at ? String(subscription_ends_at).slice(0, 10) : null;
    const safeEmail = email ? String(email) : null;

    const _db = require('better-sqlite3')(require('path').resolve(process.cwd(), 'emails.db'));
    _db.prepare(`
      UPDATE clients 
      SET email = COALESCE(?, email), 
          telegram = COALESCE(?, telegram), 
          subscription_starts_at = ?,
          subscription_ends_at = ? 
      WHERE id = ?
    `).run(safeEmail, safeTelegram, safeSubStartDate, safeSubDate, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Clients PUT]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
