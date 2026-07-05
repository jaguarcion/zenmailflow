import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

const CHECKER_URL = 'http://127.0.0.1:3015';

export async function GET(request, { params }) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { path } = await params;
  const targetPath = '/' + (path ? path.join('/') : '');
  const searchParams = new URL(request.url).searchParams;
  const queryString = searchParams.toString();
  const fullTargetUrl = `${CHECKER_URL}${targetPath}${queryString ? '?' + queryString : ''}`;

  try {
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : undefined;
    
    const res = await fetch(fullTargetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Checker Proxy POST Error:', err);
    return NextResponse.json({ success: false, error: 'Checker service is not available' }, { status: 502 });
  }
}

export async function DELETE(request, { params }) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { path } = await params;
  const targetPath = '/' + (path ? path.join('/') : '');
  const searchParams = new URL(request.url).searchParams;
  const queryString = searchParams.toString();
  const fullTargetUrl = `${CHECKER_URL}${targetPath}${queryString ? '?' + queryString : ''}`;

  try {
    const res = await fetch(fullTargetUrl, {
      method: 'DELETE',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Checker Proxy DELETE Error:', err);
    return NextResponse.json({ success: false, error: 'Checker service is not available' }, { status: 502 });
  }
}
