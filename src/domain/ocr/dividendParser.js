import { normalizeTicker } from '../portfolio'
import {
  extractDateFromBrokerageText,
  convertBrokerageDateToIso,
  inferAssetCategoryFromTicker,
} from './brokerageParser'
import {
  normalizeOcrTicker,
  buildOcrTolerantTickerPattern,
  resolveTickerFromKnownAssets,
  findKnownTickerMatches,
} from './tickerUtils'

/** @param {string} value */
function normalizeDetectionText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
}

/** @param {string} value */
function parseImplicitCentsNumber(value) {
  const numericValue = String(value || '').replace(/[^\d-]/g, '')
  if (!/^-?\d{3,6}$/.test(numericValue)) return Number.NaN
  return Number(numericValue) / 100
}

function parseBrokerageLocalizedNumber(value) {
  return Number(
    String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'),
  )
}

/** @param {string} text */
function extractIncomeAmountCandidates(text, { afterIndex = 0 } = {}) {
  const relevantText = String(text || '').slice(afterIndex)
  const rawMatches = [...relevantText.matchAll(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d{3,6}/g)]

  return rawMatches
    .map((match) => {
      const raw = match[0]
      const value = raw.includes(',') ? parseBrokerageLocalizedNumber(raw) : parseImplicitCentsNumber(raw)
      return { raw, index: (match.index || 0) + afterIndex, value }
    })
    .filter((match) => Number.isFinite(match.value) && match.value > 0)
}

/** @param {string} text */
export function detectIncomeTypeFromText(text) {
  const upperText = normalizeDetectionText(text)

  if (upperText.includes('FRAC') && upperText.includes('ACO')) return 'Fracao de acoes (nao recorrente)'
  if (upperText.includes('JUROS') || upperText.includes('JCP')) return 'Juros sobre capital proprio (JCP)'
  if (upperText.includes('DIVIDEND')) return 'Dividendos'
  if (upperText.includes('RENDIMENTO')) return 'Rendimento de FII/FIAGRO/FIP'
  return 'Outros proventos'
}

/** @param {string} text @param {string} ticker */
function resolveIncomeCategoryForAsset(text, ticker) {
  const detectedIncomeType = detectIncomeTypeFromText(text)
  if (detectedIncomeType === 'Fracao de acoes (nao recorrente)') return 'Acoes'
  return inferAssetCategoryFromTicker(ticker)
}

/** @param {string} text @param {string} ticker */
function resolveIncomeTypeForAsset(text, ticker) {
  const detectedIncomeType = detectIncomeTypeFromText(text)
  const assetCategory = resolveIncomeCategoryForAsset(text, ticker)
  if (detectedIncomeType === 'Rendimento de FII/FIAGRO/FIP' && assetCategory === 'Acoes') return 'Dividendos'
  return detectedIncomeType
}

/**
 * @param {string} rawText
 * @param {string} ownerId
 * @param {string[]} assetTickers
 */
