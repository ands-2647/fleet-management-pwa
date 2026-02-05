export default function BottomNav({ items, activeKey, onChange }) {
  return (
    <nav className="bottom-nav">
      <div
        className="bottom-nav-inner"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map(it => (
          <button
            key={it.key}
            className={`nav-btn ${activeKey === it.key ? 'active' : ''}`}
            onClick={() => onChange(it.key)}
            type="button"
          >
            <div className="icon">{it.icon}</div>
            <div>{it.label}</div>
          </button>
        ))}
      </div>
    </nav>
  )
}
