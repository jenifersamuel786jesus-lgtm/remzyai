-- Add missing fields to alerts table to match TypeScript types

-- Add alert_status column (enum type)
ALTER TABLE alerts 
ADD COLUMN alert_status TEXT NOT NULL DEFAULT 'unread'
CHECK (alert_status IN ('unread', 'read', 'resolved'));

-- Add title column
ALTER TABLE alerts 
ADD COLUMN title TEXT;

-- Add metadata column for additional data
ALTER TABLE alerts 
ADD COLUMN metadata JSONB;

-- Add read_at timestamp
ALTER TABLE alerts 
ADD COLUMN read_at TIMESTAMPTZ;

-- Add resolved_at timestamp
ALTER TABLE alerts 
ADD COLUMN resolved_at TIMESTAMPTZ;

-- Create index on alert_status for faster queries
CREATE INDEX idx_alerts_status ON alerts(alert_status);

-- Create index on patient_id and alert_status combination
CREATE INDEX idx_alerts_patient_status ON alerts(patient_id, alert_status);

-- Update existing alerts to have proper status based on is_read
UPDATE alerts 
SET alert_status = CASE 
  WHEN is_read = true THEN 'read'
  ELSE 'unread'
END;

-- We'll keep is_read for backward compatibility but alert_status is the primary field now

COMMENT ON COLUMN alerts.alert_status IS 'Current status of the alert: unread, read, or resolved';
COMMENT ON COLUMN alerts.title IS 'Short title/summary of the alert';
COMMENT ON COLUMN alerts.metadata IS 'Additional structured data (e.g., caregiver_id, device info)';
COMMENT ON COLUMN alerts.read_at IS 'Timestamp when alert was marked as read';
COMMENT ON COLUMN alerts.resolved_at IS 'Timestamp when alert was resolved';