-- FOR: probation-v271c-ledger-synth-20261015 ONLY.
-- An independent synthetic tombstone; NOT real court revocation handling.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS ledger_control (
  id INTEGER PRIMARY KEY CHECK (id=1),
  revision INTEGER NOT NULL CHECK (revision>=1),
  mode TEXT NOT NULL CHECK (mode='frozen'),
  modified_at TEXT NOT NULL
);
INSERT OR IGNORE INTO ledger_control(id,revision,mode,modified_at)
VALUES(1,1,'frozen','1970-01-01T00:00:00Z');
CREATE TABLE IF NOT EXISTS judgment_tombstones (
  jid TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (reason IN ('withdrawn','not_public','legal_removal')),
  revoked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('freeze','tombstone','reconcile')),
  jid TEXT, note TEXT NOT NULL, occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tombstones_revoked ON judgment_tombstones(revoked_at);
INSERT INTO judgment_tombstones(jid,reason,revoked_at)
VALUES('TEST_JID_SYNTHETIC_REMOTE_20261015','withdrawn','2026-10-15T00:00:01Z')
ON CONFLICT(jid) DO NOTHING;
UPDATE ledger_control SET revision=2,modified_at='2026-10-15T00:00:01Z'
WHERE id=1 AND revision=1;
INSERT INTO ledger_audit(event_type,jid,note,occurred_at)
SELECT 'tombstone','TEST_JID_SYNTHETIC_REMOTE_20261015',
       'synthetic test only','2026-10-15T00:00:01Z'
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_audit
  WHERE event_type='tombstone' AND jid='TEST_JID_SYNTHETIC_REMOTE_20261015'
);
SELECT 'LEDGER_OK' AS test, count(*) AS expected_one
FROM judgment_tombstones
WHERE jid='TEST_JID_SYNTHETIC_REMOTE_20261015' AND reason='withdrawn';
