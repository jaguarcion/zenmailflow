import { NextResponse } from 'next/server';
import { authenticateWholesale } from '@/lib/wholesale-auth';
import { getAllJetBrainsOrders } from '@/lib/db';

export async function GET(request) {
  const auth = authenticateWholesale(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = getAllJetBrainsOrders();
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('[Wholesale Orders GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
