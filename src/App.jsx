import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Vehicles from './pages/Vehicles'
import RegisterUsage from './pages/RegisterUsage'
import RegisterReturn from './pages/RegisterReturn'
import FuelLog from './pages/FuelLog'
import FleetStatus from './pages/FleetStatus'
import SmartReport from './pages/SmartReport'
import Maintenance from './pages/Maintenance'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  // sessão inicial + escuta login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setProfile(null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // buscar profile após login
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

  // logado mas profile ainda carregando
  if (!profile) {
    return <p>Carregando perfil...</p>
  }

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <p>
          Bem-vindo, <strong>{profile.name}</strong> ({profile.role})
        </p>

        <button onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </header>

      {/* Status geral da frota */}
      <FleetStatus />

      {/* Relatórios inteligentes */}
      <SmartReport profile={profile} />

      {/* Manutenção automática (somente chefia) */}
      <Maintenance profile={profile} />

      {/* Registrar Saída */}
      <RegisterUsage user={session.user} />

      {/* Registrar Chegada */}
      <RegisterReturn user={session.user} />

      {/* Registrar Abastecimento */}
      <FuelLog user={session.user} profile={profile} />

      {/* Lista de veículos */}
      <Vehicles />
    </div>
  )
}

export default App
