import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const configJson = getSetting('autodesk_config');
        if (configJson) {
            return NextResponse.json({ status: 'success', config: JSON.parse(configJson) });
        } else {
            return NextResponse.json({ status: 'success', config: null });
        }
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const config = await request.json();
        setSetting('autodesk_config', JSON.stringify(config));
        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
