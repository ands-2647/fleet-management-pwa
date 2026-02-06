import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const card = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 16,
  marginTop: 12
}

export default function FuelLog({ user, profile }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [amount, setAmount] = useState('')
  const [tankFill, setTankFill] = useState('parcial')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const draftKey = `draft_fuel_log::${user?.id || 'anon'}`
  const [loading, setLoading] = useState(false)

  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      if (d.vehicleId) setVehicleId(d.vehicleId)
      if (d.amount) setAmount(d.amount)
      if (d.tankFill) setTankFill(d.tankFill)
      if (d.notes) setNotes(d.notes)
      if (d.date) setDate(d.date)
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
        JSON.stringify({ vehicleId, amount, tankFill, notes, date })
      )
    } catch (_) {}
  }, [draftKey, vehicleId, amount, tankFill, notes, date])


  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model')
      .order('plate')

    if (!error) setVehicles(data || [])
  }

  async function fetchLogs() {
    setLoadingLogs(true)

    const isManager = profile?.role !== 'motorista'

    let query = supabase
      .from('fuel_logs')
      .select('id, date, amount, tank_fill, notes, created_at, vehicle_id, user_id')
      .order('created_at', { ascending: false })
      .limit(20)

    // motorista vê só o dele (policy já garante, mas ajuda a filtrar no client)
    if (!isManager) {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
      setLogs([])
    } else {
      setLogs(data || [])
    }

    setLoadingLogs(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!vehicleId || !amount) {
      alert('Preencha os campos obrigatórios')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('fuel_logs').insert([
      {
        vehicle_id: vehicleId,
        user_id: user.id,
        date,
        amount: Number(amount),
        tank_fill: tankFill,
        notes: notes || null
      }
    ])

    setLoading(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao registrar abastecimento')
      return
    }

    alert('Abastecimento registrado ⛽')
    setVehicleId('')
    setAmount('')
    setTankFill('parcial')
    setNotes('')
    setDate(new Date().toISOString().slice(0, 10))
    fetchLogs()
  }

  const vehicleLabel = id => {
    const v = vehicles.find(x => x.id === id)
    if (!v) return id
    return `${v.plate} — ${v.model}`
  }

  return (
    <div style={card}>
      <h2>Registrar Abastecimento</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
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
          type="number"
          placeholder="Valor abastecido (R$)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <select value={tankFill} onChange={e => setTankFill(e.target.value)}>
          <option value="parcial">Parcial</option>
          <option value="completo">Completo</option>
        </select>

        <input
          type="text"
          placeholder="Observação (opcional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Abastecimento'}
        </button>
      </form>

      <hr style={{ margin: '16px 0' }} />

      <h3>Últimos abastecimentos</h3>

      {loadingLogs ? (
        <p>Carregando...</p>
      ) : logs.length === 0 ? (
        <p>Nenhum abastecimento registrado ainda.</p>
      ) : (
        <ul style={{ display: 'grid', gap: 8, paddingLeft: 16 }}>
          {logs.map(l => (
            <li key={l.id}>
              <strong>{l.date}</strong> — {vehicleLabel(l.vehicle_id)} — R$ {l.amount}{' '}
              ({l.tank_fill}) {l.notes ? `— ${l.notes}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
