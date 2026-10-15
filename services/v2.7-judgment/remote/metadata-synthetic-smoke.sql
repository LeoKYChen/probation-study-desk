-- Only artificial IDs; a dedicated synthetic D1 database.
PRAGMA foreign_keys=ON;
INSERT INTO judgment_access(jid,state,changed_at)
VALUES('TEST_JID_SYNTHETIC_REMOTE_20261015','blocked','2026-10-15T00:00:00Z')
ON CONFLICT(jid) DO NOTHING;
INSERT INTO judgment_metadata
(jid,case_year,case_type,case_no,judgment_date,title,revision,created_at,updated_at)
VALUES('TEST_JID_SYNTHETIC_REMOTE_20261015','999','合成','000','20990101','合成遠端測試紀錄',1,'2026-10-15T00:00:00Z','2026-10-15T00:00:00Z')
ON CONFLICT(jid) DO NOTHING;
