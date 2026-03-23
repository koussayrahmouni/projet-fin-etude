import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  bigint,
  boolean,        // ← MUST be here
  primaryKey,     // for the compound key in accounts
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
//import { boolean,pgTable, uuid, varchar, text, bigint, primaryKey, index } from "drizzle-orm/pg-core";
// Roles enum
export const roleEnum = pgEnum("role", [
  "superadmin",
  "admin",
  "collaborator",
  "client",
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 100 }),
  image: varchar("image", { length: 500 }),
  hashedPassword: text("hashed_password"),

  emailVerified: boolean("email_verified").notNull().default(false),  // ← now works

  role: roleEnum("role").notNull().default("client"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});





// Sessions table
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  token: varchar("token", { length: 255 }).unique().notNull(),

  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  // Add these to satisfy Better Auth validation
  ipAddress: varchar("ip_address", { length: 45 }),     // IPv4/IPv6
  userAgent: text("user_agent"),
});






// Accounts table (OAuth)
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    providerId: varchar("provider_id", { length: 50 }).notNull(),
    accountId: varchar("account_id", { length: 255 }).notNull(),

    password: text("password"),  // for credentials

    // Add these timestamps (Better Auth expects them)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),  // optional: auto-update on changes

    // Your existing OAuth fields
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    expires_at: bigint("expires_at", { mode: "number" }),
    token_type: varchar("token_type", { length: 50 }),
    scope: text("scope"),
    id_token: text("id_token"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.providerId, table.accountId] }),
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

// Excel sessions table
export const excelSessions = pgTable(
  "excel_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    filename: text("filename"),
    data: jsonb("data").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("excel_sessions_user_id_idx").on(table.userId),
    userSessionIdx: index("excel_sessions_user_session_idx").on(table.userId, table.id),
  })
);

// Checklist sessions table
export const checklistSessions = pgTable(
  "checklist_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    clientInfo: jsonb("client_info"),
    data: jsonb("data").notNull(),
    excelData: text("excel_data"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdIdx: index("checklist_sessions_user_id_idx").on(table.userId),
    userChecklistIdx: index("checklist_sessions_user_checklist_idx").on(table.userId, table.id),
  })
);

// Active editors presence tracking
// Each row = "this user is currently editing this checklist"
// Rows older than 30 seconds are considered stale (user left)
export const checklistPresence = pgTable(
  "checklist_presence",
  {
    checklistId: uuid("checklist_id").notNull().references(() => checklistSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userName: varchar("user_name", { length: 100 }),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.checklistId, table.userId] }),
    checklistIdx: index("checklist_presence_checklist_idx").on(table.checklistId),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  excelSessions: many(excelSessions),
  checklistSessions: many(checklistSessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const excelSessionsRelations = relations(excelSessions, ({ one }) => ({
  user: one(users, { fields: [excelSessions.userId], references: [users.id] }),
}));

export const checklistSessionsRelations = relations(checklistSessions, ({ one }) => ({
  user: one(users, { fields: [checklistSessions.userId], references: [users.id] }),
}));
