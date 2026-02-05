export default function Card({ title, right, children, style }) {
  return (
    <div className="card" style={style}>
      <div className="card-body">
        {(title || right) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div>{title && <h3 style={{ margin: 0 }}>{title}</h3>}</div>
            <div>{right}</div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
