import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { globalSearch } from '@/lib/db';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, data: { clients: [], accounts: [] } });
  }

  try {
    const results = globalSearch(q);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('[Search GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
