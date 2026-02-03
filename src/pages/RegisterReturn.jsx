import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

  const selectedVehicle = vehicles.find(v => v.id === vehicleId)
  const labelMedicao =
    selectedVehicle?.measurement_type === 'hours' ? 'Horas' : 'KM'

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !endValue) {
      alert('Preencha todos os campos')
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
    } else {
      alert('Chegada registrada ✅')
      setEndValue('')
      fetchOpenUsage(vehicleId) // deve ficar null agora
    }
  }

  return (
    <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, marginTop: 12 }}>
      <h2>Registrar Chegada</h2>

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

        {!openUsage && vehicleId && (
          <div style={{ background: '#eaf7ea', padding: 10, borderRadius: 6 }}>
            Não há uso aberto para este veículo.
          </div>
        )}

        {openUsage && (
          <div style={{ background: '#fff7d6', padding: 10, borderRadius: 6 }}>
            Uso aberto encontrado ✅
            <div>
              Saída: <strong>{openUsage.start_value}</strong> ({labelMedicao})
            </div>
            <div>Data: {openUsage.date}</div>
          </div>
        )}

        <input
          type="number"
          placeholder={`Informe ${labelMedicao} de chegada`}
          value={endValue}
          onChange={e => setEndValue(e.target.value)}
          disabled={!openUsage}
        />

        <button type="submit" disabled={loading || !openUsage}>
          {loading ? 'Salvando...' : 'Registrar Chegada'}
        </button>
      </form>
    </div>
  )
}
