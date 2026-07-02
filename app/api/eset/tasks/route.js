import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const tasks = db.prepare(`
            SELECT id, created_at, total, success, error, status, items_json
            FROM eset_tasks
            ORDER BY created_at DESC
        `).all();

        return NextResponse.json({ success: true, tasks });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
        }

        if (id === 'all') {
            db.prepare('DELETE FROM eset_tasks').run();
            db.prepare('DELETE FROM eset_emails').run();
        } else {
            db.prepare('DELETE FROM eset_tasks WHERE id = ?').run(id);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
