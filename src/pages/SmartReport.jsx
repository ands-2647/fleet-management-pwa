import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const box = {
  padding: 20,
  border: '1px solid #ddd',
  borderRadius: 10,
  marginTop: 20
}

const card = {
  background: '#f4f4f4',
  padding: 14,
  borderRadius: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}

const sectionBox = {
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: 16,
  marginTop: 18,
  background: '#fff'
}

const pill = (bg) => ({
  background: bg,
  color: '#111',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700
})

function iso(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function firstDayOfMonth() {
  const now = new Date()
  return iso(new Date(now.getFullYear(), now.getMonth(), 1))
}

function shortLabel(plate, model) {
  const m = (model || '').trim()
  const mShort = m.length > 12 ? m.slice(0, 12) + '…' : m
  return `${plate} — ${mShort}`
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00')
  const b = new Date(dateStrB + 'T00:00:00')
  const diff = b.getTime() - a.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function SmartReport({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [start, setStart] = useState(firstDayOfMonth())
  const [end, setEnd] = useState(iso(new Date()))

  const [vehicles, setVehicles] = useState([])
  const [profiles, setProfiles] = useState([])

  const [driverFuel, setDriverFuel] = useState([])
  const [lastUse, setLastUse] = useState([])
  const [maintStatus, setMaintStatus] = useState([])

  const [idleDays, setIdleDays] = useState(15)

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isManager) return
    fetchBase()
    fetchExtras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  async function fetchBase() {
    setLoading(true)

    const [vehRes, profRes] = await Promise.all([
      supabase.from('vehicles').select('id, plate, model, measurement_type').order('plate'),
      supabase.from('profiles').select('id, name')
    ])

    setLoading(false)

    if (vehRes.error) console.error(vehRes.error)
    if (profRes.error) console.error(profRes.error)

    setVehicles(vehRes.data || [])
    setProfiles(profRes.data || [])
  }

  async function fetchExtras() {
    setLoading(true)

    const [driverRes, lastUseRes, maintRes] = await Promise.all([
      supabase
        .from('v_driver_fuel_month')
        .select('user_id, total_fuel_spend, fuel_events')
        .order('total_fuel_spend', { ascending: false }),

      supabase
        .from('v_vehicle_last_use')
        .select('vehicle_id, last_use_date'),

      // ✅ aqui usamos a view nova baseada em KM/H
      supabase
        .from('v_vehicle_maintenance_status')
        .select('vehicle_id, status, remaining, last_value, interval_value')
    ])

    setLoading(false)

    if (driverRes.error) console.error(driverRes.error)
    if (lastUseRes.error) console.error(lastUseRes.error)
    if (maintRes.error) console.error(maintRes.error)

    setDriverFuel(driverRes.data || [])
    setLastUse(lastUseRes.data || [])
    setMaintStatus(maintRes.data || [])
  }

  const vehicleById = useMemo(() => {
    const map = {}
    for (const v of vehicles) map[v.id] = v
    return map
  }, [vehicles])

  const profileNameById = useMemo(() => {
    const map = {}
    for (const p of profiles) map[p.id] = p.name
    return map
  }, [profiles])

  // ===== Veículos parados =====
  const idleVehicles = useMemo(() => {
    const today = iso(new Date())

    return (lastUse || [])
      .map(x => {
        const v = vehicleById[x.vehicle_id]
        const label = v ? shortLabel(v.plate, v.model) : x.vehicle_id.slice(0, 8)

        const last = x.last_use_date
        const idle = last ? daysBetween(last, today) : 9999

        return { vehicle_id: x.vehicle_id, label, last_use_date: last, idle_days: idle }
      })
      .filter(x => x.idle_days >= Number(idleDays))
      .sort((a, b) => b.idle_days - a.idle_days)
      .slice(0, 10)
  }, [lastUse, vehicleById, idleDays])

  // ===== Manutenção (vencida/vencendo) =====
  const maintList = useMemo(() => {
    return (maintStatus || [])
      .map(x => {
        const v = vehicleById[x.vehicle_id]
        const label = v ? shortLabel(v.plate, v.model) : x.vehicle_id.slice(0, 8)
        return { ...x, label }
      })
      .filter(x => x.status === 'vencida' || x.status === 'vencendo')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'vencida' ? -1 : 1
        return Number(a.remaining || 0) - Number(b.remaining || 0)
      })
      .slice(0, 10)
  }, [maintStatus, vehicleById])

  // ===== Top motoristas =====
  const topDrivers = useMemo(() => {
    return (driverFuel || [])
      .slice(0, 5)
      .map(x => ({
        user_id: x.user_id,
        name: profileNameById[x.user_id] || x.user_id.slice(0, 8),
        gasto: Number(Number(x.total_fuel_spend || 0).toFixed(2)),
        eventos: Number(x.fuel_events || 0)
      }))
  }, [driverFuel, profileNameById])

  if (!isManager) return null

  return (
    <div style={box}>
      <h2>Relatórios Inteligentes — Extras</h2>

      <button onClick={fetchExtras} disabled={loading}>
        {loading ? 'Atualizando...' : 'Atualizar dados'}
      </button>

      {/* VEÍCULOS PARADOS */}
      <div style={sectionBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Veículos parados</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#555' }}>Parado há</span>
            <input
              type="number"
              value={idleDays}
              onChange={e => setIdleDays(e.target.value)}
              style={{ width: 70 }}
            />
            <span style={{ fontSize: 13, color: '#555' }}>dias</span>
          </div>
        </div>

        {idleVehicles.length === 0 ? (
          <p style={{ marginTop: 10 }}>Nenhum veículo parado acima do limite ✅</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {idleVehicles.map(v => (
              <div key={v.vehicle_id} style={card}>
                <strong>{v.label}</strong>
                <span style={{ fontSize: 13, color: '#333' }}>
                  {v.last_use_date ? `${v.idle_days} dias (último: ${v.last_use_date})` : 'Sem uso registrado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MANUTENÇÃO */}
      <div style={sectionBox}>
        <h3 style={{ marginTop: 0 }}>Manutenções (vencidas / vencendo)</h3>

        {maintList.length === 0 ? (
          <p>Sem manutenções críticas ✅</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {maintList.map(m => (
              <div key={m.vehicle_id} style={card}>
                <strong>{m.label}</strong>
                <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={pill(m.status === 'vencida' ? '#ffd6d6' : '#fff2c2')}>
                    {m.status.toUpperCase()}
                  </span>

                  <span style={{ fontSize: 13, color: '#333' }}>
                    Faltam: <strong>{Number(m.remaining || 0).toFixed(0)}</strong> (meta: {Number(m.interval_value || 0).toFixed(0)})
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TOP MOTORISTAS */}
      <div style={sectionBox}>
        <h3 style={{ marginTop: 0 }}>Top motoristas — combustível (mês atual)</h3>

        {topDrivers.length === 0 ? (
          <p>Sem abastecimentos neste mês.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {topDrivers.map((d, idx) => (
              <div key={d.user_id} style={card}>
                <strong>{idx + 1}. {d.name}</strong>
                <span>R$ {d.gasto.toFixed(2)} ({d.eventos}x)</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: '#666', marginTop: 10 }}>
          *Ranking baseado em <strong>fuel_logs</strong> do mês atual.
        </p>
      </div>
    </div>
  )
}
