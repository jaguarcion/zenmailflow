import { NextResponse } from 'next/server';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const targetUrl = 'https://pro100pochta.com' + path;

    const headers = new Headers();
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');

    // Forward cookies if needed (pro100pochta uses cookies)
    const incomingCookies = req.headers.get('cookie');
    if (incomingCookies) {
      headers.set('Cookie', incomingCookies);
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const text = await response.text();
    const res = new NextResponse(text, { status: response.status });

    // Forward Set-Cookie headers
    if (typeof response.headers.getSetCookie === 'function') {
      const setCookies = response.headers.getSetCookie();
      for (const cookie of setCookies) {
        let modifiedCookie = cookie
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*HttpOnly/gi, '')
          .replace(/domain=[^;]+/gi, '')
          .replace(/path=[^;]+/gi, 'path=/');
        res.headers.append('Set-Cookie', modifiedCookie);
      }
    } else {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        let modifiedCookie = setCookie
          .replace(/;\s*Secure/gi, '')
          .replace(/;\s*HttpOnly/gi, '')
          .replace(/domain=[^;]+/gi, '')
          .replace(/path=[^;]+/gi, 'path=/');
        res.headers.append('Set-Cookie', modifiedCookie);
      }
    }

    return res;

  } catch (error) {
    console.error('Pro100Pochta Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
