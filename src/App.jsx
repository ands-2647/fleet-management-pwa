import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import FleetStatus from './pages/FleetStatus'
import RegisterUsage from './pages/RegisterUsage'
import RegisterReturn from './pages/RegisterReturn'
import FuelLog from './pages/FuelLog'
import SmartReport from './pages/SmartReport'
import Vehicles from './pages/Vehicles'
import Users from './pages/Users'

const TABS = ['status','uso','comb','gestao','frota','usuarios']

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(false)

  const [activeTab, setActiveTab] = useState(
    localStorage.getItem('tab') || 'status'
  )

  const loadingTimer = useRef(null)

  // =============================
  // Persistir aba
  // =============================
  useEffect(() => {
    localStorage.setItem('tab', activeTab)
  }, [activeTab])

  // =============================
  // Sessão
  // =============================
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

    return () => listener.subscription.unsubscribe()
  }, [])

  // =============================
  // Carregar perfil
  // =============================
  async function loadProfile(userId) {
    if (!userId) return

    setProfileError(false)

    clearTimeout(loadingTimer.current)
    loadingTimer.current = setTimeout(() => {
      setProfileError(true)
    }, 7000)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    clearTimeout(loadingTimer.current)

    if (error) {
      console.error(error)
      setProfileError(true)
    } else {
      setProfile(data)
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadProfile(session.user.id)
    }
  }, [session])

  // =============================
  // Fix iOS background
  // =============================
  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id)
      }
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
    window.addEventListener('pageshow', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  // =============================
  // Estados de tela
  // =============================
  if (!session) return <Login />

  if (!profile && !profileError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Carregando perfil...
      </div>
    )
  }

  if (profileError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>Erro ao carregar perfil</p>
        <button onClick={()=>window.location.reload()}>
          Recarregar
        </button>
      </div>
    )
  }

  // =============================
  // Render abas
  // =============================
  return (
    <div style={{ paddingBottom: 90 }}>
      <header style={{ padding: 16 }}>
        <h2>Frota MS</h2>
        <div>
          {profile.name} • {profile.role}
        </div>
        <button onClick={()=>supabase.auth.signOut()}>
          Sair
        </button>
      </header>

      {activeTab==='status' && <FleetStatus/>}

      {activeTab==='uso' && (
        <>
          <RegisterUsage user={session.user}/>
          <RegisterReturn user={session.user}/>
        </>
      )}

      {activeTab==='comb' && (
        <FuelLog user={session.user} profile={profile}/>
      )}

      {activeTab==='gestao' && (
        <SmartReport profile={profile}/>
      )}

      {(profile.role!=='motorista') && activeTab==='frota' && (
        <Vehicles/>
      )}

      {(profile.role!=='motorista') && activeTab==='usuarios' && (
        <Users/>
      )}

      {/* MENU INFERIOR */}
      <nav style={{
        position:'fixed',
        bottom:0,
        left:0,
        right:0,
        display:'flex',
        justifyContent:'space-around',
        background:'#111',
        padding:10
      }}>
        {TABS.map(t=>(
          <button
            key={t}
            onClick={()=>setActiveTab(t)}
            style={{
              color: activeTab===t ? 'orange':'white'
            }}
          >
            {t}
          </button>
        ))}
      </nav>
    </div>
  )
}