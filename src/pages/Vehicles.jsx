import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) {
      setVehicles(data)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!plate || !model || !year) {
      alert('Preencha todos os campos')
      return
    }

    const { error } = await supabase
      .from('vehicles')
      .insert([
        {
          plate,
          model,
          year: Number(year)
        }
      ])

    if (error) {
      console.error(error)
      alert('Erro ao salvar veículo')
    } else {
      setPlate('')
      setModel('')
      setYear('')
      fetchVehicles()
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [])

  return (
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h1>Cadastro de Veículos</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Placa"
          value={plate}
          onChange={e => setPlate(e.target.value)}
        />

        <input
          placeholder="Modelo"
          value={model}
          onChange={e => setModel(e.target.value)}
        />

        <input
          placeholder="Ano"
          type="number"
          value={year}
          onChange={e => setYear(e.target.value)}
        />

        <button type="submit">Salvar</button>
      </form>

      <hr />

      <h2>Veículos cadastrados</h2>

      <ul>
        {vehicles.map(v => (
          <li key={v.id}>
            {v.plate} — {v.model} ({v.year})
          </li>
        ))}
      </ul>
    </div>
  )
}


