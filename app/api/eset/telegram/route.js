import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
