import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getLogs } from '@/lib/db';

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 100;
    
    const logs = getLogs(limit);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('[Logs API]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
