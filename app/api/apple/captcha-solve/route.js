import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

export async function POST(req) {
    try {
        const { solution } = await req.json();
        const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        
        const waiting = await redis.get('apple_captcha_status');
        if (waiting === 'waiting') {
            await redis.set('apple_captcha_solution', solution, 'EX', 120);
            redis.disconnect();
            return NextResponse.json({ success: true });
        }
        
        redis.disconnect();
        return NextResponse.json({ error: 'Not currently waiting for captcha' }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
