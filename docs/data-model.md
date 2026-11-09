# Data Model

> **Phase 1 stub.** The Phase 0 database schema is intentionally empty. No tables exist yet. The entities below describe the planned model and will be implemented with Drizzle migrations in Phase 1 and later phases.

## Core entities

| Entity | Purpose |
| --- | --- |
| **Sources** | A permitted public source (site, feed, or other channel) that may be ingested. |
| **SourceRecords** | A single captured item from a source, preserving raw content and provenance. |
| **Opportunities** | A structured, potentially paid software-engineering opportunity. |
| **OpportunityEvidence** | Links an opportunity to the source records that support it. |
| **Skills** | A skill or technology relevant to matching and scoring opportunities. |
| **OpportunitySkills** | Join table linking opportunities to required or relevant skills. |
| **LeadScores** | A deterministic score for an opportunity or lead, with versioned inputs. |
| **ProblemClusters** | A group of recurring, related problems. |
| **ClusterMembers** | Join table linking problems or opportunities to a cluster. |
| **ClientLeads** | A prospective client or lead associated with an opportunity. |
| **OutreachActivities** | A recorded outreach or follow-up action for a lead. |

## Optional entities

| Entity | Purpose |
| --- | --- |
| **IngestionRuns** | An audit record of a single ingestion execution. |
| **OpportunityFeedback** | User feedback on an opportunity's quality or relevance. |
| **ServiceIdeas** | A potential productised service derived from recurring problems. |

## Key relationships

- A **Source** has many **SourceRecords**.
- A **SourceRecord** can support many **OpportunityEvidence** rows; each row points to one **Opportunity**.
- An **Opportunity** has many **OpportunitySkills** rows, each referencing a **Skill**.
- An **Opportunity** or **ClientLead** can have versioned **LeadScores**.
- A **ProblemCluster** has many **ClusterMembers**.
- A **ClientLead** has many **OutreachActivities**.
- **IngestionRuns** reference the **Source** being processed.