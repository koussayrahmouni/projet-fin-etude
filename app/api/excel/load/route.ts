import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  // 1️⃣ Get authenticated user
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // 2️⃣ Get sessionId from query params
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  // 3️⃣ Load ONLY the user's own Excel session
  const result = await pool.query(
    `
    SELECT data, filename
    FROM excel_sessions
    WHERE id = $1 AND user_id = $2
    `,
    [sessionId, userId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(result.rows[0]);
}
