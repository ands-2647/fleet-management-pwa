import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import logo from '../assets/logo.PNG'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      console.error(error)
    }

    setLoading(false)
  }

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 36px)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Card
          title="Acesso ao sistema"
          right={
            <img
              src={logo}
              alt="MS"
              style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: '#0C0D0F', objectFit: 'cover' }}
            />
          }
        >
          <form onSubmit={handleLogin} className="grid">
            <div>
              <div className="small" style={{ marginBottom: 6 }}>Email</div>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="small" style={{ marginBottom: 6 }}>Senha</div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" disabled={loading}>
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </div>

            <div className="small">
              Dica: depois de logar, o app fica conectado. Só saia quando necessário.
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
