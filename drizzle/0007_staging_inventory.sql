CREATE TABLE staging_workspaces (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX staging_workspace_owner ON staging_workspaces(owner_id);
--> statement-breakpoint
-- Membership is provisioned by a verified operator. No public self-assignment API.
CREATE TABLE staging_members (
 workspace_id TEXT NOT NULL REFERENCES staging_workspaces(id), user_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('manager','viewer')), revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
 PRIMARY KEY(workspace_id,user_id)
);
--> statement-breakpoint
CREATE TABLE staging_units (
 workspace_id TEXT NOT NULL REFERENCES staging_workspaces(id), id TEXT NOT NULL,
 request_id TEXT NOT NULL, request_json TEXT NOT NULL, stock_code TEXT NOT NULL COLLATE NOCASE, label TEXT NOT NULL,
 catalog_id TEXT NOT NULL, width_mm INTEGER NOT NULL CHECK(width_mm BETWEEN 10 AND 20000),
 depth_mm INTEGER NOT NULL CHECK(depth_mm BETWEEN 10 AND 20000), height_mm INTEGER NOT NULL CHECK(height_mm BETWEEN 10 AND 20000),
 condition TEXT NOT NULL CHECK(condition IN ('good','fair','damaged','missing')),
 retired INTEGER NOT NULL DEFAULT 0 CHECK(retired IN (0,1)), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2000000000),
 updated_at TEXT NOT NULL, actor_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,stock_code), UNIQUE(workspace_id,request_id)
);
--> statement-breakpoint
CREATE TABLE staging_reservations (
 workspace_id TEXT NOT NULL REFERENCES staging_workspaces(id), id TEXT NOT NULL,
 request_id TEXT NOT NULL, request_json TEXT NOT NULL, property_label TEXT NOT NULL,
 start_day TEXT NOT NULL, end_day TEXT NOT NULL CHECK(start_day < end_day),
 state TEXT NOT NULL CHECK(state IN ('building','reserved','packed','completed','cancelled')),
 unit_count INTEGER NOT NULL CHECK(unit_count BETWEEN 1 AND 50), revision INTEGER NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 200),
 operation TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, actor_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,request_id)
);
--> statement-breakpoint
CREATE INDEX staging_calendar ON staging_reservations(workspace_id,start_day,end_day);
--> statement-breakpoint
CREATE TABLE staging_reservation_units (
 workspace_id TEXT NOT NULL, reservation_id TEXT NOT NULL, unit_id TEXT NOT NULL,
 -- Historical pack-list identity and physical dimensions are snapshots, not live joins.
 stock_code TEXT NOT NULL, label TEXT NOT NULL, catalog_id TEXT NOT NULL,
 width_mm INTEGER NOT NULL, depth_mm INTEGER NOT NULL, height_mm INTEGER NOT NULL,
 condition_out TEXT NOT NULL, condition_in TEXT, return_note TEXT,
 status TEXT NOT NULL CHECK(status IN ('reserved','packed','returned','cancelled')),
 packed_at TEXT, returned_at TEXT, updated_at TEXT NOT NULL, actor_id TEXT NOT NULL,
 PRIMARY KEY(workspace_id,reservation_id,unit_id),
 FOREIGN KEY(workspace_id,reservation_id) REFERENCES staging_reservations(workspace_id,id),
 FOREIGN KEY(workspace_id,unit_id) REFERENCES staging_units(workspace_id,id)
);
--> statement-breakpoint
CREATE INDEX staging_booked_unit ON staging_reservation_units(workspace_id,unit_id,status);
--> statement-breakpoint
CREATE TABLE staging_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL REFERENCES staging_workspaces(id),
 unit_id TEXT, reservation_id TEXT, kind TEXT NOT NULL, at TEXT NOT NULL, actor_id TEXT NOT NULL, detail TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX staging_event_scope ON staging_events(workspace_id,reservation_id,id);
