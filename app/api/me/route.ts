export const runtime = "nodejs";
// app/api/me/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers"; // use headers for session

export async function GET() {
  try {
    // Get session from Better Auth using cookies
    const session = await auth.api.getSession({
      headers: await headers(), // forwards headers (including cookies) to server
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return only the fields you need
    return NextResponse.json({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    });
  } catch (err) {
    console.error("Failed to fetch session:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}