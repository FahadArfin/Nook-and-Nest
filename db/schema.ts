import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

// Every lookup includes ownerId. Versions are immutable; restoring creates a new version.
export const projectVersions = sqliteTable("project_versions", {
  ownerId: text("owner_id").notNull(),
  projectId: text("project_id").notNull(),
  revision: integer("revision").notNull(),
  name: text("name").notNull(),
  savedAt: text("saved_at").notNull(),
  document: text("document").notNull(),
}, t => [primaryKey({ columns: [t.ownerId, t.projectId, t.revision] })]);

// Daily counters only. Uploaded plans and provider responses are never stored here.
export const recognitionUsage = sqliteTable('recognition_usage', {
  ownerId: text('owner_id').notNull(),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, t => [primaryKey({columns:[t.ownerId,t.day]})]);
