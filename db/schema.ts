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
