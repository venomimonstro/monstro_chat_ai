-- Add HNSW vector index for semantic cache (knowledge_chunks already has ivfflat index)
CREATE INDEX IF NOT EXISTS semantic_cache_entries_embedding_idx ON semantic_cache_entries
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Analytics time-range queries
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages("created_at");
CREATE INDEX IF NOT EXISTS dialogs_tenant_created_at_idx ON dialogs("tenant_id", "created_at");

-- Add session_version to users for global refresh revocation
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
