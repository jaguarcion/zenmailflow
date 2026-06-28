import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAdobeAccountById, updateAdobeAccountStatus } from '@/lib/db';
import { checkAdobeAccount } from '@/lib/dongvanfb';

export async function POST(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountIds } = body; // Array of IDs

    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No accounts selected' }, { status: 400 });
    }

    const results = [];

    // Check each sequentially or with Promise.all. 
    // Sequential to avoid rate limits on the dongvanfb API.
    for (const id of accountIds) {
        const account = getAdobeAccountById(id);
        if (!account) {
            results.push({ id, status: 'not_found' });
            continue;
        }

        const checkRes = await checkAdobeAccount(account.email, account.refresh_token, account.device_id);
        
        let newStatus = account.status;
        if (checkRes && checkRes.isBanned && account.status !== 'banned') {
            updateAdobeAccountStatus(account.id, 'banned');
            newStatus = 'banned';
            
            const { insertLog } = require('@/lib/db');
            insertLog('BAN_ACCOUNT', `Внимание! Чекер обнаружил блокировку аккаунта ${account.email}`);
        }

        results.push({ id, status: newStatus, error: checkRes.error });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Adobe Check POST]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
