import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function roleLabel(role) {
  if (role === 'gestor') return 'Gestor da Frota'
  if (role === 'diretor') return 'Diretor'
  if (role === 'gerente') return 'Gerente'
  if (role === 'motorista') return 'Motorista'
  return role
}

function allowedCreateRoles(creatorRole) {
  if (creatorRole === 'gestor') return ['diretor', 'gerente', 'motorista']
  if (creatorRole === 'diretor' || creatorRole === 'gerente') return ['motorista']
  return []
}

export default function Users({ session, profile }) {
  const creatorRole = profile?.role
  const canManage = creatorRole && creatorRole !== 'motorista'

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)

  // criar
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('motorista')

  // editar
  const [editing, setEditing] = useState({}) // { [id]: { name, role } }

  const createRoles = useMemo(() => allowedCreateRoles(creatorRole), [creatorRole])

  useEffect(() => {
    if (!canManage) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage])

  async function refresh() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, created_at')
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      console.error(error)
      alert('Erro ao buscar usuários')
      return
    }
    setList(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name || !email || !password || !role) {
      alert('Preencha nome, email, senha e cargo.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, email, password, role })
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok || payload?.error) {
        alert(payload?.error || 'Erro ao criar usuário')
      } else {
        alert('Usuário criado com sucesso ✅')
        setName('')
        setEmail('')
        setPassword('')
        setRole('motorista')
        await refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  function canEditRow(row) {
    if (creatorRole === 'gestor') return true
    if (creatorRole === 'diretor' || creatorRole === 'gerente') {
      return row.role === 'motorista'
    }
    return false
  }

  function roleOptionsForRow(row) {
    // diretor/gerente não podem trocar cargo; gestor pode trocar (exceto o próprio)
    if (creatorRole === 'gestor') {
      if (row.id === session.user.id) return [row.role] // trava seu próprio cargo
      return ['diretor', 'gerente', 'motorista']
    }
    return [row.role]
  }

  function startEdit(row) {
    setEditing(prev => ({
      ...prev,
      [row.id]: { name: row.name || '', role: row.role || 'motorista' }
    }))
  }

  function cancelEdit(id) {
    setEditing(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  async function saveEdit(id) {
    const patch = editing[id]
    if (!patch) return

    setLoading(true)
    try {
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, name: patch.name, role: patch.role })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok || payload?.error) {
        alert(payload?.error || 'Erro ao atualizar usuário')
      } else {
        cancelEdit(id)
        await refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!canManage) return null

  return (
    <Card
      title="Usuários"
      right={
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </Button>
      }
    >
      {/* CRIAR */}
      <div style={{ marginBottom: 14 }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Criar usuário</h4>

        {createRoles.length === 0 ? (
          <p style={{ opacity: 0.8, margin: 0 }}>
            Você não tem permissão para criar usuários.
          </p>
        ) : (
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Nome"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              placeholder="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              placeholder="Senha"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            <select value={role} onChange={e => setRole(e.target.value)}>
              {createRoles.map(r => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>

            <Button type="submit" disabled={loading}>
              {loading ? 'Criando…' : 'Criar usuário'}
            </Button>
          </form>
        )}
      </div>

      <div className="sep" style={{ margin: '14px 0' }} />

      {/* LISTA */}
      <h4 style={{ marginTop: 0, marginBottom: 8 }}>Lista</h4>
      {list.length === 0 ? (
        <p style={{ opacity: 0.8, margin: 0 }}>
          Nenhum usuário encontrado.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(u => {
            const isEditing = Boolean(editing[u.id])
            const editable = canEditRow(u)
            const opts = roleOptionsForRow(u)

            return (
              <div key={u.id} className="soft" style={{ padding: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 16 }}>{u.name || '(sem nome)'}</strong>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge tone={u.role === 'motorista' ? 'neutral' : 'warning'}>
                        {roleLabel(u.role)}
                      </Badge>
                      {u.id === session.user.id && (
                        <Badge tone="success">você</Badge>
                      )}
                      <span style={{ opacity: 0.7, fontSize: 12 }}>
                        {u.id.slice(0, 8)}…
                      </span>
                    </div>
                  </div>

                  {editable && !isEditing && (
                    <Button variant="ghost" onClick={() => startEdit(u)}>
                      Editar
                    </Button>
                  )}
                </div>

                {editable && isEditing && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                    <input
                      placeholder="Nome"
                      value={editing[u.id].name}
                      onChange={e =>
                        setEditing(prev => ({
                          ...prev,
                          [u.id]: { ...prev[u.id], name: e.target.value }
                        }))
                      }
                    />

                    <select
                      value={editing[u.id].role}
                      onChange={e =>
                        setEditing(prev => ({
                          ...prev,
                          [u.id]: { ...prev[u.id], role: e.target.value }
                        }))
                      }
                      disabled={opts.length === 1}
                    >
                      {opts.map(r => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button onClick={() => saveEdit(u.id)} disabled={loading}>
                        Salvar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => cancelEdit(u.id)}
                        disabled={loading}
                      >
                        Cancelar
                      </Button>
                    </div>

                    {(creatorRole === 'diretor' || creatorRole === 'gerente') && (
                      <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
                        *Diretor/Gerente pode editar somente motoristas (sem trocar o cargo).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
