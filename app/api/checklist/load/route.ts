export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Any authenticated user can load any checklist (shared workspace)
  const result = await pool.query(
    `
    SELECT cs.id, cs.client_name, cs.client_info, cs.data, cs.version,
           cs.created_at, cs.updated_at, cs.user_id,
           u.name AS created_by_name, u.email AS created_by_email
    FROM checklist_sessions cs
    LEFT JOIN users u ON cs.user_id = u.id
    WHERE cs.id = $1
    `,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = result.rows[0];
  return NextResponse.json({
    ...row,
    created_by: row.created_by_name || row.created_by_email || "Unknown",
    is_owner: row.user_id === session.user.id,
  });
}
