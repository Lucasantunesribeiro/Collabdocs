CREATE TABLE IF NOT EXISTS document_audit_log (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('created', 'updated', 'deleted', 'viewed', 'collaborator_added', 'collaborator_removed')),
  metadata TEXT, -- JSON string for additional context
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_document ON document_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON document_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON document_audit_log(created_at);
