import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

export async function GET() {
    try {
        const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        const statusStr = await redis.get('apple_queue_status');
        redis.disconnect();
        
        if (!statusStr) {
            return NextResponse.json({ running: false, total: 0, current: 0, success: 0, failed: 0 });
        }
        
        return NextResponse.json(JSON.parse(statusStr));
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
