export function Header({ meta }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{meta.eyebrow}</p>
        <h2>{meta.title}</h2>
        <span>{meta.subtitle}</span>
      </div>

      <div className="profile-tag">
        <span className="member-dot" style={{ backgroundColor: meta.tagColor }} />
        <strong>{meta.tag}</strong>
      </div>
    </header>
  )
}
