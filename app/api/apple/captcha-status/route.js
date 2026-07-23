import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

export async function GET() {
    try {
        const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        const status = await redis.get('apple_captcha_status');
        redis.disconnect();
        
        return NextResponse.json({ waiting: status === 'waiting' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
