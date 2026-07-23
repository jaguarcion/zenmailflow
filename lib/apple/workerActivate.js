import IORedis from 'ioredis';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const registrationFlow = require('./registration.js');
const config = require('./config.js');

const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export async function startAppleRegistration(jobId, count) {
    let queue = {
        total: count,
        current: 0,
        success: 0,
        failed: 0,
        running: true
    };
    
    await redis.set('apple_queue_status', JSON.stringify(queue));

    for (let i = 0; i < count; i++) {
        queue.current = i + 1;
        await redis.set('apple_queue_status', JSON.stringify(queue));
        console.log(`\n--- Starting Apple registration ${queue.current} of ${queue.total} ---`);
        
        // Refresh proxy IP if URL is provided
        if (config.proxy && config.proxy.refreshUrl) {
            try {
                console.log('Refreshing proxy IP...');
                const fetch = (await import('node-fetch')).default;
                const refreshRes = await fetch(config.proxy.refreshUrl);
                console.log(`Proxy refresh response: ${refreshRes.status} ${refreshRes.statusText}`);
                await new Promise(r => setTimeout(r, 5000));
            } catch (err) {
                console.error('Failed to refresh proxy IP:', err.message);
            }
        }

        try {
            const result = await registrationFlow.run();
            if (result && result.success) {
                queue.success++;
            } else {
                queue.failed++;
            }
        } catch (err) {
            console.error('Registration flow error:', err);
            queue.failed++;
        }
        await redis.set('apple_queue_status', JSON.stringify(queue));
    }
    
    queue.running = false;
    await redis.set('apple_queue_status', JSON.stringify(queue));
    console.log('\n--- Mass Apple registration finished ---');
    return queue;
}
