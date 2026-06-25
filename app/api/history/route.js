import { NextResponse } from "next/server";
import { getAllEmails, deleteEmail, clearAllEmails } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

export async function GET(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

export async function DELETE(request) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (id === "all") {
      clearAllEmails();
      return NextResponse.json({ success: true, message: "All emails deleted from history" });
    }

    if (id) {
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
