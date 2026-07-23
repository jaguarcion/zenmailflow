import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { startBatchEsetActivate } from './lib/eset/batchEsetActivate.js';
import { startJetBrainsActivation } from './lib/jetbrains/workerActivate.js';
import { startAppleRegistration } from './lib/apple/workerActivate.js';

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

const jetbrainsWorker = new Worker('jetbrains-activation', async job => {
    console.log(`[JetBrains Job] Processing job ${job.id} for email ${job.data.email}`);
    try {
        await startJetBrainsActivation(job.data.id, job.data.email, job.data.password, job.data.order_id);
        console.log(`[JetBrains Job] Job ${job.id} completed successfully`);
    } catch (err) {
        console.error(`[JetBrains Job] Job ${job.id} failed:`, err.message);
        throw err;
    }
}, { connection, concurrency: 1 });

jetbrainsWorker.on('failed', (job, err) => {
    console.error(`[JetBrains Job] Job ${job?.id} failed with error:`, err.message);
});

// Optionally you can add yopmail worker here later
// const yopmailWorker = new Worker('yopmail-tasks', async job => { ... }, { connection });

const appleWorker = new Worker('apple-registration', async job => {
    console.log(`[Apple Job] Processing job ${job.id} for count ${job.data.count}`);
    try {
        await startAppleRegistration(job.id, job.data.count);
        console.log(`[Apple Job] Job ${job.id} completed successfully`);
    } catch (err) {
        console.error(`[Apple Job] Job ${job.id} failed:`, err.message);
        throw err;
    }
}, { connection, concurrency: 1 });

appleWorker.on('failed', (job, err) => {
    console.error(`[Apple Job] Job ${job?.id} failed with error:`, err.message);
});

process.on('SIGINT', async () => {
    console.log('Closing workers...');
    await esetWorker.close();
    await jetbrainsWorker.close();
    await appleWorker.close();
    process.exit(0);
});