export function parseDividendReceiptText(rawText, ownerId, assetTickers = []) {
  const normalizedText = String(rawText || '')
    .replace(/\r/g, '\n').replace(/[|]/g, ' ').replace(/[^\S\n]+/g, ' ')
  const upperText = normalizedText.toUpperCase()
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean)
  const referenceDate = extractDateFromBrokerageText(normalizedText)
  const parsedDate = convertBrokerageDateToIso(referenceDate)

  const extractDividendRow = (sourceText, index, rowDate = parsedDate, rowRawDate = referenceDate) => {
    const upperLine = sourceText.toUpperCase()
    const knownTicker = resolveTickerFromKnownAssets(upperLine, assetTickers)
    const rawTickerMatch =
      upperLine.match(/([A-Z]{4,5}[0-9IL]{1,2})(?=S?\/?\d|\b)/) ||
      upperLine.match(/\b([A-Z]{4}[0-9IL]{1,2}|[A-Z]{5}[0-9IL]{1,2})\b/) ||
      upperLine.match(/\b([A-Z]{4,5})\s*([0-9IL]{1,2})\b/)
    const rawTicker = rawTickerMatch ? (rawTickerMatch[2] ? `${rawTickerMatch[1]}${rawTickerMatch[2]}` : rawTickerMatch[1]) : ''
    const normalizedRawTicker = normalizeOcrTicker(rawTicker)
    const completedTicker =
      !knownTicker && detectIncomeTypeFromText(upperLine) === 'Rendimento de FII/FIAGRO/FIP' && /^[A-Z]{4,5}\d$/.test(normalizedRawTicker)
        ? `${normalizedRawTicker}1`
        : normalizedRawTicker
    const ticker = knownTicker || completedTicker
    const incomeType = resolveIncomeTypeForAsset(upperLine, ticker)
    const quantityMatch = upperLine.match(/\bS\s*\/\s*(\d{1,6})\b/)
    const amountSearchStart = quantityMatch?.index != null
      ? quantityMatch.index + quantityMatch[0].length
      : rawTickerMatch?.index != null
        ? rawTickerMatch.index + rawTicker.length
        : 0
    const positiveAmounts = extractIncomeAmountCandidates(upperLine, { afterIndex: amountSearchStart }).map((m) => m.value)
    const amount = positiveAmounts.length >= 1 ? positiveAmounts[0] : 0

    if (!ticker || !rowDate || !Number.isFinite(amount) || amount <= 0) return []

    return [{
      id: `import-dividend-${rowDate}-${ticker}-${index}-${amount}`,
      kind: 'dividend',
      ownerId,
      date: rowDate,
      asset: ticker,
      category: resolveIncomeCategoryForAsset(upperLine, ticker),
      incomeType,
      amount,
      referenceMonth: incomeType === 'Fracao de acoes (nao recorrente)' ? '' : rowDate.slice(0, 7),
      notes: rowRawDate ? `Importado de comprovante de provento de ${rowRawDate}.` : 'Importado de comprovante de provento.',
    }]
  }

  const buildMergedTickerMatches = (sourceText) => {
    const upperSourceText = sourceText.toUpperCase()
    const knownTickerMatches = findKnownTickerMatches(upperSourceText, assetTickers)
    const rawTickerMatches = [...upperSourceText.matchAll(/[A-Z]{4,5}[0-9IL]{1,2}/g)].map((match) => {
      const rawCandidate = match[0]
      const normalizedRaw = normalizeOcrTicker(rawCandidate)
      const resolvedFromKnown = resolveTickerFromKnownAssets(rawCandidate, assetTickers)
      const resolvedTicker = resolvedFromKnown ||
        assetTickers.find((ticker) => {
          const nt = normalizeTicker(ticker)
          return nt.startsWith(normalizedRaw) || normalizedRaw.startsWith(nt.slice(0, -1))
        }) || normalizedRaw

      return { index: match.index, ticker: normalizeTicker(resolvedTicker) }
    })

    return [...knownTickerMatches, ...rawTickerMatches]
      .filter((m) => m.ticker)
      .sort((a, b) => a.index - b.index)
      .filter(
        (m, i, arr) =>
          arr.findIndex(
            (c) => c.ticker === m.ticker && Math.abs(Number(c.index || 0) - Number(m.index || 0)) < 4,
          ) === i,
      )
  }

  const selectEntryAmounts = (amountMatches, expectedCount) => {
    if (!expectedCount || !amountMatches.length) return []
    if (amountMatches.length <= expectedCount) return amountMatches

    const pairedAmounts = []
    for (let i = 0; i + 1 < amountMatches.length && pairedAmounts.length < expectedCount; i += 2) {
      const left = amountMatches[i], right = amountMatches[i + 1]
      if (!left || !right) continue
      const looksLikeEventAndBalance = right.value > left.value && (right.value >= left.value * 3 || right.value - left.value >= 20)
      if (!looksLikeEventAndBalance) { pairedAmounts.length = 0; break }
      pairedAmounts.push(left)
    }

    return pairedAmounts.length === expectedCount ? pairedAmounts : amountMatches.slice(0, expectedCount)
  }

  const buildSectionRows = (sectionText, sectionIndex, rowDate, rowRawDate) => {
    const upperSection = sectionText.toUpperCase()
    const mergedTickerMatches = buildMergedTickerMatches(upperSection)
    const amountMatches = extractIncomeAmountCandidates(upperSection)

    const windowRows = mergedTickerMatches.flatMap((tickerMatch, ti) => {
      const nextTickerIndex = mergedTickerMatches[ti + 1]?.index ?? Number.POSITIVE_INFINITY
      const amountMatch = amountMatches.find((c) => c.index > tickerMatch.index && c.index < nextTickerIndex)
      if (!amountMatch) return []

      return [{
        id: `import-dividend-section-${rowDate}-${tickerMatch.ticker}-${sectionIndex}-${ti}-${amountMatch.value}`,
        kind: 'dividend', ownerId, date: rowDate, asset: tickerMatch.ticker,
        category: resolveIncomeCategoryForAsset(upperSection, tickerMatch.ticker),
        incomeType: resolveIncomeTypeForAsset(upperSection, tickerMatch.ticker),
        amount: amountMatch.value,
        referenceMonth: resolveIncomeTypeForAsset(upperSection, tickerMatch.ticker) === 'Fracao de acoes (nao recorrente)' ? '' : rowDate.slice(0, 7),
        notes: rowRawDate ? `Importado de comprovante de provento de ${rowRawDate}.` : 'Importado de comprovante de provento.',
      }]
    })

    const missingTickerMatches = mergedTickerMatches.filter((tm) => !windowRows.some((r) => normalizeTicker(r.asset) === normalizeTicker(tm.ticker)))
    const orderedAmounts = selectEntryAmounts(amountMatches, mergedTickerMatches.length)
    const orderedRows = missingTickerMatches.length && orderedAmounts.length >= mergedTickerMatches.length
      ? mergedTickerMatches.flatMap((tickerMatch, ti) => {
          const amountMatch = orderedAmounts[ti]
          if (!amountMatch) return []
          return [{
            id: `import-dividend-ordered-${rowDate}-${tickerMatch.ticker}-${sectionIndex}-${ti}-${amountMatch.value}`,
            kind: 'dividend', ownerId, date: rowDate, asset: tickerMatch.ticker,
            category: resolveIncomeCategoryForAsset(upperSection, tickerMatch.ticker),
            incomeType: resolveIncomeTypeForAsset(upperSection, tickerMatch.ticker),
            amount: amountMatch.value,
            referenceMonth: resolveIncomeTypeForAsset(upperSection, tickerMatch.ticker) === 'Fracao de acoes (nao recorrente)' ? '' : rowDate.slice(0, 7),
            notes: rowRawDate ? `Importado de comprovante de provento de ${rowRawDate}.` : 'Importado de comprovante de provento.',
          }]
        })
      : []

    return [...windowRows, ...orderedRows].filter(
      (row, i, arr) => arr.findIndex((c) => c.date === row.date && normalizeTicker(c.asset) === normalizeTicker(row.asset) && Math.abs(Number(c.amount || 0) - Number(row.amount || 0)) < 0.000001) === i,
    )
  }

  const buildRowsFromDateSections = () => {
    const dateMatches = [...upperText.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)]

    return dateMatches.flatMap((match, sectionIndex) => {
      const sectionRawDate = match[0]
      const sectionDate = convertBrokerageDateToIso(sectionRawDate)
      const sectionStart = (match.index || 0) + match[0].length
      const sectionEnd = dateMatches[sectionIndex + 1]?.index ?? upperText.length
      const sectionText = upperText.slice(sectionStart, sectionEnd)
      const entryMatches = [...sectionText.matchAll(/((?:CRÉDITO|CREDITO|DÉBITO|DEBITO))([\s\S]*?)(?=(?:CRÉDITO|CREDITO|DÉBITO|DEBITO|\b\d{2}\/\d{2}\/\d{4}\b|$))/g)]

      return entryMatches.flatMap((entryMatch, entryIndex) => {
        const entryType = entryMatch[1] || ''
        const entryBody = entryMatch[2] || ''
        if (entryType.includes('DEBITO') || entryType.includes('DÉBITO')) return []
        return extractDividendRow(`${entryType} ${entryBody}`, `${sectionIndex}-${entryIndex}`, sectionDate, sectionRawDate)
      })
    })
  }

  const buildRowsFromIncomeEntries = () => {
    const dateMatches = [...upperText.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)]
    const entryMatches = [...normalizeDetectionText(upperText).matchAll(/(?:RENDIMENTOS DE CLIENTES|DIVIDENDOS DE CLIENTES|JUROS S\/ CAPITAL DE CLIENTES|FRACOES DE ACOES)/g)]

    return entryMatches.flatMap((match, entryIndex) => {
      const entryStart = match.index || 0
      const nextEntryStart = entryMatches[entryIndex + 1]?.index ?? Number.POSITIVE_INFINITY
      const nextDateStart = dateMatches.find((dm) => (dm.index || 0) > entryStart)?.index ?? Number.POSITIVE_INFINITY
      const entryEnd = Math.min(nextEntryStart, nextDateStart, upperText.length)
      const entryText = upperText.slice(entryStart, entryEnd)
      const lastDateMatchBeforeEntry = [...dateMatches].filter((dm) => (dm.index || 0) < entryStart).at(-1)
      const entryRawDate = lastDateMatchBeforeEntry?.[0] || referenceDate
      const entryDate = convertBrokerageDateToIso(entryRawDate)
      return extractDividendRow(entryText, `income-entry-${entryIndex}`, entryDate, entryRawDate)
    })
  }

  let currentRawDate = referenceDate
  let currentDate = parsedDate
  const blocks = []
  let activeBlock = null

  function flushActiveBlock() {
    if (!activeBlock?.lines?.length) return
    blocks.push({ rawDate: activeBlock.rawDate, date: activeBlock.date, text: activeBlock.lines.join(' ') })
    activeBlock = null
  }

  lines.forEach((line) => {
    const upperLine = line.toUpperCase()
    const detectionLine = normalizeDetectionText(line)
    const lineDate = extractDateFromBrokerageText(upperLine)

    if (lineDate) { flushActiveBlock(); currentRawDate = lineDate; currentDate = convertBrokerageDateToIso(lineDate); return }
    if (upperLine.includes('DEBITO') || upperLine.includes('DÉBITO')) { flushActiveBlock(); return }

    const startsNewBlock =
      detectionLine.includes('CREDITO') ||
      detectionLine.includes('RENDIMENT') ||
      detectionLine.includes('JUROS') ||
      detectionLine.includes('DIVIDEND') ||
      (detectionLine.includes('FRAC') && detectionLine.includes('ACO'))

    if (startsNewBlock) {
      flushActiveBlock()
      activeBlock = { rawDate: currentRawDate, date: currentDate, lines: [upperLine] }
      return
    }

    if (activeBlock) activeBlock.lines.push(upperLine)
  })

  flushActiveBlock()

  const lineRows = blocks.flatMap((block, i) => extractDividendRow(block.text, i, block.date, block.rawDate))
  const sectionRows = blocks.flatMap((block, i) => buildSectionRows(block.text, i, block.date, block.rawDate))
  const dateSectionRows = buildRowsFromDateSections()
  const incomeEntryRows = buildRowsFromIncomeEntries()

  const rows = [...lineRows, ...sectionRows, ...dateSectionRows, ...incomeEntryRows].filter(
    (row, i, arr) =>
      arr.findIndex((c) => c.date === row.date && c.asset === row.asset && Math.abs(Number(c.amount || 0) - Number(row.amount || 0)) < 0.000001) === i,
  )

  if (!rows.length) return { rows: [], rawDate: referenceDate, date: parsedDate }

  return { rawDate: currentRawDate || referenceDate, date: currentDate || parsedDate, rows }
}

/**
 * @param {import('../../types.js').Dividend} existingEntry
 * @param {object} importedEntry
 */
export function isDividendDuplicate(existingEntry, importedEntry) {
  return (
    String(existingEntry.ownerId || '') === String(importedEntry.ownerId || '') &&
    String(existingEntry.date || '') === String(importedEntry.date || '') &&
    normalizeTicker(existingEntry.asset) === normalizeTicker(importedEntry.asset) &&
    String(existingEntry.incomeType || 'Dividendos') === String(importedEntry.incomeType || 'Dividendos') &&
    Math.abs(Number(existingEntry.amount || 0) - Number(importedEntry.amount || 0)) < 0.000001
  )
}
