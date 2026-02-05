export default function Button({
  variant = 'primary',
  children,
  style,
  ...props
}) {
  const base = {
    width: 'fit-content',
    borderRadius: 12,
    padding: '10px 14px',
    border: '1px solid var(--border)',
    background: '#0C0D0F',
    color: 'var(--text)',
    fontWeight: 800,
    letterSpacing: '.2px'
  }

  const variants = {
    primary: {
      background: 'var(--brand)',
      borderColor: 'rgba(255,106,0,.55)',
      color: '#0F0F10'
    },
    ghost: {
      background: 'transparent',
      borderColor: 'var(--border)',
      color: 'var(--text)'
    },
    danger: {
      background: 'var(--danger)',
      borderColor: 'rgba(255,59,48,.55)',
      color: '#0F0F10'
    }
  }

  return (
    <button
      {...props}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      onMouseEnter={(e) => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--brand-hover)'
        props.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') e.currentTarget.style.background = 'var(--brand)'
        props.onMouseLeave?.(e)
      }}
    >
      {children}
    </button>
  )
}
