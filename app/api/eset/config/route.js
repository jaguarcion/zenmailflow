import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';

export async function GET(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const config = {
            proxy: getSetting('eset_proxy') || '',
            emailProvider: getSetting('eset_email_provider') || 'migadu',
            migaduUser: getSetting('eset_migadu_user') || '',
            migaduToken: getSetting('eset_migadu_token') || '',
            migaduDomain: getSetting('eset_migadu_domain') || '',
            concurrency: parseInt(getSetting('eset_concurrency'), 10) || 2,
            autopostChannel: getSetting('eset_autopost_channel') || process.env.ESET_TELEGRAM_CHANNEL_ID || '',
            autopostCron: getSetting('eset_autopost_cron') || process.env.ESET_AUTOPOST_CRON || '0 12 * * *',
            autopostCount: parseInt(getSetting('eset_autopost_count'), 10) || 5,
        };
        return NextResponse.json({ status: 'success', config });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        
        if (body.proxy !== undefined) setSetting('eset_proxy', body.proxy);
        if (body.emailProvider !== undefined) setSetting('eset_email_provider', body.emailProvider);
        if (body.migaduUser !== undefined) setSetting('eset_migadu_user', body.migaduUser);
        if (body.migaduToken !== undefined) setSetting('eset_migadu_token', body.migaduToken);
        if (body.migaduDomain !== undefined) setSetting('eset_migadu_domain', body.migaduDomain);
        if (body.concurrency !== undefined) setSetting('eset_concurrency', body.concurrency.toString());
        if (body.autopostChannel !== undefined) setSetting('eset_autopost_channel', body.autopostChannel);
        if (body.autopostCron !== undefined) setSetting('eset_autopost_cron', body.autopostCron);
        if (body.autopostCount !== undefined) setSetting('eset_autopost_count', body.autopostCount.toString());

        return NextResponse.json({ status: 'success' });
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
