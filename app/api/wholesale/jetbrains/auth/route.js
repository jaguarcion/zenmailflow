import { NextResponse } from 'next/server';
import {
  verifyWholesalePassword,
  generateWholesaleToken,
  checkWholesaleRateLimit,
  recordWholesaleFailure,
  clearWholesaleFailures
} from '@/lib/wholesale-auth';

export async function POST(request) {
  // Rate limiting check
  const rateCheck = await checkWholesaleRateLimit(request);
  if (rateCheck.blocked) {
    console.warn(`[Wholesale Auth] Blocked IP: ${rateCheck.ip}`);
    return NextResponse.json(
      { success: false, error: 'Слишком много попыток. Попробуйте через 30 минут.' },
      { status: 429 }
    );
  }

  try {
    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      await recordWholesaleFailure(request);
      return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 });
    }

    if (!verifyWholesalePassword(password)) {
      await recordWholesaleFailure(request);
      return NextResponse.json({ success: false, error: 'Неверный пароль' }, { status: 401 });
    }

    // Password correct — generate JWT token
    const token = generateWholesaleToken();

    // Clear failed attempts
    await clearWholesaleFailures(request);

    // Set httpOnly cookie with the JWT
    const response = NextResponse.json({ success: true });
    response.cookies.set('wholesale_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    console.log(`[Wholesale Auth] Successful login from ${rateCheck.ip}`);
    return response;
  } catch (err) {
    console.error('[Wholesale Auth Error]', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
