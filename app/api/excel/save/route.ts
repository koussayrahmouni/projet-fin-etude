export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { sessionId, filename, data, version } = await req.json();

  if (!sessionId || !data) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  // Optimistic locking: only update if version matches
  if (version != null) {
    const result = await pool.query(
      `
      UPDATE excel_sessions
      SET data = $3,
          filename = $4,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND version = $5
      `,
      [sessionId, userId, data, filename, version]
    );

    if (result.rowCount === 0) {
      const exists = await pool.query(
        `SELECT version FROM excel_sessions WHERE id = $1`,
        [sessionId]
      );
      if (exists.rowCount === 0) {
        // Doesn't exist yet — fall through to INSERT
      } else if (exists.rows[0].version !== version) {
        return NextResponse.json(
          { error: "conflict", message: "Data was modified in another tab. Please refresh.", serverVersion: exists.rows[0].version },
          { status: 409 }
        );
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ saved: true, version: version + 1 });
    }
  }

  // INSERT for new records, with user ownership on conflict
  const result = await pool.query(
    `
    INSERT INTO excel_sessions (id, user_id, filename, data, version)
    VALUES ($1, $2, $3, $4, 1)
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      filename = EXCLUDED.filename,
      version = excel_sessions.version + 1,
      updated_at = NOW()
    WHERE excel_sessions.user_id = $2
    RETURNING version
    `,
    [sessionId, userId, filename, data]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: "Forbidden", message: "You don't own this session" },
      { status: 403 }
    );
  }

  return NextResponse.json({ saved: true, version: result.rows[0].version });
}
