import { createClient } from 'jsr:@supabase/supabase-js@2'

export interface AuthContext {
  userId: string
  email: string
  role?: string
}

/**
 * Validates the JWT token and returns the authenticated user context
 * @param req - The incoming request
 * @returns AuthContext with user information
 * @throws Error if authentication fails
 */
export async function validateAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Server configuration error')
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  })
  
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

/**
 * Returns CORS headers for Edge Functions
 */
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

/**
 * Creates a Supabase client with service role access
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Server configuration error')
  }
  
  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Standard error response
 */
export function errorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Standard success response
 */
export function successResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify({ data }),
    {
      status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    }
  )
}
