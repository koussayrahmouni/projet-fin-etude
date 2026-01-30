import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // Skip API and public assets
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Get session
  const session = await auth.api.getSession({
    headers: Object.fromEntries(req.headers),
  });

  const role = session?.user?.role;

  // Protect pages based on role
  const superadminPages = ["/superadmin"];
  const adminPages = ["/admin"];
  const collaboratorPages = ["/workspace"];
  const clientPages = ["/dashboard"];

  if (superadminPages.includes(url.pathname) && role !== "superadmin") {
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  if (adminPages.includes(url.pathname) && role !== "admin") {
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  if (collaboratorPages.includes(url.pathname) && role !== "collaborator") {
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  if (clientPages.includes(url.pathname) && role !== "client") {
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
