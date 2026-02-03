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

function monthISO(d = new Date()) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1)
  return dt.toISOString().slice(0, 10)
}

export default function SmartReport({ profile }) {
  const [month, setMonth] = useState(monthISO())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const isManager = profile?.role !== 'motorista'

  useEffect(() => {
    if (!isManager) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isManager])

  async function fetchData() {
    setLoading(true)

    const { data, error } = await supabase
      .from('v_vehicle_monthly_kpis')
      .select(
        'vehicle_id, plate, model, type, measurement_type, month, fuel_spend, fuel_events, usage_total, trips_finished'
      )
      .eq('month', month)
      .order('fuel_spend', { ascending: false })

    if (error) {
      console.error(error)
      setRows([])
    } else {
      setRows(data || [])
    }

    setLoading(false)
  }

  const totals = useMemo(() => {
    const fuel = rows.reduce((acc, r) => acc + Number(r.fuel_spend || 0), 0)
    const events = rows.reduce((acc, r) => acc + Number(r.fuel_events || 0), 0)
    const usage = rows.reduce((acc, r) => acc + Number(r.usage_total || 0), 0)
    const trips = rows.reduce((acc, r) => acc + Number(r.trips_finished || 0), 0)
    return { fuel, events, usage, trips }
  }, [rows])

  const chartFuel = useMemo(
    () =>
      rows.map(r => ({
        name: r.plate,
        gasto: Number(r.fuel_spend || 0)
      })),
    [rows]
  )

  const chartUsage = useMemo(
    () =>
      rows.map(r => ({
        name: r.plate,
        uso: Number(r.usage_total || 0)
      })),
    [rows]
  )

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

      <div style={{ display: 'grid', gap: 10, maxWidth: 260 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Mês do relatório</label>
        <input
          type="date"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
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
              <strong>Abastecimentos no mês</strong>
              <span>{totals.events}</span>
            </div>

            <div style={card}>
              <strong>Uso total (KM/Horas)</strong>
              <span>{totals.usage}</span>
            </div>

            <div style={card}>
              <strong>Viagens finalizadas</strong>
              <span>{totals.trips}</span>
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
                  {['Placa', 'Modelo', 'Tipo', 'Gasto (R$)', 'Abastec.', 'Uso', 'Viagens'].map(h => (
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
                {rows.map(r => (
                  <tr key={r.vehicle_id}>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.plate}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.model}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.type || '—'}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                      {Number(r.fuel_spend || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.fuel_events}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.usage_total}</td>
                    <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{r.trips_finished}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
