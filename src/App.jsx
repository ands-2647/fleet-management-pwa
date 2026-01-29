import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Vehicles from './pages/Vehicles'
import Report from './pages/Report'
import RegisterUsage from './pages/RegisterUsage'


function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    // mudanças de login/logout
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setProfile(null)
    })
  }, [])

  // buscar profile quando logar
  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setProfile(data)
        })
    }
  }, [session])

  // não logado
  if (!session) {
    return <Login />
  }

  // logado, mas profile ainda carregando
  if (!profile) {
    return <p>Carregando perfil...</p>
  }

  return (
  <div style={{ padding: 20 }}>
    <p>
      Bem-vindo, {profile.name} ({profile.role})
    </p>

    <button onClick={() => supabase.auth.signOut()}>
      Sair
    </button>

    {/* Registrar Saída (todos podem usar, inclusive chefia) */}
    <RegisterUsage user={session.user} />

    {/* Relatório só para chefia */}
    {profile.role !== 'motorista' && <Report />}

    {/* Todos podem ver veículos (ajustamos depois) */}
    <Vehicles />
  </div>
)
}

export default App
