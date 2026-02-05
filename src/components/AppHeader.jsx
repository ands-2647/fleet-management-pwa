import Button from './ui/Button'
import logo from '../assets/logo.PNG'

export default function AppHeader({ profile, onSignOut }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src={logo}
            alt="MS Silos e Secadores"
            style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: '#0C0D0F', objectFit: 'cover' }}
          />
          <div>
            <h2 style={{ margin: 0 }}>Frota MS</h2>
            <div className="small">
              Bem-vindo, <strong style={{ color: 'var(--text)' }}>{profile?.name}</strong>
            </div>
          </div>
        </div>

        <Button variant="ghost" onClick={onSignOut}>
          Sair
        </Button>
      </div>
    </div>
  )
}
