import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const stats = {
            totalUsers: db.prepare('SELECT COUNT(*) as count FROM eset_tg_users').get().count,
            todayUsers: db.prepare('SELECT COUNT(*) as count FROM eset_tg_users WHERE created_at >= date(\'now\')').get().count,
            totalKeys: db.prepare('SELECT SUM(keys_received) as sum FROM eset_tg_users').get().sum || 0
        };

        const tasks = db.prepare(`
            SELECT id, created_at, items_json, user_info
            FROM eset_tasks
            WHERE source = 'api-telegram'
            ORDER BY created_at DESC
            LIMIT 100
        `).all();

        return NextResponse.json({ success: true, stats, history: tasks });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
