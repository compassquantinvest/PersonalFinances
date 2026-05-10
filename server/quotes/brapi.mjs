import { getCachedQuote, setCachedQuote } from './cache.mjs'
import { fetchYahooQuote } from './yahoo.mjs'

let _brapiToken = ''

/** @param {string} token */
export function setBrapiToken(token) {
  _brapiToken = token
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${_brapiToken}`,
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Falha ao consultar a brapi.dev (${response.status}): ${details}`)
  }

  return response.json()
}

/** @param {string[]} symbols */
async function fetchMissingQuotes(symbols) {
  if (!symbols.length) return

  if (!_brapiToken) {
    const error = new Error('BRAPI_TOKEN nao configurado. Crie o arquivo .env.server com seu token da brapi.dev.')
    error.code = 'TOKEN_MISSING'
    throw error
  }

  for (const requestedSymbol of symbols) {
    let quote = null

    try {
      const endpoint = new URL(`https://brapi.dev/api/quote/${requestedSymbol}`)
      endpoint.searchParams.set('token', _brapiToken)

      const payload = await fetchJson(endpoint)
      const row = (payload.results || []).find((candidate) => {
        const symbol = String(candidate.symbol || candidate.stock || candidate.ticker || '').trim().toUpperCase()
        return symbol === requestedSymbol
      })
      const price = Number(row?.regularMarketPrice ?? row?.regularMarketPreviousClose ?? row?.close)

      if (row && Number.isFinite(price)) {
        quote = {
          symbol: requestedSymbol,
          price,
          currency: row.currency || 'BRL',
          name: row.shortName || row.longName || requestedSymbol,
          updatedAt: row.regularMarketTime || row.updatedAt || new Date().toISOString(),
          source: 'brapi',
        }
      }
    } catch {
      // fallback to Yahoo below
    }

    if (!quote) {
      try {
        quote = await fetchYahooQuote(requestedSymbol)
      } catch {
        continue
      }
    }

    setCachedQuote(requestedSymbol, { cachedAt: Date.now(), value: quote })
  }
}

/**
 * @param {string[]} symbols
 * @returns {Promise<Record<string, import('../../src/types.js').Quote>>}
 */
export async function getQuotes(symbols) {
  const quotes = {}
  const missing = []

  symbols.forEach((symbol) => {
    const cached = getCachedQuote(symbol)
    if (cached) { quotes[symbol] = cached; return }
    missing.push(symbol)
  })

  await fetchMissingQuotes(missing)

  symbols.forEach((symbol) => {
    const cached = getCachedQuote(symbol)
    if (cached) quotes[symbol] = cached
  })

  return quotes
}

/**
 * @param {string} url
 * @returns {Promise<unknown>}
 */
export { fetchJson }
