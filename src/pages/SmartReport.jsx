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

function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10)
}

function startOfMonthISO(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonthISO(date = new Date()) {
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export default function SmartReport({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [rangeType, setRangeType] = useState('last_30') // last_7 | last_30 | month | custom
  const [monthBase, setMonthBase] = useState(startOfMonthISO()) // usado quando rangeType = month
  const [customStart, setCustomStart] = useState(isoDate(new Date(Date.now() - 6 * 86400000)))
  const [customEnd, setCustomEnd] = useState(isoDate(new Date()))

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const { start, end } = useMemo(() => {
    const today = new Date()
    if (rangeType === 'last_7') {
      return {
        start: isoDate(new Date(Date.now() - 6 * 86400000)),
        end: isoDate(today)
      }
    }
    if (rangeType === 'last_30') {
      return {
        start: isoDate(new Date(Date.now() - 29 * 86400000)),
        end: isoDate(today)
      }
    }
    if (rangeType === 'month') {
      const base = new Date(monthBase)
      return {
        start: startOfMonthISO(base),
        end: endOfMonthISO(base)
      }
    }
    // custom
    return { start: customStart, end: customEnd }
  }, [rangeType, monthBase, customStart, customEnd])

  useEffect(() => {
    if (!isManager) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, isManager])

  async function fetchData() {
    setLoading(true)

    const { data, error } = await supabase
      .from('v_vehicle_daily_kpis')
      .select(
        'vehicle_id, plate, model, type, measurement_type, day, fuel_spend, fuel_events, usage_total, trips_finished'
      )
      .gte('day', start)
      .lte('day', end)
      .order('day', { ascending: true })

    if (error) {
      console.error(error)
      setRows([])
    } else {
      setRows(data || [])
    }

    setLoading(false)
  }

  // Agrupa por veículo (somando dentro do período)
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
    return Array.from(map.values()).sort((a, b) => b.fuel_spend - a.fuel_spend)
  }, [rows])

  const totals = useMemo(() => {
    const fuel = byVehicle.reduce((acc, r) => acc + r.fuel_spend, 0)
    const events = byVehicle.reduce((acc, r) => acc + r.fuel_events, 0)
    const usage = byVehicle.reduce((acc, r) => acc + r.usage_total, 0)
    const trips = byVehicle.reduce((acc, r) => acc + r.trips_finished, 0)
    const costPerUnit = usage > 0 ? fuel / usage : 0
    return { fuel, events, usage, trips, costPerUnit }
  }, [byVehicle])

  const chartFuel = useMemo(
    () =>
      byVehicle.map(r => ({
        name: r.plate,
        gasto: Number(r.fuel_spend.toFixed(2))
      })),
    [byVehicle]
  )

  const chartUsage = useMemo(
    () =>
      byVehicle.map(r => ({
        name: r.plate,
        uso: Number(r.usage_total.toFixed(2))
      })),
    [byVehicle]
  )

  function labelMedicao(measurementType) {
    return measurementType === 'hours' ? 'Hora' : 'KM'
  }

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

        <select
          value={rangeType}
          onChange={e => setRangeType(e.target.value)}
        >
          <option value="last_7">Últimos 7 dias</option>
          <option value="last_30">Últimos 30 dias</option>
          <option value="month">Mês (selecionar)</option>
          <option value="custom">Personalizado</option>
        </select>

        {rangeType === 'month' && (
          <>
            <label style={{ fontSize: 13, color: '#555' }}>Escolha um dia do mês</label>
            <input
              type="date"
              value={monthBase}
              onChange={e => setMonthBase(e.target.value)}
            />
          </>
        )}

        {rangeType === 'custom' && (
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label style={{ fontSize: 13, color: '#555' }}>Início</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, color: '#555' }}>Fim</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
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
              <span>
                {totals.usage > 0 ? totals.costPerUnit.toFixed(2) : '—'}
              </span>
            </div>
          </div>

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

          <h3 style={{ marginTop: 24 }}>Tabela detalhada</h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: 8
              }}
            >
              <thead>
                <tr>
                  {[
                    'Placa',
                    'Modelo',
                    'Tipo',
                    'Medição',
                    'Gasto (R$)',
                    'Abastec.',
                    'Uso',
                    'Viagens',
                    'R$/KM(H)'
                  ].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        borderBottom: '1px solid #ddd',
                        padding: 8,
                        fontSize: 13
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byVehicle.map(r => {
                  const unit = labelMedicao(r.measurement_type)
                  const cost = r.usage_total > 0 ? r.fuel_spend / r.usage_total : null
                  return (
                    <tr key={r.vehicle_id}>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.plate}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.model}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.type || '—'}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{unit}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.fuel_spend.toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.fuel_events}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.usage_total.toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.trips_finished}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                        {cost !== null ? cost.toFixed(2) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
