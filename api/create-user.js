const { getAdminClient, getRequester } = require('./_supabaseAdmin')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const admin = getAdminClient()
    const { profile: requesterProfile } = await getRequester(req, admin)

    if (!requesterProfile) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { email, password, name, role } = body || {}

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // Permissions:
    // - gestor: can create any role
    // - diretor/gerente: can create only motorista
    const requesterRole = requesterProfile.role
    const allowedRoles = requesterRole === 'gestor' ? ['gestor', 'diretor', 'gerente', 'motorista'] : ['motorista']
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Not allowed to create this role' })
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createErr) {
      return res.status(400).json({ error: createErr.message || 'Create user failed' })
    }

    const userId = created.user.id

    const { error: profErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        name,
        role
      },
      { onConflict: 'id' }
    )

    if (profErr) {
      return res.status(400).json({ error: profErr.message || 'Profile insert failed' })
    }

    return res.status(200).json({ ok: true, userId })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
}
