import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

import Section from '../components/ui/Section'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

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

function cardRowStyle() {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: '#0C0D0F'
  }
}

export default function SmartReport({ profile }) {
  const isManager = profile?.role !== 'motorista'

  // (mantido caso queira filtro por período no futuro)
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
      supabase
        .from('vehicles')
        .select('id, plate, model, measurement_type')
        .order('plate'),
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

      supabase.from('v_vehicle_last_use').select('vehicle_id, last_use_date'),

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
      .map((x) => {
        const v = vehicleById[x.vehicle_id]
        const label = v
          ? shortLabel(v.plate, v.model)
          : x.vehicle_id.slice(0, 8)

        const last = x.last_use_date
        const idle = last ? daysBetween(last, today) : 9999

        return {
          vehicle_id: x.vehicle_id,
          label,
          last_use_date: last,
          idle_days: idle
        }
      })
      .filter((x) => x.idle_days >= Number(idleDays))
      .sort((a, b) => b.idle_days - a.idle_days)
      .slice(0, 10)
  }, [lastUse, vehicleById, idleDays])

  // ===== Manutenção (vencida/vencendo) =====
  const maintList = useMemo(() => {
    return (maintStatus || [])
      .map((x) => {
        const v = vehicleById[x.vehicle_id]
        const label = v
          ? shortLabel(v.plate, v.model)
          : x.vehicle_id.slice(0, 8)
        return { ...x, label }
      })
      .filter((x) => x.status === 'vencida' || x.status === 'vencendo')
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
      .map((x) => ({
        user_id: x.user_id,
        name: profileNameById[x.user_id] || x.user_id.slice(0, 8),
        gasto: Number(Number(x.total_fuel_spend || 0).toFixed(2)),
        eventos: Number(x.fuel_events || 0)
      }))
  }, [driverFuel, profileNameById])

  if (!isManager) return null

  const headerRight = (
    <Button variant="ghost" onClick={fetchExtras} disabled={loading}>
      {loading ? 'Atualizando...' : 'Atualizar dados'}
    </Button>
  )

  return (
    <Section title="Relatórios Inteligentes — Extras" right={headerRight}>
      {/* VEÍCULOS PARADOS */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <h3 style={{ margin: 0 }}>Veículos parados</h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="small">Parado há</span>
            <input
              type="number"
              value={idleDays}
              onChange={(e) => setIdleDays(e.target.value)}
              style={{ width: 86 }}
            />
            <span className="small">dias</span>
          </div>
        </div>

        {idleVehicles.length === 0 ? (
          <div style={cardRowStyle()}>
            <div>
              <strong>Nenhum veículo acima do limite</strong>
              <div className="small">Tudo ok ✅</div>
            </div>
            <Badge tone="ok">OK</Badge>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {idleVehicles.map((v) => (
              <div key={v.vehicle_id} style={cardRowStyle()}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong>{v.label}</strong>
                  <div className="small">
                    {v.last_use_date
                      ? `Último uso: ${v.last_use_date}`
                      : 'Sem uso registrado'}
                  </div>
                </div>

                <Badge tone="warn">{v.idle_days} dias</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hr" />

      {/* MANUTENÇÃO */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Manutenções críticas</h3>
          <div className="small">vencidas / vencendo</div>
        </div>

        {maintList.length === 0 ? (
          <div style={cardRowStyle()}>
            <div>
              <strong>Sem manutenções críticas</strong>
              <div className="small">Tudo ok ✅</div>
            </div>
            <Badge tone="ok">OK</Badge>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {maintList.map((m) => {
              const tone = m.status === 'vencida' ? 'danger' : 'warn'
              const label = m.status === 'vencida' ? 'VENCIDA' : 'VENCENDO'

              return (
                <div key={m.vehicle_id} style={cardRowStyle()}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>{m.label}</strong>
                    <div className="small">
                      Faltam{' '}
                      <strong style={{ color: 'var(--text)' }}>
                        {Number(m.remaining || 0).toFixed(0)}
                      </strong>{' '}
                      (meta:{' '}
                      {Number(m.interval_value || 0).toFixed(0)})
                    </div>
                  </div>

                  <Badge tone={tone}>{label}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="hr" />

      {/* TOP MOTORISTAS */}
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Top motoristas — combustível</h3>
          <Badge tone="brand">Mês atual</Badge>
        </div>

        {topDrivers.length === 0 ? (
          <div style={cardRowStyle()}>
            <div>
              <strong>Sem abastecimentos no mês</strong>
              <div className="small">Nenhum registro em fuel_logs</div>
            </div>
            <Badge tone="neutral">—</Badge>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {topDrivers.map((d, idx) => (
              <div key={d.user_id} style={cardRowStyle()}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong>
                    {idx + 1}. {d.name}
                  </strong>
                  <div className="small">{d.eventos} abastecimento(s)</div>
                </div>

                <Badge tone="brand">R$ {d.gasto.toFixed(2)}</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="small">
          *Ranking baseado em <strong style={{ color: 'var(--text)' }}>fuel_logs</strong> do mês atual.
        </div>
      </div>
    </Section>
  )
}