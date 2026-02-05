import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Labels (UI) -> values (DB)
const ROLE_OPTIONS = [
  { value: 'gestor', label: 'Administrador' },
  { value: 'diretor', label: 'Diretor' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'motorista', label: 'Motorista' }
]

function roleLabel(role) {
  return ROLE_OPTIONS.find(r => r.value === role)?.label || role
}

export default function Users({ profile }) {
  const isFleetAdmin = profile?.role === 'gestor'
  const canSee = profile?.role !== 'motorista'

  const [loading, setLoading] = useState(false)
  const [profiles, setProfiles] = useState([])

  // create form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(isFleetAdmin ? 'motorista' : 'motorista')

  // edit
  const [editing, setEditing] = useState(null) // {id, name, role}

  const allowedCreateRoles = useMemo(() => {
    // Gestor da frota (você) cria qualquer um.
    if (isFleetAdmin) return ['gestor', 'diretor', 'gerente', 'motorista']
    // Diretor/Gerente: só motorista.
    return ['motorista']
  }, [isFleetAdmin])

  const allowedEditRoles = useMemo(() => {
    if (isFleetAdmin) return ['gestor', 'diretor', 'gerente', 'motorista']
    return ['motorista']
  }, [isFleetAdmin])

  useEffect(() => {
    if (!canSee) return
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSee])

  async function fetchProfiles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, created_at')
      .order('created_at', { ascending: false })

    setLoading(false)
    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao buscar usuários')
      return
    }

    const list = data || []
    // Diretor/Gerente só enxerga motoristas (pra não “bagunçar”)
    setProfiles(isFleetAdmin ? list : list.filter(p => p.role === 'motorista'))
  }

  async function handleCreate(e) {
    e.preventDefault()

    if (!name || !email || !password) {
      alert('Preencha nome, e-mail e senha')
      return
    }

    if (!allowedCreateRoles.includes(role)) {
      alert('Você não tem permissão para criar esse cargo.')
      return
    }

    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ name, email, password, role })
    })

    setLoading(false)

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('CREATE USER ERROR:', payload)
      alert(payload?.error || 'Erro ao criar usuário')
      return
    }

    alert('Usuário criado com sucesso ✅')
    setName('')
    setEmail('')
    setPassword('')
    setRole(isFleetAdmin ? 'motorista' : 'motorista')
    fetchProfiles()
  }

  function startEdit(p) {
    setEditing({ id: p.id, name: p.name || '', role: p.role })
  }

  async function saveEdit() {
    if (!editing) return
    if (!editing.name) {
      alert('Informe o nome')
      return
    }
    if (!allowedEditRoles.includes(editing.role)) {
      alert('Você não tem permissão para alterar para esse cargo.')
      return
    }

    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ id: editing.id, name: editing.name, role: editing.role })
    })

    setLoading(false)
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('UPDATE PROFILE ERROR:', payload)
      alert(payload?.error || 'Erro ao atualizar usuário')
      return
    }

    alert('Usuário atualizado ✅')
    setEditing(null)
    fetchProfiles()
  }

  if (!canSee) {
    return (
      <div className="card">
        <h2>Usuários</h2>
        <p className="muted">Acesso restrito.</p>
      </div>
    )
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Usuários</h2>
          <button className="btn" onClick={fetchProfiles} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          {isFleetAdmin
            ? 'Administrador: cria e edita qualquer usuário.'
            : 'Diretor/Gerente: cria e edita apenas Motoristas.'}
        </p>
      </div>

      {/* Criar */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Cadastrar usuário</h3>

        <form onSubmit={handleCreate} className="grid" style={{ gap: 10 }}>
          <input
            className="input"
            placeholder="Nome"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <input
            className="input"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {/* Cargo */}
          {isFleetAdmin ? (
            <select className="select" value={role} onChange={e => setRole(e.target.value)}>
              {ROLE_OPTIONS.filter(r => allowedCreateRoles.includes(r.value)).map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <div className="badge badge-ok">Cargo: Motorista</div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Salvando…' : 'Criar usuário'}
          </button>
        </form>
      </div>

      {/* Lista */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Lista</h3>
        {profiles.length === 0 ? (
          <p className="muted">Nenhum usuário encontrado.</p>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {profiles.map(p => (
              <div key={p.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{p.name || p.id.slice(0, 8)}</strong>
                  <span className="badge">{roleLabel(p.role)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  ID: {p.id.slice(0, 8)}…
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className="btn" onClick={() => startEdit(p)}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal simples de edição */}
      {editing && (
        <div className="card" style={{ borderColor: 'rgba(255,255,255,.18)' }}>
          <h3 style={{ marginTop: 0 }}>Editar usuário</h3>

          <div className="grid" style={{ gap: 10 }}>
            <input
              className="input"
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
            />

            {isFleetAdmin ? (
              <select
                className="select"
                value={editing.role}
                onChange={e => setEditing({ ...editing, role: e.target.value })}
              >
                {ROLE_OPTIONS.filter(r => allowedEditRoles.includes(r.value)).map(r => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="badge badge-ok">Cargo: Motorista</div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
