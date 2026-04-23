import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, body } = await req.json();

    if (!url) {
      return NextResponse.json({ error: { code: -1, message: "No URL provided", data: "No URL" } }, { status: 400 });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: -1, message: err.message, data: err.message } },
      { status: 500 }
    );
  }
}
