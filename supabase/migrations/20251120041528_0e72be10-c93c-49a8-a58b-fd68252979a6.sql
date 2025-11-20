-- Add pinned field to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- Add index for better performance when filtering pinned conversations
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(organization_id, pinned, updated_at DESC);