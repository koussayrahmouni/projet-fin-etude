export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: Load the most recent Excel data for a given client name
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientName = searchParams.get("clientName");
  const listMode = searchParams.get("list") === "true";
  if (listMode) {
    // Return list of clients
    const result = await pool.query(
      `
      SELECT DISTINCT client_name
      FROM checklist_sessions
      WHERE excel_data IS NOT NULL
      ORDER BY client_name ASC
      `
    );
    const clients = result.rows.map(r => r.client_name);
    return NextResponse.json({ clients });
    // or return NextResponse.json(clients);
  }
  if (!clientName) {
    return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  }

  const result = await pool.query(
    `
    SELECT id, client_name, client_info, excel_data, updated_at
    FROM checklist_sessions
    WHERE LOWER(client_name) = LOWER($1) AND excel_data IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [clientName]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "No checklist found for this client" }, { status: 404 });
  }

  const row = result.rows[0];
  return NextResponse.json({
    id: row.id,
    clientName: row.client_name,
    clientInfo: row.client_info,
    excelData: row.excel_data,
    updatedAt: row.updated_at,
  });
}

// PUT: Save edited Excel data back to the DB
export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, excelData } = await req.json();

  if (!id || !excelData) {
    return NextResponse.json({ error: "id and excelData are required" }, { status: 400 });
  }

  await pool.query(
    `
    UPDATE checklist_sessions
    SET excel_data = $2,
        updated_at = NOW()
    WHERE id = $1
    `,
    [id, excelData]
  );

  return NextResponse.json({ saved: true });
}
