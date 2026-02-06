// /api/_supabaseAdmin.js
const { createClient } = require('@supabase/supabase-js')

function getEnv(name) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : null
}

function getAdminClient() {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl) {
    throw new Error('Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)')
  }
  if (!serviceRole) {
    throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

async function getRequester(req, admin) {
  const authHeader =
    req.headers.authorization || req.headers.Authorization || ''

  const token = String(authHeader).startsWith('Bearer ')
    ? String(authHeader).slice('Bearer '.length)
    : null

  if (!token) {
    return { user: null, profile: null }
  }

  // pega o usuário do token (JWT do supabase)
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return { user: null, profile: null }
  }

  const user = userData.user

  // pega o profile com service role (não cai em RLS)
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  if (profErr) {
    return { user, profile: null }
  }

  return { user, profile }
}

module.exports = { getAdminClient, getRequester }
