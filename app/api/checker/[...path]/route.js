import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

const CHECKER_URL = 'http://127.0.0.1:3005';

export async function GET(request, { params }) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  const targetPath = '/' + (path ? path.join('/') : '');
  const searchParams = new URL(request.url).searchParams;
  const queryString = searchParams.toString();
  const fullTargetUrl = `${CHECKER_URL}${targetPath}${queryString ? '?' + queryString : ''}`;

  try {
    const res = await fetch(fullTargetUrl);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Checker Proxy GET Error:', err);
    return NextResponse.json({ success: false, error: 'Checker service is not available' }, { status: 502 });
  }
}

export async function POST(request, { params }) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await params;
  const targetPath = '/' + (path ? path.join('/') : '');
  const searchParams = new URL(request.url).searchParams;
  const queryString = searchParams.toString();
  const fullTargetUrl = `${CHECKER_URL}${targetPath}${queryString ? '?' + queryString : ''}`;

  try {
    const body = await request.json();
    const res = await fetch(fullTargetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Checker Proxy POST Error:', err);
    return NextResponse.json({ success: false, error: 'Checker service is not available' }, { status: 502 });
  }
}
