-- v2.7.1c: OFFLINE/SYNTHETIC ONLY. Do not provision remotely without retention approval.
-- No judgment full text, pdf, attachments, or real-person content fields.
-- D1 Time Travel can retain deleted database versions: revocation != full historical erasure.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS judgment_access (
  jid TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('blocked','revoked')),
  changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judgment_metadata (
  jid TEXT PRIMARY KEY REFERENCES judgment_access(jid),
  case_year TEXT NOT NULL,
  case_type TEXT NOT NULL,
  case_no TEXT NOT NULL,
  judgment_date TEXT NOT NULL,
  title TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS judgment_search_tokens (
  jid TEXT NOT NULL REFERENCES judgment_metadata(jid) ON DELETE CASCADE,
  token TEXT NOT NULL,
  PRIMARY KEY(jid, token)
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
-- Deny by default: the system has no public search interface. A future reader
-- MUST explicitly consult judgment_access, including when indexing from caches.
