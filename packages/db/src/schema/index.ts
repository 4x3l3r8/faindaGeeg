// Phase 0 intentionally ships an empty schema. The full entity set
// (Sources, SourceRecords, Opportunities, ...) arrives in Phase 1. Keeping a
// named export here lets `drizzle(sql, { schema })` infer table types as soon
// as they are added.

export const schema = {};
