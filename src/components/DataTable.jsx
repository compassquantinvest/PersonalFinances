import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../lib/formatters'

export function sortTableRows(rows, getValue, direction) {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = getValue(left)
    const rightValue = getValue(right)

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return String(leftValue || '').toLowerCase().localeCompare(String(rightValue || '').toLowerCase(), 'pt-BR')
    }

    return Number(leftValue || 0) - Number(rightValue || 0)
  })

  return direction === 'desc' ? sorted.reverse() : sorted
}

export function TableSortBar({ sortBy, sortDirection, onChangeSortBy, onToggleDirection, options, directionLabels }) {
  return (
    <div className="table-sortbar">
      <div className="sort-controls compact-sort-controls">
        {options.map((option) => (
          <button
            key={option.value}
            className={`ghost-button ${sortBy === option.value ? 'active' : ''}`}
            onClick={() => onChangeSortBy(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
        <button className="ghost-button inline-action" type="button" onClick={onToggleDirection}>
          inverter ordem
        </button>
        <span className="mono">{sortDirection === 'desc' ? directionLabels.desc : directionLabels.asc}</span>
      </div>
    </div>
  )
}

export function DataTable({ title, rows, columns }) {
  return (
    <article className="panel table-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Historico</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function TransactionsTable({ rows, members, onEdit, onDelete }) {
  const pageSizeOptions = [10, 20, 50]
  const [pageSize, setPageSize] = useState(pageSizeOptions[0])
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')

  const { getOwnerName } = useMemo(() => ({
    getOwnerName: (ownerId) => members.find((m) => m.id === ownerId)?.name || ownerId,
  }), [members])

  const sortedRows = useMemo(() => {
    const getValue = (row) => {
      if (sortBy === 'member') return getOwnerName(row.ownerId)
      if (sortBy === 'asset') return row.asset
      if (sortBy === 'type') return row.type
      if (sortBy === 'category') return row.category
      if (sortBy === 'quantity') return Number(row.quantity || 0)
      if (sortBy === 'unitPrice') return Number(row.unitPrice || 0)
      if (sortBy === 'fees') return Number(row.fees || 0)
      if (sortBy === 'total') return Number(row.total || 0)
      return row.date
    }
    return sortTableRows(rows, getValue, sortDirection)
  }, [getOwnerName, rows, sortBy, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize)

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  function handlePageSizeChange(event) { setPageSize(Number(event.target.value)); setPage(1) }
  function handleChangeSortBy(nextSortBy) { setSortBy(nextSortBy); setPage(1) }
  function handleToggleDirection() { setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc')); setPage(1) }

  return (
    <article className="panel table-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Historico</p>
          <h3>Operacoes recentes</h3>
        </div>
      </div>

      <TableSortBar
        sortBy={sortBy}
        sortDirection={sortDirection}
        onChangeSortBy={handleChangeSortBy}
        onToggleDirection={handleToggleDirection}
        options={[
          { value: 'date', label: 'data' },
          { value: 'asset', label: 'ativo' },
          { value: 'type', label: 'operacao' },
          { value: 'member', label: 'membro' },
          { value: 'quantity', label: 'qte' },
          { value: 'unitPrice', label: 'preco/un' },
          { value: 'total', label: 'total' },
        ]}
        directionLabels={{ desc: 'mais novo > mais antigo', asc: 'mais antigo > mais novo' }}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Membro</th><th>Data</th><th>Operacao</th><th>Ativo</th>
              <th>Categoria</th><th>Quantidade</th><th>Preco/un</th><th>Taxas</th><th>Total</th><th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id}>
                <td>{getOwnerName(row.ownerId)}</td>
                <td>{row.date}</td>
                <td>{row.type}</td>
                <td>{row.asset}</td>
                <td>{row.category}</td>
                <td>{row.quantity}</td>
                <td>{formatCurrency(row.unitPrice ?? 0)}</td>
                <td>{formatCurrency(row.fees ?? 0)}</td>
                <td>{formatCurrency(row.total ?? 0)}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-button inline-action" type="button" onClick={() => onEdit(row.id)}>Editar</button>
                    <button className="danger-icon-button" type="button" onClick={() => onDelete(row.id)} aria-label={`Excluir ${row.asset}`}>lixeira</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <label className="table-pagination-size">
          Registros por pagina
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="table-pagination-controls">
          <button className="ghost-button inline-action" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>←</button>
          <span className="mono">{currentPage}/{totalPages}</span>
          <button className="ghost-button inline-action" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>→</button>
        </div>
      </div>
    </article>
  )
}

export function DividendsTable({ rows, members, onEdit, onDelete }) {
  const pageSizeOptions = [10, 20, 50]
  const [pageSize, setPageSize] = useState(pageSizeOptions[0])
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')

  const { getOwnerName } = useMemo(() => ({
    getOwnerName: (ownerId) => members.find((m) => m.id === ownerId)?.name || ownerId,
  }), [members])

  const sortedRows = useMemo(() => {
    const getValue = (row) => {
      if (sortBy === 'member') return getOwnerName(row.ownerId)
      if (sortBy === 'asset') return row.asset
      if (sortBy === 'category') return row.category
      if (sortBy === 'incomeType') return row.incomeType || 'Dividendos'
      if (sortBy === 'amount') return Number(row.amount || 0)
      return row.date
    }
    return sortTableRows(rows, getValue, sortDirection)
  }, [getOwnerName, rows, sortBy, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedRows = sortedRows.slice(startIndex, startIndex + pageSize)

  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  function handlePageSizeChange(event) { setPageSize(Number(event.target.value)); setPage(1) }
  function handleChangeSortBy(nextSortBy) { setSortBy(nextSortBy); setPage(1) }
  function handleToggleDirection() { setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc')); setPage(1) }

  return (
    <article className="panel table-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Historico</p>
          <h3>Dividendos recebidos</h3>
        </div>
      </div>

      <TableSortBar
        sortBy={sortBy}
        sortDirection={sortDirection}
        onChangeSortBy={handleChangeSortBy}
        onToggleDirection={handleToggleDirection}
        options={[
          { value: 'date', label: 'data' },
          { value: 'asset', label: 'ativo' },
          { value: 'member', label: 'membro' },
          { value: 'incomeType', label: 'tipo' },
          { value: 'amount', label: 'valor' },
        ]}
        directionLabels={{ desc: 'mais novo > mais antigo', asc: 'mais antigo > mais novo' }}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Membro</th><th>Data</th><th>Ativo</th><th>Categoria</th>
              <th>Tipo de provento</th><th>Referencia</th><th>Valor</th><th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id}>
                <td>{getOwnerName(row.ownerId)}</td>
                <td>{row.date}</td>
                <td>{row.asset}</td>
                <td>{row.category}</td>
                <td>{row.incomeType || 'Dividendos'}</td>
                <td>{row.referenceMonth || '-'}</td>
                <td>{formatCurrency(row.amount ?? 0)}</td>
                <td>
                  <div className="row-actions">
                    <button className="ghost-button inline-action" type="button" onClick={() => onEdit(row.id)}>Editar</button>
                    <button className="danger-icon-button" type="button" onClick={() => onDelete(row.id)} aria-label={`Excluir ${row.asset}`}>lixeira</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <label className="table-pagination-size">
          Registros por pagina
          <select value={pageSize} onChange={handlePageSizeChange}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <div className="table-pagination-controls">
          <button className="ghost-button inline-action" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>←</button>
          <span className="mono">{currentPage}/{totalPages}</span>
          <button className="ghost-button inline-action" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>→</button>
        </div>
      </div>
    </article>
  )
}
