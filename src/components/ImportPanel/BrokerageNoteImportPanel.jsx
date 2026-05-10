import { useRef, useState } from 'react'
import OcrWorker from '../../workers/ocrWorker.js?worker'
import { parseBrokerageNoteText, isTransactionDuplicate } from '../../domain/ocr/brokerageParser'
import { parseDividendReceiptText, isDividendDuplicate } from '../../domain/ocr/dividendParser'
import { ImportStatusModal } from './ImportStatusModal'
import { BrokerageImportReviewModal } from './BrokerageImportReviewModal'

function extractTextViaWorker(file, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new OcrWorker()

    worker.onmessage = (event) => {
      const { type, message, text } = event.data
      if (type === 'progress') { onProgress(message); return }
      worker.terminate()
      if (type === 'result') resolve(text)
      else reject(new Error(message || 'Erro no worker de OCR.'))
    }

    worker.onerror = (error) => {
      worker.terminate()
      reject(new Error(error.message || 'Falha ao inicializar worker de OCR.'))
    }

    worker.postMessage({ type: 'extractText', file })
  })
}

export function BrokerageNoteImportPanel({ members, assets, selectedMemberId, selectedMember, transactions, dividends, onAddTransaction, onAddDividend }) {
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [importError, setImportError] = useState('')
  const [ocrDebugText, setOcrDebugText] = useState('')
  const [importResultMessage, setImportResultMessage] = useState('')
  const [resultTone, setResultTone] = useState('success')
  const [statusModal, setStatusModal] = useState({ open: false, title: '', message: '' })
  const [isDragActive, setIsDragActive] = useState(false)
  const [previewState, setPreviewState] = useState({ open: false, rows: [], broker: '', date: '', fileName: '', duplicateCount: 0 })

  function updateStatus(title, message) { setStatusModal({ open: true, title, message }) }
  function closeStatus() { setStatusModal({ open: false, title: '', message: '' }) }

  function getImportableFile(fileList) {
    return [...(fileList || [])].find(
      (file) => file.type === 'application/pdf' || String(file.type || '').startsWith('image/') || file.name?.toLowerCase().endsWith('.pdf'),
    )
  }

  async function processImportedFile(file) {
    if (!file) return
    setImportResultMessage(''); setImportError(''); setOcrDebugText(''); setResultTone('success'); setIsProcessing(true)
    updateStatus('Preparando arquivo', `Recebido: ${file.name || 'imagem colada'}`)

    const updateProgressMessage = (message) => updateStatus('Importacao em andamento', message)
    const assetTickers = assets.filter((asset) => !selectedMemberId || asset.ownerId === selectedMemberId).map((asset) => asset.name)

    try {
      const rawText = await extractTextViaWorker(file, updateProgressMessage)
      setOcrDebugText(rawText)
      updateStatus('Analisando conteudo', 'Estruturando lancamentos encontrados...')

      const transactionImport = parseBrokerageNoteText(rawText, selectedMemberId)
      const dividendImport = parseDividendReceiptText(rawText, selectedMemberId, assetTickers)
      const parsedRows = [...transactionImport.rows, ...dividendImport.rows]
      const previewRows = parsedRows.map((row) => ({
        ...row,
        isDuplicate: row.kind === 'dividend'
          ? dividends.some((entry) => isDividendDuplicate(entry, row))
          : transactions.some((entry) => isTransactionDuplicate(entry, row)),
      }))
      const duplicateCount = previewRows.filter((row) => row.isDuplicate).length

      if (!previewRows.length) {
        closeStatus(); setResultTone('error')
        setImportError('Nao foi possivel identificar lancamentos validos na nota. Verifique a legibilidade do PDF ou da imagem.')
        return
      }

      const actionableRows = previewRows.filter((row) => !row.isDuplicate)
      if (!actionableRows.length) {
        closeStatus(); setResultTone('error')
        setImportError(duplicateCount ? 'Nao adicionado: encontrado evento duplicado para todos os lancamentos detectados.' : 'Nao foi possivel identificar lancamentos validos na nota.')
        setPreviewState({ open: true, rows: previewRows, broker: transactionImport.broker, date: transactionImport.rawDate || dividendImport.rawDate || transactionImport.date || dividendImport.date, fileName: file.name || 'imagem-colada.png', duplicateCount })
        return
      }

      closeStatus()
      setPreviewState({ open: true, rows: previewRows, broker: transactionImport.broker, date: transactionImport.rawDate || dividendImport.rawDate || transactionImport.date || dividendImport.date, fileName: file.name || 'imagem-colada.png', duplicateCount })
    } catch (error) {
      closeStatus(); setResultTone('error')
      setImportError(error.message || 'Nao foi possivel ler a nota. Tente um PDF mais nitido ou uma imagem mais legivel.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleFileChange(event) { const file = event.target.files?.[0]; await processImportedFile(file); event.target.value = '' }
  async function handlePaste(event) {
    const file = getImportableFile(event.clipboardData?.files)
    if (!file) return
    event.preventDefault()
    await processImportedFile(file)
  }
  async function handleDrop(event) {
    event.preventDefault(); setIsDragActive(false)
    const file = getImportableFile(event.dataTransfer?.files)
    await processImportedFile(file)
  }

  function handleApproveImport() {
    const existingRows = [...transactions]
    let addedCount = 0, duplicateCount = 0, failureCount = 0

    previewState.rows.forEach((row) => {
      if (row.kind === 'dividend') {
        if (dividends.some((entry) => isDividendDuplicate(entry, row))) { duplicateCount += 1; return }
        const success = onAddDividend({ id: row.id, ownerId: row.ownerId, date: row.date, asset: row.asset, category: row.category, incomeType: row.incomeType, amount: row.amount, referenceMonth: row.referenceMonth, notes: row.notes })
        if (success === false) { failureCount += 1; return }
        addedCount += 1; return
      }

      if (existingRows.some((entry) => isTransactionDuplicate(entry, row))) { duplicateCount += 1; return }
      const success = onAddTransaction(row)
      if (success === false) { failureCount += 1; return }
      addedCount += 1; existingRows.push(row)
    })

    setPreviewState({ open: false, rows: [], broker: '', date: '', fileName: '', duplicateCount: 0 })

    if (addedCount > 0 && duplicateCount === 0 && failureCount === 0) {
      setResultTone('success'); setImportResultMessage(`Registro efetuado. ${addedCount} lancamento(s) incluido(s).`)
      return
    }
    if (addedCount > 0) {
      setResultTone('success'); setImportResultMessage(`Registro efetuado com ressalvas. Incluidos: ${addedCount}. Duplicados: ${duplicateCount}. Nao processados: ${failureCount}.`)
      return
    }
    setResultTone('error')
    setImportError(duplicateCount > 0 ? 'Nao adicionado: encontrado evento duplicado.' : 'Nao foi possivel efetuar o registro dos lancamentos selecionados.')
  }

  return (
    <>
      <article className="panel import-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Importacao assistida</p>
            <h3>Anexar nota de corretagem</h3>
            <span className="research-subtitle">PDF ou imagem. Arraste o arquivo, cole um screenshot com Cmd+V ou selecione manualmente.</span>
          </div>
        </div>

        <div
          ref={dropZoneRef}
          className={`import-panel-body import-dropzone ${isDragActive ? 'drag-active' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragActive(true) }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragActive(false) }}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
        >
          <div className="import-context-row">
            <span className="member-context-chip">
              <span className="member-context-dot" style={selectedMember?.accent ? { backgroundColor: selectedMember.accent } : undefined} />
              Membro atual: {selectedMember?.name || 'Sem membro'}
            </span>
            <span className="mono">Corretora esperada: CLEAR</span>
          </div>

          <input ref={fileInputRef} className="hidden-file-input" type="file" accept="application/pdf,image/*" onChange={handleFileChange} />

          <div className="form-actions import-actions-row">
            <button className="primary-button submit-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
              {isProcessing ? 'Processando...' : 'Selecionar PDF ou imagem'}
            </button>
            <span className="import-help-text">Funciona melhor com notas da Clear onde a area "Negocios realizados" esteja legivel.</span>
          </div>

          <div className="import-dropzone-copy">
            <strong>Solte aqui o PDF/imagem ou cole um screenshot com Cmd+V.</strong>
          </div>

          {importError ? <p className="form-error-message">{importError}</p> : null}
          {importError && ocrDebugText ? (
            <details className="import-debug-box">
              <summary>Ver texto lido pelo OCR</summary>
              <pre>{ocrDebugText}</pre>
            </details>
          ) : null}
          {importResultMessage ? (
            <p className={resultTone === 'success' ? 'form-success-message' : 'form-error-message'}>{importResultMessage}</p>
          ) : null}
        </div>
      </article>

      <ImportStatusModal open={statusModal.open} title={statusModal.title} message={statusModal.message} />
      <BrokerageImportReviewModal
        open={previewState.open}
        rows={previewState.rows}
        members={members}
        fileName={previewState.fileName}
        broker={previewState.broker}
        date={previewState.date}
        duplicateCount={previewState.duplicateCount}
        onRemoveRow={(rowId) => setPreviewState((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== rowId) }))}
        onClose={() => setPreviewState((current) => ({ ...current, open: false }))}
        onConfirm={handleApproveImport}
      />
    </>
  )
}
