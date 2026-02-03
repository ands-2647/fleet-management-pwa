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

const rowLine = {
  display: 'grid',
  gridTemplateColumns: '140px 1fr 140px',
  gap: 10,
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid #ddd'
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

  // Histórico de manutenções
  const [serviceLogs, setServiceLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)

  // edição inline (histórico)
  const [editLogId, setEditLogId] = useState(null)
  const [editDate, setEditDate] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editNotes, setEditNotes] = useState('')

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
      setServiceLogs([])
      cancelEdit()
      return
    }
    fetchConfig(vehicleId)
    fetchServiceLogs(vehicleId)
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

    // limpar inputs de manutenção
    setServiceValue('')
    setServiceNotes('')

    setLoading(false)
  }

  async function fetchServiceLogs(vId) {
    setLogsLoading(true)
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('id, performed_at, value_at_service, notes, created_at')
      .eq('vehicle_id', vId)
      .order('performed_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error(error)
      setServiceLogs([])
    } else {
      setServiceLogs(data || [])
    }
    setLogsLoading(false)
  }

  const unit = useMemo(() => unitLabel(measurementType), [measurementType])

  async function saveVehicle(e) {
    e.preventDefault()
    if (!vehicleId) return

    setSaving(true)

    const updatePayload = {
      plate,
      model,
      type,
      measurement_type: measurementType,
      notes: vehicleNotes
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
    cancelEdit()
    fetchConfig(vehicleId)
    fetchServiceLogs(vehicleId)
  }

  async function deleteLog(logId) {
    const ok = window.confirm('Tem certeza que deseja excluir este registro?')
    if (!ok) return

    setSaving(true)
    const { error } = await supabase
      .from('maintenance_logs')
      .delete()
      .eq('id', logId)

    setSaving(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao excluir registro')
      return
    }

    alert('Registro excluído ✅')
    cancelEdit()
    fetchConfig(vehicleId)
    fetchServiceLogs(vehicleId)
  }

  function startEdit(log) {
    setEditLogId(log.id)
    setEditDate(log.performed_at || '')
    setEditValue(String(log.value_at_service ?? ''))
    setEditNotes(log.notes || '')
  }

  function cancelEdit() {
    setEditLogId(null)
    setEditDate('')
    setEditValue('')
    setEditNotes('')
  }

  async function saveEdit() {
    if (!editLogId) return

    if (!editDate || !editValue) {
      alert('Preencha a data e o valor.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('maintenance_logs')
      .update({
        performed_at: editDate,
        value_at_service: Number(editValue),
        notes: editNotes || null
      })
      .eq('id', editLogId)

    setSaving(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao salvar edição')
      return
    }

    alert('Registro atualizado ✅')
    cancelEdit()
    fetchConfig(vehicleId)
    fetchServiceLogs(vehicleId)
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
                  Última manutenção: {row?.last_service_date || '—'} • valor:{' '}
                  {Number(row?.last_service_value || 0).toFixed(0)} {unit}
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

                {/* HISTÓRICO */}
                <div style={card}>
                  <h3 style={{ margin: 0 }}>Histórico de manutenções</h3>

                  {logsLoading ? (
                    <p>Carregando histórico...</p>
                  ) : serviceLogs.length === 0 ? (
                    <p>Nenhuma manutenção registrada ainda.</p>
                  ) : (
                    <div>
                      <div style={{ ...rowLine, fontWeight: 'bold' }}>
                        <div>Data</div>
                        <div>Observação</div>
                        <div style={{ textAlign: 'right' }}>Valor</div>
                      </div>

                      {serviceLogs.map(l => {
                        const isEditing = editLogId === l.id

                        return (
                          <div key={l.id} style={rowLine}>
                            {/* COLUNA DATA */}
                            <div>
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={e => setEditDate(e.target.value)}
                                />
                              ) : (
                                l.performed_at
                              )}
                            </div>

                            {/* COLUNA OBS */}
                            <div style={{ color: '#444' }}>
                              {isEditing ? (
                                <input
                                  placeholder="Observação"
                                  value={editNotes}
                                  onChange={e => setEditNotes(e.target.value)}
                                />
                              ) : (
                                l.notes || <span style={{ color: '#888' }}>—</span>
                              )}
                            </div>

                            {/* COLUNA VALOR + AÇÕES */}
                            <div style={{ textAlign: 'right' }}>
                              {isEditing ? (
                                <>
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    placeholder={`Valor (${unit})`}
                                    style={{ width: '100%', marginBottom: 6 }}
                                  />
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={saveEdit}
                                      disabled={saving}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      disabled={saving}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <strong>{Number(l.value_at_service).toFixed(0)}</strong> {unit}
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                                    <button
                                      onClick={() => startEdit(l)}
                                      disabled={saving}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => deleteLog(l.id)}
                                      disabled={saving}
                                      style={{ fontSize: 12, padding: '4px 8px' }}
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
