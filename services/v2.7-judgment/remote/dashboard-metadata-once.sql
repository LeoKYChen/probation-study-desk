-- FOR: probation-v271c-metadata-synth-20261015 ONLY.
-- Pure synthetic court metadata test. No real cases, API keys, or public access.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS judgment_access (
  jid TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('blocked','revoked')),
  changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judgment_metadata (
  jid TEXT PRIMARY KEY REFERENCES judgment_access(jid),
  case_year TEXT NOT NULL, case_type TEXT NOT NULL, case_no TEXT NOT NULL,
  judgment_date TEXT NOT NULL, title TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judgment_search_tokens (
  jid TEXT NOT NULL REFERENCES judgment_metadata(jid) ON DELETE CASCADE,
  token TEXT NOT NULL, PRIMARY KEY(jid, token)
);
CREATE TABLE IF NOT EXISTS judgment_summaries (
  jid TEXT PRIMARY KEY REFERENCES judgment_metadata(jid) ON DELETE CASCADE,
  summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judgment_vectors (
  jid TEXT PRIMARY KEY REFERENCES judgment_metadata(jid) ON DELETE CASCADE,
  vector_ref TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_judgment_metadata_date ON judgment_metadata(judgment_date);
CREATE INDEX IF NOT EXISTS idx_judgment_tokens ON judgment_search_tokens(token);
INSERT INTO judgment_access(jid,state,changed_at)
VALUES ('TEST_JID_SYNTHETIC_REMOTE_20261015','blocked','2026-10-15T00:00:00Z')
ON CONFLICT(jid) DO NOTHING;
INSERT INTO judgment_metadata
(jid,case_year,case_type,case_no,judgment_date,title,revision,created_at,updated_at)
VALUES ('TEST_JID_SYNTHETIC_REMOTE_20261015','999','合成','000','20990101',
        '合成遠端測試紀錄',1,'2026-10-15T00:00:00Z','2026-10-15T00:00:00Z')
ON CONFLICT(jid) DO NOTHING;
SELECT 'METADATA_OK' AS test, count(*) AS expected_one
FROM judgment_metadata m
JOIN judgment_access a ON m.jid=a.jid
WHERE m.jid='TEST_JID_SYNTHETIC_REMOTE_20261015'
  AND a.state='blocked' AND m.title='合成遠端測試紀錄';
