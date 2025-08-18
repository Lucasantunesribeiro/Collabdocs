-- CollabDocs Initial Schema
-- Migration: 0001_init.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  provider TEXT NOT NULL CHECK(provider IN ('github', 'google')),
  provider_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'public')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_snapshot_r2_key TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  r2_key TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  author_id TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS permissions (
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  parent_comment_id TEXT REFERENCES comments(id),
  content TEXT NOT NULL,
  position_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes para performance
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_snapshots_document ON snapshots(document_id);
CREATE INDEX idx_permissions_document ON permissions(document_id);
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_comments_document ON comments(document_id);