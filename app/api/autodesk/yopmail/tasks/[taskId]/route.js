import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

export async function PUT(request, { params }) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { taskId } = await params;
        const body = await request.json();
        const { success, error, status, items } = body;

        
        const stmt = db.prepare(`
            UPDATE yopmail_tasks 
            SET success = ?, error = ?, status = ?, items_json = ?
            WHERE id = ?
        `);
        
        stmt.run(
            success,
            error,
            status,
            JSON.stringify(items || []),
            taskId
        );

        
        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { taskId } = await params;
        
        
        const stmt = db.prepare(`DELETE FROM yopmail_tasks WHERE id = ?`);
        stmt.run(taskId);

        
        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
