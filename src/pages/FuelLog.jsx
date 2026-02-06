import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const card = {
  border: '1px solid rgba(255,255,255,.10)',
  borderRadius: 12,
  padding: 16,
  marginTop: 12,
  background: 'rgba(0,0,0,.35)',
  overflow: 'hidden', // ✅ impede o date de vazar no iOS
  width: '100%',
  boxSizing: 'border-box'
}

const field = {
  width: '100%',
  boxSizing: 'border-box',
  padding: 12,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(0,0,0,.35)',
  color: '#fff',
  outline: 'none'
}

const button = {
  width: '100%',
  padding: 12,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.10)',
  background: '#ff6a00',
  color: '#111',
  fontWeight: 900,
  cursor: 'pointer'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model, name')
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
    return `${v.plate} — ${(v.name || v.model || '').trim()}`
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>Registrar Abastecimento</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          style={field}
        >
          <option value="">Selecione o veículo</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.plate} — {(v.name || v.model || '').trim()}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={field} // ✅ agora date usa o mesmo estilo (e não vaza)
        />

        <input
          type="number"
          placeholder="Valor abastecido (R$) *"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={field}
        />

        <select
          value={tankFill}
          onChange={e => setTankFill(e.target.value)}
          style={field}
        >
          <option value="parcial">Parcial</option>
          <option value="completo">Completo</option>
        </select>

        <input
          type="text"
          placeholder="Observação (opcional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={field}
        />

        <button type="submit" disabled={loading} style={button}>
          {loading ? 'Salvando...' : 'Salvar Abastecimento'}
        </button>
      </form>

      <hr style={{ margin: '16px 0', opacity: 0.2 }} />

      <h3 style={{ margin: 0 }}>Últimos abastecimentos</h3>

      {loadingLogs ? (
        <p>Carregando...</p>
      ) : logs.length === 0 ? (
        <p>Nenhum abastecimento registrado ainda.</p>
      ) : (
        <ul style={{ display: 'grid', gap: 8, paddingLeft: 16, marginTop: 12 }}>
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