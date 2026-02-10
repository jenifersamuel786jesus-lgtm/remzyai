# Application-Level Security (ALS) Conversion Plan

## Overview
Convert RemZy from Row Level Security (RLS) to Application-Level Security (ALS) where all security checks are performed in Edge Functions instead of database policies.

## Current Architecture
- ✅ Frontend: React + TypeScript
- ✅ Database: Supabase PostgreSQL with RLS policies
- ✅ Auth: Supabase Auth
- ✅ Data Access: Direct Supabase client queries from frontend

## Target Architecture
- ✅ Frontend: React + TypeScript
- ✅ Database: Supabase PostgreSQL **WITHOUT RLS**
- ✅ Auth: Supabase Auth (unchanged)
- ✅ Data Access: Edge Functions only (service role access)
- ✅ Security: Application-level checks in Edge Functions

## Benefits of ALS
1. **Flexibility**: Complex business logic easier to implement
2. **Debugging**: Easier to trace and debug security issues
3. **Testing**: Simpler to unit test security logic
4. **Centralization**: All security rules in one place
5. **Performance**: No RLS policy overhead on queries

## Implementation Plan

### Phase 1: Infrastructure Setup
- [ ] Create Edge Functions directory structure
- [ ] Create security middleware for JWT validation
- [ ] Create helper utilities for common patterns
- [ ] Set up service role key in Edge Functions

### Phase 2: Disable RLS
- [ ] Create migration to disable RLS on all tables
- [ ] Remove all RLS policies
- [ ] Keep database functions (they're useful for ALS too)

### Phase 3: Create Edge Functions
- [ ] Auth operations (login, signup, profile)
- [ ] Patient operations (CRUD, linking code)
- [ ] Caregiver operations (CRUD, patient management)
- [ ] Device linking operations
- [ ] Alert operations
- [ ] Task operations
- [ ] Known faces operations
- [ ] AI interaction operations
- [ ] Health metrics operations

### Phase 4: Update Frontend
- [ ] Update src/db/api.ts to call Edge Functions
- [ ] Remove direct Supabase queries
- [ ] Update error handling for Edge Function responses
- [ ] Update types to match Edge Function responses

### Phase 5: Testing & Validation
- [ ] Test all CRUD operations
- [ ] Test authorization (users can only access their data)
- [ ] Test role-based access (patient vs caregiver)
- [ ] Test device linking security
- [ ] Test edge cases and error scenarios

## Detailed Implementation

### 1. Security Middleware (Edge Functions)

**File: supabase/functions/_shared/security.ts**
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

export interface AuthContext {
  userId: string
  email: string
  role?: string
}

export async function validateAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw new Error('Invalid or expired token')
  }

  return {
    userId: user.id,
    email: user.email!,
    role: user.user_metadata?.role
  }
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}
```

### 2. Database Migration to Disable RLS

**File: supabase/migrations/XXXXX_disable_rls_enable_als.sql**
```sql
-- Disable RLS on all tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE caregivers DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE known_faces DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Patients can view own data" ON patients;
DROP POLICY IF EXISTS "Patients can update own data" ON patients;
DROP POLICY IF EXISTS "Caregivers can view linked patients" ON patients;

DROP POLICY IF EXISTS "Caregivers can view own data" ON caregivers;
DROP POLICY IF EXISTS "Caregivers can update own data" ON caregivers;

DROP POLICY IF EXISTS "Caregivers can view own links" ON device_links;
DROP POLICY IF EXISTS "Caregivers can create links" ON device_links;
DROP POLICY IF EXISTS "Caregivers can update own links" ON device_links;

DROP POLICY IF EXISTS "Caregivers can view alerts for linked patients" ON alerts;
DROP POLICY IF EXISTS "Patients can create alerts" ON alerts;
DROP POLICY IF EXISTS "Caregivers can update alerts" ON alerts;

DROP POLICY IF EXISTS "Patients can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Patients can create own tasks" ON tasks;
DROP POLICY IF EXISTS "Patients can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Caregivers can view tasks for linked patients" ON tasks;
DROP POLICY IF EXISTS "Caregivers can create tasks for linked patients" ON tasks;

DROP POLICY IF EXISTS "Patients can view own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can insert own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can update own known faces" ON known_faces;
DROP POLICY IF EXISTS "Patients can delete own known faces" ON known_faces;

DROP POLICY IF EXISTS "Patients can view own AI interactions" ON ai_interactions;
DROP POLICY IF EXISTS "Patients can insert own AI interactions" ON ai_interactions;

DROP POLICY IF EXISTS "Patients can view own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Patients can insert own health metrics" ON health_metrics;
DROP POLICY IF EXISTS "Caregivers can view health metrics for linked patients" ON health_metrics;

