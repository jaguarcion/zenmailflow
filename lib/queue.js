import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Reuse the same connection for all queues and workers
export const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

export const esetQueue = new Queue('eset-generation', { connection });
export const yopmailQueue = new Queue('yopmail-tasks', { connection });
