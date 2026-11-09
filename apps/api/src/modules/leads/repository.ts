import { and, desc, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { clientLeads, getDb, opportunities, outreachActivities } from '@toi/db';

import type { OpportunityStatus, OutreachActivityType } from '../../shared/index.js';

export interface LeadListParams {
  status?: string;
}

export interface LeadPatch {
  status?: string;
  notes?: string | null;
  nextActionAt?: Date | null;
}

export interface ActivityInput {
  activityType: string;
  content: string | null;
  outcome: string | null;
}

export async function createLeadFromOpportunity(
  opportunityId: string,
  status: string = 'qualified',
): Promise<typeof clientLeads.$inferSelect> {
  const db = getDb();

  await db
    .insert(clientLeads)
    .values({ opportunityId, status: status as OpportunityStatus })
    .onConflictDoNothing({ target: clientLeads.opportunityId });

  const rows = await db
    .select()
    .from(clientLeads)
    .where(eq(clientLeads.opportunityId, opportunityId))
    .limit(1);

  const row = rows[0];
  if (row === undefined) {
    throw new Error('Failed to create or find the client lead');
  }

  return row;
}

export async function listLeads(params: LeadListParams) {
  const db = getDb();

  const conditions: SQL[] = [];

  if (params.status !== undefined) {
    conditions.push(eq(clientLeads.status, params.status as OpportunityStatus));
  }

  return db
    .select({
      id: clientLeads.id,
      opportunityId: clientLeads.opportunityId,
      status: clientLeads.status,
      notes: clientLeads.notes,
      nextActionAt: clientLeads.nextActionAt,
      createdAt: clientLeads.createdAt,
      updatedAt: clientLeads.updatedAt,
      opportunityTitle: opportunities.title,
      opportunityType: opportunities.opportunityType,
    })
    .from(clientLeads)
    .innerJoin(opportunities, eq(opportunities.id, clientLeads.opportunityId))
    .where(and(...conditions))
    .orderBy(desc(clientLeads.updatedAt));
}

export async function getLead(id: string) {
  const db = getDb();

  const rows = await db
    .select({
      id: clientLeads.id,
      opportunityId: clientLeads.opportunityId,
      status: clientLeads.status,
      notes: clientLeads.notes,
      nextActionAt: clientLeads.nextActionAt,
      createdAt: clientLeads.createdAt,
      updatedAt: clientLeads.updatedAt,
      opportunity: {
        id: opportunities.id,
        title: opportunities.title,
        opportunityType: opportunities.opportunityType,
        status: opportunities.status,
      },
    })
    .from(clientLeads)
    .innerJoin(opportunities, eq(opportunities.id, clientLeads.opportunityId))
    .where(eq(clientLeads.id, id))
    .limit(1);

  const lead = rows[0];
  if (lead === undefined) {
    return null;
  }

  const activities = await db
    .select()
    .from(outreachActivities)
    .where(eq(outreachActivities.clientLeadId, id))
    .orderBy(desc(outreachActivities.occurredAt));

  return { ...lead, activities };
}

export async function updateLead(
  id: string,
  patch: LeadPatch,
): Promise<typeof clientLeads.$inferSelect | null> {
  const db = getDb();

  const updates: Partial<typeof clientLeads.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.status !== undefined) {
    updates.status = patch.status as OpportunityStatus;
  }

  if (patch.notes !== undefined) {
    updates.notes = patch.notes;
  }

  if (patch.nextActionAt !== undefined) {
    updates.nextActionAt = patch.nextActionAt;
  }

  const rows = await db.update(clientLeads).set(updates).where(eq(clientLeads.id, id)).returning();

  return rows[0] ?? null;
}

export async function addActivity(
  leadId: string,
  data: ActivityInput,
): Promise<typeof outreachActivities.$inferSelect> {
  const db = getDb();

  const inserted = await db
    .insert(outreachActivities)
    .values({
      clientLeadId: leadId,
      activityType: data.activityType as OutreachActivityType,
      content: data.content,
      outcome: data.outcome,
    })
    .returning();

  const row = inserted[0];
  if (row === undefined) {
    throw new Error('Failed to insert the outreach activity');
  }

  return row;
}
