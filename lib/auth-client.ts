// lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/client";



export const authClient = createAuthClient({
   baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"
});

//export const { signIn, signUp, signOut, useSession } = authClient;






















