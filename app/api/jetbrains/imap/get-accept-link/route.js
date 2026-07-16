import { NextResponse } from 'next/server';
import { getAcceptLink } from '../../../../../lib/jetbrains/outlookScraper.js';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, pass } = await req.json();
    const acceptLink = await getAcceptLink(email, pass);
    
    return NextResponse.json({ acceptLink });
  } catch (error) {
    console.error('get-accept-link Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
