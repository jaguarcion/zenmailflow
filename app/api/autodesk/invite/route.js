import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { tenant_id, invited_by, auth_token, cookie, user } = body;

        if (!user || !user.email) {
            return NextResponse.json({ error: 'User email is required' }, { status: 400 });
        }

        const apiUrl = `https://api.user-access.aum.autodesk.com/user-access/v1/tenants/${tenant_id}/users`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": auth_token,
                "content-type": "application/json",
                "cookie": cookie,
                "origin": "https://manage.autodesk.com",
                "referer": "https://manage.autodesk.com/",
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
            },
            body: JSON.stringify({
                "firstName": user.firstName || '',
                "lastName": user.lastName || '',
                "emailId": user.email,
                "invitedBy": invited_by,
                "hideMarketingOptIn": true
            })
        });

        // The Autodesk API usually returns empty body on success (204 or 201)
        // or JSON on error. We try parsing json, fallback to empty object.
        const text = await response.text();
        let data = {};
        if (text) {
            try { data = JSON.parse(text); } catch (e) {}
        }

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
