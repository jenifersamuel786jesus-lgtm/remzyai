-- Fix ai_interactions table to match TypeScript types

-- Add interaction_type column
ALTER TABLE ai_interactions 
ADD COLUMN interaction_type TEXT;

-- Rename created_at to interaction_time for consistency with TypeScript
ALTER TABLE ai_interactions 
RENAME COLUMN created_at TO interaction_time;

-- Extract interaction_type from context_data for existing records
UPDATE ai_interactions 
SET interaction_type = context_data->>'interaction_type'
WHERE context_data ? 'interaction_type';

-- Set default interaction_type for records without it
UPDATE ai_interactions 
SET interaction_type = 'chat'
WHERE interaction_type IS NULL;

-- Create index for faster queries
CREATE INDEX idx_ai_interactions_patient ON ai_interactions(patient_id, interaction_time DESC);

COMMENT ON COLUMN ai_interactions.interaction_type IS 'Type of interaction: chat, reminder, guidance, etc.';
COMMENT ON COLUMN ai_interactions.interaction_time IS 'Timestamp when the interaction occurred';