const { createClient } = require('@supabase/supabase-js')

function getEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function getAdminClient() {
  const url = getEnv('VITE_SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  })
}

async function getRequester(req, admin) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null

  if (!token) return { user: null, profile: null }

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return { user: null, profile: null }

  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('id, role, name')
    .eq('id', userData.user.id)
    .single()

  if (profErr) return { user: userData.user, profile: null }
  return { user: userData.user, profile: prof }
}

module.exports = { getAdminClient, getRequester }
