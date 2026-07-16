import { NextResponse } from 'next/server';
import { confirmJetBrainsLicense } from '../../../../../lib/jetbrains/outlookScraper.js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, email } = await req.json();
    const sessionId = await confirmJetBrainsLicense(code, email);
    
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('confirm-license Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
