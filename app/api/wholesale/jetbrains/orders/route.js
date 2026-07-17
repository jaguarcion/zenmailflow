import { NextResponse } from 'next/server';
import { getAllJetBrainsOrders } from '@/lib/db';

const PASSWORD = process.env.WHOLESALE_PASSWORD || 'optovik';

export async function GET(request) {
  const auth = request.headers.get('x-wholesale-auth');
  if (auth !== PASSWORD) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = getAllJetBrainsOrders();
    // Exclude sensitive data if necessary, but the wholesaler needs to see the status.
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('[Wholesale Orders GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
