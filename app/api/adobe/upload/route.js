import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { insertAdobeAccount, insertAdobeUpload } from '@/lib/db';

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

    return NextResponse.json({ success: true, added, errors, upload_id: uploadId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
