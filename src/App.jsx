import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'

import Login from './pages/Login'

// suas páginas
import FleetStatus from './pages/FleetStatus'
import RegisterUsage from './pages/RegisterUsage'
import RegisterReturn from './pages/RegisterReturn'
import FuelLog from './pages/FuelLog'
import SmartReport from './pages/SmartReport'
import Maintenance from './pages/Maintenance'
import Users from './pages/Users'
import Vehicles from './pages/Vehicles'

// ✅ opcional: tempo máximo esperando perfil antes de liberar “Continuar”
const PROFILE_LOAD_TIMEOUT_MS = 7000

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [stuck, setStuck] = useState(false)

  const loadTimerRef = useRef(null)

  const clearTimer = () => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current)
      loadTimerRef.current = null
    }
  }

  const startStuckTimer = () => {
    clearTimer()
    setStuck(false)
    loadTimerRef.current = setTimeout(() => {
      // se passou tempo demais “carregando perfil”, liberamos botão
      setStuck(true)
    }, PROFILE_LOAD_TIMEOUT_MS)
  }

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return
    setProfileError('')
    startStuckTimer()

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      clearTimer()

      if (error) {
        console.error('PROFILE ERROR:', error)
        setProfile(null)
        setProfileError(error.message || 'Erro ao carregar perfil')
        return
      }

      setProfile(data)
      setStuck(false)
    } catch (e) {
      clearTimer()
      console.error('PROFILE EXCEPTION:', e)
      setProfile(null)
      setProfileError(e?.message || 'Erro ao carregar perfil')
    }
  }, [])

  const refreshAndReload = useCallback(async () => {
    try {
      // renova token (muito importante no iPhone)
      await supabase.auth.refreshSession()
    } catch (e) {
      console.warn('refreshSession warn:', e)
    }

    const { data } = await supabase.auth.getSession()
    setSession(data.session)

    if (data.session?.user?.id) {
      await loadProfile(data.session.user.id)
    }
  }, [loadProfile])

  // sessão inicial + escuta login/logout
  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        setProfile(null)
        setProfileError('')
        setStuck(false)
      }
    )

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
      clearTimer()
    }
  }, [])

  // buscar profile após login
  useEffect(() => {
    if (session?.user?.id) {
      loadProfile(session.user.id)
    }
  }, [session, loadProfile])

  // ✅ iPhone: ao desbloquear/voltar, às vezes dispara pageshow/focus/visibilitychange
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) refreshAndReload()
    }
    const onFocus = () => refreshAndReload()
    const onPageShow = () => refreshAndReload()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [refreshAndReload])

  // não logado
  if (!session) return <Login />

  // carregando perfil
  if (!profile && !profileError) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <p>Carregando perfil...</p>

        {/* ✅ se travar, aparece botão de continuar */}
        {stuck && (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <p style={{ opacity: 0.85 }}>
              Parece que o iPhone pausou o app. Toque para continuar.
            </p>
            <button onClick={refreshAndReload}>Continuar</button>
            <button onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        )}
      </div>
    )
  }

  // erro ao carregar perfil
  if (!profile && profileError) {
    return (
      <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <h2>Erro ao carregar perfil</h2>
        <p style={{ opacity: 0.9 }}>{profileError}</p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={refreshAndReload}>Tentar novamente</button>
          <button onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </div>
    )
  }

  // ✅ render normal (mantenha suas abas/painéis como já está)
  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      {/* aqui fica seu header + tabs (se já tiver) */}
      {/* abaixo deixei seus blocos só como exemplo */}
      <FleetStatus profile={profile} />
      <RegisterUsage user={session.user} />
      <RegisterReturn user={session.user} />
      <FuelLog user={session.user} profile={profile} />
      <SmartReport profile={profile} />
      <Maintenance user={session.user} profile={profile} />
      <Users user={session.user} profile={profile} />
      <Vehicles user={session.user} profile={profile} />
    </div>
  )
}