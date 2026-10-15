-- v2.7.1c round 2 - independent synthetic revocation ledger.
-- Provision separately from judgment metadata DB in a future private deployment.
-- DO NOT deploy remotely or store real JIDs. SQLite/D1 emulation only.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS ledger_control (
  id INTEGER PRIMARY KEY CHECK(id=1),
  revision INTEGER NOT NULL CHECK(revision>=1),
  mode TEXT NOT NULL CHECK(mode='frozen'),
  modified_at TEXT NOT NULL
);
INSERT OR IGNORE INTO ledger_control(id,revision,mode,modified_at)
VALUES(1,1,'frozen','1970-01-01T00:00:00Z');

CREATE TABLE IF NOT EXISTS judgment_tombstones (
  jid TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK(reason IN ('withdrawn','not_public','legal_removal')),
  revoked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_audit (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL CHECK(event_type IN ('freeze','tombstone','reconcile')),
  jid TEXT,
  note TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tombstones_revoked ON judgment_tombstones(revoked_at);
