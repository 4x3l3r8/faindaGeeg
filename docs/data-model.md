# Data Model

> **Phase 1–4.** The Phase 1 schema is implemented in Drizzle (`packages/db/src/schema`) and applied by migration `0000_known_tomas`; the Phase 2 ingestion table by `0001_third_master_chief`; and the Phase 4 problem-intelligence tables plus the `opportunities.embedding` column by `0002_faithful_namor`, which also enables the pgvector extension. Fourteen tables exist today.

## Implemented (Phase 1–4)

| Entity                  | Table                  | Purpose and key relationships                                                                                                                                                        |
| ----------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sources**             | `sources`              | A permitted channel that may be ingested. Has many SourceRecords.                                                                                                                    |
| **SourceRecords**       | `source_records`       | A single captured item with raw content, provenance, and a `content_hash` used for dedup. Belongs to a Source; supports many OpportunityEvidence rows.                               |
| **Opportunities**       | `opportunities`        | A structured opportunity (`gig`/`problem`/`product_gap`) with workflow status and commercial fields, plus an `embedding` vector(256) used for semantic clustering.                   |
| **OpportunityEvidence** | `opportunity_evidence` | Links an Opportunity to the SourceRecords that support it (cascades on opportunity delete).                                                                                          |
| **Skills**              | `skills`               | A skill or technology with category, aliases, and proficiency. Seeded with 23 profile skills.                                                                                        |
| **OpportunitySkills**   | `opportunity_skills`   | Join table linking an Opportunity to a Skill, with match strength and a required flag.                                                                                               |
| **LeadScores**          | `lead_scores`          | A versioned deterministic score for an Opportunity, with per-factor values and an explanation JSON.                                                                                  |
| **ClientLeads**         | `client_leads`         | A tracked lead promoted from an Opportunity (one-to-one). Has many OutreachActivities.                                                                                               |
| **OutreachActivities**  | `outreach_activities`  | A recorded outreach or follow-up action for a ClientLead.                                                                                                                            |
| **OpportunityFeedback** | `opportunity_feedback` | Relevance, rating, and notes feedback for an Opportunity.                                                                                                                            |
| **IngestionRuns**       | `ingestion_runs`       | Ingestion run tracking — status, counts, error, a resumable cursor, and a source link. Belongs to a Source.                                                                          |
| **ProblemClusters**     | `problem_clusters`     | A recurring-problem cluster with a normalized-mean `centroid` vector(256), demand and independent-source metrics, and a validation status. Has many ClusterMembers and ServiceIdeas. |
| **ClusterMembers**      | `cluster_members`      | Join table linking a ProblemCluster to an Opportunity, with a similarity score.                                                                                                      |
| **ServiceIdeas**        | `service_ideas`        | A draft AI-generated service offering derived from a ProblemCluster (summary, suggested service, required skills, engagement model, validation questions, next action).              |

## Deferred

None for the current roadmap — Phase 4 was the last deferred group of entities.
