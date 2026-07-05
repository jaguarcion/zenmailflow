import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const isBuild = process.env.npm_lifecycle_event === 'build' || process.argv.includes('build') || process.env.NEXT_PHASE === 'phase-production-build';

// Reuse the same connection for all queues and workers
export const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy(times) {
        // Prevent infinite retries during Next.js build
        if (isBuild) {
            return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
    }
});

// Avoid connection errors during build by suppressing Redis errors
connection.on('error', (err) => {
    if (!isBuild) {
        console.error('[Redis Error]', err.message);
    }
});

export const esetQueue = isBuild ? { add: async () => {} } : new Queue('eset-generation', { connection });
export const yopmailQueue = isBuild ? { add: async () => {} } : new Queue('yopmail-tasks', { connection });

