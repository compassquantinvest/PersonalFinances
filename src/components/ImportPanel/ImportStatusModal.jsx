export function ImportStatusModal({ open, title, message }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel modal-status-panel">
        <div className="panel-header modal-header">
          <div>
            <p className="eyebrow">Importacao assistida</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="import-help-text">{message}</p>
      </div>
    </div>
  )
}
