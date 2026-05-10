import { database, runInTransaction } from '../db.mjs'
import { nowIso, buildSqlPlaceholders, normalizeTicker } from '../utils.mjs'

/**
 * @param {string[]} symbols
 * @param {string[]} monthKeys
 */
export function loadMonthlyPricesForTickers(symbols = [], monthKeys = []) {
  if (!symbols.length || !monthKeys.length) return []

  const symbolPlaceholders = buildSqlPlaceholders(symbols.length)
  const monthPlaceholders = buildSqlPlaceholders(monthKeys.length)

  return database.prepare(`
    SELECT ticker, month_ref AS monthRef, close_date AS closeDate, close_price AS closePrice, source
    FROM asset_monthly_prices
    WHERE ticker IN (${symbolPlaceholders})
      AND month_ref IN (${monthPlaceholders})
  `).all(...symbols, ...monthKeys)
}

/** @param {import('../../src/types.js').MonthlyPrice & { ticker: string, monthRef: string }[]} rows */
export function saveMonthlyPriceRows(rows = []) {
  if (!rows.length) return

  const statement = database.prepare(`
    INSERT INTO asset_monthly_prices (ticker, month_ref, close_date, close_price, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticker, month_ref) DO UPDATE SET
      close_date = excluded.close_date,
      close_price = excluded.close_price,
      source = excluded.source,
      updated_at = excluded.updated_at
  `)

  runInTransaction(() => {
    rows.forEach((row) => {
      const timestamp = nowIso()
      statement.run(
        String(row.ticker || ''),
        String(row.monthRef || ''),
        String(row.closeDate || ''),
        Number(row.closePrice || 0),
        String(row.source || 'yahoo'),
        timestamp,
        timestamp,
      )
    })
  })
}

/**
 * Agrupa as linhas de preços mensais em um mapa { ticker → { monthRef → MonthlyPrice } }.
 * @param {string[]} symbols
 * @param {string[]} monthKeys
 * @returns {import('../../src/types.js').MonthlyPriceMap}
 */
export function buildMonthlyPriceMap(symbols, monthKeys) {
  return loadMonthlyPricesForTickers(symbols, monthKeys).reduce((acc, row) => {
    acc[row.ticker] = acc[row.ticker] || {}
    acc[row.ticker][row.monthRef] = {
      closePrice: Number(row.closePrice || 0),
      closeDate: row.closeDate,
      source: row.source,
    }
    return acc
  }, {})
}

/**
 * @param {string[]} symbols
 * @param {string[]} monthKeys
 */
export async function ensureMonthlyPrices(symbols = [], monthKeys = []) {
  const { fetchYahooMonthlyCloses } = await import('../quotes/yahoo.mjs')

  const normalizedSymbols = [...new Set(symbols.map(normalizeTicker).filter(Boolean))]
  const normalizedMonths = [...new Set(monthKeys.filter(Boolean))]

  if (!normalizedSymbols.length || !normalizedMonths.length) return {}

  const existingRows = loadMonthlyPricesForTickers(normalizedSymbols, normalizedMonths)
  const existingMap = new Map(existingRows.map((row) => [`${row.ticker}::${row.monthRef}`, row]))
  const symbolsToFetch = normalizedSymbols.filter((symbol) =>
    normalizedMonths.some((monthKey) => !existingMap.has(`${symbol}::${monthKey}`)),
  )

  for (const symbol of symbolsToFetch) {
    try {
      const fetchedRows = await fetchYahooMonthlyCloses(symbol)
      saveMonthlyPriceRows(fetchedRows)
    } catch {
      // keep best-effort behavior; rows stay missing if provider fails
    }
  }

  return buildMonthlyPriceMap(normalizedSymbols, normalizedMonths)
}
