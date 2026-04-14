export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as yaml from "js-yaml";

const AWX_URL = process.env.AWX_URL || "http://10.7.157.105:30080";
const AWX_TOKEN = process.env.AWX_TOKEN || "xf9KU5Oop2G7waMfIPgoCRq4qRPgL9";
const INVENTORY_ID = 3;

async function awxFetch(path: string) {
  const res = await fetch(`${AWX_URL}/api/v2${path}`, {
    headers: {
      "Authorization": `Bearer ${AWX_TOKEN}`,
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`AWX error ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await awxFetch(`/inventories/${INVENTORY_ID}/hosts/`);

    const clients = data.results.map((host: { id: number; name: string; variables: string }) => {
      const vars = yaml.load(host.variables) as Record<string, string>;
      return {
        id: host.id,
        hostName: host.name,         // "b2r-client-a"
        clientName: vars.client_name, // "ClientA"
      };
    });

    return NextResponse.json(clients);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}