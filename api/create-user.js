// api/create-user.js
import { getAdminClient, getRequester } from './_supabaseAdmin.js'

function send(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  return res.status(status).json(body)
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true })
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })

  try {
    const admin = getAdminClient()

    const { profile: requesterProfile } = await getRequester(req, admin)
    if (!requesterProfile) return send(res, 401, { error: 'Unauthorized' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { email, password, name, role } = body || {}

    if (!email || !password || !name || !role) {
      return send(res, 400, { error: 'Missing fields: email, password, name, role' })
    }

    // Permissões:
    // - gestor: cria qualquer role
    // - diretor/gerente: cria só motorista
    const requesterRole = requesterProfile.role
    const allowedRoles =
      requesterRole === 'gestor'
        ? ['gestor', 'diretor', 'gerente', 'motorista']
        : ['motorista']

    if (!allowedRoles.includes(role)) {
      return send(res, 403, { error: 'Not allowed to create this role' })
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createErr) return send(res, 400, { error: createErr.message || 'Create user failed' })
    const userId = created.user.id

    const { error: profErr } = await admin
      .from('profiles')
      .upsert({ id: userId, name, role }, { onConflict: 'id' })

    if (profErr) return send(res, 400, { error: profErr.message || 'Profile upsert failed' })

    return send(res, 200, { ok: true, userId })
  } catch (e) {
    return send(res, 500, { error: e?.message || 'Server error' })
  }
}
