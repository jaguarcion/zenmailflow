import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path, type, method, payload } = await req.json();

    const baseUrl = type === 'shop' ? 'https://www.jetbrains.com' : 'https://account.jetbrains.com';
    const targetUrl = baseUrl + path;

    const headers = new Headers();
    headers.set('Accept', 'application/json, text/plain, */*');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    headers.set('Origin', baseUrl);
    headers.set('Referer', baseUrl + '/');
    headers.set('X-Requested-With', 'XMLHttpRequest');

    if (payload) {
      headers.set('Content-Type', 'application/json');
    }

    // Forward cookies from the client
    const incomingCookies = req.headers.get('cookie');
    if (incomingCookies) {
      headers.set('Cookie', incomingCookies);
    }
    
    // Also extract x-xsrf-token from the cookies if needed
    if (incomingCookies) {
      const cookieName = type === 'shop' ? '_st-SHOP' : '_st-JBA';
      const match = incomingCookies.match(new RegExp('(^|;\\s*)' + cookieName + '=([^;]+)'));
      if (match) {
        headers.set('x-xsrf-token', match[2]);
      }
    }

    const options = {
      method: method || 'POST',
      headers,
    };

    if (payload && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(payload);
    }

    // Since we are running on Node.js, we can use native fetch
    const response = await fetch(targetUrl, options);

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    const res = NextResponse.json(data, { status: response.status });

    // Forward Set-Cookie headers back to the client, modifying them
    // Fetch API Headers object combines multiple Set-Cookie into one string, which is annoying.
    // In Node 18+, response.headers.getSetCookie() is available!
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
      // Fallback
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
    console.error('JetBrains Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
