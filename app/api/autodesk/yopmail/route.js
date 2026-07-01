import { NextResponse } from 'next/server';
import { Semaphore } from 'async-mutex';
import { getYopmailAlias } from '@/lib/yopmail';
import { isAuthenticated } from '@/lib/auth';

// Ограничитель нагрузки на 5 потоков Playwright
const concurrencyLimit = new Semaphore(5);

export async function POST(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ status: 'error', error: 'URL не предоставлен' }, { status: 400 });
        }

        const [value, release] = await concurrencyLimit.acquire();
        try {
            const alias = await getYopmailAlias(url, true);
            return NextResponse.json({ status: 'success', alias });
        } finally {
            release();
        }
    } catch (err) {
        return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
    }
}
