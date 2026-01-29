import { useEffect, useState } from 'react'
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

export default function Report() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReport()
  }, [])

  async function fetchReport() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, type, measurement_type')

    if (error) {
      console.error(error)
    } else {
      setVehicles(data)
    }

    setLoading(false)
  }

  if (loading) {
    return <p>Carregando relatório...</p>
  }

  const total = vehicles.length

  const byType = vehicles.reduce((acc, v) => {
    acc[v.type] = (acc[v.type] || 0) + 1
    return acc
  }, {})

  const byMeasurement = vehicles.reduce((acc, v) => {
    acc[v.measurement_type] = (acc[v.measurement_type] || 0) + 1
    return acc
  }, {})

  const chartData = Object.entries(byType).map(([type, count]) => ({
  name: type,
  quantidade: count
}))


 return (
  <div style={{ padding: 20 }}>
    <h1>Relatório da Frota</h1>

    <div style={{ display: 'grid', gap: 12 }}>
      <div style={card}>
        <strong>Total de ativos</strong>
        <span>{total}</span>
      </div>

      {Object.entries(byType).map(([type, count]) => (
        <div key={type} style={card}>
          <strong>{type}</strong>
          <span>{count}</span>
        </div>
      ))}

      {Object.entries(byMeasurement).map(([m, count]) => (
        <div key={m} style={card}>
          <strong>
            {m === 'km' ? 'Usam KM' : 'Usam Horas'}
          </strong>
          <span>{count}</span>
        </div>
      ))}
      <h2 style={{ marginTop: 30 }}>Distribuição por tipo</h2>

<div style={{ width: '100%', height: 250 }}>
  <ResponsiveContainer>
    <BarChart data={chartData}>
      <XAxis dataKey="name" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="quantidade" />
    </BarChart>
  </ResponsiveContainer>
</div>

    </div>
  </div>
)
}
