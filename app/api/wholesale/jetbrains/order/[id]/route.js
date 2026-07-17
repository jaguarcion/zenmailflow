import { NextResponse } from 'next/server';
import { getJetBrainsOrderById, getJetBrainsAccountsByOrderId } from '@/lib/db';

const PASSWORD = process.env.WHOLESALE_PASSWORD || 'optovik';

export async function GET(request, { params }) {
  const auth = request.headers.get('x-wholesale-auth');
  if (auth !== PASSWORD) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = params.id;
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
