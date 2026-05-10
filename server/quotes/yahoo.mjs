/**
 * @param {string} requestedSymbol
 * @returns {Promise<import('../../src/types.js').Quote>}
 */
export async function fetchYahooQuote(requestedSymbol) {
  const endpoint = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${requestedSymbol}.SA`)
  endpoint.searchParams.set('interval', '1d')
  endpoint.searchParams.set('range', '1d')

  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Falha ao consultar Yahoo Finance (${response.status}): ${details}`)
  }

  const payload = await response.json()
  const result = payload.chart?.result?.[0]
  const meta = result?.meta || {}
  const price = Number(meta.regularMarketPrice ?? meta.previousClose)

  if (!Number.isFinite(price)) {
    throw new Error(`Cotacao indisponivel no Yahoo Finance para ${requestedSymbol}.`)
  }

  return {
    symbol: requestedSymbol,
    price,
    currency: meta.currency || 'BRL',
    name: meta.shortName || meta.longName || requestedSymbol,
    updatedAt: meta.regularMarketTime
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : new Date().toISOString(),
    source: 'yahoo',
  }
}

/**
 * @param {string} requestedSymbol
 * @returns {Promise<Array<{ ticker: string, monthRef: string, closeDate: string, closePrice: number, source: string }>>}
 */
export async function fetchYahooMonthlyCloses(requestedSymbol) {
  const endpoint = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${requestedSymbol}.SA`)
  endpoint.searchParams.set('interval', '1d')
  endpoint.searchParams.set('range', '3y')
  endpoint.searchParams.set('includePrePost', 'false')

  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Falha ao consultar Yahoo historico (${response.status}): ${details}`)
  }

  const payload = await response.json()
  const result = payload.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const closes = result?.indicators?.quote?.[0]?.close || []
  const rowsByMonth = new Map()

  timestamps.forEach((timestamp, index) => {
    const closePrice = Number(closes[index])
    if (!Number.isFinite(closePrice) || closePrice <= 0) return

    const isoDate = new Date(Number(timestamp) * 1000).toISOString().slice(0, 10)
    const monthRef = isoDate.slice(0, 7)
    const existing = rowsByMonth.get(monthRef)

    if (!existing || isoDate > existing.closeDate) {
      rowsByMonth.set(monthRef, { ticker: requestedSymbol, monthRef, closeDate: isoDate, closePrice, source: 'yahoo' })
    }
  })

  return [...rowsByMonth.values()]
}
