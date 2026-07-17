import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { connection } from './queue';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '24h';

/**
 * Timing-safe comparison of two strings.
 */
function timingSafeCompare(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) {
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Get the wholesale password from env. Returns null if not configured.
 * No hardcoded fallback — system must be explicitly configured.
 */
function getWholesalePassword() {
  return process.env.WHOLESALE_PASSWORD || null;
}

/**
 * Verify wholesale password using timing-safe comparison.
 */
export function verifyWholesalePassword(inputPassword) {
  const expected = getWholesalePassword();
  if (!expected) return false;
  return timingSafeCompare(inputPassword, expected);
}

/**
 * Generate a JWT token for a verified wholesale session.
 */
export function generateWholesaleToken() {
  return jwt.sign(
    { role: 'wholesale', iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify a JWT token from cookies or headers.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function verifyWholesaleToken(token) {
  if (!token) return { valid: false, reason: 'No token provided' };
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'wholesale') {
      return { valid: false, reason: 'Invalid token role' };
    }
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Extract wholesale token from request (httpOnly cookie first, then header fallback).
 */
export function getWholesaleTokenFromRequest(request) {
  // 1. Try httpOnly cookie
  const cookieToken = request.cookies?.get('wholesale_session')?.value;
  if (cookieToken) return cookieToken;

  // 2. Fallback to Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  return null;
}

/**
 * Full auth check for wholesale endpoints: extracts token, verifies it.
 * Returns { authenticated: true } or { authenticated: false, reason: string }
 */
export function authenticateWholesale(request) {
  const token = getWholesaleTokenFromRequest(request);
  if (!token) return { authenticated: false, reason: 'No session token' };
  
  const result = verifyWholesaleToken(token);
  return result.valid
    ? { authenticated: true }
    : { authenticated: false, reason: result.reason };
}

/**
 * Rate limiting for wholesale auth (fail2ban via Redis).
 * Blocks IP after 5 failed attempts for 30 minutes.
 */
export async function checkWholesaleRateLimit(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown-ip';
  const failKey = `wholesale:fail2ban:${ip}`;

  try {
    const fails = await connection.get(failKey);
    if (fails && parseInt(fails) >= 5) {
      return { blocked: true, ip };
    }
  } catch (e) {
    console.error('[Wholesale Rate Limit] Redis error:', e.message);
  }

  return { blocked: false, ip };
}

/**
 * Record a failed wholesale auth attempt.
 */
export async function recordWholesaleFailure(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown-ip';
  const failKey = `wholesale:fail2ban:${ip}`;

  try {
    const currentFails = await connection.incr(failKey);
    if (currentFails === 1) {
      await connection.expire(failKey, 1800); // 30 minutes
    }
    console.warn(`[Wholesale Auth] Failed login attempt from ${ip} (attempt ${currentFails})`);
  } catch (e) {}
}

/**
 * Clear failed attempts for IP after successful login.
 */
export async function clearWholesaleFailures(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown-ip';
  try {
    await connection.del(`wholesale:fail2ban:${ip}`);
  } catch (e) {}
}
