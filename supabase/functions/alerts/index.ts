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

    // GET /alerts - Get alerts for patient or caregiver
    if (method === 'GET') {
      const patientId = url.searchParams.get('patient_id')

      // Check if user is a patient
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (patient) {
        // User is a patient - get their alerts
        const { data: alerts, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('patient_id', patient.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        return successResponse(alerts || [])
      }

      // Check if user is a caregiver
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (caregiver) {
        // Get linked patients
        const { data: links } = await supabase
          .from('device_links')
          .select('patient_id')
          .eq('caregiver_id', caregiver.id)
          .eq('is_active', true)

        const patientIds = links?.map(l => l.patient_id) || []

        if (patientIds.length === 0) {
          return successResponse([])
        }

        // Get alerts for linked patients
        let query = supabase
          .from('alerts')
          .select('*, patient:patients(full_name)')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })

        // Filter by specific patient if requested
        if (patientId) {
          if (!patientIds.includes(patientId)) {
            return errorResponse('Unauthorized', 403)
          }
          query = query.eq('patient_id', patientId)
        }

        const { data: alerts, error } = await query

        if (error) throw error
        return successResponse(alerts || [])
      }

      return errorResponse('User is neither patient nor caregiver', 403)
    }

    // POST /alerts - Create alert (patients only)
    if (method === 'POST') {
      const body = await req.json()

      // Get patient ID for this user
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!patient) {
        return errorResponse('Only patients can create alerts', 403)
      }

      // Security: Force patient_id to authenticated user's patient
      const alertData = {
        ...body,
        patient_id: patient.id,
      }

      const { data: alert, error } = await supabase
        .from('alerts')
        .insert(alertData)
        .select()
        .single()

      if (error) throw error
      return successResponse(alert, 201)
    }

    // PUT /alerts - Update alert (caregivers can update status)
    if (method === 'PUT') {
      const alertId = url.searchParams.get('id')
      if (!alertId) {
        return errorResponse('Alert ID required')
      }

      const body = await req.json()

      // Get alert
      const { data: alert } = await supabase
        .from('alerts')
        .select('patient_id')
        .eq('id', alertId)
        .maybeSingle()

      if (!alert) {
        return errorResponse('Alert not found', 404)
      }

      // Check access
      const hasAccess = await hasPatientAccess(alert.patient_id)
      if (!hasAccess) {
        return errorResponse('Unauthorized', 403)
      }

      // Don't allow changing patient_id
      delete body.patient_id

      const { data: updatedAlert, error } = await supabase
        .from('alerts')
        .update(body)
        .eq('id', alertId)
        .select()
        .single()

      if (error) throw error
      return successResponse(updatedAlert)
    }

    // DELETE /alerts - Delete alert
    if (method === 'DELETE') {
      const alertId = url.searchParams.get('id')
      if (!alertId) {
        return errorResponse('Alert ID required')
      }

      // Get alert
      const { data: alert } = await supabase
        .from('alerts')
        .select('patient_id')
        .eq('id', alertId)
        .maybeSingle()

      if (!alert) {
        return errorResponse('Alert not found', 404)
      }

      // Check access
      const hasAccess = await hasPatientAccess(alert.patient_id)
      if (!hasAccess) {
        return errorResponse('Unauthorized', 403)
      }

      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId)

      if (error) throw error
      return successResponse({ success: true })
    }

    return errorResponse('Method not allowed', 405)

  } catch (error) {
    console.error('Error in alerts function:', error)
    return errorResponse(error.message || 'Internal server error', 500)
  }
})
