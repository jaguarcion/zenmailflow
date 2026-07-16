import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { updateJetBrainsStudentEmailStatus } from '@/lib/db';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

const jetbrainsQueue = new Queue('jetbrains-activation', { connection });

export async function POST(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { items } = body; // Array of { id, email, password }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'items array required' }, { status: 400 });
    }

    let enqueued = 0;
    for (const item of items) {
      if (item.id && item.email && item.password) {
        // Update DB status to processing
        updateJetBrainsStudentEmailStatus(item.id, 'processing');
        
        // Add job
        await jetbrainsQueue.add('activate', {
            id: item.id,
            email: item.email,
            password: item.password
        });
        enqueued++;
      }
    }

    return NextResponse.json({ success: true, enqueued });
  } catch (error) {
    console.error('[StudentEmails Activate POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
