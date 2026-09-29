import { integer, sqliteTable, text, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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

// Existing 0002 table must remain represented in future generated migrations.
export const googleTilesUsage=sqliteTable('google_tiles_usage',{day:text('day').primaryKey(),count:integer('count').notNull().default(0)});

export const sharedPlans=sqliteTable("shared_plans",{id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),createdAt:text("created_at").notNull(),document:text("document").notNull()},t=>[index("shared_plans_owner_idx").on(t.ownerId)]);

// No source photos or prompts: only owner-bound provider job metadata and a retry fingerprint.
export const listingVideoJobs = sqliteTable('listing_video_jobs', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  requestId: text('request_id').notNull(),
  requestHash: text('request_hash').notNull(),
  providerId: text('provider_id'),
  status: text('status').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  nextPollAt: integer('next_poll_at').notNull().default(0),
  videoUrl: text('video_url'),
  error: text('error'),
}, t => [index('listing_video_owner_idx').on(t.ownerId), uniqueIndex('listing_video_request_idx').on(t.ownerId,t.requestId)]);

export const listingVideoUsage = sqliteTable('listing_video_usage', {
  scope: text('scope').notNull(),
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, t => [primaryKey({columns:[t.scope,t.day]})]);

export * from './clientReviewSchema';
export * from './remixGallerySchema';
export * from './stagingInventorySchema';
export * from './collaborationSchema';
export * from './onlineMediaSchema';
