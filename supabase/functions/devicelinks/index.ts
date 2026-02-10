import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface AuthContext {
  userId: string
  email: string
  role?: string
}

async function validateAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new Error('Missing authorization header')
  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() })
  }

  try {
    const auth = await validateAuth(req)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const url = new URL(req.url)
    const method = req.method

    if (method === 'GET') {
      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!caregiver) {
        return new Response(JSON.stringify({ error: 'Caregiver profile not found' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: links, error } = await supabase
        .from('device_links')
        .select('*, patient:patients(*)')
        .eq('caregiver_id', caregiver.id)
        .eq('is_active', true)
        .order('linked_at', { ascending: false })

      if (error) throw error
      return new Response(JSON.stringify({ data: links || [] }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (method === 'POST') {
      const { linking_code } = await req.json()
      if (!linking_code) {
        return new Response(JSON.stringify({ error: 'Linking code required' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!caregiver) {
        return new Response(JSON.stringify({ error: 'Caregiver profile not found' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('linking_code', linking_code)
        .maybeSingle()

      if (!patient) {
        return new Response(JSON.stringify({ error: 'Invalid linking code' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: existingLink } = await supabase
        .from('device_links')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('caregiver_id', caregiver.id)
        .maybeSingle()

      if (existingLink) {
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
        status: 201,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    if (method === 'DELETE') {
      const linkId = url.searchParams.get('id')
      if (!linkId) {
        return new Response(JSON.stringify({ error: 'Link ID required' }), {
          status: 400,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: caregiver } = await supabase
        .from('caregivers')
        .select('id')
        .eq('profile_id', auth.userId)
        .maybeSingle()

      if (!caregiver) {
        return new Response(JSON.stringify({ error: 'Caregiver profile not found' }), {
          status: 404,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { data: link } = await supabase
        .from('device_links')
        .select('caregiver_id')
        .eq('id', linkId)
        .maybeSingle()

      if (!link || link.caregiver_id !== caregiver.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        })
      }

      const { error } = await supabase
        .from('device_links')
        .update({ is_active: false })
        .eq('id', linkId)

      if (error) throw error
      return new Response(JSON.stringify({ data: { success: true } }), {
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in devicelinks function:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    })
  }
})
