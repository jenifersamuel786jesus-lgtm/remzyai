import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Security utilities
interface AuthContext {
  userId: string
  email: string
  role?: string
}

async function validateAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization header')

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error('Invalid or expired token')

  return { userId: user.id, email: user.email!, role: user.user_metadata?.role }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

function successResponse(data: any, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    // Validate authentication
    const auth = await validateAuth(req)
    const supabase = createServiceClient()
    const url = new URL(req.url)
    const method = req.method

    // GET /patients - Get patient by authenticated user's profile_id
    if (method === 'GET') {
      const patientId = url.searchParams.get('id')
      
      if (patientId) {
        // Get specific patient - verify ownership
        const { data: patient, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .maybeSingle()

        if (error) throw error
        
        // Security: Verify patient belongs to user
        if (patient && patient.profile_id !== auth.userId) {
          return errorResponse('Unauthorized', 403)
        }

        return successResponse(patient)
      } else {
        // Get patient by profile_id
        const { data: patient, error } = await supabase
          .from('patients')
          .select('*')
          .eq('profile_id', auth.userId)
          .maybeSingle()

        if (error) throw error
        return successResponse(patient)
      }
    }

    // POST /patients - Create patient
    if (method === 'POST') {
      const body = await req.json()
      
      // Security: Force profile_id to authenticated user
      const patientData = {
        ...body,
        profile_id: auth.userId,
      }

      const { data: patient, error } = await supabase
        .from('patients')
        .insert(patientData)
        .select()
        .single()

      if (error) throw error
      return successResponse(patient, 201)
    }

    // PUT /patients - Update patient
    if (method === 'PUT') {
      const patientId = url.searchParams.get('id')
      if (!patientId) {
        return errorResponse('Patient ID required')
      }

      const body = await req.json()

      // Security: Verify patient belongs to user
      const { data: existing } = await supabase
        .from('patients')
        .select('profile_id')
        .eq('id', patientId)
        .maybeSingle()

      if (!existing || existing.profile_id !== auth.userId) {
        return errorResponse('Unauthorized', 403)
      }

      // Don't allow changing profile_id
      delete body.profile_id

      const { data: patient, error } = await supabase
        .from('patients')
        .update(body)
        .eq('id', patientId)
        .select()
        .single()

      if (error) throw error
      return successResponse(patient)
    }

    // DELETE /patients - Delete patient
    if (method === 'DELETE') {
      const patientId = url.searchParams.get('id')
      if (!patientId) {
        return errorResponse('Patient ID required')
      }

      // Security: Verify patient belongs to user
      const { data: existing } = await supabase
        .from('patients')
        .select('profile_id')
        .eq('id', patientId)
        .maybeSingle()

      if (!existing || existing.profile_id !== auth.userId) {
        return errorResponse('Unauthorized', 403)
      }

      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId)

      if (error) throw error
      return successResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)

  } catch (error) {
    console.error('Error in patients function:', error)
    return errorResponse(error.message || 'Internal server error', 500)
  }
})
