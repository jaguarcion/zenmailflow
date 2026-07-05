import { NextResponse } from "next/server";
import { getAllEmails, getEmailById, deleteEmail, clearAllEmails } from "@/lib/db";
import { isAuthenticated, checkFail2Ban } from "@/lib/auth";

export async function GET(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const emails = getAllEmails();
    return NextResponse.json({ success: true, data: emails });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

async function deleteFromMigadu(emailAddress) {
  const emailAdmin = process.env.MIGADU_EMAIL;
  const apiKey = process.env.MIGADU_API_KEY;

  if (!emailAdmin || !apiKey) {
    console.error("Missing Migadu credentials in environment variables.");
    return false;
  }

  const authHeader = "Basic " + Buffer.from(`${emailAdmin}:${apiKey}`).toString("base64");
  
  const [localPart, domain] = emailAddress.split("@");
  if (!localPart || !domain) return false;

  const url = `https://api.migadu.com/v1/domains/${domain}/mailboxes/${localPart}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Authorization": authHeader,
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to delete ${emailAddress} from Migadu:`, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Network error deleting ${emailAddress} from Migadu:`, error);
    return false;
  }
}

export async function DELETE(request) {
  const authStatus = await checkFail2Ban(request);
    if (authStatus.banned) return NextResponse.json({ error: 'Banned for 24h' }, { status: 429 });
    if (!authStatus.isAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (id === "all") {
      const allEmails = getAllEmails();
      for (const emailObj of allEmails) {
        await deleteFromMigadu(emailObj.email);
        await new Promise((resolve) => setTimeout(resolve, 300)); // Rate limit prevention
      }
      clearAllEmails();
      return NextResponse.json({ success: true, message: "All emails deleted from history and Migadu" });
    }

    if (id) {
      const emailObj = getEmailById(parseInt(id));
      if (emailObj) {
        await deleteFromMigadu(emailObj.email);
      }
      deleteEmail(parseInt(id));
      return NextResponse.json({ success: true, message: `Email ${id} deleted` });
    }

    return NextResponse.json(
      { error: "Missing ID" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting history:", error);
    return NextResponse.json(
      { error: "Failed to delete from history" },
      { status: 500 }
    );
  }
}
