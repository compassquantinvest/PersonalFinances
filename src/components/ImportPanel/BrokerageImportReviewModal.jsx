import { formatCurrency } from '../../lib/formatters'
import { getOwnerName } from '../../lib/members'

export function BrokerageImportReviewModal({ open, rows, members, fileName, broker, date, onClose, onConfirm, onRemoveRow, duplicateCount = 0 }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel">
        <div className="panel-header modal-header">
          <div>
            <p className="eyebrow">Importacao de nota</p>
            <h3>Revisar lancamentos encontrados</h3>
          </div>
          <button className="ghost-button inline-action" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="import-meta-grid">
          <div className="summary-item"><span>Arquivo</span><strong>{fileName || '-'}</strong></div>
          <div className="summary-item"><span>Corretora</span><strong>{broker || '-'}</strong></div>
          <div className="summary-item"><span>Data</span><strong>{date || '-'}</strong></div>
          <div className="summary-item"><span>Registros</span><strong>{rows.length}</strong></div>
        </div>

        {duplicateCount ? <p className="import-help-text">{duplicateCount} registro(s) duplicado(s) foram ignorados antes da revisao.</p> : null}

        <div className="table-wrap modal-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th>Membro</th><th>Data</th><th>Origem</th><th>Evento</th>
                <th>Ativo</th><th>Categoria</th><th>Quantidade</th><th>Preco/valor</th>
                <th>Total/credito</th><th>Status</th><th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isDuplicate ? 'import-row-duplicate' : ''}>
                  <td>{row.kind === 'dividend' ? 'Provento' : 'Operacao'}</td>
                  <td>{getOwnerName(row.ownerId, members)}</td>
                  <td>{row.date}</td>
                  <td>{row.kind === 'dividend' ? 'Comprovante' : row.broker}</td>
                  <td>{row.kind === 'dividend' ? row.incomeType : row.type}</td>
                  <td>{row.asset}</td>
                  <td>{row.category}</td>
                  <td>{row.kind === 'dividend' ? '-' : row.quantity}</td>
                  <td>{formatCurrency(row.kind === 'dividend' ? row.amount || 0 : row.unitPrice || 0)}</td>
                  <td>{formatCurrency(row.kind === 'dividend' ? row.amount || 0 : row.total || 0)}</td>
                  <td>
                    {row.isDuplicate
                      ? <span className="import-status-badge duplicate">Duplicado</span>
                      : <span className="import-status-badge">Novo</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="danger-icon-button" type="button" onClick={() => onRemoveRow(row.id)} aria-label={`Excluir ${row.asset}`}>
                        lixeira
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-actions">
          <button className="primary-button submit-button" type="button" onClick={onConfirm} disabled={!rows.length}>
            Aprovar e adicionar todos
          </button>
          <button className="ghost-button inline-action" type="button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
