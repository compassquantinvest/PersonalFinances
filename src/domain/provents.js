const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function padMonth(value) {
  return String(value).padStart(2, '0')
}

function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  return { year, month }
}

function buildMonthKey(year, month) {
  return `${year}-${padMonth(month)}`
}

export function getPreviousMonthKey(monthKey) {
  const { year, month } = parseMonthKey(monthKey)
  if (!year || !month) {
    return ''
  }

  if (month === 1) {
    return buildMonthKey(year - 1, 12)
  }

  return buildMonthKey(year, month - 1)
}

export function getMonthEndIso(monthKey) {
  const { year, month } = parseMonthKey(monthKey)
  if (!year || !month) {
    return ''
  }

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

export function getLastTwelveMonthColumns(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear()
  const monthIndex = referenceDate.getUTCMonth()
  const columns = []

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, monthIndex - offset, 1))
    const columnYear = date.getUTCFullYear()
    const columnMonth = date.getUTCMonth() + 1

    columns.push({
      key: buildMonthKey(columnYear, columnMonth),
      label: `${monthLabels[columnMonth - 1]}/${String(columnYear).slice(-2)}`,
    })
  }

  return columns
}

export function getRequiredPriceMonthKeys(columns) {
  return [...new Set((columns || []).map((column) => getPreviousMonthKey(column.key)).filter(Boolean))]
}

function sortTransactionsChronologically(rows = []) {
  return [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return String(left.date || '').localeCompare(String(right.date || ''))
    }

    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}

function getQuantityHeldAsOf(transactions, ownerId, ticker, cutoffDate, normalizeTicker) {
  return sortTransactionsChronologically(
    (transactions || []).filter(
      (transaction) =>
        transaction.ownerId === ownerId &&
        normalizeTicker(transaction.asset) === ticker &&
        String(transaction.date || '') <= cutoffDate,
    ),
  ).reduce((sum, transaction) => {
    const quantity = Number(transaction.quantity || 0)
    return sum + ((transaction.type || 'Compra') === 'Venda' ? -quantity : quantity)
  }, 0)
}

export function buildMemberIncomePanels({ member, assets, transactions, dividends, monthlyPrices, normalizeTicker }) {
  const columns = getLastTwelveMonthColumns()

  if (!member) {
    return { columns, fiisRows: [], acoesRows: [] }
  }

  const memberAssets = (assets || [])
    .filter((asset) => asset.ownerId === member.id && ['FIIs', 'Acoes'].includes(asset.type))
    .sort((left, right) => normalizeTicker(left.name).localeCompare(normalizeTicker(right.name)))

  const trackedTickers = new Set(memberAssets.map((asset) => normalizeTicker(asset.name)))
  const aggregateByTickerMonth = new Map()

  ;(dividends || [])
    .filter((dividend) => dividend.ownerId === member.id)
    .forEach((dividend) => {
      const ticker = normalizeTicker(dividend.asset)
      const paymentMonthKey = String(dividend.date || '').slice(0, 7)

      if (!trackedTickers.has(ticker) || !paymentMonthKey) {
        return
      }

      const key = `${ticker}::${paymentMonthKey}`
      aggregateByTickerMonth.set(key, (aggregateByTickerMonth.get(key) || 0) + Number(dividend.amount || 0))
    })

  const quantityCache = new Map()

  function getQuantityForYield(ticker, baseMonthKey) {
    const cacheKey = `${ticker}::${baseMonthKey}`
    if (quantityCache.has(cacheKey)) {
      return quantityCache.get(cacheKey)
    }

    const quantity = getQuantityHeldAsOf(
      transactions,
      member.id,
      ticker,
      getMonthEndIso(baseMonthKey),
      normalizeTicker,
    )
    quantityCache.set(cacheKey, quantity)
    return quantity
  }

  const rows = memberAssets.map((asset) => {
    const ticker = normalizeTicker(asset.name)
    const values = columns.map((column) => {
      const baseMonthKey = getPreviousMonthKey(column.key)
      const amount = aggregateByTickerMonth.get(`${ticker}::${column.key}`) || 0
      const quantity = baseMonthKey ? getQuantityForYield(ticker, baseMonthKey) : 0
      const perShareAmount = quantity > 0 ? amount / quantity : 0
      const closePrice = Number(monthlyPrices?.[ticker]?.[baseMonthKey]?.closePrice || 0)
      const percent = closePrice > 0 && perShareAmount > 0 ? (perShareAmount / closePrice) * 100 : 0

      return {
        monthKey: column.key,
        amount,
        quantity,
        closePrice,
        percent,
      }
    })

    return {
      ticker,
      type: asset.type,
      institution: asset.institution || '',
      values,
      hasPositive: values.some((value) => value.percent > 0),
    }
  })

  return {
    columns,
    fiisRows: rows.filter((row) => row.type === 'FIIs'),
    acoesRows: rows.filter((row) => row.type === 'Acoes'),
  }
}
