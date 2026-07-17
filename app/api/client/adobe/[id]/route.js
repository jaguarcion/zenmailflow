import { NextResponse } from 'next/server';
import { getAdobeAccountByAccessToken, updateAdobeAccountStatus } from '@/lib/db';
import { checkAdobeAccount } from '@/lib/dongvanfb';
import { checkRateLimit } from '@/lib/rateLimit';

// [SECURITY] C-01+C-02: Use access_token for lookup instead of sequential ID.
// No admin auth required — the UUID itself serves as the secret.
export async function GET(request, { params }) {
  const { id: accessToken } = await params;
  
  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // [SECURITY] C-02: Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(accessToken)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Rate limiting based on IP and accessToken (10 requests per minute)
  const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown-ip';
  const limitKey = `${ip}:${accessToken}`;
  const isAllowed = await checkRateLimit(limitKey, 10, 60);
  if (!isAllowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const account = getAdobeAccountByAccessToken(accessToken);
    if (!account) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // Fetch messages dynamically
    const result = await checkAdobeAccount(account.email, account.refresh_token, account.device_id);
    
    if (result && result.isBanned && account.status !== 'banned') {
        updateAdobeAccountStatus(account.id, 'banned');
        account.status = 'banned';
    }

    // Filter verification codes
    let codes = [];
    if (result && result.messages && Array.isArray(result.messages)) {
        codes = result.messages.filter(msg => {
            const subj = (msg.subject || '').toLowerCase();
            const from = (msg.from || '').toLowerCase();
            // Match any email from Adobe or containing standard security keywords regardless of language
            return from.includes('adobe.com') || subj.includes('verification') || subj.includes('код') || subj.includes('code') || subj.includes('suspended') || subj.includes('fraudulent');
        });
        codes = codes.slice(0, 5); // top 5
    }
    
    // [SECURITY] C-01: Only return what the client needs — no refresh_token, device_id, or password
    return NextResponse.json({
        id: account.access_token,
        email: account.email,
        adobe_password: account.adobe_password,
        status: account.status,
        messages: codes
    });
  } catch (error) {
    console.error('[ClientAdobe] Error:', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
