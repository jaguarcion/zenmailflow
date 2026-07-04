import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import db, { getSetting } from '@/lib/db';
import crypto from 'crypto';
import { startBatchEsetActivate } from '@/lib/eset/batchEsetActivate';

async function handleRequest(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        let count = 1;

        if (request.method === 'POST') {
            try {
                const body = await request.json();
                if (body && body.count) {
                    count = parseInt(body.count, 10);
                }
            } catch (e) {
                // Ignore JSON parse errors
            }
        } else if (request.method === 'GET') {
            const url = new URL(request.url);
            const queryCount = url.searchParams.get('count');
            if (queryCount) {
                count = parseInt(queryCount, 10);
            }
        }
        
        if (isNaN(count) || count < 1 || count > 100) {
            return NextResponse.json({ success: false, error: 'Count must be between 1 and 100' }, { status: 400 });
        }

        const taskId = crypto.randomUUID();

        // Create a new task record in DB
        db.prepare(`
            INSERT INTO eset_tasks (id, total, status, items_json, source)
            VALUES (?, ?, ?, ?, 'api')
        `).run(taskId, count, 'processing', '[]');

        // Start and AWAIT background process synchronously
        const concurrency = parseInt(getSetting('eset_concurrency'), 10) || 2;
        await startBatchEsetActivate(taskId, count, concurrency);

        // Fetch the results
        const finalTask = db.prepare('SELECT items_json FROM eset_tasks WHERE id = ?').get(taskId);
        const items = JSON.parse(finalTask?.items_json || '[]');
        
        // Extract just the keys
        const keys = items.map(item => item.licenseKey).filter(Boolean);
        
        // Give exactly what the user asked: "отдается только список ключей"
        return NextResponse.json(keys);
    } catch (err) {
        console.error("External Eset generation error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function GET(request) {
    return handleRequest(request);
}

export async function POST(request) {
    return handleRequest(request);
}
