// api/update-profile.js
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
    const { userId, name, role } = body || {}

    if (!userId) return send(res, 400, { error: 'Missing field: userId' })

    // Permissões:
    // - gestor: edita qualquer role
    // - diretor/gerente: só edita motorista
    const requesterRole = requesterProfile.role
    const canEditAny = requesterRole === 'gestor'
    if (!canEditAny) {
      // se não é gestor, só pode setar role motorista e não pode trocar pra diretor/gerente/gestor
      if (role && role !== 'motorista') {
        return send(res, 403, { error: 'Not allowed to set this role' })
      }
    }

    const patch = {}
    if (typeof name === 'string') patch.name = name
    if (typeof role === 'string') patch.role = role

    if (Object.keys(patch).length === 0) {
      return send(res, 400, { error: 'Nothing to update' })
    }

    const { error } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', userId)

    if (error) return send(res, 400, { error: error.message || 'Update failed' })

    return send(res, 200, { ok: true })
  } catch (e) {
    return send(res, 500, { error: e?.message || 'Server error' })
  }
}
