import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import db from '@/lib/db';
import crypto from 'crypto';
import { getSetting } from '@/lib/db';
import { esetQueue } from '@/lib/queue';

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

        // Send job to queue
        const concurrency = parseInt(getSetting('eset_concurrency'), 10) || 2;
        await esetQueue.add('generate-eset', {
            taskId,
            totalCount: count,
            concurrency
        });

        return NextResponse.json({ success: true, taskId });
    } catch (err) {
        console.error("Eset generation error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
