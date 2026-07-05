import crypto from "crypto";
import { connection } from "./queue";

/**
 * Timing-safe comparison of two strings.
 * Prevents timing attacks by always comparing in constant time.
 */
function timingSafeCompare(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Pad to same length to avoid length leak via timingSafeEqual throwing
    if (bufA.length !== bufB.length) {
      // Compare against itself to keep constant time, but return false
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Check if request has valid admin authentication.
 * Supports both Bearer token header and HttpOnly cookie.
 */
export function isAuthenticated(request) {
  const expected = process.env.APP_ACCESS_TOKEN;
  if (!expected) return false;

  // Check Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return timingSafeCompare(token, expected);
  }

  // Check HttpOnly cookie
  const cookieToken = request.cookies?.get("auth_token")?.value;
  if (cookieToken) {
    return timingSafeCompare(cookieToken, expected);
  }

  return false;
}

/**
 * Fail2Ban check that wraps isAuthenticated and blocks IP after 5 failed attempts
 */
export async function checkFail2Ban(request) {
    const ip = request.headers.get("x-forwarded-for") || request.ip || "unknown-ip";
    const failKey = `fail2ban:${ip}`;

    try {
        const fails = await connection.get(failKey);
        if (fails && parseInt(fails) >= 5) {
            return { banned: true, isAuth: false };
        }
    } catch (e) {
        console.error("Fail2Ban error:", e);
    }

    const isAuth = isAuthenticated(request);

    if (!isAuth) {
        try {
            const currentFails = await connection.incr(failKey);
            if (currentFails === 1) {
                await connection.expire(failKey, 86400); // 24h
            }
        } catch (e) {}
        return { banned: false, isAuth: false };
    }

    try {
        await connection.del(failKey);
    } catch (e) {}

    return { banned: false, isAuth: true };
}
