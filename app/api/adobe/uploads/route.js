import { NextResponse } from 'next/server';
import { isAuthenticated, checkFail2Ban } from '@/lib/auth';
import { getAdobeUploads } from '@/lib/db';

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const uploads = getAdobeUploads();
    return NextResponse.json({ success: true, data: uploads });
  } catch (error) {
    console.error('[Adobe Uploads]', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
