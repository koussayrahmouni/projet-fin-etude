ALTER TABLE "sessions" ADD COLUMN "ip_address" varchar(45) DEFAULT null;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text DEFAULT null;