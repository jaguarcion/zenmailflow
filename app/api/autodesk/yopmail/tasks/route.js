import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const tasks = db.prepare('SELECT * FROM yopmail_tasks ORDER BY created_at DESC').all();

        // Parse items_json back to array
        const parsedTasks = tasks.map(task => ({
            id: task.id,
            date: task.created_at,
            total: task.total,
            success: task.success,
            error: task.error,
            status: task.status,
            items: JSON.parse(task.items_json || '[]')
        }));

        return NextResponse.json({ status: 'success', tasks: parsedTasks });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, date, total, success, error, status, items } = body;

        
        const stmt = db.prepare(`
            INSERT INTO yopmail_tasks (id, created_at, total, success, error, status, items_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            date || new Date().toLocaleString(),
            total,
            success,
            error,
            status,
            JSON.stringify(items || [])
        );



        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
