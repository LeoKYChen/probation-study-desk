-- Independent simulated tombstone on a dedicated synthetic D1 database.
INSERT INTO judgment_tombstones(jid,reason,revoked_at)
VALUES('TEST_JID_SYNTHETIC_REMOTE_20261015','withdrawn','2026-10-15T00:00:01Z')
ON CONFLICT(jid) DO NOTHING;
UPDATE ledger_control SET revision=revision+1,modified_at='2026-10-15T00:00:01Z'
WHERE id=1 AND revision=1;
INSERT INTO ledger_audit(event_type,jid,note,occurred_at)
VALUES('tombstone','TEST_JID_SYNTHETIC_REMOTE_20261015',
 'artificial remote smoke test, no court document','2026-10-15T00:00:01Z');
