import { NextResponse } from "next/server";
import { isAuthenticated, checkFail2Ban } from "@/lib/auth";

const MIGADU_API_URL = "https://api.migadu.com/v1/domains";

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const email = process.env.MIGADU_EMAIL;
    const apiKey = process.env.MIGADU_API_KEY;

    if (!email || !apiKey) {
      console.error("Missing Migadu credentials in environment variables.");
      return NextResponse.json(
        { error: "Server configuration error. Missing credentials." },
        { status: 500 }
      );
    }

    const authHeader = "Basic " + Buffer.from(`${email}:${apiKey}`).toString("base64");

    const response = await fetch(MIGADU_API_URL, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const domains = data.domains.map(d => d.name);
      return NextResponse.json({ success: true, domains });
    } else {
      const errorData = await response.text();
      console.error("Failed to fetch domains from Migadu:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch domains." },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error("API error while fetching domains:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
