import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function PUT(request, { params }) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const taskId = params.taskId;
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
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const taskId = params.taskId;
        
        
        const stmt = db.prepare(`DELETE FROM yopmail_tasks WHERE id = ?`);
        stmt.run(taskId);

        
        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
