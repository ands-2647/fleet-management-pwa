import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function labelUnit(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

export default function RegisterReturn({ user }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [endValue, setEndValue] = useState('')
  const [openUsage, setOpenUsage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchVehicles()
  }, [])

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model, measurement_type')
      .order('plate')

    if (!error) setVehicles(data || [])
  }

  useEffect(() => {
    if (!vehicleId) {
      setOpenUsage(null)
      return
    }
    fetchOpenUsage(vehicleId)
  }, [vehicleId])

  async function fetchOpenUsage(vId) {
    const { data, error } = await supabase
      .from('usage_logs')
      .select('id, start_value, date')
      .eq('vehicle_id', vId)
      .is('end_value', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!error) setOpenUsage(data?.[0] ?? null)
  }

  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId),
    [vehicles, vehicleId]
  )

  const unit = labelUnit(selectedVehicle?.measurement_type)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !endValue) {
      alert('Preencha os campos obrigatórios')
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('register_vehicle_return', {
      p_vehicle_id: vehicleId,
      p_user_id: user.id,
      p_end_value: Number(endValue)
    })

    setLoading(false)

    if (error) {
      console.error('RPC ERROR:', error)
      alert(error.message || 'Erro ao registrar chegada')
      return
    }

    alert('Chegada registrada ✅')
    setEndValue('')
    fetchOpenUsage(vehicleId)
  }

  return (
    <Card
      title="Registrar chegada"
      right={
        <Button
          variant="ghost"
          onClick={() => vehicleId && fetchOpenUsage(vehicleId)}
          disabled={!vehicleId || loading}
        >
          Atualizar
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="grid">
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
          <option value="">Selecione o veículo</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate} — {v.model}
            </option>
          ))}
        </select>

        {vehicleId && !openUsage && (
          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Sem uso aberto</strong>
              <Badge tone="neutral">N/A</Badge>
            </div>
          </div>
        )}

        {openUsage && (
          <div className="card" style={{ boxShadow: 'none', borderColor: 'rgba(255,204,0,.35)' }}>
            <div className="card-body" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Uso aberto encontrado</strong>
                <Badge tone="warn">ABERTO</Badge>
              </div>
              <div className="small">
                Saída: <strong style={{ color: 'var(--text)' }}>{openUsage.start_value}</strong> {unit}
              </div>
              <div className="small">Data: {openUsage.date}</div>
            </div>
          </div>
        )}

        <input
          type="number"
          placeholder={`Leitura de chegada (${unit})`}
          value={endValue}
          onChange={e => setEndValue(e.target.value)}
          disabled={!openUsage}
        />

        <Button type="submit" disabled={loading || !openUsage} style={{ width: '100%' }}>
          {loading ? 'Salvando...' : 'Registrar chegada'}
        </Button>
      </form>
    </Card>
  )
}
