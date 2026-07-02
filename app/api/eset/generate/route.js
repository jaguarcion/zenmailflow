import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { startBatchEsetActivate } from '@/lib/eset/batchEsetActivate';
import { getSetting } from '@/lib/db';

export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const count = parseInt(body.count, 10) || 1;
        
        if (count < 1 || count > 100) {
            return NextResponse.json({ success: false, error: 'Count must be between 1 and 100' }, { status: 400 });
        }

        const taskId = crypto.randomUUID();

        // Create a new task record in DB
        db.prepare(`
            INSERT INTO eset_tasks (id, total, status, items_json)
            VALUES (?, ?, ?, ?)
        `).run(taskId, count, 'processing', '[]');

        // Start background process
        const concurrency = parseInt(getSetting('eset_concurrency'), 10) || 2;
        startBatchEsetActivate(taskId, count, concurrency).catch(console.error);

        return NextResponse.json({ success: true, taskId });
    } catch (err) {
        console.error("Eset generation error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
