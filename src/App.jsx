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
import Maintenance from './pages/Maintenance'
import Users from './pages/Users'

import AppHeader from './components/AppHeader'
import BottomNav from './components/BottomNav'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('status')

  // sessão inicial + escuta login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setProfile(null)
      setTab('status')
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

  const isManager = profile.role !== 'motorista'

  const navItems = [
    { key: 'status', label: 'Status', icon: '🚦' },
    { key: 'uso', label: 'Uso', icon: '🚗' },
    { key: 'abastecer', label: 'Comb.', icon: '⛽' },
    ...(isManager ? [{ key: 'gestao', label: 'Gestão', icon: '📊' }] : []),
    ...(isManager ? [{ key: 'usuarios', label: 'Usuários', icon: '👤' }] : []),
    { key: 'veiculos', label: 'Frota', icon: '🧰' }
  ]

  return (
    <div className="container safe-bottom">
      <AppHeader profile={profile} onSignOut={() => supabase.auth.signOut()} />

      {tab === 'status' && (
        <div className="grid">
          <FleetStatus />
          {isManager && <Maintenance profile={profile} />}
        </div>
      )}

      {tab === 'uso' && (
        <div className="grid grid-2">
          <RegisterUsage user={session.user} />
          <RegisterReturn user={session.user} />
        </div>
      )}

      {tab === 'abastecer' && (
        <div className="grid">
          <FuelLog user={session.user} profile={profile} />
        </div>
      )}

      {tab === 'gestao' && isManager && (
        <div className="grid">
          <SmartReport profile={profile} />
          <Report />
        </div>
      )}

      {tab === 'usuarios' && isManager && (
        <div className="grid">
          <Users profile={profile} />
        </div>
      )}

      {tab === 'veiculos' && (
        <div className="grid">
          <Vehicles />
        </div>
      )}

      <BottomNav items={navItems} activeKey={tab} onChange={setTab} />
    </div>
  )
}

export default App
