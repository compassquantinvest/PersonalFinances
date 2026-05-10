import { normalizeTicker, buildMonthKey, getPreviousMonthKey, getMonthEndIso } from './utils.mjs'
import { loadAssets } from './resources/assets.mjs'
import { loadTransactions, getQuantityHeldAsOf } from './resources/transactions.mjs'
import { loadDividends } from './resources/dividends.mjs'
import { ensureMonthlyPrices } from './resources/monthlyPrices.mjs'

/** @param {string} ownerId */
export async function getIncomeMatrixForOwner(ownerId) {
  const assets = loadAssets().filter((asset) => asset.ownerId === ownerId && ['FIIs', 'Acoes'].includes(asset.type))
  const transactions = loadTransactions().filter((t) => t.ownerId === ownerId)
  const dividends = loadDividends().filter((d) => d.ownerId === ownerId)
  const tickers = [...new Set(assets.map((asset) => normalizeTicker(asset.name)).filter(Boolean))]

  const columns = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (11 - index), 1))
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() + 1
    return { key: buildMonthKey(year, month), label: buildMonthKey(year, month) }
  })

  const monthKeys = columns.map((column) => column.key)
  const priceMonths = monthKeys.map(getPreviousMonthKey).filter(Boolean)
  const monthlyPrices = await ensureMonthlyPrices(tickers, priceMonths)
  const amountByTickerMonth = new Map()

  dividends.forEach((dividend) => {
    const ticker = normalizeTicker(dividend.asset)
    const paymentMonthKey = String(dividend.date || '').slice(0, 7)
    if (!tickers.includes(ticker) || !paymentMonthKey || !monthKeys.includes(paymentMonthKey)) return
    const key = `${ticker}::${paymentMonthKey}`
    amountByTickerMonth.set(key, (amountByTickerMonth.get(key) || 0) + Number(dividend.amount || 0))
  })

  const rows = assets
    .sort((a, b) => normalizeTicker(a.name).localeCompare(normalizeTicker(b.name)))
    .map((asset) => {
      const ticker = normalizeTicker(asset.name)
      return {
        ticker,
        type: asset.type,
        values: monthKeys.map((monthKey) => {
          const previousMonthKey = getPreviousMonthKey(monthKey)
          const amount = amountByTickerMonth.get(`${ticker}::${monthKey}`) || 0
          const quantity = previousMonthKey ? getQuantityHeldAsOf(transactions, ownerId, ticker, getMonthEndIso(previousMonthKey)) : 0
          const perShareAmount = quantity > 0 ? amount / quantity : 0
          const closePrice = Number(monthlyPrices?.[ticker]?.[previousMonthKey]?.closePrice || 0)
          const percent = closePrice > 0 && perShareAmount > 0 ? (perShareAmount / closePrice) * 100 : 0
          return { monthKey, amount, quantity, closePrice, percent }
        }),
      }
    })

  return {
    columns,
    fiisRows: rows.filter((row) => row.type === 'FIIs'),
    acoesRows: rows.filter((row) => row.type === 'Acoes'),
    monthlyPrices,
  }
}
