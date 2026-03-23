export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { checklistSessions, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: checklistSessions.id,
        clientName: checklistSessions.clientName,
        updatedAt: checklistSessions.updatedAt,
        createdBy: checklistSessions.userId,
        createdByName: users.name,
        data: checklistSessions.data,
      })
      .from(checklistSessions)
      .leftJoin(users, eq(checklistSessions.userId, users.id))
      .orderBy(checklistSessions.updatedAt);

    const list = rows.map((row) => {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data as any;
      const allItems = data?.sections?.flatMap((s: any) => s.items).filter((i: any) => i.status !== "na") ?? [];
      const doneItems = allItems.filter((i: any) => i.status === "done").length;
      const progress = allItems.length > 0 ? Math.round((doneItems / allItems.length) * 100) : 0;

      return {
        id: row.id,
        clientName: row.clientName,
        updatedAt: row.updatedAt,
        createdBy: row.createdByName ?? row.createdBy,
        isOwner: row.createdBy === session.user.id,
        progress,
        totalItems: allItems.length,
        doneItems,
      };
    });

    return NextResponse.json(list);
  } catch (err) {
    console.error("Failed to get checklists:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}