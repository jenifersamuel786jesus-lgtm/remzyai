-- Create a function to create caregiver and update role in one transaction
CREATE OR REPLACE FUNCTION create_caregiver_with_role(
  p_profile_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  caregiver_id UUID,
  caregiver_full_name TEXT,
  caregiver_phone TEXT,
  profile_role TEXT
) AS $$
DECLARE
  v_caregiver_id UUID;
  v_role TEXT;
BEGIN
  -- Verify the caller is the profile owner
  IF p_profile_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You can only create a caregiver profile for yourself';
  END IF;
  
  -- Check if caregiver already exists
  SELECT id INTO v_caregiver_id
  FROM caregivers
  WHERE profile_id = p_profile_id;
  
  IF v_caregiver_id IS NOT NULL THEN
    -- Caregiver already exists, just return it
    RETURN QUERY
    SELECT 
      c.id,
      c.full_name,
      c.phone,
      pr.role
    FROM caregivers c
    JOIN profiles pr ON pr.id = c.profile_id
    WHERE c.id = v_caregiver_id;
    RETURN;
  END IF;
  
  -- Create caregiver
  INSERT INTO caregivers (profile_id, full_name, phone)
  VALUES (p_profile_id, p_full_name, p_phone)
  RETURNING id INTO v_caregiver_id;
  
  -- Update profile role
  UPDATE profiles
  SET role = 'caregiver'
  WHERE id = p_profile_id
  RETURNING role INTO v_role;
  
  -- Return the created caregiver with updated role
  RETURN QUERY
  SELECT 
    v_caregiver_id,
    p_full_name,
    p_phone,
    v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;