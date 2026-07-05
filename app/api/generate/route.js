import { NextResponse } from "next/server";
import { insertEmail } from "@/lib/db";
import { isAuthenticated, checkFail2Ban } from "@/lib/auth";
import crypto from "crypto";

const MIGADU_API_URL = "https://api.migadu.com/v1/domains";

// Utility to generate a readable random string (alternating consonants and vowels)
function generateRandomString(length = 8) {
  const consonants = "bcdfghjklmnpqrstvwxyz";
  const vowels = "aeiou";
  let result = "";
  for (let i = 0; i < length; i++) {
    if (i % 2 === 0) {
      result += consonants.charAt(Math.floor(Math.random() * consonants.length));
    } else {
      result += vowels.charAt(Math.floor(Math.random() * vowels.length));
    }
  }
  // Add a random number at the end for uniqueness
  result += Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return result;
}

// [SECURITY] C-03: Generate cryptographically random password instead of hardcoded
function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function POST(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const count = body.count;
    const reqDomain = body.domain;
    const amount = parseInt(count);

    // [SECURITY] M-01: Input validation
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      return NextResponse.json(
        { error: "Invalid count. Must be between 1 and 100." },
        { status: 400 }
      );
    }

    // [SECURITY] M-01: Validate domain format
    if (reqDomain && !/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(reqDomain)) {
      return NextResponse.json(
        { error: "Invalid domain format." },
        { status: 400 }
      );
    }

    const email = process.env.MIGADU_EMAIL;
    const apiKey = process.env.MIGADU_API_KEY;
    const domain = reqDomain || process.env.MIGADU_DOMAIN;

    if (!email || !apiKey || !domain) {
      console.error("Missing Migadu credentials in environment variables.");
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const authHeader = "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");
    const results = [];
    const errors = [];

    // Process sequentially to avoid rate limiting
    for (let i = 0; i < amount; i++) {
      const localPart = generateRandomString(8);
      const password = generatePassword(16);
      const mailboxName = `Gen ${localPart}`;
      const fullEmail = `${localPart}@${domain}`;

      try {
        const response = await fetch(`${MIGADU_API_URL}/${domain}/mailboxes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({
            name: mailboxName,
            local_part: localPart,
            password: password,
          }),
        });

        if (response.ok) {
          // Save to SQLite
          try {
            insertEmail(fullEmail, password);
            results.push({
              email: fullEmail,
              password: password,
            });
          } catch (dbErr) {
             console.error(`DB save error for ${fullEmail}:`, dbErr);
             errors.push(`Failed to save ${fullEmail} to local DB`);
          }
        } else {
          const errorData = await response.text();
          console.error(`Failed to create ${localPart}:`, errorData);
          errors.push(`Failed to create ${fullEmail}`);
        }
      } catch (err) {
        console.error(`Network error creating ${localPart}:`, err);
        errors.push(`Network error for ${fullEmail}`);
      }
      
      // Optional: small delay to avoid hitting rate limits on Migadu side
      if (i < amount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({
      success: true,
      generated: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("API error:", error);
    // [SECURITY] H-02: Don't leak error details
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
