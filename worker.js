import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { startBatchEsetActivate } from './lib/eset/batchEsetActivate.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});

console.log('🚀 Worker started. Listening for ESET jobs...');

const esetWorker = new Worker('eset-generation', async job => {
    console.log(`[ESET Job] Processing job ${job.id} for task ${job.data.taskId}`);
    try {
        await startBatchEsetActivate(
            job.data.taskId, 
            job.data.totalCount, 
            job.data.concurrency
        );
        console.log(`[ESET Job] Job ${job.id} completed successfully`);
    } catch (err) {
        console.error(`[ESET Job] Job ${job.id} failed:`, err);
        throw err;
    }
}, { connection, concurrency: 5 });

esetWorker.on('failed', (job, err) => {
    console.error(`[ESET Job] Job ${job?.id} failed with error:`, err.message);
});

// Optionally you can add yopmail worker here later
// const yopmailWorker = new Worker('yopmail-tasks', async job => { ... }, { connection });

process.on('SIGINT', async () => {
    console.log('Closing workers...');
    await esetWorker.close();
    process.exit(0);
});
