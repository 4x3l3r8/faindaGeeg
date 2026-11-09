CREATE TYPE "public"."buying_intent" AS ENUM('explicit', 'implied', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('fixed_project', 'contract', 'retainer', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('quote', 'summary', 'link', 'other');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('new', 'reviewing', 'qualified', 'contacted', 'replied', 'discussion', 'proposal', 'won', 'lost', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('gig', 'problem', 'product_gap');--> statement-breakpoint
CREATE TYPE "public"."outreach_activity_type" AS ENUM('note', 'draft', 'contact', 'reply', 'proposal', 'status_change', 'other');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('reddit', 'x', 'facebook', 'instagram', 'github', 'job_board', 'review', 'manual', 'other');--> statement-breakpoint
CREATE TABLE "client_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"status" "opportunity_status" DEFAULT 'new' NOT NULL,
	"notes" text,
	"next_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_leads_opportunity_id_unique" UNIQUE("opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"score_version" text NOT NULL,
	"skill_fit" numeric NOT NULL,
	"buying_intent" numeric NOT NULL,
	"commercial_value" numeric NOT NULL,
	"urgency" numeric NOT NULL,
	"freshness" numeric NOT NULL,
	"credibility" numeric NOT NULL,
	"total_score" numeric NOT NULL,
	"explanation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_type" "opportunity_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_customer" text,
	"buying_intent" "buying_intent" DEFAULT 'unknown' NOT NULL,
	"engagement_type" "engagement_type" DEFAULT 'unknown' NOT NULL,
	"budget_min" numeric,
	"budget_max" numeric,
	"currency" text,
	"urgency" integer,
	"commercial_evidence" text,
	"confidence" numeric,
	"status" "opportunity_status" DEFAULT 'new' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"evidence_type" "evidence_type" DEFAULT 'quote' NOT NULL,
	"excerpt" text NOT NULL,
	"strength" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"is_relevant" boolean,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_skills" (
	"opportunity_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"match_strength" numeric,
	"is_required" boolean DEFAULT false NOT NULL,
	"evidence_excerpt" text,
	CONSTRAINT "opportunity_skills_opportunity_id_skill_id_pk" PRIMARY KEY("opportunity_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "outreach_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_lead_id" uuid NOT NULL,
	"activity_type" "outreach_activity_type" NOT NULL,
	"content" text,
	"outcome" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"proficiency" integer,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"canonical_url" text,
	"author_key" text,
	"title" text,
	"content_text" text NOT NULL,
	"published_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"language" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_leads" ADD CONSTRAINT "client_leads_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_evidence" ADD CONSTRAINT "opportunity_evidence_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_feedback" ADD CONSTRAINT "opportunity_feedback_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_activities" ADD CONSTRAINT "outreach_activities_client_lead_id_client_leads_id_fk" FOREIGN KEY ("client_lead_id") REFERENCES "public"."client_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_scores_opportunity_id_scored_at_idx" ON "lead_scores" USING btree ("opportunity_id","scored_at");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_opportunity_type_idx" ON "opportunities" USING btree ("opportunity_type");--> statement-breakpoint
CREATE INDEX "opportunity_evidence_opportunity_id_idx" ON "opportunity_evidence" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_records_source_id_external_id_unique" ON "source_records" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "source_records_content_hash_idx" ON "source_records" USING btree ("content_hash");