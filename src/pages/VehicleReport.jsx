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

const box = {
  padding: 20,
  border: '1px solid #ddd',
  borderRadius: 10
}

const card = {
  background: '#f4f4f4',
  padding: 14,
  borderRadius: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
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

function unitLabel(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

export default function VehicleReport({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [vehicle, setVehicle] = useState(null)

  const [rangeType, setRangeType] = useState('last_30') // last_7 | last_30 | month | custom
  const [monthBase, setMonthBase] = useState(startOfMonthISO())
  const [customStart, setCustomStart] = useState(
    isoDate(new Date(Date.now() - 6 * 86400000))
  )
  const [customEnd, setCustomEnd] = useState(isoDate(new Date()))

  const [daily, setDaily] = useState([])
  const [maintLogs, setMaintLogs] = useState([])
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
    fetchVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  useEffect(() => {
    if (!vehicleId) {
      setVehicle(null)
      setDaily([])
      setMaintLogs([])
      return
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, start, end])

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model, type, measurement_type')
      .order('plate')

    if (error) {
      console.error(error)
      setVehicles([])
    } else {
      setVehicles(data || [])
    }
  }

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchVehicleInfo(), fetchDaily(), fetchMaintLogs()])
    setLoading(false)
  }

  async function fetchVehicleInfo() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model, type, measurement_type, notes')
      .eq('id', vehicleId)
      .single()

    if (error) {
      console.error(error)
      setVehicle(null)
    } else {
      setVehicle(data)
    }
  }

  async function fetchDaily() {
    const { data, error } = await supabase
      .from('v_vehicle_report_daily')
      .select('vehicle_id, day, usage_total, trips_finished, fuel_spend, fuel_events')
      .eq('vehicle_id', vehicleId)
      .gte('day', start)
      .lte('day', end)
      .order('day', { ascending: true })

    if (error) {
      console.error(error)
      setDaily([])
    } else {
      setDaily(data || [])
    }
  }

  async function fetchMaintLogs() {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('id, performed_at, value_at_service, notes')
      .eq('vehicle_id', vehicleId)
      .gte('performed_at', start)
      .lte('performed_at', end)
      .order('performed_at', { ascending: false })

    if (error) {
      console.error(error)
      setMaintLogs([])
    } else {
      setMaintLogs(data || [])
    }
  }

  const totals = useMemo(() => {
    const fuel = daily.reduce((acc, r) => acc + Number(r.fuel_spend || 0), 0)
    const usage = daily.reduce((acc, r) => acc + Number(r.usage_total || 0), 0)
    const events = daily.reduce((acc, r) => acc + Number(r.fuel_events || 0), 0)
    const trips = daily.reduce((acc, r) => acc + Number(r.trips_finished || 0), 0)
    const costPerUnit = usage > 0 ? fuel / usage : 0
    return { fuel, usage, events, trips, costPerUnit }
  }, [daily])

  const chartFuel = useMemo(() => {
    return daily.map(r => ({ name: r.day.slice(5), gasto: Number(Number(r.fuel_spend || 0).toFixed(2)) }))
  }, [daily])

  const chartUsage = useMemo(() => {
    return daily.map(r => ({ name: r.day.slice(5), uso: Number(Number(r.usage_total || 0).toFixed(2)) }))
  }, [daily])

  if (!isManager) {
    return (
      <div style={box}>
        <h2>Relatório por veículo</h2>
        <p>Somente gestor/gerente/diretor pode gerar relatórios.</p>
      </div>
    )
  }

  return (
    <div style={box}>
      {/* CSS para impressão/PDF */}
      <style>{`
        @media print {
          button, select, input { display: none !important; }
          .no-print { display: none !important; }
          .print-box { border: none !important; padding: 0 !important; }
          .print-break { page-break-before: always; }
        }
      `}</style>

      <div className="print-box">
        <h2>Relatório por veículo</h2>

        <div className="no-print" style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label style={{ fontSize: 13, color: '#555' }}>Veículo</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
            <option value="">Selecione</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.plate} — {v.model}
              </option>
            ))}
          </select>

          <label style={{ fontSize: 13, color: '#555' }}>Período</label>
          <select value={rangeType} onChange={e => setRangeType(e.target.value)}>
            <option value="last_7">Últimos 7 dias</option>
            <option value="last_30">Últimos 30 dias</option>
            <option value="month">Mês (selecionar)</option>
            <option value="custom">Personalizado</option>
          </select>

          {rangeType === 'month' && (
            <input type="date" value={monthBase} onChange={e => setMonthBase(e.target.value)} />
          )}

          {rangeType === 'custom' && (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ fontSize: 13, color: '#555' }}>
            Período ativo: <strong>{start}</strong> até <strong>{end}</strong>
          </div>

          <button onClick={() => window.print()} disabled={!vehicleId}>
            Imprimir / Salvar PDF
          </button>
        </div>

        {!vehicleId ? (
          <p style={{ marginTop: 10 }}>Selecione um veículo para gerar o relatório.</p>
        ) : loading ? (
          <p style={{ marginTop: 10 }}>Carregando...</p>
        ) : (
          <>
            {/* Cabeçalho do relatório */}
            <div style={{ marginTop: 16 }}>
              <h3 style={{ margin: 0 }}>
                {vehicle?.plate} — {vehicle?.model}
              </h3>
              <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                Tipo: <strong>{vehicle?.type || '—'}</strong> • Medição:{' '}
                <strong>{unitLabel(vehicle?.measurement_type)}</strong> •
                Período: <strong>{start}</strong> até <strong>{end}</strong>
              </div>
              {vehicle?.notes && (
                <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                  Observações: {vehicle.notes}
                </div>
              )}
            </div>

            {/* Resumo */}
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              <div style={card}>
                <strong>Gasto combustível (R$)</strong>
                <span>{totals.fuel.toFixed(2)}</span>
              </div>
              <div style={card}>
                <strong>Uso total ({unitLabel(vehicle?.measurement_type)})</strong>
                <span>{totals.usage.toFixed(2)}</span>
              </div>
              <div style={card}>
                <strong>Abastecimentos</strong>
                <span>{totals.events}</span>
              </div>
              <div style={card}>
                <strong>Viagens finalizadas</strong>
                <span>{totals.trips}</span>
              </div>
              <div style={card}>
                <strong>Custo médio (R$ por {unitLabel(vehicle?.measurement_type)})</strong>
                <span>{totals.usage > 0 ? totals.costPerUnit.toFixed(2) : '—'}</span>
              </div>
            </div>

            {/* Gráficos */}
            <h3 style={{ marginTop: 22 }}>Gasto por dia (R$)</h3>
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

            <h3 style={{ marginTop: 22 }}>Uso por dia ({unitLabel(vehicle?.measurement_type)})</h3>
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

            {/* Tabela diária */}
            <h3 style={{ marginTop: 22 }}>Detalhado por dia</h3>
            {daily.length === 0 ? (
              <p>Sem registros no período.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Dia</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
                        Uso ({unitLabel(vehicle?.measurement_type)})
                      </th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Viagens</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Abastecimentos</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>Gasto (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map(r => (
                      <tr key={r.day}>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{r.day}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                          {Number(r.usage_total || 0).toFixed(2)}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                          {r.trips_finished || 0}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                          {r.fuel_events || 0}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                          {Number(r.fuel_spend || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Manutenções no período */}
            <h3 style={{ marginTop: 22 }}>Manutenções no período</h3>
            {maintLogs.length === 0 ? (
              <p>Nenhuma manutenção registrada no período.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Data</th>
                      <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd', padding: 8 }}>
                        Valor ({unitLabel(vehicle?.measurement_type)})
                      </th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintLogs.map(m => (
                      <tr key={m.id}>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{m.performed_at}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8, textAlign: 'right' }}>
                          {Number(m.value_at_service).toFixed(0)}
                        </td>
                        <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                          {m.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
