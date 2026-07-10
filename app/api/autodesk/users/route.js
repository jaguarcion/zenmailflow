import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { limit = 50, page = 0, search = '', groupId = '' } = body;

        const configJson = getSetting('autodesk_config');
        if (!configJson) {
            return NextResponse.json({ error: 'Autodesk config not found' }, { status: 400 });
        }
        
        const config = JSON.parse(configJson);
        const { tenantId, authToken, cookieString } = config;

        if (!tenantId || !authToken || !cookieString) {
            return NextResponse.json({ error: 'Incomplete Autodesk config' }, { status: 400 });
        }

        const apiUrl = `https://api.user-access.aum.autodesk.com/user-access/v1/teams/urn:adsk.aum:prd:tenant.oxygenId:${tenantId}/users`;
        
        const requestBody = {
            sort: ["nameEmail asc"],
            pagination: { limit: Number(limit), offset: Number(page) },
            includeAssignments: true,
            includeGuests: true
        };

        const filter = {};
        if (search && search.trim() !== '') {
            filter.search = search.trim();
        }
        if (groupId && groupId.trim() !== '') {
            filter.groupOxygenIds = [groupId.trim()];
        }
        
        if (Object.keys(filter).length > 0) {
            requestBody.filter = filter;
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": authToken,
                "content-type": "application/json",
                "cookie": cookieString,
                "origin": "https://manage.autodesk.com",
                "referer": "https://manage.autodesk.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json({ status: 'success', data });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
