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

  const userId = session.user.id;

  const result = await pool.query(
    `
    SELECT id, client_name, client_info, data, updated_at
    FROM checklist_sessions
    WHERE user_id = $1
    ORDER BY updated_at DESC
    `,
    [userId]
  );

  const checklists = result.rows.map((row) => {
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    const sections = data?.sections || [];
    let total = 0;
    let done = 0;
    for (const section of sections) {
      for (const item of section.items || []) {
        total++;
        if (item.status === "done") done++;
      }
    }
    return {
      id: row.id,
      clientName: row.client_name,
      updatedAt: row.updated_at,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      totalItems: total,
      doneItems: done,
    };
  });

  return NextResponse.json(checklists);
}
