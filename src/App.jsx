import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Vehicles from './pages/Vehicles'
import Report from './pages/Report'
import RegisterUsage from './pages/RegisterUsage'
import RegisterReturn from './pages/RegisterReturn'
import FuelLog from './pages/FuelLog'
import FleetStatus from './pages/FleetStatus'
import SmartReport from './pages/SmartReport'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

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

  if (!session) return <Login />
  if (!profile) return <p>Carregando perfil...</p>

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <p>
          Bem-vindo, <strong>{profile.name}</strong>
        </p>
        <button onClick={() => supabase.auth.signOut()}>Sair</button>
      </header>

      <FleetStatus />

      <RegisterUsage user={session.user} />
      <RegisterReturn user={session.user} />

      <FuelLog user={session.user} profile={profile} />

      {/* ✅ Relatórios Inteligentes (chefia) */}
      {profile.role !== 'motorista' && <SmartReport profile={profile} />}

      {/* Relatório simples antigo (chefia) */}
      {profile.role !== 'motorista' && <Report />}

      <Vehicles />
    </div>
  )
}

export default App
