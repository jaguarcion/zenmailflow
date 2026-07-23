import { NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const appleQueue = new Queue('apple-registration', { connection });

export async function POST(req) {
    try {
        const { count } = await req.json();
        
        if (!count || count <= 0) {
            return NextResponse.json({ error: 'Invalid count' }, { status: 400 });
        }

        const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        const statusStr = await redis.get('apple_queue_status');
        if (statusStr) {
            const status = JSON.parse(statusStr);
            if (status.running) {
                redis.disconnect();
                return NextResponse.json({ error: 'Registration is already running' }, { status: 400 });
            }
        }
        redis.disconnect();

        const job = await appleQueue.add('apple-registration', { count });
        return NextResponse.json({ success: true, message: 'Started', jobId: job.id });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
