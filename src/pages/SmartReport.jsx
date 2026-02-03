import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

const card = {
  background: '#f4f4f4',
  padding: 16,
  borderRadius: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 16
}

const alertBox = {
  border: '1px solid #ffd18b',
  background: '#fff7e6',
  borderRadius: 10,
  padding: 12
}

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function startOfMonthISO(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonthISO(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function hoursDiffFromNow(dateISO) {
  const ms = Date.now() - new Date(dateISO).getTime()
  return ms / 1000 / 60 / 60
}

export default function SmartReport({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const OPEN_USAGE_ALERT_HOURS = 24
  const HIGH_COST_THRESHOLD = 2.5

  const [rangeType, setRangeType] = useState('last_30')
  const [monthBase, setMonthBase] = useState(startOfMonthISO())
  const [customStart, setCustomStart] = useState(
    isoDate(new Date(Date.now() - 6 * 86400000))
  )
  const [customEnd, setCustomEnd] = useState(isoDate(new Date()))

  const [rows, setRows] = useState([])
  const [openUsages, setOpenUsages] = useState([])
  const [userRows, setUserRows] = useState([])
  const [loading, setLoading] = useState(true)

  const { start, end } = useMemo(() => {
    const today = new Date()
    if (rangeType === 'last_7') {
      return { start: isoDate(new Date(Date.now() - 6 * 86400000)), end: isoDate(today) }
    }
    if (rangeType === 'last_30') {
      return { start: isoDate(new Date(Date.now() - 29 * 86400000)), end: isoDate(today) }
    }
    if (rangeType === 'month') {
      const base = new Date(monthBase)
      return { start: startOfMonthISO(base), end: endOfMonthISO(base) }
    }
    return { start: customStart, end: customEnd }
  }, [rangeType, monthBase, customStart, customEnd])

  useEffect(() => {
    if (!isManager) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, isManager])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchDailyKpis(), fetchOpenUsages(), fetchUserKpis()])
    setLoading(false)
  }

  async function fetchDailyKpis() {
    const { data, error } = await supabase
      .from('v_vehicle_daily_kpis')
      .select(
        'vehicle_id, plate, model, type, measurement_type, day, fuel_spend, fuel_events, usage_total, trips_finished'
      )
      .gte('day', start)
      .lte('day', end)
      .order('day', { ascending: true })

    if (error) {
      console.error('v_vehicle_daily_kpis error:', error)
      setRows([])
    } else {
      setRows(data || [])
    }
  }

  async function fetchUserKpis() {
    const { data, error } = await supabase
      .from('v_user_daily_kpis')
      .select('user_id, name, role, day, fuel_spend, fuel_events, usage_total, trips_finished')
      .gte('day', start)
      .lte('day', end)
      .order('day', { ascending: true })

    if (error) {
      console.error('v_user_daily_kpis error:', error)
      setUserRows([])
    } else {
      setUserRows(data || [])
    }
  }

  async function fetchOpenUsages() {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('id, vehicle_id, user_id, date, start_value, created_at')
      .is('end_value', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('open usage error:', error)
      setOpenUsages([])
      return
    }

    const open = data || []
    const userIds = [...new Set(open.map(u => u.user_id).filter(Boolean))]

    let profilesMap = {}
    if (userIds.length > 0) {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('id', userIds)

      if (profErr) {
        console.error('profiles map error:', profErr)
      } else {
        profilesMap = Object.fromEntries((prof || []).map(p => [p.id, p]))
      }
    }

    setOpenUsages(open.map(u => ({ ...u, profile: profilesMap[u.user_id] || null })))
  }

  const byVehicle = useMemo(() => {
    const map = new Map()
    for (const r of rows) {
      const key = r.vehicle_id
      if (!map.has(key)) {
        map.set(key, {
          vehicle_id: r.vehicle_id,
          plate: r.plate,
          model: r.model,
          type: r.type,
          measurement_type: r.measurement_type,
          fuel_spend: 0,
          fuel_events: 0,
          usage_total: 0,
          trips_finished: 0
        })
      }
      const agg = map.get(key)
      agg.fuel_spend += Number(r.fuel_spend || 0)
      agg.fuel_events += Number(r.fuel_events || 0)
      agg.usage_total += Number(r.usage_total || 0)
      agg.trips_finished += Number(r.trips_finished || 0)
    }
    return Array.from(map.values())
  }, [rows])

  const byUser = useMemo(() => {
    const map = new Map()
    for (const r of userRows) {
      const key = r.user_id
      if (!key) continue
      if (!map.has(key)) {
        map.set(key, {
          user_id: r.user_id,
          name: r.name || 'Usuário',
          role: r.role || '—',
          fuel_spend: 0,
          fuel_events: 0,
          usage_total: 0,
          trips_finished: 0
        })
      }
      const agg = map.get(key)
      agg.fuel_spend += Number(r.fuel_spend || 0)
      agg.fuel_events += Number(r.fuel_events || 0)
      agg.usage_total += Number(r.usage_total || 0)
      agg.trips_finished += Number(r.trips_finished || 0)
    }
    return Array.from(map.values())
  }, [userRows])

  const totals = useMemo(() => {
    const fuel = byVehicle.reduce((acc, r) => acc + r.fuel_spend, 0)
    const events = byVehicle.reduce((acc, r) => acc + r.fuel_events, 0)
    const usage = byVehicle.reduce((acc, r) => acc + r.usage_total, 0)
    const trips = byVehicle.reduce((acc, r) => acc + r.trips_finished, 0)
    const costPerUnit = usage > 0 ? fuel / usage : 0
    return { fuel, events, usage, trips, costPerUnit }
  }, [byVehicle])

  const top5Fuel = useMemo(
    () => [...byVehicle].sort((a, b) => b.fuel_spend - a.fuel_spend).slice(0, 5),
    [byVehicle]
  )

  const top5Usage = useMemo(
    () => [...byVehicle].sort((a, b) => b.usage_total - a.usage_total).slice(0, 5),
    [byVehicle]
  )

  const top5DriversUsage = useMemo(
    () => [...byUser].sort((a, b) => b.usage_total - a.usage_total).slice(0, 5),
    [byUser]
  )

  const top5DriversFuel = useMemo(
    () => [...byUser].sort((a, b) => b.fuel_spend - a.fuel_spend).slice(0, 5),
    [byUser]
  )

  const top5DriversEvents = useMemo(
    () => [...byUser].sort((a, b) => b.fuel_events - a.fuel_events).slice(0, 5),
    [byUser]
  )

  const chartFuel = useMemo(() => {
    return [...byVehicle]
      .sort((a, b) => b.fuel_spend - a.fuel_spend)
      .map(r => ({ name: r.plate, gasto: Number(r.fuel_spend.toFixed(2)) }))
  }, [byVehicle])

  const chartUsage = useMemo(() => {
    return [...byVehicle]
      .sort((a, b) => b.usage_total - a.usage_total)
      .map(r => ({ name: r.plate, uso: Number(r.usage_total.toFixed(2)) }))
  }, [byVehicle])

  function labelMedicao(measurementType) {
    return measurementType === 'hours' ? 'Hora' : 'KM'
  }

  const alerts = useMemo(() => {
    const a = []

    for (const u of openUsages) {
      const h = hoursDiffFromNow(u.created_at)
      if (h >= OPEN_USAGE_ALERT_HOURS) {
        const who = u.profile?.name ? `${u.profile.name}` : 'Usuário'
        a.push({
          type: 'Uso aberto',
          message: `Uso aberto há ${Math.floor(h)}h. ${who} — saída ${u.start_value} em ${u.date}.`
        })
      }
    }

    for (const v of byVehicle) {
      if (v.fuel_events > 0 && v.trips_finished === 0) {
        a.push({
          type: 'Possível falta de registro',
          message: `${v.plate}: abasteceu no período, mas 0 viagens finalizadas. Pode ter faltado registrar chegada.`
        })
      }
    }

    for (const v of byVehicle) {
      if (v.trips_finished > 0 && v.fuel_events === 0) {
        a.push({
          type: 'Sem abastecimento',
          message: `${v.plate}: teve uso no período, mas nenhum abastecimento registrado.`
        })
      }
    }

    for (const v of byVehicle) {
      if (v.usage_total > 0) {
        const cost = v.fuel_spend / v.usage_total
        if (cost >= HIGH_COST_THRESHOLD) {
          const unit = labelMedicao(v.measurement_type)
          a.push({
            type: 'Custo alto',
            message: `${v.plate}: ${cost.toFixed(2)} R$/${unit} no período (>= ${HIGH_COST_THRESHOLD}).`
          })
        }
      }
    }

    return a
  }, [openUsages, byVehicle])

  if (!isManager) {
    return (
      <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Relatórios</h2>
        <p>Relatórios completos disponíveis apenas para gestor/gerente/diretor.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Relatórios inteligentes</h2>

      <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Período</label>

        <select value={rangeType} onChange={e => setRangeType(e.target.value)}>
          <option value="last_7">Últimos 7 dias</option>
          <option value="last_30">Últimos 30 dias</option>
          <option value="month">Mês (selecionar)</option>
          <option value="custom">Personalizado</option>
        </select>

        {rangeType === 'month' && (
          <>
            <label style={{ fontSize: 13, color: '#555' }}>Escolha um dia do mês</label>
            <input type="date" value={monthBase} onChange={e => setMonthBase(e.target.value)} />
          </>
        )}

        {rangeType === 'custom' && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ fontSize: 13, color: '#555' }}>Início</label>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: '#555' }}>Fim</label>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: '#555' }}>
          Período ativo: <strong>{start}</strong> até <strong>{end}</strong>
        </div>
      </div>

      {loading ? (
        <p style={{ marginTop: 12 }}>Carregando...</p>
      ) : (
        <>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <div style={card}>
              <strong>Gasto total combustível (R$)</strong>
              <span>{totals.fuel.toFixed(2)}</span>
            </div>

            <div style={card}>
              <strong>Abastecimentos no período</strong>
              <span>{totals.events}</span>
            </div>

            <div style={card}>
              <strong>Uso total (KM/Horas)</strong>
              <span>{totals.usage.toFixed(2)}</span>
            </div>

            <div style={card}>
              <strong>Viagens finalizadas</strong>
              <span>{totals.trips}</span>
            </div>

            <div style={card}>
              <strong>Custo estimado (R$ por KM/Hora)</strong>
              <span>{totals.usage > 0 ? totals.costPerUnit.toFixed(2) : '—'}</span>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Top 5 veículos por gasto</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {top5Fuel.map(v => (
              <div key={v.vehicle_id} style={card}>
                <strong>{v.plate} — {v.model}</strong>
                <span>R$ {v.fuel_spend.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Top 5 veículos por uso (KM/Horas)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {top5Usage.map(v => (
              <div key={v.vehicle_id} style={card}>
                <strong>{v.plate} — {v.model}</strong>
                <span>{v.usage_total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 24 }}>Top motoristas (período)</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={alertBox}>
              <strong>Top 5 por uso (KM/Horas)</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {top5DriversUsage.map(u => (
                  <div key={u.user_id} style={card}>
                    <strong>{u.name}</strong>
                    <span>{u.usage_total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={alertBox}>
              <strong>Top 5 por gasto em combustível (R$)</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {top5DriversFuel.map(u => (
                  <div key={u.user_id} style={card}>
                    <strong>{u.name}</strong>
                    <span>R$ {u.fuel_spend.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={alertBox}>
              <strong>Top 5 por número de abastecimentos</strong>
              <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                {top5DriversEvents.map(u => (
                  <div key={u.user_id} style={card}>
                    <strong>{u.name}</strong>
                    <span>{u.fuel_events}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Alertas</h3>
          {alerts.length === 0 ? (
            <p>Nenhum alerta no momento ✅</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {alerts.map((a, idx) => (
                <div key={idx} style={alertBox}>
                  <strong>{a.type}:</strong> {a.message}
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginTop: 24 }}>Gasto por veículo</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartFuel}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="gasto" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ marginTop: 24 }}>Uso por veículo (KM/Horas)</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartUsage}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="uso" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
