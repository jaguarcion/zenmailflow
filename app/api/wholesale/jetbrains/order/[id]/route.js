import { NextResponse } from 'next/server';
import { authenticateWholesale } from '@/lib/wholesale-auth';
import { getJetBrainsOrderById, getJetBrainsAccountsByOrderId } from '@/lib/db';

export async function GET(request, { params }) {
  const auth = authenticateWholesale(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const order = getJetBrainsOrderById(id);
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const accounts = getJetBrainsAccountsByOrderId(id);

    return NextResponse.json({ success: true, order, accounts });
  } catch (error) {
    console.error('[Wholesale GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
