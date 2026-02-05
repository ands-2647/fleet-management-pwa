export default function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: { background: '#22242A', color: '#fff' },
    ok: { background: 'rgba(52,199,89,.18)', color: 'var(--ok)', border: '1px solid rgba(52,199,89,.35)' },
    warn: { background: 'rgba(255,204,0,.18)', color: 'var(--warn)', border: '1px solid rgba(255,204,0,.35)' },
    danger: { background: 'rgba(255,59,48,.18)', color: 'var(--danger)', border: '1px solid rgba(255,59,48,.35)' },
    brand: { background: 'rgba(255,106,0,.18)', color: 'var(--brand)', border: '1px solid rgba(255,106,0,.35)' }
  }

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '.2px',
    border: '1px solid var(--border)'
  }

  return (
    <span style={{ ...base, ...(tones[tone] || tones.neutral) }}>
      {children}
    </span>
  )
}
