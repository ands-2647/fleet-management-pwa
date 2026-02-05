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

function allowRolesForCreator(creatorRole) {
  // Ajuste de permissão conforme combinado:
  // - gestor: pode criar diretor/gerente/motorista
  // - diretor/gerente: pode criar somente motorista
  // - motorista: não cria
  if (creatorRole === 'gestor') return ['diretor', 'gerente', 'motorista']
  if (creatorRole === 'diretor' || creatorRole === 'gerente') return ['motorista']
  return []
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

  // 1) valida o usuário que está chamando esta rota
  const { data: authData, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !authData?.user) {
    return json(res, 401, { error: 'Invalid session' })
  }

  const creatorId = authData.user.id

  // 2) pega o papel do criador (profiles)
  const { data: creatorProfile, error: creatorProfErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', creatorId)
    .single()

  if (creatorProfErr || !creatorProfile?.role) {
    return json(res, 403, { error: 'Creator profile not found/allowed' })
  }

  const allowedRoles = allowRolesForCreator(creatorProfile.role)
  if (allowedRoles.length === 0) {
    return json(res, 403, { error: 'Você não tem permissão para criar usuários.' })
  }

  // 3) lê payload
  let body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' })
  }

  const name = (body?.name || '').trim()
  const email = (body?.email || '').trim()
  const password = (body?.password || '').trim()
  const role = (body?.role || '').trim()

  if (!name || !email || !password || !role) {
    return json(res, 400, { error: 'Campos obrigatórios: name, email, password, role.' })
  }

  if (!allowedRoles.includes(role)) {
    return json(res, 403, {
      error: `Seu cargo não permite criar usuário com role="${role}".`
    })
  }

  // 4) cria usuário no Auth
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (createErr || !created?.user?.id) {
    return json(res, 400, {
      error: createErr?.message || 'Erro ao criar usuário no Auth.'
    })
  }

  const newUserId = created.user.id

  // 5) cria profile
  const { error: profErr } = await admin.from('profiles').insert([
    {
      id: newUserId,
      name,
      role
    }
  ])

  if (profErr) {
    // se falhar profile, tenta remover usuário criado (para não ficar solto)
    await admin.auth.admin.deleteUser(newUserId)
    return json(res, 400, {
      error: profErr.message || 'Erro ao criar profile.'
    })
  }

  return json(res, 200, { ok: true, user_id: newUserId })
}
