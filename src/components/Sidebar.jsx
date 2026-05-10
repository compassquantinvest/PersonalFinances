import { navItems } from '../lib/constants'
import { formatMemberRole } from '../lib/members'

export function Sidebar({ activePage, setActivePage, members, selectedMemberId, onSelectMember }) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <span className="brand-chip">PF</span>
        <div>
          <h1>Personal Finance</h1>
          <p>familia | brasil</p>
        </div>
      </div>

      <nav className="nav-list">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span>{item.short}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      <div className="sidebar-section">
        <p className="eyebrow">Membros</p>
        <div className="member-list">
          {members.map((member) => (
            <button
              key={member.id}
              className={`member-pill ${selectedMemberId === member.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage('home')
                onSelectMember(member.id)
              }}
            >
              <span className="member-dot" style={{ backgroundColor: member.accent }} />
              <div>
                <strong>{member.name}</strong>
                <p>{formatMemberRole(member.role)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-note">
        <p>Estrutura atual</p>
        <strong>Home por membro, carteiras modelo por casa e base local salva no navegador.</strong>
      </div>
    </aside>
  )
}