--> statement-breakpoint
CREATE TRIGGER staging_unit_insert_limit BEFORE INSERT ON staging_units BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM staging_units WHERE workspace_id=NEW.workspace_id)>=500 THEN RAISE(ABORT,'staging_unit_limit') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_unit_immutable BEFORE UPDATE ON staging_units BEGIN
 SELECT CASE WHEN NEW.workspace_id!=OLD.workspace_id OR NEW.id!=OLD.id OR NEW.stock_code!=OLD.stock_code OR NEW.label!=OLD.label OR NEW.catalog_id!=OLD.catalog_id OR NEW.width_mm!=OLD.width_mm OR NEW.depth_mm!=OLD.depth_mm OR NEW.height_mm!=OLD.height_mm OR NEW.request_id!=OLD.request_id OR NEW.request_json!=OLD.request_json THEN RAISE(ABORT,'staging_immutable_stock') END;
 SELECT CASE WHEN NEW.revision!=OLD.revision+1 THEN RAISE(ABORT,'staging_stale') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_unit_no_delete BEFORE DELETE ON staging_units BEGIN SELECT RAISE(ABORT,'staging_keep_stock_history'); END;
--> statement-breakpoint
CREATE TRIGGER staging_reservation_limit BEFORE INSERT ON staging_reservations BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM staging_reservations WHERE workspace_id=NEW.workspace_id)>=2000 THEN RAISE(ABORT,'staging_booking_limit') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_reservation_guard BEFORE UPDATE ON staging_reservations BEGIN
 SELECT CASE WHEN NEW.workspace_id!=OLD.workspace_id OR NEW.id!=OLD.id OR NEW.request_id!=OLD.request_id OR NEW.request_json!=OLD.request_json OR NEW.property_label!=OLD.property_label OR NEW.start_day!=OLD.start_day OR NEW.end_day!=OLD.end_day OR NEW.unit_count!=OLD.unit_count OR NEW.created_at!=OLD.created_at THEN RAISE(ABORT,'staging_immutable_booking') END;
 SELECT CASE WHEN OLD.state='building' AND NEW.state='reserved' AND (SELECT COUNT(*) FROM staging_reservation_units WHERE workspace_id=NEW.workspace_id AND reservation_id=NEW.id)!=NEW.unit_count THEN RAISE(ABORT,'staging_missing_unit') END;
 SELECT CASE WHEN OLD.state IN ('cancelled','completed') THEN RAISE(ABORT,'staging_finished') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_reservation_no_delete BEFORE DELETE ON staging_reservations BEGIN SELECT RAISE(ABORT,'staging_keep_booking_history'); END;
--> statement-breakpoint
-- The overlap predicate runs inside the INSERT, under SQLite's writer lock. No check-then-insert gap.
CREATE TRIGGER staging_booking_overlap BEFORE INSERT ON staging_reservation_units BEGIN
 SELECT CASE WHEN NEW.status!='reserved' OR NOT EXISTS(SELECT 1 FROM staging_reservations WHERE workspace_id=NEW.workspace_id AND id=NEW.reservation_id AND state='building') THEN RAISE(ABORT,'staging_bad_state') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM staging_units WHERE workspace_id=NEW.workspace_id AND id=NEW.unit_id AND retired=0 AND condition IN ('good','fair')) THEN RAISE(ABORT,'staging_unavailable') END;
 SELECT CASE WHEN EXISTS(
   SELECT 1 FROM staging_reservation_units b
   JOIN staging_reservations prior ON prior.workspace_id=b.workspace_id AND prior.id=b.reservation_id
   JOIN staging_reservations incoming ON incoming.workspace_id=NEW.workspace_id AND incoming.id=NEW.reservation_id
   WHERE b.workspace_id=NEW.workspace_id AND b.unit_id=NEW.unit_id AND
   (b.status='packed' OR (b.status='reserved' AND prior.start_day<incoming.end_day AND incoming.start_day<prior.end_day))
 ) THEN RAISE(ABORT,'staging_overlap') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_booking_transition BEFORE UPDATE ON staging_reservation_units BEGIN
 SELECT CASE WHEN NEW.workspace_id!=OLD.workspace_id OR NEW.reservation_id!=OLD.reservation_id OR NEW.unit_id!=OLD.unit_id OR NEW.stock_code!=OLD.stock_code OR NEW.label!=OLD.label OR NEW.catalog_id!=OLD.catalog_id OR NEW.width_mm!=OLD.width_mm OR NEW.depth_mm!=OLD.depth_mm OR NEW.height_mm!=OLD.height_mm THEN RAISE(ABORT,'staging_immutable_pack_list') END;
 SELECT CASE WHEN NOT ((OLD.status='reserved' AND NEW.status IN ('packed','cancelled')) OR (OLD.status='packed' AND NEW.status='returned')) THEN RAISE(ABORT,'staging_bad_transition') END;
 SELECT CASE WHEN NEW.status='packed' AND (NOT EXISTS(SELECT 1 FROM staging_units WHERE workspace_id=NEW.workspace_id AND id=NEW.unit_id AND retired=0 AND condition IN ('good','fair')) OR EXISTS(SELECT 1 FROM staging_reservation_units WHERE workspace_id=NEW.workspace_id AND unit_id=NEW.unit_id AND status='packed' AND reservation_id!=NEW.reservation_id)) THEN RAISE(ABORT,'staging_unavailable') END;
 SELECT CASE WHEN NEW.status='returned' AND (NEW.condition_in IS NULL OR NEW.condition_in NOT IN ('good','fair','damaged','missing') OR NEW.returned_at IS NULL) THEN RAISE(ABORT,'staging_bad_return') END;
