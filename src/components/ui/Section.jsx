import Card from './Card'

export default function Section({ title, right, children }) {
  return (
    <Card title={title} right={right}>
      <div className="grid">
        {children}
      </div>
    </Card>
  )
}
