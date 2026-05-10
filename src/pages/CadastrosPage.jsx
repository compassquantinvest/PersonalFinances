import { useEffect, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { formatCurrency } from '../lib/formatters'
import { formatMemberRole, getOwnerName } from '../lib/members'
import { getAssetCurrentValue } from '../domain/portfolio'

function MemberForm({ onSubmit, initialData = null, onCancel }) {
  function buildInitialState() {
    if (initialData) return { name: initialData.name || '', role: initialData.role || '', accent: initialData.accent || '#58d7ff' }
    return { name: '', role: '', accent: '#58d7ff' }
  }

  const [formData, setFormData] = useState(buildInitialState)

  useEffect(() => { setFormData(buildInitialState()) }, [initialData])

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit({ id: initialData?.id ?? crypto.randomUUID(), ...formData, role: formData.role || 'Membro' })

    if (!initialData) setFormData({ name: '', role: '', accent: '#58d7ff' })
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="form-grid member-form-grid compact-grid">
        <label>
          Nome do membro
          <input name="name" type="text" value={formData.name} onChange={handleChange} required />
        </label>
        <label>
          Papel
          <input name="role" type="text" placeholder="Titular, dependente, etc." value={formData.role} onChange={handleChange} />
        </label>
        <label className="color-inline-field">
          <span>Cor</span>
          <input name="accent" type="color" value={formData.accent} onChange={handleChange} />
        </label>
      </div>
      <div className="form-actions">
        <button className="primary-button submit-button" type="submit">
          {initialData ? 'Salvar membro' : 'Cadastrar membro'}
        </button>
        {onCancel ? (
          <button className="ghost-button inline-action" type="button" onClick={onCancel}>
            Cancelar edicao
          </button>
        ) : null}
      </div>
    </form>
  )
}

function MembersTable({ rows, onEdit }) {
  return (
    <article className="panel table-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Historico</p>
          <h3>Membros cadastrados</h3>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>Papel</th><th>Cor</th><th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatMemberRole(row.role)}</td>
                <td>
                  <span className="member-color-swatch" style={{ backgroundColor: row.accent }} aria-label={`Cor de ${row.name}`} />
                </td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-button inline-action" type="button" onClick={() => onEdit(row.id)}>Editar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function DeleteMemberSection({ members, selectedMemberId, onChangeMember, selectedMember, canDelete, reason, onDelete }) {
  if (!selectedMember) return null

  return (
    <article className="panel danger-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Zona de risco</p>
          <h3>Excluir membro da familia</h3>
        </div>
      </div>

      <label className="danger-select">
        Membro para excluir
        <select value={selectedMemberId} onChange={(event) => onChangeMember(event.target.value)}>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </label>

      <div className="danger-copy">
        <p>Membro selecionado: <strong>{selectedMember.name}</strong></p>
        <span>{reason}</span>
      </div>

      <button className="danger-button" type="button" onClick={onDelete} disabled={!canDelete}>
        Deletar membro
      </button>
    </article>
  )
}

export function CadastrosPage({ members, assets, selectedMemberId, onChangeDeleteMember, selectedMember, canDeleteMember, deleteReason, onAddMember, onEditMember, editingMember, onCancelEditMember, onDeleteMember }) {
  return (
    <section className="entries-layout">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Cadastro base</p>
            <h3>{editingMember ? 'Editar membro' : 'Novo membro'}</h3>
          </div>
        </div>
        <MemberForm onSubmit={onAddMember} initialData={editingMember} onCancel={editingMember ? onCancelEditMember : null} />
      </article>

      <MembersTable rows={members} onEdit={onEditMember} />

      <DataTable
        title="Ativos cadastrados"
        rows={assets}
        columns={[
          { key: 'ownerId', label: 'Membro', render: (row) => getOwnerName(row.ownerId, members) },
          { key: 'name', label: 'Nome' },
          { key: 'currency', label: 'Moeda' },
          { key: 'type', label: 'Tipo' },
          { key: 'purchaseValue', label: 'Compra', render: (row) => formatCurrency(row.purchaseValue ?? getAssetCurrentValue(row), row.currency) },
          { key: 'fees', label: 'Taxas', render: (row) => formatCurrency(row.fees ?? 0, row.currency) },
          { key: 'amount', label: 'Atual', render: (row) => formatCurrency(getAssetCurrentValue(row), row.currency) },
        ]}
      />

      <DeleteMemberSection
        members={members}
        selectedMemberId={selectedMemberId}
        onChangeMember={onChangeDeleteMember}
        selectedMember={selectedMember}
        canDelete={canDeleteMember}
        reason={deleteReason}
        onDelete={onDeleteMember}
      />
    </section>
  )
}
