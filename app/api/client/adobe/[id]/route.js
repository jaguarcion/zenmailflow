import { NextResponse } from 'next/server';
import { getAdobeAccountById } from '@/lib/db';
import { checkAdobeAccount } from '@/lib/dongvanfb';

export async function GET(request, { params }) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
  }

  try {
    const account = getAdobeAccountById(id);
    if (!account) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    
    // Fetch messages dynamically
    const result = await checkAdobeAccount(account.email, account.refresh_token, account.device_id);
    
    // Filter verification codes
    let codes = [];
    if (result && result.messages && Array.isArray(result.messages)) {
        codes = result.messages.filter(msg => {
            const subj = (msg.subject || '').toLowerCase();
            return subj.includes('verification code') || subj.includes('email address changed') || subj.includes('suspended');
        });
        codes = codes.slice(0, 5); // top 5
    }
    
    return NextResponse.json({
        id: account.id,
        email: account.email,
        adobe_password: account.adobe_password,
        status: account.status,
        messages: codes
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
