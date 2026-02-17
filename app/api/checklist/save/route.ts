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
  const { id, clientName, clientInfo, data } = await req.json();

  if (!id || !clientName || !data) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await pool.query(
    `
    INSERT INTO checklist_sessions (id, user_id, client_name, client_info, data)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id)
    DO UPDATE SET
      client_name = EXCLUDED.client_name,
      client_info = EXCLUDED.client_info,
      data = EXCLUDED.data,
      updated_at = NOW()
    `,
    [id, userId, clientName, JSON.stringify(clientInfo), JSON.stringify(data)]
  );

  return NextResponse.json({ saved: true });
}
