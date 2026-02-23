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

  // Show ALL checklists to all authenticated users (shared workspace)
  const result = await pool.query(
    `
    SELECT cs.id, cs.client_name, cs.client_info, cs.data, cs.updated_at, cs.user_id,
           u.name AS created_by_name, u.email AS created_by_email
    FROM checklist_sessions cs
    LEFT JOIN users u ON cs.user_id = u.id
    ORDER BY cs.updated_at DESC
    `
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
      createdBy: row.created_by_name || row.created_by_email || "Unknown",
      isOwner: row.user_id === session.user.id,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      totalItems: total,
      doneItems: done,
    };
  });

  return NextResponse.json(checklists);
}
