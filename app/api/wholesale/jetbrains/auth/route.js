import { NextResponse } from 'next/server';

const PASSWORD = process.env.WHOLESALE_PASSWORD || 'optovik';

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (password === PASSWORD) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
