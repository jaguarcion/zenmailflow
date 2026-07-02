import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const config = {
            proxy: getSetting('eset_proxy') || '',
            emailProvider: getSetting('eset_email_provider') || 'migadu',
            migaduUser: getSetting('eset_migadu_user') || '',
            migaduToken: getSetting('eset_migadu_token') || '',
            migaduDomain: getSetting('eset_migadu_domain') || '',
        };
        return NextResponse.json({ status: 'success', config });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        
        if (body.proxy !== undefined) setSetting('eset_proxy', body.proxy);
        if (body.emailProvider !== undefined) setSetting('eset_email_provider', body.emailProvider);
        if (body.migaduUser !== undefined) setSetting('eset_migadu_user', body.migaduUser);
        if (body.migaduToken !== undefined) setSetting('eset_migadu_token', body.migaduToken);
        if (body.migaduDomain !== undefined) setSetting('eset_migadu_domain', body.migaduDomain);

        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
