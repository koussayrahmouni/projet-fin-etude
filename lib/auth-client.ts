"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://10.7.157.105:3000",
  // Ensure cookies are used for auth
  fetchOptions: {
    credentials: "include",
  },
});