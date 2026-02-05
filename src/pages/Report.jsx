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

import Section from '../components/ui/Section'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'

function rowCardStyle() {
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

export default function Report() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchReport() {
    setLoading(true)

    const { data, error } = await supabase
      .from('vehicles')
      .select('id, type, measurement_type')

    if (error) {
      console.error(error)
      setVehicles([])
    } else {
      setVehicles(data || [])
    }

    setLoading(false)
  }

  const total = vehicles.length

  const byType = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      const key = v.type || 'sem tipo'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [vehicles])

  const byMeasurement = useMemo(() => {
    return vehicles.reduce((acc, v) => {
      const key = v.measurement_type || 'indefinido'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  }, [vehicles])

  const chartData = useMemo(() => {
    return Object.entries(byType).map(([type, count]) => ({
      name: type,
      quantidade: count
    }))
  }, [byType])

  const headerRight = (
    <Button variant="ghost" onClick={fetchReport} disabled={loading}>
      {loading ? 'Atualizando...' : 'Atualizar'}
    </Button>
  )

  if (loading) {
    return (
      <Section title="Relatório da Frota" right={headerRight}>
        <p>Carregando relatório...</p>
      </Section>
    )
  }

  return (
    <Section title="Relatório da Frota" right={headerRight}>
      {/* 🔥 CARIMBO PARA PROVAR QUE É O ARQUIVO NOVO */}
      <div style={{ marginBottom: 10 }}>
        <Badge tone="brand">REPORT v2 (dark)</Badge>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {/* Total */}
        <div style={rowCardStyle()}>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong>Total de ativos</strong>
            <div className="small">Veículos cadastrados</div>
          </div>
          <Badge tone="brand">{total}</Badge>
        </div>

        {/* Por tipo */}
        <div className="hr" />
        <h3 style={{ margin: 0 }}>Por tipo</h3>

        {Object.entries(byType).length === 0 ? (
          <div style={rowCardStyle()}>
            <strong>Nenhum dado</strong>
            <Badge tone="neutral">—</Badge>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} style={rowCardStyle()}>
                <strong style={{ textTransform: 'capitalize' }}>{type}</strong>
                <Badge tone="neutral">{count}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Por medição */}
        <div className="hr" />
        <h3 style={{ margin: 0 }}>Por medição</h3>

        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(byMeasurement).map(([m, count]) => {
            const label =
              m === 'km'
                ? 'Usam KM'
                : m === 'hours'
                ? 'Usam Horas'
                : `Medição: ${m}`

            return (
              <div key={m} style={rowCardStyle()}>
                <strong>{label}</strong>
                <Badge tone="neutral">{count}</Badge>
              </div>
            )
          })}
        </div>

        {/* Gráfico */}
        <div className="hr" />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10
          }}
        >
          <h3 style={{ margin: 0 }}>Distribuição por tipo</h3>
          <span className="small">Barras</span>
        </div>

        <div
          style={{
            width: '100%',
            height: 260,
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: '#0C0D0F',
            padding: 10
          }}
        >
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fill: 'var(--muted)' }} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)' }} />
              <Tooltip
                contentStyle={{
                  background: '#0C0D0F',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)'
                }}
                labelStyle={{ color: 'var(--muted)' }}
              />
              <Bar dataKey="quantidade" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  )
}