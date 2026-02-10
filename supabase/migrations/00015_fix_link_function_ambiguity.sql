-- Fix link_patient_to_caregiver function - resolve column ambiguity

CREATE OR REPLACE FUNCTION link_patient_to_caregiver(
  p_patient_id UUID,
  p_caregiver_id UUID
)
RETURNS TABLE (
  link_id UUID,
  patient_id UUID,
  caregiver_id UUID,
  is_active BOOLEAN,
  linked_at TIMESTAMPTZ
) AS $$
DECLARE
  v_link_id UUID;
BEGIN
  -- Check if link already exists (use table aliases to avoid ambiguity)
  SELECT dl.id INTO v_link_id
  FROM device_links dl
  WHERE dl.patient_id = p_patient_id AND dl.caregiver_id = p_caregiver_id;
  
  IF v_link_id IS NOT NULL THEN
    -- Link exists, check if it's active
    IF EXISTS (SELECT 1 FROM device_links dl WHERE dl.id = v_link_id AND dl.is_active = false) THEN
      -- Reactivate the link
      UPDATE device_links dl
      SET is_active = true
      WHERE dl.id = v_link_id;
    END IF;
    
    -- Return existing link
    RETURN QUERY
    SELECT 
      dl.id,
      dl.patient_id,
      dl.caregiver_id,
      dl.is_active,
      dl.linked_at
    FROM device_links dl
    WHERE dl.id = v_link_id;
    RETURN;
  END IF;
  
  -- Create new link
  INSERT INTO device_links (patient_id, caregiver_id, is_active)
  VALUES (p_patient_id, p_caregiver_id, true)
  RETURNING id INTO v_link_id;
  
  -- Return the created link
  RETURN QUERY
  SELECT 
    dl.id,
    dl.patient_id,
    dl.caregiver_id,
    dl.is_active,
    dl.linked_at
  FROM device_links dl
  WHERE dl.id = v_link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION link_patient_to_caregiver IS 'Creates or reactivates device link. Authorization is handled by Edge Functions (ALS).';