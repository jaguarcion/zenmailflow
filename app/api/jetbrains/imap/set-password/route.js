import { NextResponse } from 'next/server';
import { setAccountPassword } from '../../../../../lib/jetbrains/outlookScraper.js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, otp, password } = await req.json();
    await setAccountPassword(sessionId, otp, password);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('set-password Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
