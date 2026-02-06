import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePersistedState } from '../lib/usePersistedState'

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(false)

  // rascunho do formulário (salva enquanto digita)
  const [draft, setDraft] = usePersistedState('draft_vehicle_form', {
    plate: '',
    name: '',
    color: '',
    year: '',
    type: 'leve',
    measurement_type: 'km', // km | hours
    current_value: '',
    maintenance_required: true,
    maintenance_interval: '',
    oil_change_required: true,
    oil_change_interval: ''
  })

  const labelMedicao = useMemo(() => {
    return draft.measurement_type === 'hours' ? 'Horas' : 'KM'
  }, [draft.measurement_type])

  useEffect(() => {
    fetchVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchVehicles() {
    setLoading(true)

    const { data, error } = await supabase
      .from('vehicles')
      .select(
        'id, plate, model, name, color, year, type, measurement_type, current_value, maintenance_required, maintenance_interval, oil_change_required, oil_change_interval, created_at'
      )
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      console.error(error)
      alert('Erro ao carregar veículos')
      return
    }

    setVehicles(data || [])
  }

  function updateDraft(patch) {
    setDraft(prev => ({ ...prev, ...patch }))
  }

  function resetForm() {
    setDraft({
      plate: '',
      name: '',
      color: '',
      year: '',
      type: 'leve',
      measurement_type: 'km',
      current_value: '',
      maintenance_required: true,
      maintenance_interval: '',
      oil_change_required: true,
      oil_change_interval: ''
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const plateClean = String(draft.plate || '').trim().toUpperCase()
    const nameClean = String(draft.name || '').trim()
    const colorClean = String(draft.color || '').trim()

    const yearNum = draft.year ? Number(onlyDigits(draft.year)) : null
    const currentNum =
      draft.current_value === '' || draft.current_value === null
        ? null
        : Number(draft.current_value)

    if (!plateClean || !nameClean || !yearNum || !draft.type || !draft.measurement_type) {
      alert('Preencha os campos obrigatórios: Placa, Nome, Ano, Tipo e Medição.')
      return
    }

    const maintenanceIntervalNum =
      draft.maintenance_required && draft.maintenance_interval
        ? Number(draft.maintenance_interval)
        : null

    const oilIntervalNum =
      draft.oil_change_required && draft.oil_change_interval
        ? Number(draft.oil_change_interval)
        : null

    setLoading(true)

    const { error } = await supabase.from('vehicles').insert([
      {
        plate: plateClean,
        // compatibilidade com telas antigas
        model: nameClean,
        name: nameClean,
        color: colorClean || null,
        year: yearNum,
        type: draft.type,
        measurement_type: draft.measurement_type,
        current_value: currentNum,
        maintenance_required: !!draft.maintenance_required,
        maintenance_interval: maintenanceIntervalNum,
        oil_change_required: !!draft.oil_change_required,
        oil_change_interval: oilIntervalNum
      }
    ])

    setLoading(false)

    if (error) {
      console.error(error)
      alert(error.message || 'Erro ao salvar veículo')
      return
    }

    alert('Veículo cadastrado ✅')
    resetForm()
    fetchVehicles()
  }

  return (
    <section className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Cadastro de Veículos</h2>

        <form onSubmit={handleSubmit} className="grid">
          <input
            placeholder="Placa * (ex: ABC1D23)"
            value={draft.plate}
            onChange={e => updateDraft({ plate: e.target.value })}
          />

          <input
            placeholder="Nome * (ex: Strada, S10, Hilux...)"
            value={draft.name}
            onChange={e => updateDraft({ name: e.target.value })}
          />

          <div className="grid-2">
            <input
              placeholder="Cor (opcional)"
              value={draft.color}
              onChange={e => updateDraft({ color: e.target.value })}
            />

            <input
              placeholder="Ano * (ex: 2022)"
              type="number"
              value={draft.year}
              onChange={e => updateDraft({ year: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <select
              value={draft.type}
              onChange={e => updateDraft({ type: e.target.value })}
            >
              <option value="leve">Leve</option>
              <option value="medio">Médio</option>
              <option value="caminhao">Caminhão</option>
              <option value="maquinario">Maquinário</option>
            </select>

            <select
              value={draft.measurement_type}
              onChange={e => updateDraft({ measurement_type: e.target.value })}
            >
              <option value="km">KM</option>
              <option value="hours">Horas (horímetro)</option>
            </select>
          </div>

          <input
            placeholder={`Leitura inicial (${labelMedicao}) (opcional)`}
            type="number"
            value={draft.current_value}
            onChange={e => updateDraft({ current_value: e.target.value })}
          />

          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body">
              <strong>Manutenção periódica</strong>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <select
                  value={draft.maintenance_required ? 'sim' : 'nao'}
                  onChange={e => updateDraft({ maintenance_required: e.target.value === 'sim' })}
                >
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>

                <input
                  placeholder={`Intervalo (${labelMedicao})`}
                  type="number"
                  value={draft.maintenance_interval}
                  onChange={e => updateDraft({ maintenance_interval: e.target.value })}
                  disabled={!draft.maintenance_required}
                />
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Ex.: revisão geral a cada 10.000 KM ou 250 horas.
              </div>
            </div>
          </div>

          <div className="card" style={{ boxShadow: 'none' }}>
            <div className="card-body">
              <strong>Troca de óleo</strong>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <select
                  value={draft.oil_change_required ? 'sim' : 'nao'}
                  onChange={e => updateDraft({ oil_change_required: e.target.value === 'sim' })}
                >
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>

                <input
                  placeholder={`Intervalo (${labelMedicao})`}
                  type="number"
                  value={draft.oil_change_interval}
                  onChange={e => updateDraft({ oil_change_interval: e.target.value })}
                  disabled={!draft.oil_change_required}
                />
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                Ex.: troca de óleo a cada 5.000 KM.
              </div>
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Cadastrar veículo'}
          </button>
        </form>

        <hr style={{ borderColor: 'rgba(255,255,255,.08)', margin: '18px 0' }} />

        <h3 style={{ margin: 0 }}>Veículos cadastrados</h3>

        {vehicles.length === 0 ? (
          <p className="small" style={{ marginTop: 10 }}>Nenhum veículo cadastrado ainda.</p>
        ) : (
          <div className="grid" style={{ marginTop: 12 }}>
            {vehicles.map(v => (
              <div key={v.id} className="card" style={{ boxShadow: 'none' }}>
                <div className="card-body">
                  <div style={{ fontWeight: 900 }}>
                    {v.plate} — {(v.name || v.model || '').trim()}
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Tipo: {v.type || '—'} • Medição: {v.measurement_type === 'hours' ? 'Horas' : 'KM'}
                    {v.color ? ` • Cor: ${v.color}` : ''}
                    {v.year ? ` • Ano: ${v.year}` : ''}
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Leitura atual: <strong>{v.current_value ?? '—'}</strong>
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Manutenção: <strong>{v.maintenance_required ? 'Sim' : 'Não'}</strong>
                    {v.maintenance_required && v.maintenance_interval ? ` (a cada ${v.maintenance_interval})` : ''}
                    {' • '}
                    Óleo: <strong>{v.oil_change_required ? 'Sim' : 'Não'}</strong>
                    {v.oil_change_required && v.oil_change_interval ? ` (a cada ${v.oil_change_interval})` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
