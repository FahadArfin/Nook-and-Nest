-- Provisional numbering: parent must assign the next migration and Drizzle journal entry.
CREATE TABLE remix_shares (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL,
 current_revision INTEGER NOT NULL DEFAULT 1, access_version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
 token_hash TEXT, publication_id TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX remix_owner ON remix_shares(owner_id,created_at);
--> statement-breakpoint
CREATE TABLE remix_revisions (
 share_id TEXT NOT NULL REFERENCES remix_shares(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, created_at INTEGER NOT NULL, document TEXT NOT NULL,
 title TEXT NOT NULL, creator TEXT NOT NULL, description TEXT NOT NULL, kind TEXT NOT NULL,
 allow_copy INTEGER NOT NULL, tags TEXT NOT NULL, thumbnail TEXT NOT NULL,
 PRIMARY KEY(share_id,revision)
);
--> statement-breakpoint
CREATE TABLE idea_submissions (
 id TEXT PRIMARY KEY, share_id TEXT NOT NULL REFERENCES remix_shares(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, owner_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','approved','rejected','withdrawn','removed')),
 state_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 moderator_id TEXT, moderation_note TEXT NOT NULL DEFAULT '',
 UNIQUE(share_id,revision)
);
--> statement-breakpoint
CREATE INDEX idea_public ON idea_submissions(state,created_at,id);
--> statement-breakpoint
CREATE INDEX idea_owner ON idea_submissions(owner_id,state,created_at);
--> statement-breakpoint
CREATE TABLE idea_reports (
 id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES idea_submissions(id) ON DELETE CASCADE,
 reporter_id TEXT NOT NULL, request_id TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL,
 created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0,
 UNIQUE(reporter_id,request_id)
);
--> statement-breakpoint
CREATE INDEX idea_report_rate ON idea_reports(reporter_id,created_at);
