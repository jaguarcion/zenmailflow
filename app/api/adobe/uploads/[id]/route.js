import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAdobeAccountsByUploadId } from '@/lib/db';

export async function GET(request, { params }) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const accounts = getAdobeAccountsByUploadId(id);
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
