import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

function labelUnit(measurementType) {
  return measurementType === 'hours' ? 'Horas' : 'KM'
}

function statusToBadge(s) {
  if (s === 'atrasado') return { tone: 'danger', label: 'ATRASADO' }
  if (s === 'proximo') return { tone: 'warn', label: 'VENCENDO' }
  if (s === 'ok') return { tone: 'ok', label: 'OK' }
  return { tone: 'neutral', label: 'INATIVO' }
}

export default function Maintenance({ profile }) {
  const isManager = profile?.role !== 'motorista'

  const [vehicles, setVehicles] = useState([])
  const [statusRows, setStatusRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // formulário: criar/atualizar plano
  const [vehicleId, setVehicleId] = useState('')
  const [intervalValue, setIntervalValue] = useState('')
  const [remindBefore, setRemindBefore] = useState('')
  const [planNotes, setPlanNotes] = useState('')

  // registrar manutenção feita
  const [serviceVehicleId, setServiceVehicleId] = useState('')
  const [serviceValue, setServiceValue] = useState('')
  const [serviceNotes, setServiceNotes] = useState('')

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
    // Observação: esta view já existe no seu banco (v_maintenance_status)
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

  if (!isManager) return null

  return (
    <Card
      title="Manutenção"
      right={
        <Button variant="ghost" onClick={fetchAll} disabled={loading || saving}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </Button>
      }
    >
      {loading ? (
        <p>Carregando status de manutenção...</p>
      ) : (
        <div className="grid">
          {/* Lista de alertas */}
          <div className="grid">
            {statusRows.length === 0 ? (
              <p>Você ainda não criou nenhum plano de manutenção.</p>
            ) : (
              statusRows.map(r => {
                const unit = labelUnit(r.measurement_type)
                const b = statusToBadge(r.status)
                return (
                  <div
                    key={r.vehicle_id}
                    className="card"
                    style={{ boxShadow: 'none' }}
                  >
                    <div className="card-body" style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div>
                          <strong>{r.plate}</strong> — {r.model}
                          <div className="small">
                            Atual: <strong style={{ color: 'var(--text)' }}>{Number(r.current_value || 0).toFixed(0)}</strong> {unit} • Próxima: <strong style={{ color: 'var(--text)' }}>{Number(r.next_due_value || 0).toFixed(0)}</strong> {unit}
                          </div>
                        </div>
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </div>

                      <div className="small">
                        Restante: <strong style={{ color: 'var(--text)' }}>{Number(r.remaining || 0).toFixed(0)}</strong> {unit} • Intervalo: {Number(r.interval_value || 0).toFixed(0)} {unit}
                      </div>
                      <div className="small">
                        Última manutenção: {r.last_service_date || '—'} (valor: {Number(r.last_service_value || 0).toFixed(0)} {unit})
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="hr" />

          <div className="grid-2">
            {/* Criar/Atualizar Plano */}
            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="card-body">
                <h3>Plano por veículo</h3>
                <p className="small">Crie ou atualize o intervalo de manutenção do veículo.</p>

                <form onSubmit={savePlan} className="grid">
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
                    placeholder="Avisar antes (opcional)"
                    value={remindBefore}
                    onChange={e => setRemindBefore(e.target.value)}
                  />

                  <input
                    type="text"
                    placeholder="Observações do plano (opcional)"
                    value={planNotes}
                    onChange={e => setPlanNotes(e.target.value)}
                  />

                  <Button type="submit" disabled={saving} style={{ width: '100%' }}>
                    {saving ? 'Salvando...' : 'Salvar plano'}
                  </Button>
                </form>
              </div>
            </div>

            {/* Registrar manutenção feita */}
            <div className="card" style={{ boxShadow: 'none' }}>
              <div className="card-body">
                <h3>Registrar manutenção feita</h3>
                <p className="small">Após a manutenção, informe o KM/Horas em que ela foi executada.</p>

                <form onSubmit={registerService} className="grid">
                  <select value={serviceVehicleId} onChange={e => setServiceVehicleId(e.target.value)}>
                    <option value="">Selecione o veículo</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.plate} — {v.model}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder={`Valor (${selectedServiceVehicle ? labelUnit(selectedServiceVehicle.measurement_type) : 'KM/Horas'})`}
                    value={serviceValue}
                    onChange={e => setServiceValue(e.target.value)}
                  />

                  <input
                    type="text"
                    placeholder="Observações (opcional)"
                    value={serviceNotes}
                    onChange={e => setServiceNotes(e.target.value)}
                  />

                  <Button type="submit" disabled={saving} style={{ width: '100%' }}>
                    {saving ? 'Registrando...' : 'Registrar manutenção'}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
