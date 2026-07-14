import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fetch from 'node-fetch';

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        let proxyString = body.proxy;
        
        if (!proxyString) {
            return NextResponse.json({ status: 'error', error: 'No proxy provided' });
        }

        // Get the first proxy if there are multiple
        proxyString = proxyString.split(',')[0].trim();

        // Extract refresh URL if present
        let refreshUrl = null;
        const refreshMatch = proxyString.match(/\[(.*?)\]/);
        if (refreshMatch) {
            refreshUrl = refreshMatch[1];
            proxyString = proxyString.replace(/\[.*?\]/, '');
        }

        const agent = proxyString.startsWith('socks') ? new SocksProxyAgent(proxyString) : new HttpsProxyAgent(proxyString);

        const startTime = Date.now();
        
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 15000); // 15s timeout

        try {
            const res = await fetch('https://api.ipify.org?format=json', {
                agent,
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            if (!res.ok) {
                throw new Error(HTTP error! status: );
            }
            
            const data = await res.json();
            const timeTaken = Date.now() - startTime;
            
            return NextResponse.json({ 
                status: 'success', 
                ip: data.ip,
                timeMs: timeTaken,
                refreshUrl
            });
        } catch (err) {
            clearTimeout(timeout);
            
            // Try to refresh if there's a refresh URL
            let refreshed = false;
            if (refreshUrl) {
                try {
                    const refreshRes = await fetch(refreshUrl);
                    if (refreshRes.ok) {
                        refreshed = true;
                    }
                } catch (e) {
                    // Ignore refresh error
                }
            }
            
            return NextResponse.json({ 
                status: 'error', 
                error: err.message,
                refreshed
            });
        }
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
