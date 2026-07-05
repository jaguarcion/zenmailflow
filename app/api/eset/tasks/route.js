import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = 20;
        const offset = (page - 1) * limit;

        const tasks = db.prepare(`
            SELECT id, created_at, total, success, error, status, items_json, source
            FROM eset_tasks
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        const totalCount = db.prepare('SELECT COUNT(*) as c FROM eset_tasks').get().c;
        const hasMore = offset + tasks.length < totalCount;

        return NextResponse.json({ success: true, tasks, hasMore });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
