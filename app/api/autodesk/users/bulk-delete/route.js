import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { userIds } = body;
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json({ error: 'User IDs array is required' }, { status: 400 });
        }

        const configJson = getSetting('autodesk_config');
        if (!configJson) return NextResponse.json({ error: 'Autodesk config not found' }, { status: 400 });
        
        const config = JSON.parse(configJson);
        const { tenantId, authToken, cookieString } = config;

        if (!tenantId || !authToken || !cookieString) {
            return NextResponse.json({ error: 'Incomplete Autodesk config' }, { status: 400 });
        }

        const results = { success: 0, failed: 0, errors: [] };

        // Process sequentially to avoid rate limiting
        for (const userId of userIds) {
            try {
                const apiUrl = `https://api.user-access.aum.autodesk.com/user-access/v2/tenants/${tenantId}/users/${userId}`;
                const response = await fetch(apiUrl, {
                    method: 'DELETE',
                    headers: {
                        "accept": "application/json, text/plain, */*",
                        "authorization": authToken,
                        "cookie": cookieString,
                        "origin": "https://manage.autodesk.com",
                        "referer": "https://manage.autodesk.com/"
                    }
                });

                if (response.ok) {
                    results.success++;
                } else {
                    const text = await response.text();
                    results.failed++;
                    results.errors.push(`User ${userId}: ${response.status} ${text}`);
                }
            } catch (err) {
                results.failed++;
                results.errors.push(`User ${userId}: ${err.message}`);
            }
        }

        return NextResponse.json({ status: 'success', data: results });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
