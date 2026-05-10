import { fetchJson } from './quotes/brapi.mjs'

let _brapiToken = ''
let _hgBrasilKey = ''

/** @param {{ brapiToken: string, hgBrasilKey: string }} tokens */
export function setMarketOverviewTokens({ brapiToken, hgBrasilKey }) {
  _brapiToken = brapiToken
  _hgBrasilKey = hgBrasilKey
}

/** @param {string} [currency] */
function buildUnavailableItem(currency = 'BRL') {
  return { value: null, changePercent: null, currency, updatedAt: '', source: 'unavailable' }
}

async function fetchHgFinanceOverview() {
  const endpoint = new URL('https://api.hgbrasil.com/finance')
  if (_hgBrasilKey) endpoint.searchParams.set('key', _hgBrasilKey)

  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Falha ao consultar a HG Brasil (${response.status}): ${details}`)
  }

  const payload = await response.json()
  if (payload.error === true) throw new Error(payload.message || 'Falha ao consultar a HG Brasil.')
  return payload
}

function mapHgOverview(payload) {
  const results = payload.results || {}
  const stocks = results.stocks || {}
  const currencies = results.currencies || {}
  const bitcoin = results.bitcoin || {}
  const foxbit = bitcoin.foxbit || bitcoin.mercadobitcoin || {}
  const now = payload.execution_time ? new Date().toISOString() : ''

  return {
    ibov: { value: Number(stocks.IBOVESPA?.points), changePercent: Number(stocks.IBOVESPA?.variation || 0), currency: 'BRL', updatedAt: now, source: 'hgbrasil' },
    usdbrl: { value: Number(currencies.USD?.buy), changePercent: Number(currencies.USD?.variation || 0), currency: 'BRL', updatedAt: now, source: 'hgbrasil' },
    bitcoin: { value: Number(foxbit.last ?? foxbit.buy ?? currencies.BTC?.buy), changePercent: Number((foxbit.variation ?? currencies.BTC?.variation) || 0), currency: 'BRL', updatedAt: now, source: 'hgbrasil' },
    ifix: { value: Number(stocks.IFIX?.points), changePercent: Number(stocks.IFIX?.variation || 0), currency: 'BRL', updatedAt: now, source: 'hgbrasil' },
  }
}

/**
 * @returns {Promise<{ items: Record<string, import('../src/types.js').MarketOverviewItem>, error: string }>}
 */
export async function getMarketOverview() {
  const items = {
    ibov: buildUnavailableItem(),
    usdbrl: buildUnavailableItem(),
    bitcoin: buildUnavailableItem(),
    ifix: buildUnavailableItem(),
  }
  const errors = []

  if (_brapiToken) {
    try {
      const ibovPayload = await fetchJson('https://brapi.dev/api/quote/^BVSP')
      const ibovRow = (ibovPayload.results || [])[0]
      if (Number.isFinite(Number(ibovRow?.regularMarketPrice))) {
        items.ibov = { value: Number(ibovRow.regularMarketPrice), changePercent: Number(ibovRow.regularMarketChangePercent || 0), currency: 'BRL', updatedAt: ibovRow.regularMarketTime || '', source: 'brapi' }
      }
    } catch (error) { errors.push(`Ibovespa via brapi: ${error.message}`) }

    try {
      const ifixPayload = await fetchJson('https://brapi.dev/api/quote/IFIX')
      const ifixRow = (ifixPayload.results || [])[0]
      if (Number.isFinite(Number(ifixRow?.regularMarketPrice))) {
        items.ifix = { value: Number(ifixRow.regularMarketPrice), changePercent: Number(ifixRow.regularMarketChangePercent || 0), currency: 'BRL', updatedAt: ifixRow.regularMarketTime || '', source: 'brapi' }
      }
    } catch (error) { errors.push(`IFIX via brapi: ${error.message}`) }

    try {
      const currencyPayload = await fetchJson('https://brapi.dev/api/v2/currency?currency=USD-BRL')
      const usdRow = (currencyPayload.currency || [])[0]
      if (Number.isFinite(Number(usdRow?.bidPrice))) {
        items.usdbrl = { value: Number(usdRow.bidPrice), changePercent: Number(usdRow.percentageChange || 0), currency: 'BRL', updatedAt: usdRow.updatedAtDate || '', source: 'brapi' }
      }
    } catch (error) { errors.push(`Dolar via brapi: ${error.message}`) }

    try {
      const cryptoPayload = await fetchJson('https://brapi.dev/api/v2/crypto?coin=BTC&currency=BRL')
      const btcRow = (cryptoPayload.coins || [])[0]
      if (Number.isFinite(Number(btcRow?.regularMarketPrice))) {
        items.bitcoin = { value: Number(btcRow.regularMarketPrice), changePercent: Number(btcRow.regularMarketChangePercent || 0), currency: 'BRL', updatedAt: btcRow.regularMarketTime || '', source: 'brapi' }
      }
    } catch (error) { errors.push(`Bitcoin via brapi: ${error.message}`) }
  }

  const missingKeys = Object.entries(items)
    .filter(([, item]) => !(typeof item.value === 'number' && Number.isFinite(item.value)))
    .map(([key]) => key)

  if (missingKeys.length) {
    try {
      const hgPayload = await fetchHgFinanceOverview()
      const hgItems = mapHgOverview(hgPayload)
      missingKeys.forEach((key) => {
        if (Number.isFinite(Number(hgItems[key]?.value))) items[key] = hgItems[key]
      })
    } catch (error) { errors.push(`HG Brasil: ${error.message}`) }
  }

  return { items, error: errors.length ? errors.join(' | ') : '' }
}
