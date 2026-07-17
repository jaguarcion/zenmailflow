import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { getJetBrainsAccountsByOrderId } from '@/lib/db';

export async function GET(request, { params }) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const accounts = getJetBrainsAccountsByOrderId(id);
    return NextResponse.json({ success: true, accounts });
  } catch (error) {
    console.error('[Orders Download GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
