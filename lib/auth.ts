import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { users, sessions, accounts } from "@/drizzle/schema"; // <-- corrected path

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
    },
  }),
  debug: true, // verbose logging for troubleshooting
  emailAndPassword: {
    enabled: true,
    disableVerification: true, // no email verification needed
  },
  advanced: {
    disable2FA: true,
    disableBanUser: true,
    database: {
      generateId: false, // This disables Better Auth's ID generation; DB defaultRandom() will be used
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string" as const,
        enum: ["superadmin", "admin", "collaborator", "client"] as const,
        input: false, // cannot be set by user
        required: false,
      },
    },
  },
});


