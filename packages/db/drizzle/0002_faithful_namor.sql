CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."cluster_validation_status" AS ENUM('unvalidated', 'investigating', 'validated', 'rejected');--> statement-breakpoint
CREATE TABLE "cluster_members" (
	"cluster_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"similarity" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cluster_members_cluster_id_opportunity_id_pk" PRIMARY KEY("cluster_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "problem_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_audience" text,
	"problem_category" text,
	"centroid" vector(256),
	"member_count" integer DEFAULT 0 NOT NULL,
	"independent_source_count" integer DEFAULT 0 NOT NULL,
	"demand_score" numeric,
	"validation_status" "cluster_validation_status" DEFAULT 'unvalidated' NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"target_customer" text,
	"suggested_service" text NOT NULL,
	"required_skills" text[] DEFAULT '{}' NOT NULL,
	"engagement_model" text,
	"validation_questions" text[] DEFAULT '{}' NOT NULL,
	"next_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "embedding" vector(256);--> statement-breakpoint
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_cluster_id_problem_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."problem_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cluster_members" ADD CONSTRAINT "cluster_members_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_ideas" ADD CONSTRAINT "service_ideas_cluster_id_problem_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."problem_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cluster_members_opportunity_id_idx" ON "cluster_members" USING btree ("opportunity_id");