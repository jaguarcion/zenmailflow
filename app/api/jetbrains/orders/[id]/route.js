import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { deleteJetBrainsOrder, getJetBrainsOrderById } from '@/lib/db';

export async function DELETE(request, { params }) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const order = getJetBrainsOrderById(id);
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    deleteJetBrainsOrder(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[JetBrains Order DELETE]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
