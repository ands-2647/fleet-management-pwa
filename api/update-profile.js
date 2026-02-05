import { createClient } from '@supabase/supabase-js'

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function getBearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  if (typeof h !== 'string') return null
  if (!h.toLowerCase().startsWith('bearer ')) return null
  return h.slice(7).trim()
}

function canUpdateTarget({ creatorRole, targetRole, wantsRoleChange }) {
  // gestor: pode editar qualquer um (mas bloqueamos trocar role do próprio usuário)
  if (creatorRole === 'gestor') return true

  // diretor/gerente: pode editar SOMENTE motoristas e não pode promover
  if (creatorRole === 'diretor' || creatorRole === 'gerente') {
    if (targetRole !== 'motorista') return false
    if (wantsRoleChange) return false
    return true
  }

  // motorista: não edita
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(res, 500, {
      error:
        'Missing server env vars. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.'
    })
  }

  const token = getBearerToken(req)
  if (!token) return json(res, 401, { error: 'Missing bearer token' })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // valida quem chama
  const { data: authData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !authData?.user) {
    return json(res, 401, { error: 'Invalid session' })
  }

  const creatorId = authData.user.id

  // payload
  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' })
  }

  const id = (body?.id || '').trim()
  const name = typeof body?.name === 'string' ? body.name.trim() : null
  const role = typeof body?.role === 'string' ? body.role.trim() : null

  if (!id) return json(res, 400, { error: 'Campo obrigatório: id' })
  if (!name && !role) {
    return json(res, 400, { error: 'Informe ao menos name ou role para atualizar.' })
  }

  // pega role do criador
  const { data: creatorProfile, error: creatorProfErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', creatorId)
    .single()

  if (creatorProfErr || !creatorProfile?.role) {
    return json(res, 403, { error: 'Creator profile not found/allowed' })
  }

  // pega role do alvo
  const { data: targetProfile, error: targetErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single()

  if (targetErr || !targetProfile?.role) {
    return json(res, 404, { error: 'Usuário alvo não encontrado.' })
  }

  const wantsRoleChange = role && role !== targetProfile.role

  // bloqueia alterar o próprio role
  if (id === creatorId && wantsRoleChange) {
    return json(res, 403, { error: 'Você não pode alterar o seu próprio cargo.' })
  }

  if (
    !canUpdateTarget({
      creatorRole: creatorProfile.role,
      targetRole: targetProfile.role,
      wantsRoleChange
    })
  ) {
    return json(res, 403, { error: 'Sem permissão para editar este usuário.' })
  }

  const patch = {}
  if (name) patch.name = name
  if (role) patch.role = role

  const { error: upErr } = await admin.from('profiles').update(patch).eq('id', id)
  if (upErr) {
    return json(res, 400, { error: upErr.message || 'Erro ao atualizar profile.' })
  }

  return json(res, 200, { ok: true })
}
