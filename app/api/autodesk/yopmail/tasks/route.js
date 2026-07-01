import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
