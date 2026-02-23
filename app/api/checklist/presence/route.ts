import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

const STALE_SECONDS = 30; // Consider a user "gone" after 30s without heartbeat

// POST: Send heartbeat — "I'm currently editing this checklist"
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checklistId } = await req.json();
  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 });
  }

  // Upsert: insert or update the last_seen timestamp
  await pool.query(
    `
    INSERT INTO checklist_presence (checklist_id, user_id, user_name, last_seen)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (checklist_id, user_id)
    DO UPDATE SET last_seen = NOW(), user_name = EXCLUDED.user_name
    `,
    [checklistId, session.user.id, session.user.name || session.user.email]
  );

  // Clean up stale entries (anyone not seen in 30 seconds)
  await pool.query(
    `DELETE FROM checklist_presence WHERE last_seen < NOW() - INTERVAL '${STALE_SECONDS} seconds'`
  );

  return NextResponse.json({ ok: true });
}

// GET: Who is currently editing this checklist?
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const checklistId = searchParams.get("checklistId");

  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 });
  }

  // Get all active editors (seen in last 30 seconds), exclude the current user
  const result = await pool.query(
    `
    SELECT user_id, user_name, last_seen
    FROM checklist_presence
    WHERE checklist_id = $1
      AND user_id != $2
      AND last_seen > NOW() - INTERVAL '${STALE_SECONDS} seconds'
    ORDER BY last_seen DESC
    `,
    [checklistId, session.user.id]
  );

  return NextResponse.json({ editors: result.rows });
}

// DELETE: User is leaving the checklist (cleanup)
export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const checklistId = searchParams.get("checklistId");

  if (!checklistId) {
    return NextResponse.json({ error: "Missing checklistId" }, { status: 400 });
  }

  await pool.query(
    `DELETE FROM checklist_presence WHERE checklist_id = $1 AND user_id = $2`,
    [checklistId, session.user.id]
  );

  return NextResponse.json({ ok: true });
}
