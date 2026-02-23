import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AWX_URL = process.env.AWX_URL || "http://10.7.157.105:30080";
const AWX_USER = process.env.AWX_USER || "admin";
const AWX_PASSWORD = process.env.AWX_PASSWORD || "np8H1YJCFprU6JVSJVluIcWRmPkvBGuF";

// Map section numbers to AWX job template names
const SECTION_TEMPLATES: Record<number, string> = {
  1: "B2R-Verify-JIRA",
  2: "B2R-Verify-Dollar-Universe",
  3: "B2R-Verify-Plan-Production",
  4: "B2R-Verify-Env-Applicatif",
  5: "B2R-Verify-Monitoring",
  6: "B2R-Verify-Livrables",
  7: "B2R-Verify-Systeme-Infra",
  8: "B2R-Verify-Security",
};

async function awxFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization:
      "Basic " + Buffer.from(`${AWX_USER}:${AWX_PASSWORD}`).toString("base64"),
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
    return NextResponse.json(
      { error: "Missing section or clientName" },
      { status: 400 }
    );
  }

  const templateName = SECTION_TEMPLATES[section];
  if (!templateName) {
    return NextResponse.json(
      { error: `Invalid section: ${section}` },
      { status: 400 }
    );
  }

  try {
    // Find the job template by name
    const templates = await awxFetch(
      `/job_templates/?name=${encodeURIComponent(templateName)}`
    );

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
        extra_vars: JSON.stringify({
          client_name: clientName,
          section: section,
        }),
      }),
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      url: `${AWX_URL}/#/jobs/playbook/${job.id}`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown AWX error";
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
      items?: Array<{
        id: string;
        name: string;
        status: string;
        detail: string;
      }>;
    } = {
      jobId: job.id,
      status: job.status, // pending, running, successful, failed, error, canceled
      finished: job.finished,
    };

    // If the job is done, get the stdout to parse results
    if (job.status === "successful" || job.status === "failed") {
      try {
        const stdout = await awxFetch(`/jobs/${jobId}/stdout/?format=json`);
        // Parse the JSON result from the debug output
        const content = stdout.content || "";
        const jsonMatch = content.match(
          new RegExp('"msg":\\s*"(\\{.*?section_result.*?\\})"', "s")
        );
        if (jsonMatch) {
          const sectionResult = JSON.parse(
            jsonMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "")
          );
          result.items = sectionResult.items;
        }
      } catch {
        // stdout parsing failed, that's ok
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown AWX error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
