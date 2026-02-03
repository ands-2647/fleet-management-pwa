import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const box = {
  padding: 16,
  border: '1px solid #ddd',
  borderRadius: 10
}

const card = {
  background: '#f4f4f4',
  padding: 12,
  borderRadius: 8,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10
}

function labelUnit(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

export default function Maintenance({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [vehicles, setVehicles] = useState([])
  const [statusRows, setStatusRows] = useState([])
  const [loading, setLoading] = useState(true)

  // formulário: criar/atualizar plano
  const [vehicleId, setVehicleId] = useState('')
  const [intervalValue, setIntervalValue] = useState('')
  const [remindBefore, setRemindBefore] = useState('')
  const [planNotes, setPlanNotes] = useState('')

  // registrar manutenção feita
  const [serviceVehicleId, setServiceVehicleId] = useState('')
  const [serviceValue, setServiceValue] = useState('')
  const [serviceNotes, setServiceNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isManager) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchVehicles(), fetchStatus()])
    setLoading(false)
  }

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate, model, measurement_type')
      .order('plate')

    if (error) {
      console.error(error)
      setVehicles([])
    } else {
      setVehicles(data || [])
    }
  }

  async function fetchStatus() {
    const { data, error } = await supabase
      .from('v_maintenance_status')
      .select(
        'vehicle_id, plate, model, type, measurement_type, current_value, last_service_value, last_service_date, interval_value, remind_before, next_due_value, remaining, status'
      )
      .order('status', { ascending: true })
      .order('remaining', { ascending: true })

    if (error) {
      console.error(error)
      setStatusRows([])
    } else {
      setStatusRows(data || [])
    }
  }

  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === vehicleId),
    [vehicles, vehicleId]
  )

  const selectedServiceVehicle = useMemo(
    () => vehicles.find(v => v.id === serviceVehicleId),
    [vehicles, serviceVehicleId]
  )

  async function savePlan(e) {
    e.preventDefault()
    if (!vehicleId || !intervalValue) {
      alert('Selecione o veículo e informe o intervalo.')
      return
    }

    setSaving(true)

    const payload = {
      vehicle_id: vehicleId,
      interval_value: Number(intervalValue),
      remind_before: Number(remindBefore || 0),
      notes: planNotes || null,
      active: true
    }

    // upsert: se já existir plano do veículo, atualiza
    const { error } = await supabase
      .from('maintenance_plans')
      .upsert(payload, { onConflict: 'vehicle_id' })

    setSaving(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao salvar plano')
      return
    }

    alert('Plano salvo ✅')
    setVehicleId('')
    setIntervalValue('')
    setRemindBefore('')
    setPlanNotes('')
    fetchStatus()
  }

  async function registerService(e) {
    e.preventDefault()
    if (!serviceVehicleId || !serviceValue) {
      alert('Selecione o veículo e informe o valor (KM/Horas) da manutenção.')
      return
    }

    setSaving(true)

    const payload = {
      vehicle_id: serviceVehicleId,
      value_at_service: Number(serviceValue),
      notes: serviceNotes || null
    }

    const { error } = await supabase
      .from('maintenance_logs')
      .insert([payload])

    setSaving(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao registrar manutenção')
      return
    }

    alert('Manutenção registrada ✅')
    setServiceVehicleId('')
    setServiceValue('')
    setServiceNotes('')
    fetchStatus()
  }

  function statusLabel(s) {
    if (s === 'atrasado') return 'Atrasado'
    if (s === 'proximo') return 'Próximo'
    if (s === 'ok') return 'OK'
    return 'Inativo'
  }

  function statusStyle(s) {
    if (s === 'atrasado') return { background: '#ffe0e0' }
    if (s === 'proximo') return { background: '#fff3d6' }
    if (s === 'ok') return { background: '#e7ffe7' }
    return { background: '#efefef' }
  }

  if (!isManager) {
    return (
      <div style={box}>
        <h2>Manutenção</h2>
        <p>Somente gestor/gerente/diretor pode ver planos e alertas de manutenção.</p>
      </div>
    )
  }

  return (
    <div style={box}>
      <h2>Manutenção automática</h2>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          {/* Resumo de status */}
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {statusRows.length === 0 ? (
              <p>Você ainda não criou nenhum plano de manutenção.</p>
            ) : (
              statusRows.map(r => {
                const unit = labelUnit(r.measurement_type)
                return (
                  <div key={r.vehicle_id} style={{ ...card, ...statusStyle(r.status) }}>
                    <div>
                      <strong>{r.plate}</strong> — {r.model}
                      <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                        Atual: <strong>{Number(r.current_value).toFixed(0)}</strong> {unit} •
                        Próxima: <strong>{Number(r.next_due_value).toFixed(0)}</strong> {unit} •
                        Restante: <strong>{Number(r.remaining).toFixed(0)}</strong> {unit}
                      </div>
                      <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
                        Última manutenção: {r.last_service_date || '—'} (valor: {Number(r.last_service_value).toFixed(0)} {unit})
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div><strong>{statusLabel(r.status)}</strong></div>
                      <div style={{ fontSize: 12, color: '#555' }}>
                        Intervalo: {Number(r.interval_value).toFixed(0)} {unit}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <hr style={{ margin: '18px 0' }} />

          {/* Criar/Atualizar Plano */}
          <h3>Criar/Atualizar plano por veículo</h3>
          <form onSubmit={savePlan} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Selecione o veículo</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder={`Intervalo (${selectedVehicle ? labelUnit(selectedVehicle.measurement_type) : 'KM/Horas'})`}
              value={intervalValue}
              onChange={e => setIntervalValue(e.target.value)}
            />

            <input
              type="number"
              placeholder={`Avisar antes de (opcional)`}
              value={remindBefore}
              onChange={e => setRemindBefore(e.target.value)}
            />

            <input
              type="text"
              placeholder="Observação (opcional)"
              value={planNotes}
              onChange={e => setPlanNotes(e.target.value)}
            />

            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar plano'}
            </button>
          </form>

          <hr style={{ margin: '18px 0' }} />

          {/* Registrar manutenção feita */}
          <h3>Registrar manutenção feita</h3>
          <form onSubmit={registerService} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <select
              value={serviceVehicleId}
              onChange={e => setServiceVehicleId(e.target.value)}
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
              placeholder={`Valor no momento (${selectedServiceVehicle ? labelUnit(selectedServiceVehicle.measurement_type) : 'KM/Horas'})`}
              value={serviceValue}
              onChange={e => setServiceValue(e.target.value)}
            />

            <input
              type="text"
              placeholder="Observação (opcional)"
              value={serviceNotes}
              onChange={e => setServiceNotes(e.target.value)}
            />

            <button type="submit" disabled={saving}>
              {saving ? 'Registrando...' : 'Registrar manutenção'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
