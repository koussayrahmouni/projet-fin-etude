import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
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

  // 2️⃣ Parse body
  const { sessionId, filename, data } = await req.json();

  if (!sessionId || !data) {
    return NextResponse.json(
      { error: "Missing data" },
      { status: 400 }
    );
  }

  // 3️⃣ Insert WITH user_id
  await pool.query(
    `
    INSERT INTO excel_sessions (id, user_id, filename, data)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id)
    DO UPDATE SET
      data = EXCLUDED.data,
      filename = EXCLUDED.filename,
      updated_at = NOW()
    `,
    [sessionId, userId, filename, data]
  );

  return NextResponse.json({ saved: true });
}
