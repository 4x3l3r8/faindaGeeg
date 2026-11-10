# Data Model

> **Phase 1.** The Phase 1 schema is implemented in Drizzle (`packages/db/src/schema`) and applied by migration `0000_known_tomas`. Ten tables exist today; remaining entities are deferred as noted below.

## Implemented (Phase 1)

| Entity | Table | Purpose and key relationships |
| --- | --- | --- |
| **Sources** | `sources` | A permitted channel that may be ingested. Has many SourceRecords. |
| **SourceRecords** | `source_records` | A single captured item with raw content, provenance, and a `content_hash` used for dedup. Belongs to a Source; supports many OpportunityEvidence rows. |
| **Opportunities** | `opportunities` | A structured opportunity (`gig`/`problem`/`product_gap`) with workflow status and commercial fields. |
| **OpportunityEvidence** | `opportunity_evidence` | Links an Opportunity to the SourceRecords that support it (cascades on opportunity delete). |
| **Skills** | `skills` | A skill or technology with category, aliases, and proficiency. Seeded with 23 profile skills. |
| **OpportunitySkills** | `opportunity_skills` | Join table linking an Opportunity to a Skill, with match strength and a required flag. |
| **LeadScores** | `lead_scores` | A versioned deterministic score for an Opportunity, with per-factor values and an explanation JSON. |
| **ClientLeads** | `client_leads` | A tracked lead promoted from an Opportunity (one-to-one). Has many OutreachActivities. |
| **OutreachActivities** | `outreach_activities` | A recorded outreach or follow-up action for a ClientLead. |
| **OpportunityFeedback** | `opportunity_feedback` | Relevance, rating, and notes feedback for an Opportunity. |

## Deferred

| Entity | Deferred to |
| --- | --- |
| **ProblemClusters**, **ClusterMembers**, **ServiceIdeas** | Phase 4 (problem intelligence and clustering). |
| **Dedicated ingestion-run tables** | Phase 2 (ingestion engine). |
