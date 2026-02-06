import { auth } from "@/lib/auth"; // import your better-auth instance
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";
export const { GET, POST } = toNextJsHandler(auth);
