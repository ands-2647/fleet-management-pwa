import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Fuel() {
  const [vehicles, setVehicles] = useState([])
  const [logs, setLogs] = useState([])

  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState('')
  const [liters, setLiters] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [odometer, setOdometer] = useState('')

  async function fetchVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, model')

    setVehicles(data || [])
  }

  async function fetchFuelLogs() {
    const { data } = await supabase
      .from('fuel_logs')
      .select(`
        id,
        date,
        liters,
        total_value,
        odometer,
        vehicles ( plate )
      `)
      .order('date', { ascending: false })

    setLogs(data || [])
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !date || !liters || !totalValue || !odometer) {
      alert('Preencha todos os campos')
      return
    }

    const { error } = await supabase
      .from('fuel_logs')
      .insert([
        {
          vehicle_id: vehicleId,
          date,
          liters: Number(liters),
          total_value: Number(totalValue),
          odometer: Number(odometer)
        }
      ])

    if (error) {
      console.error(error)
      alert('Erro ao salvar abastecimento')
    } else {
      setVehicleId('')
      setDate('')
      setLiters('')
      setTotalValue('')
      setOdometer('')
      fetchFuelLogs()
    }
  }

  useEffect(() => {
    fetchVehicles()
    fetchFuelLogs()
  }, [])

  return (
    <div style={{ marginTop: 40 }}>
      <h1>Abastecimento</h1>

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
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <input
          placeholder="Litros"
          type="number"
          value={liters}
          onChange={e => setLiters(e.target.value)}
        />

        <input
          placeholder="Valor total (R$)"
          type="number"
          value={totalValue}
          onChange={e => setTotalValue(e.target.value)}
        />

        <input
          placeholder="Odômetro (km)"
          type="number"
          value={odometer}
          onChange={e => setOdometer(e.target.value)}
        />

        <button type="submit">Salvar abastecimento</button>
      </form>

      <hr />

      <h2>Histórico</h2>

      <ul>
        {logs.map(log => (
          <li key={log.id}>
            {log.vehicles?.plate} — {log.liters}L — R$ {log.total_value}
          </li>
        ))}
      </ul>
    </div>
  )
}
