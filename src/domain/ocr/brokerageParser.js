import { normalizeTicker } from '../portfolio'

// ── Helpers de número e data ──────────────────────────────────────────────────

/** @param {string} value */
export function parseBrokerageLocalizedNumber(value) {
  return Number(
    String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'),
  )
}

/** @param {string} text */
export function extractDateFromBrokerageText(text) {
  const match = String(text || '').match(/\b(\d{2}\/\d{2}\/\d{4})\b/)
  return match ? match[1] : ''
}

/** @param {string} value */
export function convertBrokerageDateToIso(value) {
  const [day, month, year] = String(value || '').split('/')
  if (!day || !month || !year) return ''
  return `${year}-${month}-${day}`
}

/** @param {string} ticker */
export function inferAssetCategoryFromTicker(ticker) {
  return /\d{2}$/.test(ticker) ? 'FIIs' : 'Acoes'
}

// ── Parser principal ──────────────────────────────────────────────────────────

/**
 * @param {string} rawText
 * @param {string} ownerId
 */
export function parseBrokerageNoteText(rawText, ownerId) {
  const normalizedText = String(rawText || '')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean)
  const broker = normalizedText.toUpperCase().includes('CLEAR') ? 'CLEAR' : ''
  const referenceDate = extractDateFromBrokerageText(normalizedText)
  const parsedDate = convertBrokerageDateToIso(referenceDate)
  const tickerPattern = /\b([A-Z]{4}\d{1,2}|[A-Z]{5}\d{1,2})\b/
  const operationPattern = /\b(COMPRA|VENDA|COMP|VEND|C|V)\b/i

  const rows = lines.flatMap((line, lineIndex) => {
    const upperLine = line.toUpperCase()

    if (!tickerPattern.test(upperLine) || !operationPattern.test(upperLine)) return []

    const ticker = upperLine.match(tickerPattern)?.[1] || ''
    const operationToken = upperLine.match(operationPattern)?.[1] || ''
    const operationType = operationToken.startsWith('V') ? 'Venda' : 'Compra'
    const numberTokens = upperLine.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/g) || []

    if (!ticker || numberTokens.length < 2) return []

    const quantityToken = numberTokens.find((token) => !token.includes(',') && Number(token.replace(/\./g, '')) > 0) || numberTokens[0]
    const quantity = parseBrokerageLocalizedNumber(quantityToken)

    if (!Number.isFinite(quantity) || quantity <= 0) return []

    const unitPriceCandidates = numberTokens
      .filter((token) => token !== quantityToken)
      .map((token) => ({ raw: token, value: parseBrokerageLocalizedNumber(token) }))
      .filter((token) => Number.isFinite(token.value) && token.value > 0)
    const unitPrice = unitPriceCandidates[0]?.value || 0
    const totalCandidate = unitPriceCandidates[unitPriceCandidates.length - 1]?.value || unitPrice * quantity

    if (!unitPrice) return []

    return [{
      id: `import-${parsedDate || 'sem-data'}-${ticker}-${lineIndex}-${quantity}`,
      ownerId,
      date: parsedDate,
      type: operationType,
      asset: ticker,
      category: inferAssetCategoryFromTicker(ticker),
      broker: broker || 'CLEAR',
      quantity,
      unitPrice,
      total: totalCandidate || unitPrice * quantity,
      fees: 0,
      notes: referenceDate
        ? `Importado da nota de corretagem ${broker || 'CLEAR'} de ${referenceDate}.`
        : `Importado da nota de corretagem ${broker || 'CLEAR'}.`,
    }]
  })

  const dedupedRows = rows.filter(
    (row, index, currentRows) =>
      currentRows.findIndex(
        (candidate) =>
          candidate.ownerId === row.ownerId &&
          candidate.date === row.date &&
          candidate.type === row.type &&
          candidate.asset === row.asset &&
          Number(candidate.quantity || 0) === Number(row.quantity || 0) &&
          Number(candidate.unitPrice || 0) === Number(row.unitPrice || 0),
      ) === index,
  )

  return {
    broker: broker || 'CLEAR',
    date: parsedDate,
    rawDate: referenceDate,
    rows: dedupedRows.map((row) => ({ ...row, kind: 'transaction' })),
  }
}

/**
 * @param {import('../../types.js').Transaction} existingEntry
 * @param {object} importedEntry
 */
export function isTransactionDuplicate(existingEntry, importedEntry) {
  return (
    String(existingEntry.ownerId || '') === String(importedEntry.ownerId || '') &&
    String(existingEntry.date || '') === String(importedEntry.date || '') &&
    String(existingEntry.type || 'Compra') === String(importedEntry.type || 'Compra') &&
    normalizeTicker(existingEntry.asset) === normalizeTicker(importedEntry.asset) &&
    Math.abs(Number(existingEntry.quantity || 0) - Number(importedEntry.quantity || 0)) < 0.000001 &&
    Math.abs(Number(existingEntry.unitPrice || 0) - Number(importedEntry.unitPrice || 0)) < 0.000001
  )
}
