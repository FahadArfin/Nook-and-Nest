CREATE TABLE collaboration_rooms (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL,
 source_project_id TEXT NOT NULL, source_revision INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN(0,1))
);
--> statement-breakpoint
CREATE INDEX collaboration_rooms_owner ON collaboration_rooms(owner_id,created_at);
--> statement-breakpoint
CREATE TABLE collaboration_members (
 room_id TEXT NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE, user_id TEXT NOT NULL,
 member_id TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN('owner','editor','viewer')),
 epoch INTEGER NOT NULL DEFAULT 1, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)),
 invitation_id TEXT, PRIMARY KEY(room_id,user_id), UNIQUE(room_id,member_id)
);
--> statement-breakpoint
CREATE TABLE collaboration_invites (
 id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN('editor','viewer')),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0,
 claimed_by TEXT
);
--> statement-breakpoint
CREATE INDEX collaboration_invites_room ON collaboration_invites(room_id,expires_at);
--> statement-breakpoint
CREATE TABLE collaboration_commits (
 room_id TEXT NOT NULL REFERENCES collaboration_rooms(id) ON DELETE CASCADE, revision INTEGER NOT NULL,
 operation_id TEXT NOT NULL, operation_hash TEXT NOT NULL, member_id TEXT NOT NULL, actor_name TEXT NOT NULL,
 label TEXT NOT NULL, created_at INTEGER NOT NULL, document TEXT NOT NULL,
 PRIMARY KEY(room_id,revision), UNIQUE(room_id,operation_id)
);
--> statement-breakpoint
CREATE TABLE collaboration_presence (
 room_id TEXT NOT NULL, member_id TEXT NOT NULL, floor_id TEXT, selection_id TEXT, expires_at INTEGER NOT NULL,
 PRIMARY KEY(room_id,member_id), FOREIGN KEY(room_id,member_id) REFERENCES collaboration_members(room_id,member_id) ON DELETE CASCADE
);
--> statement-breakpoint
