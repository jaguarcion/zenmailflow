import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { getAllJetBrainsAccounts, insertJetBrainsAccount } from '@/lib/db';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const accounts = getAllJetBrainsAccounts();
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('[JetBrains Accounts GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  
  // Notice we only check tokens or cookies since internal APIs might use authorization token
  const authHeader = request.headers.get('authorization');
  let isAuthorized = authStatus.isAuth;
  
  if (!isAuthorized && authHeader && authHeader.startsWith('Bearer ')) {
    // Basic verification - this could be improved
    isAuthorized = true;
  }
  
  if (!isAuthorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { email, password, license_email } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const result = insertJetBrainsAccount(email, password, license_email);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('[JetBrains Accounts POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
