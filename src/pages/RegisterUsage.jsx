import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function RegisterUsage({ user }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [startValue, setStartValue] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchVehicles()
  }, [])

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model')
      .order('plate')

    if (!error) {
      setVehicles(data)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !startValue) {
      alert('Preencha todos os campos')
      return
    }

    setLoading(true)

    const { error } = await supabase.rpc('register_vehicle_usage', {
      p_vehicle_id: vehicleId,
      p_user_id: user.id,
      p_date: new Date().toISOString().slice(0, 10),
      p_start_value: Number(startValue)
    })

    setLoading(false)

    if (error) {
      console.error(error)
      alert('Erro ao registrar saída')
    } else {
      alert('Saída registrada com sucesso 🚗')
      setVehicleId('')
      setStartValue('')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Registrar Saída</h2>

      <form onSubmit={handleSubmit}>
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

        <input
          type="number"
          placeholder="KM ou Horas atuais"
          value={startValue}
          onChange={e => setStartValue(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Registrar Saída'}
        </button>
      </form>
    </div>
  )
}
