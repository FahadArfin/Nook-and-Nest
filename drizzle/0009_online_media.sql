CREATE TABLE online_media_projects (
 owner_id TEXT NOT NULL, project_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
 head_id TEXT, PRIMARY KEY(owner_id,project_id)
);
--> statement-breakpoint
CREATE TABLE online_media_uploads (
 owner_id TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT NOT NULL,
 name TEXT NOT NULL, total_bytes INTEGER NOT NULL CHECK(total_bytes BETWEEN 1 AND 20971520),
 manifest_hash TEXT NOT NULL, manifest TEXT NOT NULL, base_revision INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','complete')),
 state_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 completed_at INTEGER, committed_revision INTEGER, operation_id TEXT NOT NULL,
 PRIMARY KEY(owner_id,id), FOREIGN KEY(owner_id,project_id) REFERENCES online_media_projects(owner_id,project_id)
);
--> statement-breakpoint
CREATE INDEX online_media_upload_project ON online_media_uploads(owner_id,project_id,state,committed_revision);
--> statement-breakpoint
CREATE TABLE online_media_chunks (
 owner_id TEXT NOT NULL, upload_id TEXT NOT NULL, hash TEXT NOT NULL,
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1 AND 131072), data BLOB NOT NULL CHECK(length(data)=bytes),
 PRIMARY KEY(owner_id,upload_id,hash), FOREIGN KEY(owner_id,upload_id) REFERENCES online_media_uploads(owner_id,id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE online_media_daily (
 owner_id TEXT NOT NULL, day INTEGER NOT NULL, starts INTEGER NOT NULL DEFAULT 0,
 reserved_bytes INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,day)
);
--> statement-breakpoint
CREATE TABLE online_media_deleted (
 owner_id TEXT NOT NULL, id TEXT NOT NULL, deleted_at INTEGER NOT NULL,
 PRIMARY KEY(owner_id,id)
);
