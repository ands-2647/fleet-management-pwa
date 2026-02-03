import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RegisterUsage({ user }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [startValue, setStartValue] = useState('')
  const [destination, setDestination] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')
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

  // quando escolher veículo, buscar uso aberto
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

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)
  const labelMedicao =
    selectedVehicle?.measurement_type === 'hours' ? 'Horas' : 'KM'

  const previousValue = openUsage?.start_value ?? null
  const isInvalid =
    previousValue !== null && Number(startValue) <= Number(previousValue)

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !startValue) {
      alert('Preencha os campos obrigatórios')
      return
    }

    if (isInvalid) {
      alert(
        `O valor informado precisa ser maior que o anterior (${previousValue}).`
      )
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
    } else {
      alert('Saída registrada com sucesso 🚗')
      setStartValue('')
      setDestination('')
      setFuelLevel('')
      fetchOpenUsage(vehicleId)
    }
  }

  return (
    <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
      <h2>Registrar Saída</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
        >
          <option value="">Selecione o veículo</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate} — {v.model}
            </option>
          ))}
        </select>

        {openUsage && (
          <div style={{ background: '#fff7d6', padding: 10, borderRadius: 6 }}>
            <strong>Atenção:</strong> existe um uso aberto deste veículo.
            <div>
              Valor anterior: <strong>{openUsage.start_value}</strong> ({labelMedicao})
            </div>
            <div>Data: {openUsage.date}</div>
          </div>
        )}

        <input
          type="number"
          placeholder={`Informe ${labelMedicao} atuais`}
          value={startValue}
          onChange={e => setStartValue(e.target.value)}
        />

        <input
          type="text"
          placeholder="Destino (ex: Brasília)"
          value={destination}
          onChange={e => setDestination(e.target.value)}
        />

        <select
          value={fuelLevel}
          onChange={e => setFuelLevel(e.target.value)}
        >
          <option value="">Nível de combustível</option>
          <option value="vazio">Vazio</option>
          <option value="1/4">1/4</option>
          <option value="1/2">1/2</option>
          <option value="3/4">3/4</option>
          <option value="cheio">Cheio</option>
        </select>

        <button type="submit" disabled={loading || !vehicleId}>
          {loading ? 'Registrando...' : 'Registrar Saída'}
        </button>
      </form>
    </div>
  )
}
