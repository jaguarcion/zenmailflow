import { NextResponse } from 'next/server';
import IORedis from 'ioredis';

export async function POST() {
    try {
        const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        
        const statusStr = await redis.get('apple_queue_status');
        if (statusStr) {
            const status = JSON.parse(statusStr);
            status.running = false;
            status.logs = status.logs || [];
            status.logs.push(`[${new Date().toLocaleTimeString('ru-RU')}] 🛑 Процесс был принудительно отменен пользователем.`);
            await redis.set('apple_queue_status', JSON.stringify(status));
        }

        // Also clear any stuck captcha state
        await redis.del('apple_captcha_status');
        await redis.del('apple_captcha_solution');

        redis.disconnect();

        return NextResponse.json({ success: true, message: 'Process cancelled' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
