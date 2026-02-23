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
  const { id, clientName, clientInfo, data, version } = await req.json();

  if (!id || !clientName || !data) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Optimistic locking: any authenticated user can save, but version must match
  if (version != null) {
    const result = await pool.query(
      `
      UPDATE checklist_sessions
      SET client_name = $2,
          client_info = $3,
          data = $4,
          version = version + 1,
          updated_at = NOW()
      WHERE id = $1 AND version = $5
      `,
      [id, clientName, JSON.stringify(clientInfo), JSON.stringify(data), version]
    );

    if (result.rowCount === 0) {
      const exists = await pool.query(
        `SELECT version FROM checklist_sessions WHERE id = $1`,
        [id]
      );
      if (exists.rowCount === 0) {
        // Record doesn't exist — fall through to INSERT below
      } else if (exists.rows[0].version !== version) {
        return NextResponse.json(
          { error: "conflict", message: "This checklist was modified by another user or tab. Please refresh to get the latest version.", serverVersion: exists.rows[0].version },
          { status: 409 }
        );
      }
    } else {
      return NextResponse.json({ saved: true, version: version + 1 });
    }
  }

  // INSERT for new records — user_id tracks who created it
  // ON CONFLICT: any user can update (shared workspace), version still increments
  const result = await pool.query(
    `
    INSERT INTO checklist_sessions (id, user_id, client_name, client_info, data, version)
    VALUES ($1, $2, $3, $4, $5, 1)
    ON CONFLICT (id) DO UPDATE SET
      client_name = EXCLUDED.client_name,
      client_info = EXCLUDED.client_info,
      data = EXCLUDED.data,
      version = checklist_sessions.version + 1,
      updated_at = NOW()
    RETURNING version
    `,
    [id, userId, clientName, JSON.stringify(clientInfo), JSON.stringify(data)]
  );

  return NextResponse.json({ saved: true, version: result.rows[0].version });
}
