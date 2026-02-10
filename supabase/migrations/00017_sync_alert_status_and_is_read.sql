-- Create trigger to keep is_read and alert_status in sync

-- Function to sync is_read with alert_status
CREATE OR REPLACE FUNCTION sync_alert_read_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When alert_status changes, update is_read accordingly
  IF NEW.alert_status = 'unread' THEN
    NEW.is_read := false;
    NEW.read_at := NULL;
  ELSIF NEW.alert_status IN ('read', 'resolved') THEN
    NEW.is_read := true;
    -- Set read_at if not already set
    IF NEW.read_at IS NULL THEN
      NEW.read_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_sync_alert_read_status
  BEFORE INSERT OR UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION sync_alert_read_status();

COMMENT ON FUNCTION sync_alert_read_status IS 'Keeps is_read boolean in sync with alert_status enum for backward compatibility';
COMMENT ON TRIGGER trigger_sync_alert_read_status ON alerts IS 'Automatically syncs is_read with alert_status changes';