import { NextResponse } from 'next/server';
import { getRecoveryOtp } from '../../../../../lib/jetbrains/outlookScraper.js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, pass } = await req.json();
    const otp = await getRecoveryOtp(email, pass);
    
    return NextResponse.json({ otp });
  } catch (error) {
    console.error('get-recovery-otp Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
