import { NextResponse } from 'next/server';
import { authenticateWholesale } from '@/lib/wholesale-auth';

export async function POST(request) {
  // Clear the wholesale session cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set('wholesale_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Expire immediately
  });
  return response;
}
