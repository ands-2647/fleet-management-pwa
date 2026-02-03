import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const box = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  marginTop: 12
}

const pill = status => ({
  display: 'inline-block',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: status === 'Em uso' ? '#ffe0e0' : '#e7f7e7',
  border: status === 'Em uso' ? '1px solid #ffb3b3' : '1px solid #bfe7bf'
})

export default function FleetStatus() {
  const [vehicles, setVehicles] = useState([])
  const [openUsages, setOpenUsages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)

    // 1) Veículos
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, plate, model, type, measurement_type')
      .order('plate')

    // 2) Usos abertos (end_value IS NULL)
    // Buscamos o user_id e depois puxamos profiles em um segundo passo
    const { data: usageData, error: usageError } = await supabase
      .from('usage_logs')
      .select(
        'id, vehicle_id, user_id, date, start_value, created_at, destination, fuel_level_start'
      )
      .is('end_value', null)
      .order('created_at', { ascending: false })

    if (vehiclesError) console.error('vehiclesError:', vehiclesError)
    if (usageError) console.error('usageError:', usageError)

    const open = usageData || []

    // 3) Buscar perfis dos usuários que estão com uso aberto (para mostrar nome/role)
    const userIds = [...new Set(open.map(u => u.user_id).filter(Boolean))]

    let profilesMap = {}
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('id', userIds)

      if (profilesError) {
        console.error('profilesError:', profilesError)
      } else {
        profilesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))
      }
    }

    // 4) Anexar profile em cada uso aberto
    const openWithProfile = open.map(u => ({
      ...u,
      profile: profilesMap[u.user_id] || null
    }))

    setVehicles(vehiclesData || [])
    setOpenUsages(openWithProfile)
    setLoading(false)
  }

  // mapa: vehicle_id -> uso aberto mais recente
  const openByVehicle = useMemo(() => {
    const map = {}
    for (const u of openUsages) {
      if (!map[u.vehicle_id]) map[u.vehicle_id] = u
    }
    return map
  }, [openUsages])

  const rows = useMemo(() => {
    return vehicles.map(v => {
      const open = openByVehicle[v.id] || null
      const status = open ? 'Em uso' : 'Livre'
      return { vehicle: v, open, status }
    })
  }, [vehicles, openByVehicle])

  const freeCount = rows.filter(r => r.status === 'Livre').length
  const inUseCount = rows.filter(r => r.status === 'Em uso').length

  function formatMedicao(measurementType) {
    return measurementType === 'hours' ? 'Horas' : 'KM'
  }

  function formatFuel(fuel) {
    if (!fuel) return '—'
    if (fuel === 'vazio') return 'Vazio'
    if (fuel === 'cheio') return 'Cheio'
    return fuel
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Status da Frota</h2>
        <span style={{ fontSize: 13, color: '#555' }}>
          Livres: <strong>{freeCount}</strong> • Em uso:{' '}
          <strong>{inUseCount}</strong>
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <button onClick={fetchStatus} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {loading ? (
        <p style={{ marginTop: 12 }}>Carregando status...</p>
      ) : rows.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhum veículo cadastrado ainda.</p>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {rows.map(({ vehicle, open, status }) => {
            const medicao = formatMedicao(vehicle.measurement_type)

            const userName = open?.profile?.name || '—'
            const userRole = open?.profile?.role || ''
            const destino = open?.destination || '—'
            const fuel = formatFuel(open?.fuel_level_start)

            return (
              <div
                key={vehicle.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {vehicle.plate} — {vehicle.model}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Tipo: {vehicle.type || '—'} • Medição: {medicao}
                    </div>
                  </div>

                  <span style={pill(status)}>{status}</span>
                </div>

                {status === 'Em uso' ? (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'grid',
                      gap: 6,
                      fontSize: 14
                    }}
                  >
                    <div>
                      <strong>Usuário:</strong> {userName}{' '}
                      {userRole ? `(${userRole})` : ''}
                    </div>
                    <div>
                      <strong>Saída:</strong> {open.start_value} ({medicao})
                    </div>
                    <div>
                      <strong>Destino:</strong> {destino}
                    </div>
                    <div>
                      <strong>Combustível:</strong> {fuel}
                    </div>
                    <div style={{ fontSize: 12, color: '#777' }}>
                      <strong>Data:</strong> {open.date}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
                    Veículo disponível para uso.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
