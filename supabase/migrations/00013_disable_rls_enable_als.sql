-- =====================================================
-- Application-Level Security (ALS) Migration
-- Disables RLS and removes all policies
-- Security is now enforced in Edge Functions
-- =====================================================

-- Disable RLS on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS caregivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS device_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS known_faces DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS health_metrics DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to view their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON profiles;

-- Drop all existing RLS policies for patients
DROP POLICY IF EXISTS "Patients can view own data" ON patients;
DROP POLICY IF EXISTS "Patients can update own data" ON patients;
DROP POLICY IF EXISTS "Patients can insert own data" ON patients;
DROP POLICY IF EXISTS "Caregivers can view linked patients" ON patients;
DROP POLICY IF EXISTS "Allow users to view patient by linking code" ON patients;
DROP POLICY IF EXISTS "Allow users to insert patients" ON patients;
DROP POLICY IF EXISTS "Allow users to update their own patient record" ON patients;
DROP POLICY IF EXISTS "Allow users to view their own patient record" ON patients;

-- Drop all existing RLS policies for caregivers
DROP POLICY IF EXISTS "Caregivers can view own data" ON caregivers;
DROP POLICY IF EXISTS "Caregivers can update own data" ON caregivers;
DROP POLICY IF EXISTS "Caregivers can insert own data" ON caregivers;
DROP POLICY IF EXISTS "Allow users to insert caregivers" ON caregivers;
DROP POLICY IF EXISTS "Allow users to view their own caregiver record" ON caregivers;
DROP POLICY IF EXISTS "Allow users to update their own caregiver record" ON caregivers;

-- Drop all existing RLS policies for device_links
DROP POLICY IF EXISTS "Caregivers can view own links" ON device_links;
DROP POLICY IF EXISTS "Caregivers can create links" ON device_links;
DROP POLICY IF EXISTS "Caregivers can update own links" ON device_links;
DROP POLICY IF EXISTS "Caregivers can delete own links" ON device_links;
DROP POLICY IF EXISTS "Allow caregivers to view their device links" ON device_links;
DROP POLICY IF EXISTS "Allow caregivers to insert device links" ON device_links;
DROP POLICY IF EXISTS "Allow caregivers to update their device links" ON device_links;

-- Drop all existing RLS policies for alerts
DROP POLICY IF EXISTS "Caregivers can view alerts for linked patients" ON alerts;
DROP POLICY IF EXISTS "Patients can create alerts" ON alerts;
DROP POLICY IF EXISTS "Caregivers can update alerts" ON alerts;
DROP POLICY IF EXISTS "Patients can view own alerts" ON alerts;
DROP POLICY IF EXISTS "Allow patients to insert alerts" ON alerts;
DROP POLICY IF EXISTS "Allow patients to view their own alerts" ON alerts;
DROP POLICY IF EXISTS "Allow caregivers to view alerts for linked patients" ON alerts;
DROP POLICY IF EXISTS "Allow caregivers to update alerts for linked patients" ON alerts;

-- Drop all existing RLS policies for tasks
DROP POLICY IF EXISTS "Patients can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Patients can create own tasks" ON tasks;
DROP POLICY IF EXISTS "Patients can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Patients can delete own tasks" ON tasks;
DROP POLICY IF EXISTS "Caregivers can view tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Caregivers can create tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Caregivers can update tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Allow patients to view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Allow patients to insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Allow patients to update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Allow caregivers to view tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Allow caregivers to insert tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Allow caregivers to update tasks for linked patients" ON tasks;

-- Drop all existing RLS policies for known_faces
DROP POLICY IF EXISTS "Patients can view own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can insert own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can update own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can delete own known faces" ON known_faces;
DROP POLICY IF EXISTS "Allow patients to view their own known faces" ON known_faces;
DROP POLICY IF EXISTS "Allow patients to insert their own known faces" ON known_faces;
DROP POLICY IF EXISTS "Allow patients to update their own known faces" ON known_faces;
DROP POLICY IF EXISTS "Allow patients to delete their own known faces" ON known_faces;

-- Drop all existing RLS policies for ai_interactions
DROP POLICY IF EXISTS "Patients can view own AI interactions" ON ai_interactions;
DROP POLICY IF EXISTS "Patients can insert own AI interactions" ON ai_interactions;
DROP POLICY IF EXISTS "Allow patients to view their own AI interactions" ON ai_interactions;
DROP POLICY IF EXISTS "Allow patients to insert their own AI interactions" ON ai_interactions;

-- Drop all existing RLS policies for health_metrics
DROP POLICY IF EXISTS "Patients can view own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Patients can insert own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Caregivers can view health metrics for linked patients" ON health_metrics;
DROP POLICY IF EXISTS "Allow patients to view their own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Allow patients to insert their own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Allow caregivers to view health metrics for linked patients" ON health_metrics;

-- Add comments to indicate ALS is now used
COMMENT ON TABLE profiles IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE patients IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE caregivers IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE device_links IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE alerts IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE tasks IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE known_faces IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE ai_interactions IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE health_metrics IS 'Security enforced at application level via Edge Functions';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'RLS disabled and all policies removed';
  RAISE NOTICE 'Security is now enforced at application level via Edge Functions';
  RAISE NOTICE 'All database operations must go through Edge Functions';
END $$;