-- Add comment to indicate ALS is now used
COMMENT ON TABLE profiles IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE patients IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE caregivers IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE device_links IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE alerts IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE tasks IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE known_faces IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE ai_interactions IS 'Security enforced at application level via Edge Functions';
COMMENT ON TABLE health_metrics IS 'Security enforced at application level via Edge Functions';
```

### 3. Edge Function Examples

#### Patient Operations
**File: supabase/functions/patients/index.ts**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { validateAuth, corsHeaders } from '../_shared/security.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const auth = await validateAuth(req)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const method = req.method

    // GET /patients - Get patient by profile_id
    if (method === 'GET') {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (error) throw error

      return new Response(JSON.stringify({ data: patient }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    // POST /patients - Create patient
    if (method === 'POST') {
      const body = await req.json()
      
      // Security: Ensure user can only create patient for themselves
      const patientData = {
        ...body,
        profile_id: auth.userId, // Force to authenticated user
      }

      const { data: patient, error } = await supabase
        .from('patients')
        .insert(patientData)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ data: patient }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        status: 201,
      })
    }

    // PUT /patients/:id - Update patient
    if (method === 'PUT') {
      const patientId = url.searchParams.get('id')
      if (!patientId) throw new Error('Patient ID required')

      const body = await req.json()

      // Security: Verify patient belongs to user
      const { data: existing } = await supabase
        .from('patients')
        .select('profile_id')
        .eq('id', patientId)
        .single()

      if (!existing || existing.profile_id !== auth.userId) {
        throw new Error('Unauthorized')
      }

      const { data: patient, error } = await supabase
        .from('patients')
        .update(body)
        .eq('id', patientId)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ data: patient }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

#### Caregiver Operations
**File: supabase/functions/caregivers/index.ts**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { validateAuth, corsHeaders } from '../_shared/security.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const auth = await validateAuth(req)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const method = req.method

    // GET /caregivers - Get caregiver by profile_id
    if (method === 'GET') {
      const { data: caregiver, error } = await supabase
        .from('caregivers')
        .select('*')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (error) throw error

      return new Response(JSON.stringify({ data: caregiver }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    // POST /caregivers - Create caregiver
    if (method === 'POST') {
      const body = await req.json()
      
      // Security: Ensure user can only create caregiver for themselves
      const caregiverData = {
        ...body,
        profile_id: auth.userId,
      }

      const { data: caregiver, error } = await supabase
        .from('caregivers')
        .insert(caregiverData)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ data: caregiver }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        status: 201,
      })
    }

    // PUT /caregivers/:id - Update caregiver
    if (method === 'PUT') {
      const caregiverId = url.searchParams.get('id')
      if (!caregiverId) throw new Error('Caregiver ID required')

      const body = await req.json()

      // Security: Verify caregiver belongs to user
      const { data: existing } = await supabase
        .from('caregivers')
        .select('profile_id')
        .eq('id', caregiverId)
        .single()

      if (!existing || existing.profile_id !== auth.userId) {
        throw new Error('Unauthorized')
      }

      const { data: caregiver, error } = await supabase
        .from('caregivers')
        .update(body)
        .eq('id', caregiverId)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ data: caregiver }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

#### Device Linking Operations
**File: supabase/functions/device-links/index.ts**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { validateAuth, corsHeaders } from '../_shared/security.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const auth = await validateAuth(req)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const method = req.method

    // GET /device-links - Get links for caregiver
    if (method === 'GET') {
      // Get caregiver ID for this user
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .single()

      if (!caregiver) {
        throw new Error('Caregiver not found')
      }

      const { data: links, error } = await supabase
        .from('device_links')
        .select(`
          *,
          patient:patients(*)
        `)
        .eq('caregiver_id', caregiver.id)
        .eq('is_active', true)

      if (error) throw error

      return new Response(JSON.stringify({ data: links }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    // POST /device-links - Create link
    if (method === 'POST') {
      const { linking_code } = await req.json()

      // Get caregiver ID for this user
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .single()

      if (!caregiver) {
        throw new Error('Caregiver not found')
      }

      // Find patient by linking code
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('linking_code', linking_code)
        .single()

      if (!patient) {
        throw new Error('Invalid linking code')
      }

      // Check if link already exists
      const { data: existingLink } = await supabase
        .from('device_links')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('caregiver_id', caregiver.id)
        .maybeSingle()

      if (existingLink) {
        // Reactivate if inactive
        if (!existingLink.is_active) {
          const { data: link, error } = await supabase
            .from('device_links')
            .update({ is_active: true })
            .eq('id', existingLink.id)
            .select()
            .single()

          if (error) throw error
          return new Response(JSON.stringify({ data: link }), {
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ data: existingLink }), {
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      // Create new link
      const { data: link, error } = await supabase
        .from('device_links')
        .insert({
          patient_id: patient.id,
          caregiver_id: caregiver.id,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ data: link }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        status: 201,
      })
    }

    // DELETE /device-links/:id - Deactivate link
    if (method === 'DELETE') {
      const url = new URL(req.url)
      const linkId = url.searchParams.get('id')
      if (!linkId) throw new Error('Link ID required')

      // Verify link belongs to user's caregiver
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .single()

      if (!caregiver) {
        throw new Error('Caregiver not found')
      }

      const { data: link } = await supabase
        .from('device_links')
        .select('caregiver_id')
        .eq('id', linkId)
        .single()

      if (!link || link.caregiver_id !== caregiver.id) {
        throw new Error('Unauthorized')
      }

      // Deactivate link
      const { error } = await supabase
        .from('device_links')
        .update({ is_active: false })
        .eq('id', linkId)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

### 4. Frontend API Updates

**File: src/db/api.ts** (Example updates)
```typescript
import { supabase } from './supabase'

