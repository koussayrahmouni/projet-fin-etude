// app/api/verify-jira/route.ts
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { auth } from "@/lib/auth";

type VerifyApiResponse =
  | { ok: true; data: any; message?: string }
  | { ok: false; error: string; details?: any; status?: number };

export async function POST(request: Request) {
  try {
    // ── 1. Authentication ────────────────────────────────────────
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized — please sign in" },
        { status: 401 }
      );
    }

    // Optional: role/permission check (uncomment when you have roles)
    // const userRole = (session.user as any)?.role;
    // if (!["admin", "editor"].includes(userRole)) {
    //   return NextResponse.json(
    //     { ok: false, error: "Forbidden — insufficient permissions" },
    //     { status: 403 }
    //   );
    // }

    // ── 2. Parse input ────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));
    const client = body?.client?.trim();

    if (!client || typeof client !== "string") {
      return NextResponse.json(
        { ok: false, error: "Valid 'client' string is required" },
        { status: 400 }
      );
    }

    // Optional: log who triggered it (useful for audit)
    console.info("Verify Jira requested", {
      userId: session.user.id,
      email: session.user.email,
      client,
      timestamp: new Date().toISOString(),
    });

    // ── 3. Execute Ansible wrapper script ────────────────────────
    const scriptPath = path.join(process.cwd(), "ansible", "scripts", "run-verify.sh");

    const result = await new Promise<VerifyApiResponse>((resolve) => {
      execFile(
        scriptPath,
        [client],
        {
          env: {
            ...process.env,
            ANSIBLE_FORCE_COLOR: "false",      // reduce ANSI noise
            PYTHONUNBUFFERED: "1",             // better real-time output
          },
          maxBuffer: 25 * 1024 * 1024,         // 25 MB — generous
          timeout: 120_000,                    // 2 minutes — adjust if needed
          killSignal: "SIGTERM",
        },
        (err, stdout, stderr) => {
          if (err) {
            // Ansible/playbook failed (non-zero exit)
            console.error("Ansible execution failed", {
              client,
              exitCode: err.code,
              signal: err.signal,
              stderr: stderr.trim().slice(0, 1500),
            });

            return resolve({
              ok: false,
              error: "Verification process failed to execute",
              details: {
                exitCode: err.code ?? null,
                stderr: stderr.trim().slice(0, 2000),
              },
              status: 500,
            });
          }

          // ── Try to extract JSON from output ─────────────────────
          const output = stdout.trim();
          const lines = output.split("\n");
          let jsonStr = "";

          // Look for the last non-empty line that looks like JSON
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith("{") && line.endsWith("}")) {
              jsonStr = line;
              break;
            }
          }

          // Fallback: try full output if single line
          if (!jsonStr && output.startsWith("{") && output.endsWith("}")) {
            jsonStr = output;
          }

          if (!jsonStr) {
            console.warn("No JSON found in Ansible output", { client, outputSnippet: output.slice(0, 1000) });
            return resolve({
              ok: false,
              error: "Verification script did not return valid JSON",
              details: { rawOutput: output.slice(0, 3000) },
              status: 500,
            });
          }

          try {
            const parsed = JSON.parse(jsonStr);

            // You can add light post-processing here if needed
            // e.g. normalize check names, add computed overall status

            resolve({
              ok: true,
              data: parsed,
              message: `Verification completed for ${client}`,
            });
          } catch (parseErr) {
            console.error("JSON parse failed", { client, parseErr, jsonStr });
            resolve({
              ok: false,
              error: "Invalid verification result format",
              details: { rawJsonAttempt: jsonStr.slice(0, 2000) },
              status: 500,
            });
          }
        }
      );
    });

    // ── 4. Return consistent response shape ──────────────────────
    if (result.ok) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: result.status ?? 500 });
    }
  } catch (error: any) {
    console.error("Critical error in /api/verify-jira", {
      message: error.message,
      stack: error.stack?.slice(0, 800),
    });

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}




