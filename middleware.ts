// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // Skip API, public assets, login and register
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    url.pathname === "/login" ||
    url.pathname === "/register" ||
    url.pathname === "/unauthorized"
  ) {
    return NextResponse.next();
  }

  // Read session cookie directly — no Node.js crypto needed
  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value;

  // Not logged in at all
  if (!sessionToken) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Role is encoded in the JWT payload (middle part of the token)
  // We can't verify it in edge, so do role checks in each page instead
  // Just allow through if session cookie exists
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/superadmin/:path*",
    "/workspace/:path*",
  ],
};