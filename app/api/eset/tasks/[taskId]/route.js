import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request, props) {
    const params = await props.params;
    
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const taskId = params.taskId;
        if (!taskId) return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 400 });

        const task = db.prepare(`
            SELECT id, created_at, total, success, error, status, items_json
            FROM eset_tasks
            WHERE id = ?
        `).get(taskId);

        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, task });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;

    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const taskId = params.taskId;
        if (!taskId) return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 400 });

        // Change status to cancelled if it was processing. Otherwise delete.
        const task = db.prepare('SELECT status FROM eset_tasks WHERE id = ?').get(taskId);
        
        if (task && task.status === 'processing') {
            db.prepare("UPDATE eset_tasks SET status = 'cancelled' WHERE id = ?").run(taskId);
        } else {
            db.prepare("DELETE FROM eset_tasks WHERE id = ?").run(taskId);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
