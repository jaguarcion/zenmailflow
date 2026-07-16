import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { getAllJetBrainsStudentTasks, insertJetBrainsStudentTask, insertJetBrainsStudentEmail, deleteJetBrainsStudentTask, deleteJetBrainsStudentEmail } from '@/lib/db';
import crypto from 'node:crypto';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tasks = getAllJetBrainsStudentTasks();
    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[StudentEmails GET]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { lines } = body;

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json({ success: false, error: 'lines array required' }, { status: 400 });
    }

    let added = 0;
    const taskId = crypto.randomUUID();
    
    // Insert task first
    insertJetBrainsStudentTask(taskId);

    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const email = parts[0].trim();
        const password = parts.slice(1).join(':').trim();
        if (email && password) {
          const res = insertJetBrainsStudentEmail(taskId, email, password);
          if (res) added++;
        }
      }
    }

    if (added === 0) {
      deleteJetBrainsStudentTask(taskId); // cleanup if no valid emails
    }

    return NextResponse.json({ success: true, added, taskId });
  } catch (error) {
    console.error('[StudentEmails POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const taskId = searchParams.get('task_id');

    if (!id && !taskId) {
      return NextResponse.json({ success: false, error: 'ID or task_id is required' }, { status: 400 });
    }

    if (taskId) {
      deleteJetBrainsStudentTask(taskId);
    } else if (id) {
      deleteJetBrainsStudentEmail(id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[StudentEmails DELETE]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
