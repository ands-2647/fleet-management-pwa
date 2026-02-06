import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { usePersistedState } from './lib/usePersistedState'

import Login from './pages/Login'
import Vehicles from './pages/Vehicles'
import Report from './pages/Report'
import RegisterUsage from './pages/RegisterUsage'
import RegisterReturn from './pages/RegisterReturn'
import FuelLog from './pages/FuelLog'
import FleetStatus from './pages/FleetStatus'
import SmartReport from './pages/SmartReport'
import Users from './pages/Users'

import BottomNav from './components/BottomNav'

function App() {
  const [session, setSession] = usePersistedState('auth_session', null)
  const [profile, setProfile] = usePersistedState('auth_profile', null)

  // aba ativa (persiste para não “voltar pro início” quando iOS recarrega)
  const [activeTab, setActiveTab] = usePersistedState('active_tab', 'status')

  // sessão inicial + escuta login/logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setProfile(null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // buscar profile após login
  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data, error }) => {
          if (error) console.error('PROFILE ERROR:', error)
          setProfile(data)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // não logado
  if (!session) {
    return <Login />
  }

  // logado mas profile ainda carregando
  if (!profile) {
    return <p style={{ padding: 20 }}>Carregando perfil...</p>
  }

  const isDriver = profile.role === 'motorista'
  const canManageFleet = !isDriver // admin/diretor/gerente

  // itens do menu (aba)
  const items = [
    { key: 'status', label: 'Status', icon: '📋' },
    { key: 'uso', label: 'Uso', icon: '🚗' },
    { key: 'comb', label: 'Combustível', icon: '⛽' },
    !isDriver ? { key: 'gestao', label: 'Gestão', icon: '📊' } : null,
    canManageFleet ? { key: 'frota', label: 'Frota', icon: '🚙' } : null
  ].filter(Boolean)

  // se a aba salva não existir mais (por role), cai pra status
  useEffect(() => {
    if (!items.find(i => i.key === activeTab)) {
      setActiveTab('status')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.role])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-title">Frota MS</div>
          <div className="app-subtitle">
            {profile.name} • {profile.role}
          </div>
        </div>

        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </header>

      <main className="app-content">
        {activeTab === 'status' && <FleetStatus />}

        {activeTab === 'uso' && (
          <>
            <RegisterUsage user={session.user} />
            <RegisterReturn user={session.user} />
          </>
        )}

        {activeTab === 'comb' && <FuelLog user={session.user} profile={profile} />}

        {!isDriver && activeTab === 'gestao' && (
          <>
            <SmartReport profile={profile} />
            <Report />
            <Users profile={profile} />
          </>
        )}

        {canManageFleet && activeTab === 'frota' && <Vehicles />}
      </main>

      <BottomNav items={items} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default App
