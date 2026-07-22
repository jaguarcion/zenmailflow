import { NextResponse } from 'next/server';
import { checkFail2Ban } from '@/lib/auth';

export async function GET(req) {
  try {
    const authStatus = await checkFail2Ban(req);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const targetUrl = 'https://pro100pochta.com' + path;

    const headersObj = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    };

    const incomingCookies = req.headers.get('cookie');
    if (incomingCookies) {
      headersObj['Cookie'] = incomingCookies;
    }

    const { ofetch } = await import('ofetch');
    const { Agent } = await import('undici');
    const { buildSocksProxyConnector } = await import('@jsr/undicijs__proxy');
    
    const PROXY_URL = 'socks5://4w99sxjb5s-corp.mobile.res-country-LV-hold-session-session-6a45848ec8ed4:ohh401aJwRYe8xuN@82.27.118.182:443';
    const dispatcher = new Agent({ connect: buildSocksProxyConnector(PROXY_URL) });

    const response = await ofetch.raw(targetUrl, {
      method: 'GET',
      headers: headersObj,
      dispatcher,
      responseType: 'text',
      ignoreResponseError: true,
    });

    const text = response._data;
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