END;
--> statement-breakpoint
CREATE TRIGGER staging_booking_no_delete BEFORE DELETE ON staging_reservation_units BEGIN SELECT RAISE(ABORT,'staging_keep_pack_history'); END;
--> statement-breakpoint
CREATE TRIGGER staging_stock_created AFTER INSERT ON staging_units BEGIN
 INSERT INTO staging_events(workspace_id,unit_id,kind,at,actor_id,detail) VALUES(NEW.workspace_id,NEW.id,'unit.created',NEW.updated_at,NEW.actor_id,json_object('stockCode',NEW.stock_code,'condition',NEW.condition,'revision',NEW.revision));
END;
--> statement-breakpoint
CREATE TRIGGER staging_stock_updated AFTER UPDATE ON staging_units BEGIN
 INSERT INTO staging_events(workspace_id,unit_id,kind,at,actor_id,detail) VALUES(NEW.workspace_id,NEW.id,'unit.updated',NEW.updated_at,NEW.actor_id,json_object('condition',NEW.condition,'previousCondition',OLD.condition,'retired',NEW.retired,'revision',NEW.revision));
END;
--> statement-breakpoint
CREATE TRIGGER staging_reservation_event AFTER UPDATE ON staging_reservations WHEN NEW.state!=OLD.state OR NEW.revision!=OLD.revision BEGIN
 INSERT INTO staging_events(workspace_id,reservation_id,kind,at,actor_id,detail) VALUES(NEW.workspace_id,NEW.id,'reservation.'||NEW.state,NEW.updated_at,NEW.actor_id,json_object('revision',NEW.revision,'start',NEW.start_day,'end',NEW.end_day,'unitCount',NEW.unit_count));
END;
--> statement-breakpoint
CREATE TRIGGER staging_pack_event AFTER UPDATE ON staging_reservation_units BEGIN
 INSERT INTO staging_events(workspace_id,unit_id,reservation_id,kind,at,actor_id,detail) VALUES(NEW.workspace_id,NEW.unit_id,NEW.reservation_id,'unit.'||NEW.status,NEW.updated_at,NEW.actor_id,json_object('conditionOut',NEW.condition_out,'conditionIn',NEW.condition_in,'note',NEW.return_note));
END;
--> statement-breakpoint
CREATE TRIGGER staging_event_no_update BEFORE UPDATE ON staging_events BEGIN SELECT RAISE(ABORT,'staging_immutable_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER staging_event_no_delete BEFORE DELETE ON staging_events BEGIN SELECT RAISE(ABORT,'staging_immutable_ledger'); END;
