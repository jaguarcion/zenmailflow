import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { insertAdobeAccount, insertAdobeUpload } from '@/lib/db';

// [SECURITY] M-04: Limit upload text size
const MAX_UPLOAD_SIZE = 500_000; // ~500KB

export async function POST(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
    }

    // [SECURITY] M-04: Prevent DoS via huge uploads
    if (typeof text !== 'string' || text.length > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ success: false, error: 'Upload text too large (max 500KB)' }, { status: 400 });
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let added = 0;
    let errors = 0;

    // Generate a new upload ID
    const uploadId = insertAdobeUpload();

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 5) {
        const [email, password, adobe_password, refresh_token, device_id] = parts;
        try {
          insertAdobeAccount(email, password, adobe_password, refresh_token, device_id, uploadId);
          added++;
        } catch (err) {
          console.error('Insert error:', err.message);
          errors++;
        }
      } else {
        errors++;
      }
    }

    const { insertLog } = require('@/lib/db');
    if (added > 0) {
      insertLog('UPLOAD_ACCOUNTS', `Загружено ${added} новых аккаунтов Adobe в пул (сборка #${uploadId})`);
    }

    return NextResponse.json({ success: true, added, errors, upload_id: uploadId });
  } catch (error) {
    console.error('[Adobe Upload]', error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
