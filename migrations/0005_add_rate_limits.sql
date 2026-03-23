-- Migration number: 0005 	 2024-05-24T00:00:00.000Z
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  -- IP or User ID
  count INTEGER DEFAULT 1,
  expires_at INTEGER -- Unix Timestamp
);
-- Index for cleanup (optional but good for performance)
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);