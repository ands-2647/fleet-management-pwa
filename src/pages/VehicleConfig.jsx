import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const box = {
  padding: 20,
  border: '1px solid #ddd',
  borderRadius: 10
}

const card = {
  background: '#f4f4f4',
  padding: 12,
  borderRadius: 8,
  display: 'grid',
  gap: 8
}

function unitLabel(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

function statusLabel(s) {
  if (s === 'atrasado') return 'Atrasado'
  if (s === 'proximo') return 'Próximo'
  if (s === 'ok') return 'OK'
  if (s === 'inativo') return 'Inativo'
  return '—'
}

function statusStyle(s) {
  if (s === 'atrasado') return { background: '#ffe0e0' }
  if (s === 'proximo') return { background: '#fff3d6' }
  if (s === 'ok') return { background: '#e7ffe7' }
  return { background: '#efefef' }
}

export default function VehicleConfig({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [vehicles, setVehicles] = useState([])
  const [vehicleId, setVehicleId] = useState('')
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // form veículo
  const [plate, setPlate] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')
  const [measurementType, setMeasurementType] = useState('km')
  const [vehicleNotes, setVehicleNotes] = useState('')

  // form plano
  const [intervalValue, setIntervalValue] = useState('')
  const [remindBefore, setRemindBefore] = useState('')
  const [planActive, setPlanActive] = useState(true)
  const [planNotes, setPlanNotes] = useState('')

  // registrar manutenção
  const [serviceValue, setServiceValue] = useState('')
  const [serviceNotes, setServiceNotes] = useState('')

  useEffect(() => {
    if (!isManager) return
    fetchVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManager])

  useEffect(() => {
    if (!vehicleId) {
      setRow(null)
      return
    }
    fetchConfig(vehicleId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId])

  async function fetchVehicles() {
    setLoading(true)
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
    setLoading(false)
  }

  async function fetchConfig(vId) {
    setLoading(true)

    const { data, error } = await supabase
      .from('v_vehicle_config')
      .select('*')
      .eq('vehicle_id', vId)
      .single()

    if (error) {
      console.error(error)
      setRow(null)
      setLoading(false)
      return
    }

    setRow(data)

    // preencher formulário do veículo
    setPlate(data.plate || '')
    setModel(data.model || '')
    setType(data.type || '')
    setMeasurementType(data.measurement_type || 'km')
    setVehicleNotes(data.vehicle_notes || '')

    // preencher plano (se existir)
    setIntervalValue(data.interval_value != null ? String(data.interval_value) : '')
    setRemindBefore(data.remind_before != null ? String(data.remind_before) : '')
    setPlanActive(data.plan_active != null ? Boolean(data.plan_active) : true)
    setPlanNotes(data.plan_notes || '')

    setServiceValue('')
    setServiceNotes('')

    setLoading(false)
  }

  const unit = useMemo(() => unitLabel(measurementType), [measurementType])

  async function saveVehicle(e) {
    e.preventDefault()
    if (!vehicleId) return

    setSaving(true)

    // Atualiza dados do veículo
    // Obs: esse update inclui notes (se você rodou o SQL do notes)
    const updatePayload = {
      plate,
      model,
      type,
      measurement_type: measurementType
    }

    // só inclui notes se a coluna existir (evita erro se você não criou)
    if (typeof vehicleNotes === 'string') {
      updatePayload.notes = vehicleNotes
    }

    const { error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', vehicleId)

    setSaving(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao salvar veículo')
      return
    }

    alert('Veículo atualizado ✅')
    fetchVehicles()
    fetchConfig(vehicleId)
  }

  async function savePlan(e) {
    e.preventDefault()
    if (!vehicleId) return

    if (!intervalValue) {
      alert('Informe o intervalo do plano.')
      return
    }

    setSaving(true)

    const payload = {
      vehicle_id: vehicleId,
      interval_value: Number(intervalValue),
      remind_before: Number(remindBefore || 0),
      active: Boolean(planActive),
      notes: planNotes || null
    }

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
    fetchConfig(vehicleId)
  }

  async function registerService(e) {
    e.preventDefault()
    if (!vehicleId) return

    if (!serviceValue) {
      alert(`Informe o valor (${unit}) no momento da manutenção.`)
      return
    }

    setSaving(true)

    const payload = {
      vehicle_id: vehicleId,
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
    setServiceValue('')
    setServiceNotes('')
    fetchConfig(vehicleId)
  }

  if (!isManager) {
    return (
      <div style={box}>
        <h2>Config do veículo</h2>
        <p>Somente gestor/gerente/diretor pode configurar veículos e manutenção.</p>
      </div>
    )
  }

  return (
    <div style={box}>
      <h2>Config do veículo</h2>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Selecione um veículo</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </option>
              ))}
            </select>
          </div>

          {!vehicleId ? (
            <p style={{ marginTop: 10 }}>Selecione um veículo para editar.</p>
          ) : (
            <>
              {/* STATUS */}
              <div style={{ marginTop: 16, ...card, ...statusStyle(row?.status) }}>
                <strong>Status manutenção: {statusLabel(row?.status)}</strong>

                <div style={{ fontSize: 13, color: '#555' }}>
                  Atual: <strong>{Number(row?.current_value || 0).toFixed(0)}</strong> {unit} •
                  Próxima: <strong>{Number(row?.next_due_value || 0).toFixed(0)}</strong> {unit} •
                  Restante: <strong>{Number(row?.remaining || 0).toFixed(0)}</strong> {unit}
                </div>

                <div style={{ fontSize: 13, color: '#555' }}>
                  Última manutenção: {row?.last_service_date || '—'} • valor: {Number(row?.last_service_value || 0).toFixed(0)} {unit}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                {/* VEÍCULO */}
                <div style={card}>
                  <h3 style={{ margin: 0 }}>Dados do veículo</h3>

                  <form onSubmit={saveVehicle} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
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
                      placeholder="Tipo (ex: pequeno, medio, grande, maquinario)"
                      value={type}
                      onChange={e => setType(e.target.value)}
                    />

                    <select
                      value={measurementType}
                      onChange={e => setMeasurementType(e.target.value)}
                    >
                      <option value="km">KM (odômetro)</option>
                      <option value="hours">Horas (horímetro)</option>
                    </select>

                    <input
                      placeholder="Observações do veículo (opcional)"
                      value={vehicleNotes}
                      onChange={e => setVehicleNotes(e.target.value)}
                    />

                    <button type="submit" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar dados do veículo'}
                    </button>
                  </form>
                </div>

                {/* PLANO */}
                <div style={card}>
                  <h3 style={{ margin: 0 }}>Plano de manutenção</h3>

                  <form onSubmit={savePlan} style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
                    <input
                      type="number"
                      placeholder={`Intervalo (${unit})`}
                      value={intervalValue}
                      onChange={e => setIntervalValue(e.target.value)}
                    />

                    <input
                      type="number"
                      placeholder={`Avisar antes de (${unit})`}
                      value={remindBefore}
                      onChange={e => setRemindBefore(e.target.value)}
                    />

                    <label style={{ fontSize: 13, color: '#555' }}>
                      <input
                        type="checkbox"
                        checked={planActive}
                        onChange={e => setPlanActive(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Plano ativo
                    </label>

                    <input
                      placeholder="Observações do plano (opcional)"
                      value={planNotes}
                      onChange={e => setPlanNotes(e.target.value)}
                    />

                    <button type="submit" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar plano'}
                    </button>
                  </form>
                </div>

                {/* REGISTRAR MANUTENÇÃO */}
                <div style={card}>
                  <h3 style={{ margin: 0 }}>Registrar manutenção feita</h3>

                  <form
                    onSubmit={registerService}
                    style={{ display: 'grid', gap: 10, maxWidth: 520 }}
                  >
                    <input
                      type="number"
                      placeholder={`Valor no momento (${unit})`}
                      value={serviceValue}
                      onChange={e => setServiceValue(e.target.value)}
                    />

                    <input
                      placeholder="Observação (opcional)"
                      value={serviceNotes}
                      onChange={e => setServiceNotes(e.target.value)}
                    />

                    <button type="submit" disabled={saving}>
                      {saving ? 'Registrando...' : 'Registrar manutenção'}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
