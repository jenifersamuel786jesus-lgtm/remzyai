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

    // Helper to check if user has access to patient
    async function hasPatientAccess(patientId: string): Promise<boolean> {
      // Check if user is the patient
      const { data: patient } = await supabase
        .from('patients')
        .select('profile_id')
        .eq('id', patientId)
        .maybeSingle()

      if (patient?.profile_id === auth.userId) {
        return true
      }

      // Check if user is a linked caregiver
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (caregiver) {
        const { data: link } = await supabase
          .from('device_links')
          .select('id')
          .eq('patient_id', patientId)
          .eq('caregiver_id', caregiver.id)
          .eq('is_active', true)
          .maybeSingle()

        if (link) {
          return true
        }
      }

      return false
    }

    // GET /tasks - Get tasks for patient or caregiver
    if (method === 'GET') {
      const patientId = url.searchParams.get('patient_id')

      // Check if user is a patient
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (patient) {
        // User is a patient - get their tasks
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('patient_id', patient.id)
          .order('scheduled_time', { ascending: true })

        if (error) throw error
        return successResponse(tasks || [])
      }

      // Check if user is a caregiver
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (caregiver) {
        if (!patientId) {
          return errorResponse('Patient ID required for caregivers')
        }

        // Verify caregiver has access to this patient
        const { data: link } = await supabase
          .from('device_links')
          .select('id')
          .eq('patient_id', patientId)
          .eq('caregiver_id', caregiver.id)
          .eq('is_active', true)
          .maybeSingle()

        if (!link) {
          return errorResponse('Unauthorized', 403)
        }

        // Get tasks for this patient
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('patient_id', patientId)
          .order('scheduled_time', { ascending: true })

        if (error) throw error
        return successResponse(tasks || [])
      }

      return errorResponse('User is neither patient nor caregiver', 403)
    }

    // POST /tasks - Create task
    if (method === 'POST') {
      const body = await req.json()
      const { patient_id } = body

      if (!patient_id) {
        return errorResponse('Patient ID required')
      }

      // Check if user has access to create tasks for this patient
      const hasAccess = await hasPatientAccess(patient_id)
      if (!hasAccess) {
        return errorResponse('Unauthorized', 403)
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert(body)
        .select()
        .single()

      if (error) throw error
      return successResponse(task, 201)
    }

    // PUT /tasks - Update task
    if (method === 'PUT') {
      const taskId = url.searchParams.get('id')
      if (!taskId) {
        return errorResponse('Task ID required')
      }

      const body = await req.json()

      // Get task
      const { data: task } = await supabase
        .from('tasks')
        .select('patient_id')
        .eq('id', taskId)
        .maybeSingle()

      if (!task) {
        return errorResponse('Task not found', 404)
      }

      // Check access
      const hasAccess = await hasPatientAccess(task.patient_id)
      if (!hasAccess) {
        return errorResponse('Unauthorized', 403)
      }

      // Don't allow changing patient_id
      delete body.patient_id

      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update(body)
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error
      return successResponse(updatedTask)
    }

    // DELETE /tasks - Delete task
    if (method === 'DELETE') {
      const taskId = url.searchParams.get('id')
      if (!taskId) {
        return errorResponse('Task ID required')
      }

      // Get task
      const { data: task } = await supabase
        .from('tasks')
        .select('patient_id')
        .eq('id', taskId)
        .maybeSingle()

      if (!task) {
        return errorResponse('Task not found', 404)
      }

      // Check access
      const hasAccess = await hasPatientAccess(task.patient_id)
      if (!hasAccess) {
        return errorResponse('Unauthorized', 403)
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) throw error
      return successResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)

  } catch (error) {
    console.error('Error in tasks function:', error)
    return errorResponse(error.message || 'Internal server error', 500)
  }
})
