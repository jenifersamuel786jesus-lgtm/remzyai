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

    // GET /known-faces - Get known faces for patient
    if (method === 'GET') {
      // Get patient ID for this user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!patient) {
        return errorResponse('Only patients can access known faces', 403)
      }

      const { data: faces, error } = await supabase
        .from('known_faces')
        .select('*')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return successResponse(faces || [])
    }

    // POST /known-faces - Create known face
    if (method === 'POST') {
      const body = await req.json()

      // Get patient ID for this user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!patient) {
        return errorResponse('Only patients can create known faces', 403)
      }

      // Security: Force patient_id to authenticated user's patient
      const faceData = {
        ...body,
        patient_id: patient.id,
      }

      const { data: face, error } = await supabase
        .from('known_faces')
        .insert(faceData)
        .select()
        .single()

      if (error) throw error
      return successResponse(face, 201)
    }

    // PUT /known-faces - Update known face
    if (method === 'PUT') {
      const faceId = url.searchParams.get('id')
      if (!faceId) {
        return errorResponse('Face ID required')
      }

      const body = await req.json()

      // Get patient ID for this user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!patient) {
        return errorResponse('Only patients can update known faces', 403)
      }

      // Verify face belongs to user's patient
      const { data: existing } = await supabase
        .from('known_faces')
        .select('patient_id')
        .eq('id', faceId)
        .maybeSingle()

      if (!existing || existing.patient_id !== patient.id) {
        return errorResponse('Unauthorized', 403)
      }

      // Don't allow changing patient_id
      delete body.patient_id

      const { data: face, error } = await supabase
        .from('known_faces')
        .update(body)
        .eq('id', faceId)
        .select()
        .single()

      if (error) throw error
      return successResponse(face)
    }

    // DELETE /known-faces - Delete known face
    if (method === 'DELETE') {
      const faceId = url.searchParams.get('id')
      if (!faceId) {
        return errorResponse('Face ID required')
      }

      // Get patient ID for this user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!patient) {
        return errorResponse('Only patients can delete known faces', 403)
      }

      // Verify face belongs to user's patient
      const { data: existing } = await supabase
        .from('known_faces')
        .select('patient_id')
        .eq('id', faceId)
        .maybeSingle()

      if (!existing || existing.patient_id !== patient.id) {
        return errorResponse('Unauthorized', 403)
      }

      const { error } = await supabase
        .from('known_faces')
        .delete()
        .eq('id', faceId)

      if (error) throw error
      return successResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)

  } catch (error) {
    console.error('Error in known-faces function:', error)
    return errorResponse(error.message || 'Internal server error', 500)
  }
})
