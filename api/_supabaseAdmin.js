// api/_supabaseAdmin.js
import { createClient } from '@supabase/supabase-js'

// IMPORTANT:
// - SUPABASE_SERVICE_ROLE_KEY nunca vai pro front (somente server/Vercel)
// - SUPABASE_URL é o Project URL do Supabase (o mesmo do VITE_SUPABASE_URL)
export function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)')
  if (!serviceKey) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY')

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  })
}

// Lê o JWT do usuário logado via header Authorization: Bearer <token>
// e carrega o profile (id, name, role) pra aplicar permissões
export async function getRequester(req, admin) {
  const authHeader = req.headers.authorization || req.headers.Authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null, profile: null }

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return { user: null, profile: null }

  const user = data.user

  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  if (profErr) return { user, profile: null }
  return { user, profile }
}
