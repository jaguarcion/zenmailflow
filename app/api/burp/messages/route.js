import { NextResponse } from 'next/server';
import { getBurpMessages } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request) {
    if (!(await isAuthenticated(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const addressId = searchParams.get('addressId');

        if (!addressId) {
            return NextResponse.json({ error: 'addressId is required' }, { status: 400 });
        }

        const messages = getBurpMessages(addressId);
        
        // Parse attachments_json
        const parsedMessages = messages.map(msg => ({
            ...msg,
            attachments: msg.attachments_json ? JSON.parse(msg.attachments_json) : []
        }));

        return NextResponse.json({ status: 'success', data: parsedMessages });
    } catch (e) {
        console.error('Failed to get burp messages:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
