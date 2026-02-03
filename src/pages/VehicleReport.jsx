import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

import logo from '../assets/logo.png'

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

function formatBRDateTime(date = new Date()) {
  // simples e consistente
  const pad = n => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export default function VehicleReport({ profile }) {
  const isManager = profile?.role !== 'motorista'
  const printRef = useRef(null)

  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [vehicle, setVehicle] = useState(null)

  const [rangeType, setRangeType] = useState('last_30')
  const [monthBase, setMonthBase] = useState(startOfMonthISO())
  const [customStart, setCustomStart] = useState(
    isoDate(new Date(Date.now() - 6 * 86400000))
  )
  const [customEnd, setCustomEnd] = useState(isoDate(new Date()))

  const [daily, setDaily] = useState([])
  const [maintLogs, setMaintLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const generatedAt = useMemo(() => formatBRDateTime(new Date()), [])

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
      .select(
        'vehicle_id, day, usage_total, trips_finished, fuel_spend, fuel_events'
      )
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
    const trips = daily.reduce(
      (acc, r) => acc + Number(r.trips_finished || 0),
      0
    )
    const costPerUnit = usage > 0 ? fuel / usage : 0
    return { fuel, usage, events, trips, costPerUnit }
  }, [daily])

  const chartFuel = useMemo(() => {
    return daily.map(r => ({
      name: r.day.slice(5),
      gasto: Number(Number(r.fuel_spend || 0).toFixed(2))
    }))
  }, [daily])

  const chartUsage = useMemo(() => {
    return daily.map(r => ({
      name: r.day.slice(5),
      uso: Number(Number(r.usage_total || 0).toFixed(2))
    }))
  }, [daily])

  function handlePrint() {
  if (!printRef.current) return

  const logoUrl = logo // aqui é a URL resolvida pelo Vite

  const css = `
    body { font-family: Arial, sans-serif; padding: 24px; }
    h2, h3 { margin: 0 0 10px 0; }
    .muted { color: #555; font-size: 13px; }
    .cards { display: grid; gap: 10px; margin-top: 16px; }
    .card { background: #f4f4f4; padding: 12px; border-radius: 8px; display:flex; justify-content:space-between; align-items:center; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px; }
    th { text-align: left; }
    .right { text-align: right; }
    .header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 14px; }
    .header-left { display:flex; align-items:center; gap:12px; }
    .logo { width: 64px; height: 64px; object-fit: contain; }
    .company { font-weight: 800; font-size: 18px; }
    .doc { font-size: 12px; color:#555; text-align:right; line-height: 1.4; }
    .sign { margin-top: 26px; display:grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color:#555; }
    @page { margin: 14mm; }
  `

  // IMPORTANTE: injeta logoUrl aqui
  const html = `
    <html>
      <head>
        <title>Relatório por veículo - MS Silos e Secadores</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img class="logo" src="${logoUrl}" alt="Logo MS" />
            <div>
              <div class="company">MS Silos e Secadores</div>
              <div class="muted">Relatório por veículo</div>
            </div>
          </div>
          <div class="doc">
            <div><strong>Gerado em:</strong> ${generatedAt}</div>
            <div><strong>Período:</strong> ${start} até ${end}</div>
            <div><strong>Veículo:</strong> ${vehicle?.plate} — ${vehicle?.model}</div>
          </div>
        </div>

        ${printRef.current.innerHTML}
        <div class="sign">
          <div class="line">Assinatura do Gestor</div>
          <div class="line">Assinatura do Motorista</div>
        </div>
      </body>
    </html>
  `

  const w = window.open('', '_blank')
  if (!w) {
    alert('O navegador bloqueou a nova aba. Permita pop-ups para imprimir.')
    return
  }

  w.document.open()
  w.document.write(html)
  w.document.close()

  w.focus()
  setTimeout(() => {
    w.print()
    w.close()
  }, 300)
}


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
      <h2>Relatório por veículo</h2>

      {/* CONTROLES */}
      <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
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
          <input
            type="date"
            value={monthBase}
            onChange={e => setMonthBase(e.target.value)}
          />
        )}

        {rangeType === 'custom' && (
          <div
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: '1fr 1fr'
            }}
          >
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        <div style={{ fontSize: 13, color: '#555' }}>
          Período ativo: <strong>{start}</strong> até <strong>{end}</strong>
        </div>

        <button onClick={handlePrint} disabled={!vehicleId || loading}>
          Imprimir / Salvar PDF (somente relatório)
        </button>
      </div>

      {!vehicleId ? (
        <p style={{ marginTop: 10 }}>Selecione um veículo para gerar o relatório.</p>
      ) : loading ? (
        <p style={{ marginTop: 10 }}>Carregando...</p>
      ) : (
        <div ref={printRef} style={{ marginTop: 16 }}>
          {/* CABEÇALHO DO DOCUMENTO */}
          <div className="header">
            <div className="header-left">
              <img className="logo" src="${logo}" alt="Logo" />
              <div>
                <div className="company">MS Silos e Secadores</div>
                <div className="muted">Relatório por veículo</div>
              </div>
            </div>

            <div className="doc">
              <div><strong>Gerado em:</strong> ${generatedAt}</div>
              <div><strong>Período:</strong> ${start} até ${end}</div>
              <div><strong>Veículo:</strong> ${vehicle?.plate} — ${vehicle?.model}</div>
            </div>
          </div>

          <h3 style={{ margin: 0 }}>
            {vehicle?.plate} — {vehicle?.model}
          </h3>
          <div className="muted" style={{ marginTop: 6 }}>
            Tipo: <strong>{vehicle?.type || '—'}</strong> • Medição:{' '}
            <strong>{unitLabel(vehicle?.measurement_type)}</strong>
          </div>

          {vehicle?.notes && (
            <div className="muted" style={{ marginTop: 6 }}>
              Observações: {vehicle.notes}
            </div>
          )}

          <div className="cards" style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div className="card" style={card}>
              <strong>Gasto combustível (R$)</strong>
              <span>{totals.fuel.toFixed(2)}</span>
            </div>
            <div className="card" style={card}>
              <strong>Uso total ({unitLabel(vehicle?.measurement_type)})</strong>
              <span>{totals.usage.toFixed(2)}</span>
            </div>
            <div className="card" style={card}>
              <strong>Abastecimentos</strong>
              <span>{totals.events}</span>
            </div>
            <div className="card" style={card}>
              <strong>Viagens finalizadas</strong>
              <span>{totals.trips}</span>
            </div>
            <div className="card" style={card}>
              <strong>Custo médio (R$ por {unitLabel(vehicle?.measurement_type)})</strong>
              <span>{totals.usage > 0 ? totals.costPerUnit.toFixed(2) : '—'}</span>
            </div>
          </div>

          <h3 style={{ marginTop: 18 }}>Gasto por dia (R$)</h3>
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

          <h3 style={{ marginTop: 18 }}>
            Uso por dia ({unitLabel(vehicle?.measurement_type)})
          </h3>
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

          <h3 style={{ marginTop: 18 }}>Detalhado por dia</h3>
          {daily.length === 0 ? (
            <p>Sem registros no período.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th className="right">Uso</th>
                  <th className="right">Viagens</th>
                  <th className="right">Abastecimentos</th>
                  <th className="right">Gasto (R$)</th>
                </tr>
              </thead>
              <tbody>
                {daily.map(r => (
                  <tr key={r.day}>
                    <td>{r.day}</td>
                    <td className="right">{Number(r.usage_total || 0).toFixed(2)}</td>
                    <td className="right">{r.trips_finished || 0}</td>
                    <td className="right">{r.fuel_events || 0}</td>
                    <td className="right">{Number(r.fuel_spend || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 style={{ marginTop: 18 }}>Manutenções no período</h3>
          {maintLogs.length === 0 ? (
            <p>Nenhuma manutenção registrada no período.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th className="right">Valor</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {maintLogs.map(m => (
                  <tr key={m.id}>
                    <td>{m.performed_at}</td>
                    <td className="right">{Number(m.value_at_service).toFixed(0)}</td>
                    <td>{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Assinaturas */}
          <div className="sign">
            <div className="line">Assinatura do Gestor</div>
            <div className="line">Assinatura do Motorista</div>
          </div>
        </div>
      )}
    </div>
  )
}
