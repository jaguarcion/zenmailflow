import { NextResponse } from 'next/server';
import { getAllBurpAddresses, insertBurpAddress, deleteBurpAddressByDomain, deleteBurpAddress, getBurpAddressByDomain } from '@/lib/db';
import { addMx, deleteMx, randomLabel, waitForMx } from '@/lib/burp';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request) {
    if (!(await isAuthenticated(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const addresses = getAllBurpAddresses();
        return NextResponse.json({ status: 'success', data: addresses });
    } catch (e) {
        console.error('Failed to get burp addresses:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request) {
    if (!(await isAuthenticated(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { labelLen = 10 } = await request.json().catch(() => ({}));

        // Generate a unique subdomain label
        let label;
        let domain;
        let attempts = 0;
        do {
            label = randomLabel(labelLen);
            domain = `${label}.${process.env.BURP_BASE_DOMAIN || 'bill.work.gd'}`;
            attempts++;
            if (attempts > 10) throw new Error("Could not generate a unique domain");
        } while (getBurpAddressByDomain(domain));

        const local = randomLabel(labelLen);
        const address = `${local}@${domain}`;

        // 1. Add MX Record via DNSExit
        await addMx(label);

        // 2. Insert into database
        insertBurpAddress(address, label, domain);

        return NextResponse.json({ 
            status: 'success', 
            data: { address, domain, label, message: 'Address created. DNS propagation may take up to 1 minute.' } 
        });
    } catch (e) {
        console.error('Failed to generate burp address:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!(await isAuthenticated(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, label, domain } = await request.json();
        if (!label || !id) {
            return NextResponse.json({ error: 'Missing id or label' }, { status: 400 });
        }

        // 1. Delete MX Record via DNSExit
        try {
            await deleteMx(label);
        } catch (e) {
            console.error(`Failed to delete MX record for ${label}:`, e);
            // We still proceed to delete from DB even if DNSExit fails (e.g. already deleted)
        }

        // 2. Delete from database
        deleteBurpAddress(id);

        return NextResponse.json({ status: 'success' });
    } catch (e) {
        console.error('Failed to delete burp address:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
