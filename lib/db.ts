// lib/db.ts
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/drizzle/schema";

// PG Pool
export const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "excel_user",
  password: "excel_password",
  database: "excel_editor",
});

// Drizzle instance
export const db = drizzle(pool, {
  schema,
});
