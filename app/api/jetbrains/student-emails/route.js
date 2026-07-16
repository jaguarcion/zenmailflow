import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';
import { getAllJetBrainsStudentEmails, insertJetBrainsStudentEmail, deleteJetBrainsStudentEmail } from '@/lib/db';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
  if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
  if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const emails = getAllJetBrainsStudentEmails();
    return NextResponse.json({ success: true, data: emails });
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
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const email = parts[0].trim();
        const password = parts.slice(1).join(':').trim();
        if (email && password) {
          const res = insertJetBrainsStudentEmail(email, password);
          if (res) added++;
        }
      }
    }

    return NextResponse.json({ success: true, added });
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

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
    }

    deleteJetBrainsStudentEmail(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[StudentEmails DELETE]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
