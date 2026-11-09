import { eq } from 'drizzle-orm';
import { getDb, skills } from '@toi/db';

export interface SkillPatch {
  isEnabled?: boolean;
  proficiency?: number | null;
  category?: string;
  aliases?: string[];
}

export interface SkillInput {
  name: string;
  category: string;
  aliases?: string[];
  proficiency?: number | null;
  isEnabled?: boolean;
}

export async function listSkills(): Promise<Array<typeof skills.$inferSelect>> {
  const db = getDb();

  return db.select().from(skills).orderBy(skills.category, skills.name);
}

export async function updateSkill(
  id: string,
  patch: SkillPatch,
): Promise<typeof skills.$inferSelect | null> {
  const db = getDb();

  const updates: Partial<typeof skills.$inferInsert> = {};

  if (patch.isEnabled !== undefined) {
    updates.isEnabled = patch.isEnabled;
  }

  if (patch.proficiency !== undefined) {
    updates.proficiency = patch.proficiency;
  }

  if (patch.category !== undefined) {
    updates.category = patch.category;
  }

  if (patch.aliases !== undefined) {
    updates.aliases = patch.aliases;
  }

  const rows = await db.update(skills).set(updates).where(eq(skills.id, id)).returning();

  return rows[0] ?? null;
}

export async function createSkill(data: SkillInput): Promise<typeof skills.$inferSelect> {
  const db = getDb();

  await db
    .insert(skills)
    .values({
      name: data.name,
      category: data.category,
      ...(data.aliases === undefined ? {} : { aliases: data.aliases }),
      ...(data.proficiency === undefined ? {} : { proficiency: data.proficiency }),
      ...(data.isEnabled === undefined ? {} : { isEnabled: data.isEnabled }),
    })
    .onConflictDoNothing({ target: skills.name });

  const rows = await db.select().from(skills).where(eq(skills.name, data.name)).limit(1);

  const row = rows[0];
  if (row === undefined) {
    throw new Error('Failed to create or find the skill');
  }

  return row;
}