// Helper to get auth token
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  return session.access_token
}

// Helper to call Edge Functions
async function callEdgeFunction<T>(
  functionName: string,
  options: {
    method?: string
    body?: any
    params?: Record<string, string>
  } = {}
): Promise<T> {
  const token = await getAuthToken()
  
  let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`
  
  if (options.params) {
    const searchParams = new URLSearchParams(options.params)
    url += `?${searchParams.toString()}`
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Request failed')
  }

  const result = await response.json()
  return result.data
}

// Patient operations
export async function getPatientByProfileId(profileId: string): Promise<Patient | null> {
  return callEdgeFunction<Patient | null>('patients', { method: 'GET' })
}

export async function createPatient(data: Partial<Patient>): Promise<Patient> {
  return callEdgeFunction<Patient>('patients', {
    method: 'POST',
    body: data,
  })
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  return callEdgeFunction<Patient>('patients', {
    method: 'PUT',
    params: { id },
    body: data,
  })
}

// Caregiver operations
export async function getCaregiverByProfileId(profileId: string): Promise<Caregiver | null> {
  return callEdgeFunction<Caregiver | null>('caregivers', { method: 'GET' })
}

export async function createCaregiver(data: Partial<Caregiver>): Promise<Caregiver> {
  return callEdgeFunction<Caregiver>('caregivers', {
    method: 'POST',
    body: data,
  })
}

// Device linking operations
export async function getDeviceLinksForCaregiver(): Promise<DeviceLink[]> {
  return callEdgeFunction<DeviceLink[]>('device-links', { method: 'GET' })
}

export async function linkDevices(linkingCode: string): Promise<DeviceLink> {
  return callEdgeFunction<DeviceLink>('device-links', {
    method: 'POST',
    body: { linking_code: linkingCode },
  })
}

export async function deactivateDeviceLink(linkId: string): Promise<void> {
  await callEdgeFunction('device-links', {
    method: 'DELETE',
    params: { id: linkId },
  })
}

// Similar updates for alerts, tasks, known_faces, etc.
```

## Security Considerations

### 1. Authentication
- All Edge Functions validate JWT token
- Use service role key for database access
- Never expose service role key to frontend

### 2. Authorization
- Verify user owns the resource before operations
- Check caregiver-patient relationships for cross-user access
- Validate linking codes before creating relationships

### 3. Data Validation
- Validate all input data in Edge Functions
- Sanitize user input to prevent injection
- Use TypeScript types for type safety

### 4. Error Handling
- Don't expose internal errors to frontend
- Log detailed errors server-side
- Return user-friendly error messages

## Testing Checklist

### Patient Operations
- [ ] Patient can create their own profile
- [ ] Patient can view their own data
- [ ] Patient can update their own data
- [ ] Patient cannot view other patients' data
- [ ] Patient cannot update other patients' data

### Caregiver Operations
- [ ] Caregiver can create their own profile
- [ ] Caregiver can view their own data
- [ ] Caregiver can update their own data
- [ ] Caregiver cannot view other caregivers' data

### Device Linking
- [ ] Caregiver can link to patient with valid code
- [ ] Caregiver cannot link with invalid code
- [ ] Caregiver can view linked patients
- [ ] Caregiver can deactivate links
- [ ] Caregiver cannot link to already-linked patient

### Alerts
- [ ] Patient can create alerts
- [ ] Caregiver can view alerts for linked patients
- [ ] Caregiver cannot view alerts for non-linked patients
- [ ] Caregiver can update alert status

### Tasks
- [ ] Patient can create tasks
- [ ] Patient can view own tasks
- [ ] Caregiver can create tasks for linked patients
- [ ] Caregiver can view tasks for linked patients
- [ ] Caregiver cannot view tasks for non-linked patients

## Rollback Plan

If issues arise, rollback is straightforward:
1. Re-enable RLS on tables
2. Restore RLS policies from backup
3. Revert frontend to use direct Supabase queries
4. Remove Edge Functions

## Notes

- Keep database functions (they're useful for complex operations)
- Edge Functions can call database functions
- Service role key bypasses RLS (but we're disabling RLS anyway)
- Consider rate limiting on Edge Functions
- Monitor Edge Function performance and costs
