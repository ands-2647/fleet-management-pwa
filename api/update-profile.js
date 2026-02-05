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
    const { id, name, role } = body || {}
    if (!id || !role) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // Permissions:
    // - gestor: can edit anyone (including role)
    // - diretor/gerente: can edit only motoristas, and can only set role to motorista
    const requesterRole = requesterProfile.role

    // Load target profile to know current role
    const { data: target, error: targetErr } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single()

    if (targetErr) {
      return res.status(400).json({ error: targetErr.message || 'Target not found' })
    }

    if (requesterRole !== 'gestor') {
      if (target.role !== 'motorista') {
        return res.status(403).json({ error: 'Not allowed to edit this user' })
      }
      if (role !== 'motorista') {
        return res.status(403).json({ error: 'Not allowed to change role' })
      }
    }

    const payload = { id, role }
    if (typeof name === 'string' && name.trim()) payload.name = name.trim()

    const { error: updErr } = await admin.from('profiles').update(payload).eq('id', id)
    if (updErr) {
      return res.status(400).json({ error: updErr.message || 'Update failed' })
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Server error' })
  }
}
