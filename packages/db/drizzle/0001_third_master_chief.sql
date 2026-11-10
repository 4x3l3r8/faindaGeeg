CREATE TYPE "public"."ingestion_status" AS ENUM('pending', 'running', 'success', 'failed', 'partial');--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"status" "ingestion_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_new" integer DEFAULT 0 NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"opportunities_created" integer DEFAULT 0 NOT NULL,
	"error" text,
	"cursor" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_id_idx" ON "ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_created_at_idx" ON "ingestion_runs" USING btree ("created_at");