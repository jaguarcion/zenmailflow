import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAdobeUploads } from '@/lib/db';

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const uploads = getAdobeUploads();
    return NextResponse.json({ success: true, data: uploads });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
