import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function formatUnit(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

function formatFuel(fuel) {
  if (!fuel) return '—'
  if (fuel === 'vazio') return 'Vazio'
  if (fuel === 'cheio') return 'Cheio'
  return fuel
}

export default function FleetStatus() {
  const [vehicles, setVehicles] = useState([])
  const [openUsages, setOpenUsages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    setLoading(true)

    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, plate, model, type, measurement_type')
      .order('plate')

    const { data: usageData, error: usageError } = await supabase
      .from('usage_logs')
      .select('id, vehicle_id, user_id, date, start_value, created_at, destination, fuel_level_start')
      .is('end_value', null)
      .order('created_at', { ascending: false })

    if (vehiclesError) console.error('vehiclesError:', vehiclesError)
    if (usageError) console.error('usageError:', usageError)

    const open = usageData || []
    const userIds = [...new Set(open.map(u => u.user_id).filter(Boolean))]

    let profilesMap = {}
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)

      if (profilesError) {
        console.error('profilesError:', profilesError)
      } else {
        profilesMap = Object.fromEntries((profilesData || []).map(p => [p.id, p]))
      }
    }

    const openWithProfile = open.map(u => ({
      ...u,
      profile: profilesMap[u.user_id] || null
    }))

    setVehicles(vehiclesData || [])
    setOpenUsages(openWithProfile)
    setLoading(false)
  }

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

  return (
    <Card
      title="Status da frota"
      right={
        <Button variant="ghost" onClick={fetchStatus} disabled={loading}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Badge tone="ok">Livres: {freeCount}</Badge>
        <Badge tone="warn">Em uso: {inUseCount}</Badge>
      </div>

      {loading ? (
        <p style={{ marginTop: 12 }}>Carregando status...</p>
      ) : rows.length === 0 ? (
        <p style={{ marginTop: 12 }}>Nenhum veículo cadastrado ainda.</p>
      ) : (
        <div className="grid" style={{ marginTop: 12 }}>
          {rows.map(({ vehicle, open, status }) => {
            const unit = formatUnit(vehicle.measurement_type)
            const userName = open?.profile?.name || '—'
            const destino = open?.destination || '—'
            const fuel = formatFuel(open?.fuel_level_start)

            return (
              <div key={vehicle.id} className="card" style={{ boxShadow: 'none' }}>
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {vehicle.plate} — {vehicle.model}
                      </div>
                      <div className="small">
                        Tipo: {vehicle.type || '—'} • Medição: {unit}
                      </div>
                    </div>

                    {status === 'Em uso' ? (
                      <Badge tone="warn">EM USO</Badge>
                    ) : (
                      <Badge tone="ok">LIVRE</Badge>
                    )}
                  </div>

                  {status === 'Em uso' ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div className="small">
                        <strong style={{ color: 'var(--text)' }}>Usuário:</strong> {userName}
                      </div>
                      <div className="small">
                        <strong style={{ color: 'var(--text)' }}>Saída:</strong> {open.start_value} {unit}
                      </div>
                      <div className="small">
                        <strong style={{ color: 'var(--text)' }}>Destino:</strong> {destino}
                      </div>
                      <div className="small">
                        <strong style={{ color: 'var(--text)' }}>Combustível:</strong> {fuel}
                      </div>
                      <div className="small">
                        <strong style={{ color: 'var(--text)' }}>Data:</strong> {open.date}
                      </div>
                    </div>
                  ) : (
                    <div className="small">Disponível para uso.</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
