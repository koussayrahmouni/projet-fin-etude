import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { users, sessions, accounts } from "@/drizzle/schema";

export const auth = betterAuth({
  baseURL: "http://10.7.157.105:3000",
  trustedOrigins: [
    "http://localhost:3000",
    "http://10.7.157.105:3000",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
    },
  }),
  debug: true,
  emailAndPassword: {
    enabled: true,
    disableVerification: true,
  },
  advanced: {
    useSecureCookies: false,
    cookiePrefix: "better-auth",
    defaultCookieAttributes: {
      secure: false,        // 👈 forces no Secure flag
      httpOnly: true,
      sameSite: "lax",
    },
    database: {
      generateId: false,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string" as const,
        enum: ["superadmin", "admin", "collaborator", "client"] as const,
        input: false,
        required: false,
      },
    },
  },
});