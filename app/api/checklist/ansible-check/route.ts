export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AWX_URL = process.env.AWX_URL || "http://10.7.157.105:30080";
const AWX_TOKEN = process.env.AWX_TOKEN || "qIDo1vGom9tZu4MYI46trWnzCg8KRJ"; // your token here

// Map section numbers to AWX job template names
const SECTION_TEMPLATES: Record<number, string> = {
  1: "B2R Section 1 - JIRA Verification",
  2: "B2R Section 2 - Dollar Universe Verification",
  3: "B2R Section 3 - Plan de Production Verification",
  4: "B2R Section 4 - Environnement Applicatif Verification",
  5: "B2R Section 5 - Monitoring Verification",
  6: "B2R Section 6 - Livrables Verification",
  7: "B2R Section 7 - Système & Infrastructure Verification",
  8: "B2R Section 8 - Security Verification",
};

async function awxFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${AWX_TOKEN}`,
  };

  const res = await fetch(`${AWX_URL}/api/v2${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AWX API error ${res.status}: ${text}`);
  }

  return res.json();
}

// POST: Launch a job for a specific section
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { section, clientName } = await req.json();

  if (!section || !clientName) {
    return NextResponse.json({ error: "Missing section or clientName" }, { status: 400 });
  }

  const templateName = SECTION_TEMPLATES[section];
  if (!templateName) {
    return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  try {
    // Find the job template by name
    const templates = await awxFetch(`/job_templates/?name=${encodeURIComponent(templateName)}`);

    if (!templates.results || templates.results.length === 0) {
      return NextResponse.json(
        {
          error: `Job template "${templateName}" not found in AWX. Please create it first.`,
          setup_required: true,
        },
        { status: 404 }
      );
    }

    const templateId = templates.results[0].id;

    // Launch the job with extra_vars
    const job = await awxFetch(`/job_templates/${templateId}/launch/`, {
      method: "POST",
      body: JSON.stringify({
        extra_vars: JSON.stringify({ client_name: clientName, section }),
      }),
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      url: `${AWX_URL}/#/jobs/playbook/${job.id}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown AWX error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Check job status and retrieve results
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const job = await awxFetch(`/jobs/${jobId}/`);

    const result: {
      jobId: number;
      status: string;
      finished: string | null;
      items?: Array<{ id: string; name: string; status: string; detail: string }>;
    } = {
      jobId: job.id,
      status: job.status,
      finished: job.finished,
    };

    if (job.status === "successful" || job.status === "failed") {
      try {
        const events = await awxFetch(
          `/jobs/${jobId}/job_events/?event=runner_on_ok&task__contains=Output&page_size=1`
        );

        if (events.results?.length) {
          const msg = events.results[0]?.event_data?.res?.msg;
          if (msg) {
            result.items = typeof msg === "string" ? JSON.parse(msg).items : msg.items;
          }
        }
      } catch (parseErr) {
        console.error("Failed to parse AWX job events:", parseErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown AWX error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}