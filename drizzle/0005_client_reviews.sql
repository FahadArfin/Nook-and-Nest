CREATE TABLE client_reviews (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL,
 current_revision INTEGER NOT NULL CHECK(current_revision BETWEEN 1 AND 10),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
 token_hash TEXT, publication_id TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX client_review_owner ON client_reviews(owner_id, project_id);
--> statement-breakpoint
CREATE TABLE client_review_revisions (
 review_id TEXT NOT NULL, revision INTEGER NOT NULL, created_at INTEGER NOT NULL,
 document TEXT NOT NULL, PRIMARY KEY(review_id,revision),
 FOREIGN KEY(review_id) REFERENCES client_reviews(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE client_review_media (
 review_id TEXT NOT NULL, revision INTEGER NOT NULL, media_id TEXT NOT NULL,
 kind TEXT NOT NULL, data_url TEXT NOT NULL CHECK(length(data_url)<=220000),
 PRIMARY KEY(review_id,revision,media_id),
 FOREIGN KEY(review_id,revision) REFERENCES client_review_revisions(review_id,revision) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE client_review_feedback (
 id TEXT PRIMARY KEY, review_id TEXT NOT NULL, revision INTEGER NOT NULL,
 request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, kind TEXT NOT NULL,
 author_name TEXT NOT NULL, text TEXT NOT NULL, anchor_kind TEXT NOT NULL, anchor_id TEXT, anchor_floor_id TEXT,
 created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0,
 UNIQUE(review_id,request_id),
 FOREIGN KEY(review_id,revision) REFERENCES client_review_revisions(review_id,revision) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX client_review_feedback_time ON client_review_feedback(review_id, created_at);
--> statement-breakpoint
