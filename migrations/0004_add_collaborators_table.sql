-- Criar tabela de colaboradores para controle de ACL
CREATE TABLE IF NOT EXISTS document_collaborators (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  document_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read', -- 'read', 'write', 'owner'
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  UNIQUE(document_id, user_email)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_collaborators_document ON document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user ON document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_email ON document_collaborators(user_email);

-- Adicionar colaboradores existentes baseado nos proprietários atuais
INSERT OR IGNORE INTO document_collaborators (document_id, user_id, user_email, permission, added_by, created_at, updated_at)
SELECT 
  d.id as document_id,
  d.owner_id as user_id,
  COALESCE(u.email, 'owner@unknown.com') as user_email,
  'owner' as permission,
  d.owner_id as added_by,
  d.created_at,
  d.updated_at
FROM documents d
LEFT JOIN users u ON d.owner_id = u.id;