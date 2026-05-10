import { useEffect, useMemo, useState } from 'react'
import { BrokerageNoteImportPanel } from '../components/ImportPanel/BrokerageNoteImportPanel'
import { DividendsTable, TransactionsTable } from '../components/DataTable'
import { DataTable } from '../components/DataTable'
import { formatCurrency, formatDecimalInput, formatSignedCurrency, parseLocalizedNumber } from '../lib/formatters'
import { getOwnerName } from '../lib/members'
import { normalizeTicker } from '../domain/portfolio'
import { assetCategories } from '../data/defaultData'
import { dividendIncomeTypes } from '../lib/constants'

function EntryForm({ mode, onSubmit, members, assets, initialData = null, submitLabel, onCancel, defaultOwnerId = '', selectedMemberName = '', selectedMemberAccent = '' }) {
  function buildInitialState() {
    if (initialData) {
      return {
        ...initialData,
        quantity: initialData.quantity != null ? String(initialData.quantity).replace('.', ',') : '',
        unitPrice: initialData.unitPrice != null ? String(initialData.unitPrice).replace('.', ',') : '',
        total: initialData.total != null ? String(initialData.total).replace('.', ',') : '',
        fees: initialData.fees != null ? String(initialData.fees).replace('.', ',') : '',
        amount: initialData.amount != null ? String(initialData.amount).replace('.', ',') : '',
      }
    }

    const resolvedOwnerId = initialData?.ownerId ?? defaultOwnerId ?? members[0]?.id ?? ''

    return mode === 'transaction'
      ? { ownerId: resolvedOwnerId, date: '', type: 'Compra', asset: '', category: 'Acoes', broker: '', quantity: '', unitPrice: '', total: '', fees: '', notes: '' }
      : { ownerId: resolvedOwnerId, date: '', asset: '', category: 'Acoes', incomeType: 'Dividendos', amount: '', referenceMonth: '', notes: '' }
  }

  const [formData, setFormData] = useState(buildInitialState)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => { setFormData(buildInitialState()); setSuccessMessage('') }, [defaultOwnerId, initialData, mode])

  const parsedQuantity = parseLocalizedNumber(formData.quantity)
  const parsedUnitPrice = parseLocalizedNumber(formData.unitPrice)
  const parsedFees = parseLocalizedNumber(formData.fees)
  const parsedDividendAmount = parseLocalizedNumber(formData.amount)
  const calculatedTransactionTotal = parsedQuantity * parsedUnitPrice + parsedFees

  function handleChange(event) {
    const { name, value } = event.target
    setSuccessMessage('')

    if (name === 'asset') {
      const matchedAsset = assets.find((asset) => asset.name.toLowerCase() === value.trim().toLowerCase())
      setFormData((current) => ({ ...current, [name]: value, category: matchedAsset?.type ?? current.category }))
      return
    }

    setFormData((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()

    const payload = mode === 'transaction'
      ? { ...formData, id: initialData?.id ?? crypto.randomUUID(), quantity: parsedQuantity, unitPrice: parsedUnitPrice, total: calculatedTransactionTotal, fees: parsedFees, asset: normalizeTicker(formData.asset) }
      : { ...formData, id: initialData?.id ?? crypto.randomUUID(), amount: parsedDividendAmount }

    const success = onSubmit(payload)
    if (success === false) return

    setSuccessMessage('Lancamento adicionado com sucesso.')
    if (!initialData) setFormData(buildInitialState())
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="member-select-field" style={selectedMemberAccent ? { '--member-accent': selectedMemberAccent } : undefined}>
          <span className="member-select-label-row">
            <span>Membro</span>
            {selectedMemberName ? (
              <span className="member-context-chip">
                <span className="member-context-dot" style={selectedMemberAccent ? { backgroundColor: selectedMemberAccent } : undefined} />
                Selecionado na sidebar: {selectedMemberName}
              </span>
            ) : null}
          </span>
          <select name="ownerId" value={formData.ownerId} onChange={handleChange} required>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label>
          Data
          <input name="date" type="date" value={formData.date} onChange={handleChange} required />
        </label>
        {mode === 'transaction' ? (
          <label>
            Operacao
            <select name="type" value={formData.type} onChange={handleChange}>
              <option value="Compra">Compra</option>
              <option value="Venda">Venda</option>
            </select>
          </label>
        ) : null}
        <label>
          Ativo
          <input name="asset" type="text" list={`asset-options-${mode}`} placeholder="Ex.: PETR4 ou HGLG11" value={formData.asset} onChange={handleChange} required />
          <datalist id={`asset-options-${mode}`}>
            {assets.map((asset) => <option key={asset.id} value={asset.name} />)}
          </datalist>
        </label>
        <label>
          Tipo
          <select name="category" value={formData.category} onChange={handleChange}>
            {assetCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>

        {mode === 'transaction' ? (
          <>
            <label>Corretora<input name="broker" type="text" value={formData.broker} onChange={handleChange} /></label>
            <label>Quantidade<input name="quantity" type="text" inputMode="decimal" placeholder="0,00" value={formData.quantity} onChange={handleChange} required /></label>
            <label>Preco unitario<input name="unitPrice" type="text" inputMode="decimal" placeholder="0,00" value={formData.unitPrice} onChange={handleChange} required /></label>
            <label>Valor total<input name="total" type="text" value={formatDecimalInput(calculatedTransactionTotal)} readOnly /></label>
            <label>Taxas<input name="fees" type="text" inputMode="decimal" placeholder="0,00" value={formData.fees} onChange={handleChange} /></label>
          </>
        ) : (
          <>
            <label>
              Tipo de provento
              <select name="incomeType" value={formData.incomeType} onChange={handleChange}>
                {dividendIncomeTypes.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>Valor recebido<input name="amount" type="text" inputMode="decimal" placeholder="0,00" value={formData.amount} onChange={handleChange} required /></label>
            <label>Mes de referencia<input name="referenceMonth" type="month" value={formData.referenceMonth} onChange={handleChange} /></label>
          </>
        )}

        <label className="full-width">
          Observacoes
          <textarea name="notes" rows="3" value={formData.notes} onChange={handleChange} />
        </label>
      </div>

      <div className="form-actions">
        <button className="primary-button submit-button" type="submit">{submitLabel || (mode === 'transaction' ? 'Adicionar compra' : 'Adicionar dividendo')}</button>
        {onCancel ? <button className="ghost-button inline-action" type="button" onClick={onCancel}>Cancelar edicao</button> : null}
        {successMessage ? <span className="form-success-message">{successMessage}</span> : null}
      </div>
    </form>
  )
}

function RealizedPnLTable({ rows, members }) {
  return (
    <DataTable
      title="Historico de Lucros e Perdas"
      rows={rows}
      columns={[
        { key: 'ownerId', label: 'Membro', render: (row) => getOwnerName(row.ownerId, members) },
        { key: 'date', label: 'Data' },
        { key: 'asset', label: 'Ativo' },
        { key: 'quantity', label: 'Quantidade' },
        { key: 'purchaseValue', label: 'Valor compra', render: (row) => formatCurrency(row.purchaseValue) },
        { key: 'saleValue', label: 'Valor venda', render: (row) => formatCurrency(row.saleValue) },
        { key: 'profitLoss', label: 'Lucro/Perda', render: (row) => <span className={Number(row.profitLoss) >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(row.profitLoss)}</span> },
      ]}
    />
  )
}

function HistoryMemberFilter({ members, filterOwnerId, onChange, selectedMember }) {
  return (
    <article className="panel">
      <label className="member-select-field history-filter-field" style={selectedMember?.accent ? { '--member-accent': selectedMember.accent } : undefined}>
        <span className="member-select-label-row">
          <span>Filtrar historicos por membro</span>
          <span className="member-context-chip">
            <span className="member-context-dot" style={selectedMember?.accent ? { backgroundColor: selectedMember.accent } : undefined} />
            {filterOwnerId ? `Exibindo: ${selectedMember?.name || 'Membro'}` : 'Exibindo: todos os membros'}
          </span>
        </span>
        <select value={filterOwnerId} onChange={(event) => onChange(event.target.value)}>
          <option value="">Todos os membros</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </label>
    </article>
  )
}

export function LancamentosPage({
  transactions, dividends, realizedPnLRows, onAddTransaction, onAddDividend,
  onEditTransaction, onDeleteTransaction, onEditDividend, onDeleteDividend,
  editingTransaction, editingDividend, onCancelEditTransaction, onCancelEditDividend,
  members, assets, selectedMemberId, selectedMember,
}) {
  const [historyFilterOwnerId, setHistoryFilterOwnerId] = useState('')
  const historyFilterMember = useMemo(() => members.find((member) => member.id === historyFilterOwnerId) ?? null, [historyFilterOwnerId, members])
  const filteredTransactions = useMemo(() => (historyFilterOwnerId ? transactions.filter((row) => row.ownerId === historyFilterOwnerId) : transactions), [historyFilterOwnerId, transactions])
  const filteredDividends = useMemo(() => (historyFilterOwnerId ? dividends.filter((row) => row.ownerId === historyFilterOwnerId) : dividends), [dividends, historyFilterOwnerId])
  const filteredRealizedPnLRows = useMemo(() => (historyFilterOwnerId ? realizedPnLRows.filter((row) => row.ownerId === historyFilterOwnerId) : realizedPnLRows), [historyFilterOwnerId, realizedPnLRows])

  return (
    <section className="entries-layout">
      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Lancamentos</p>
            <h3>Registrar operacoes</h3>
          </div>
        </div>
        <EntryForm
          mode="transaction"
          onSubmit={onAddTransaction}
          members={members}
          assets={assets}
          initialData={editingTransaction}
          submitLabel={editingTransaction ? 'Salvar operacao' : 'Adicionar operacao'}
          onCancel={editingTransaction ? onCancelEditTransaction : null}
          defaultOwnerId={selectedMemberId}
          selectedMemberName={selectedMember?.name ?? ''}
          selectedMemberAccent={selectedMember?.accent ?? ''}
        />
      </article>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Renda passiva</p>
            <h3>Registrar dividendos</h3>
          </div>
        </div>
        <EntryForm
          mode="dividend"
          onSubmit={onAddDividend}
          members={members}
          assets={assets}
          initialData={editingDividend}
          submitLabel={editingDividend ? 'Salvar dividendo' : 'Adicionar dividendo'}
          onCancel={editingDividend ? onCancelEditDividend : null}
          defaultOwnerId={selectedMemberId}
          selectedMemberName={selectedMember?.name ?? ''}
          selectedMemberAccent={selectedMember?.accent ?? ''}
        />
      </article>

      <BrokerageNoteImportPanel
        members={members}
        assets={assets}
        selectedMemberId={selectedMemberId}
        selectedMember={selectedMember}
        transactions={transactions}
        dividends={dividends}
        onAddTransaction={onAddTransaction}
        onAddDividend={onAddDividend}
      />

      <HistoryMemberFilter members={members} filterOwnerId={historyFilterOwnerId} onChange={setHistoryFilterOwnerId} selectedMember={historyFilterMember} />

      <TransactionsTable rows={filteredTransactions} members={members} onEdit={onEditTransaction} onDelete={onDeleteTransaction} />
      <DividendsTable rows={filteredDividends} members={members} onEdit={onEditDividend} onDelete={onDeleteDividend} />
      <RealizedPnLTable rows={filteredRealizedPnLRows} members={members} />
    </section>
  )
}
