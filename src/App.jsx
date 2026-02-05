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
import Users from './pages/Users'

import AppHeader from './components/AppHeader'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)

  // sessão inicial + escuta login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setProfile(null)
    })

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
  if (!session) return <Login />

  // logado mas profile ainda carregando
  if (!profile) return <p className="container">Carregando perfil...</p>

  return (
    <div className="container">
      <AppHeader profile={profile} onSignOut={() => supabase.auth.signOut()} />

      <div className="grid">
        <FleetStatus />

        <div className="grid-2">
          <RegisterUsage user={session.user} />
          <RegisterReturn user={session.user} />
        </div>

        <FuelLog user={session.user} profile={profile} />

        {/* Painel do gestor */}
        {profile.role !== 'motorista' && <SmartReport profile={profile} />}
        {profile.role !== 'motorista' && <Report />}

        {/* Usuários (cadastro/edição) */}
        {profile.role !== 'motorista' && (
          <Users session={session} profile={profile} />
        )}

        <Vehicles />
      </div>
    </div>
  )
}

export default App
