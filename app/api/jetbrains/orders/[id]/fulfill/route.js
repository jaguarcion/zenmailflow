import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { getJetBrainsOrderById, reserveEmailsForOrder, updateJetBrainsOrderStatus, updateJetBrainsStudentEmailStatus } from '@/lib/db';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

const jetbrainsQueue = new Queue('jetbrains-activation', { connection });

export async function POST(request, { params }) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const order = getJetBrainsOrderById(id);
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.status === 'completed' || order.fulfilled >= order.quantity) {
      return NextResponse.json({ success: false, error: 'Order is already fully fulfilled' }, { status: 400 });
    }

    const remaining = order.quantity - order.fulfilled;

    // Reserve emails
    const emailsToProcess = reserveEmailsForOrder(id, remaining);

    if (emailsToProcess.length === 0) {
      return NextResponse.json({ success: false, error: 'Нет свободных почт со статусом pending в пуле. Загрузите новые почты.' }, { status: 400 });
    }

    // Update order status
    updateJetBrainsOrderStatus(id, 'processing');

    // Add to BullMQ
    let enqueued = 0;
    for (const item of emailsToProcess) {
      updateJetBrainsStudentEmailStatus(item.id, 'processing');
      await jetbrainsQueue.add('activate', {
          id: item.id,
          email: item.email,
          password: item.password,
          order_id: parseInt(id)
      });
      enqueued++;
    }

    return NextResponse.json({ success: true, enqueued });
  } catch (error) {
    console.error('[Orders Fulfill POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
