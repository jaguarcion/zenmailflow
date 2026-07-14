import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Fetch processing tasks for ESET
        const esetTasks = db.prepare(`
            SELECT id, total, success, error, status, created_at, 'eset' as type
            FROM eset_tasks
            WHERE status = 'processing'
            ORDER BY created_at DESC
        `).all();

        // Fetch processing tasks for Yopmail (if any)
        const yopmailTasks = db.prepare(`
            SELECT id, total, success, error, status, created_at, 'yopmail' as type
            FROM yopmail_tasks
            WHERE status = 'processing'
            ORDER BY created_at DESC
        `).all();

        // Fetch processing tasks for Autodesk
        const autodeskTasks = db.prepare(`
            SELECT id, total, success, error, status, created_at, 'autodesk' as type
            FROM autodesk_tasks
            WHERE status = 'processing'
            ORDER BY created_at DESC
        `).all();

        return NextResponse.json({ 
            success: true, 
            tasks: [...esetTasks, ...yopmailTasks, ...autodeskTasks] 
        });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
