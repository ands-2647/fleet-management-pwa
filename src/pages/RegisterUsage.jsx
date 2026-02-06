import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function labelUnit(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

export default function RegisterUsage({ user }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [startValue, setStartValue] = useState('')
  const [destination, setDestination] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')

  const draftKey = `draft_register_usage::${user?.id || 'anon'}`
  const [openUsage, setOpenUsage] = useState(null)
  const [loading, setLoading] = useState(false)

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.vehicleId) setVehicleId(d.vehicleId)
      if (d.startValue) setStartValue(d.startValue)
      if (d.destination) setDestination(d.destination)
      if (d.fuelLevel) setFuelLevel(d.fuelLevel)
    } catch (_) {}
  }



  useEffect(() => {
    fetchVehicles()
    restoreDraft()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ vehicleId, startValue, destination, fuelLevel })
      )
    } catch (_) {}
  }, [draftKey, vehicleId, startValue, destination, fuelLevel])


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
  const previousValue = openUsage?.start_value ?? null
  const isInvalid = previousValue !== null && Number(startValue) <= Number(previousValue)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !startValue) {
      alert('Preencha os campos obrigatórios')
      return
    }

    if (isInvalid) {
      alert(`O valor informado precisa ser maior que o anterior (${previousValue}).`)
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('register_vehicle_usage', {
      p_vehicle_id: vehicleId,
      p_user_id: user.id,
      p_date: new Date().toISOString().slice(0, 10),
      p_start_value: Number(startValue),
      p_destination: destination || null,
      p_fuel_level_start: fuelLevel || null
    })

    setLoading(false)

    if (error) {
      console.error('RPC ERROR:', error)
      alert(error.message || 'Erro ao registrar saída')
      return
    }

    alert('Saída registrada com sucesso 🚗')
    setStartValue('')
    setDestination('')
    setFuelLevel('')
    fetchOpenUsage(vehicleId)
  }

  return (
    <Card
      title="Registrar saída"
      right={
        <Button variant="ghost" onClick={() => vehicleId && fetchOpenUsage(vehicleId)} disabled={!vehicleId || loading}>
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

        {openUsage ? (
          <div className="card" style={{ boxShadow: 'none', borderColor: 'rgba(255,204,0,.35)' }}>
            <div className="card-body" style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Uso aberto detectado</strong>
                <Badge tone="warn">ATENÇÃO</Badge>
              </div>
              <div className="small">
                Valor anterior: <strong style={{ color: 'var(--text)' }}>{openUsage.start_value}</strong> {unit}
              </div>
              <div className="small">Data: {openUsage.date}</div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Sem uso aberto</strong>
              <Badge tone="ok">OK</Badge>
            </div>
          </div>
        )}

        <input
          type="number"
          placeholder={`Leitura atual (${unit})`}
          value={startValue}
          onChange={e => setStartValue(e.target.value)}
        />

        <input
          type="text"
          placeholder="Destino (ex: Brasília)"
          value={destination}
          onChange={e => setDestination(e.target.value)}
        />

        <select value={fuelLevel} onChange={e => setFuelLevel(e.target.value)}>
          <option value="">Nível de combustível (opcional)</option>
          <option value="vazio">Vazio</option>
          <option value="1/4">1/4</option>
          <option value="1/2">1/2</option>
          <option value="3/4">3/4</option>
          <option value="cheio">Cheio</option>
        </select>

        <Button type="submit" disabled={loading || !vehicleId} style={{ width: '100%' }}>
          {loading ? 'Registrando...' : 'Registrar saída'}
        </Button>
      </form>
    </Card>
  )
}
