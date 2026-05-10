export function normalizeTicker(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()

  if (normalizedValue === 'ELET6') {
    return 'AXIA6'
  }

  if (normalizedValue === 'IRDM11') {
    return 'IRIM11'
  }

  return normalizedValue
}

export function isQuoteableAssetType(type, quoteableAssetTypes) {
  return quoteableAssetTypes.has(type)
}

export function buildSeedAsset(ownerId, transactions, normalizeTickerFn = normalizeTicker) {
  const purchaseTransactions = transactions.filter(
    (transaction) => (transaction.type || 'Compra') !== 'Venda',
  )
  const quantity = purchaseTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.quantity || 0),
    0,
  )
  const purchaseValue = purchaseTransactions.reduce(
    (sum, transaction) => sum + Number(transaction.quantity || 0) * Number(transaction.unitPrice || 0),
    0,
  )
  const fees = purchaseTransactions.reduce((sum, transaction) => sum + Number(transaction.fees || 0), 0)
  const sample = purchaseTransactions[0] || transactions[0]

  return {
    id: `seed-asset-${normalizeTickerFn(sample.asset)}`,
    ownerId,
    name: normalizeTickerFn(sample.asset),
    currency: 'BRL',
    type: sample.category,
    institution: sample.broker,
    purchaseValue,
    fees,
    quantity,
    amount: purchaseValue + fees,
    monthlyIncome: 0,
  }
}

export function collectQuoteTickers(
  assets,
  researchPortfolios,
  quoteableAssetTypes,
  isQuoteableAssetTypeFn,
  normalizeTickerFn = normalizeTicker,
) {
  const symbols = new Set()

  assets.forEach((asset) => {
    if (!isQuoteableAssetTypeFn(asset.type, quoteableAssetTypes)) {
      return
    }

    const ticker = normalizeTickerFn(asset.name)
    if (ticker) {
      symbols.add(ticker)
    }
  })

  Object.values(researchPortfolios).forEach((tab) => {
    Object.values(tab || {}).forEach((rows) => {
      ;(rows || []).forEach((row) => {
        const ticker = normalizeTickerFn(row.ticker)

        if (ticker && ticker !== 'RENDA_FIXA') {
          symbols.add(ticker)
        }
      })
    })
  })

  return [...symbols]
}

export function getAssetCurrentValue(asset) {
  if (typeof asset.currentValue === 'number') {
    return asset.currentValue
  }

  if (typeof asset.amount === 'number') {
    return asset.amount
  }

  return Number(asset.purchaseValue || 0) + Number(asset.fees || 0)
}

export function getAssetCostBasis(asset) {
  if (typeof asset.purchaseValue === 'number' || typeof asset.fees === 'number') {
    return Number(asset.purchaseValue || 0) + Number(asset.fees || 0)
  }

  return typeof asset.amount === 'number' ? Number(asset.amount) : getAssetCurrentValue(asset)
}

export function getAssetPerformance(asset) {
  const currentValue = getAssetCurrentValue(asset)
  const costBasis = getAssetCostBasis(asset)
  const absolute = currentValue - costBasis
  const percentage = costBasis > 0 ? (absolute / costBasis) * 100 : 0

  return {
    absolute,
    percentage,
    tone: absolute > 0 ? 'positive' : absolute < 0 ? 'negative' : 'neutral',
  }
}

export function getResearchBias(row) {
  const recommendation = String(row.recommendation || '').trim().toLowerCase()

  if (recommendation) {
    if (recommendation === 'compra') {
      return {
        label: 'Compra',
        tone: 'buy',
      }
    }

    if (recommendation === 'restrito') {
      return {
        label: 'Restrito',
        tone: 'wait',
      }
    }

    return {
      label: row.recommendation,
      tone: 'unavailable',
    }
  }

  if (typeof row.ceilingPrice !== 'number') {
    return {
      label: 'Indisponivel',
      tone: 'unavailable',
    }
  }

  const shouldBuy = row.currentPrice <= row.ceilingPrice

  return {
    label: shouldBuy ? 'Comprar' : 'Aguardar',
    tone: shouldBuy ? 'buy' : 'wait',
  }
}

export function buildGradient(allocation) {
  const total = allocation.reduce((sum, item) => sum + getAssetCurrentValue(item), 0)

  if (!total) {
    return 'conic-gradient(#20304d 0deg 360deg)'
  }

  let current = 0
  const segments = allocation.map((item) => {
    const slice = (item.amount / total) * 360
    const start = current
    const end = current + slice
    current = end
    return `${item.color} ${start}deg ${end}deg`
  })

  return `conic-gradient(${segments.join(', ')})`
}

export function enrichAssetsWithQuotes(
  assets,
  transactions,
  quotes,
  getAssetTransactionSnapshot,
  normalizeTickerFn = normalizeTicker,
) {
  return assets.map((asset) => {
    const ticker = normalizeTickerFn(asset.name)
    const quote = quotes?.[ticker]
    const snapshot = getAssetTransactionSnapshot(asset, transactions, normalizeTickerFn)
    const quantity = Number(snapshot.quantity || asset.quantity || 0)
    const purchaseValue = Number(snapshot.purchaseValue || asset.purchaseValue || 0)
    const fees = Number(snapshot.fees || asset.fees || 0)
    const livePrice =
      typeof quote?.regularMarketPrice === 'number'
        ? quote.regularMarketPrice
        : typeof quote?.price === 'number'
          ? quote.price
          : null
    const currentValue = livePrice != null && quantity > 0 ? livePrice * quantity : getAssetCurrentValue(asset)

    return {
      ...asset,
      quantity,
      purchaseValue,
      fees,
      amount: purchaseValue + fees,
      currentValue,
      currentPrice: livePrice,
    }
  })
}

export function mergeResearchQuotes(researchPortfolios, quotes, normalizeTickerFn = normalizeTicker) {
  return Object.fromEntries(
    Object.entries(researchPortfolios).map(([tabId, houses]) => [
      tabId,
      Object.fromEntries(
        Object.entries(houses || {}).map(([houseName, rows]) => [
          houseName,
          (rows || []).map((row) => {
            const ticker = normalizeTickerFn(row.ticker)
            const quote = quotes?.[ticker]
            const livePrice =
              typeof quote?.regularMarketPrice === 'number'
                ? quote.regularMarketPrice
                : typeof quote?.price === 'number'
                  ? quote.price
                  : null

            return {
              ...row,
              currentPrice: livePrice != null ? livePrice : row.currentPrice,
            }
          }),
        ]),
      ),
    ]),
  )
}

export function getFamilyResearchRows(activeTab, member, assets) {
  if (!member) {
    return []
  }

  const memberAssets = assets.filter((asset) => asset.ownerId === member.id)
  const filteredAssets = memberAssets.filter((asset) => {
    if (activeTab === 'fiis') return asset.type === 'FIIs'
    if (activeTab === 'renda-fixa') return ['Renda fixa', 'Tesouro', 'Caixa'].includes(asset.type)
    if (activeTab === 'dividendos') return asset.type === 'Acoes'
    if (activeTab === 'valor') return asset.type === 'Acoes'
    return false
  })

  const total = filteredAssets.reduce((sum, asset) => sum + getAssetCurrentValue(asset), 0)

  return filteredAssets.map((asset) => ({
    id: asset.id,
    ticker: asset.name,
    company: asset.institution || asset.type,
    allocation: total ? (getAssetCurrentValue(asset) / total) * 100 : 0,
    dyExpected: getAssetCurrentValue(asset)
      ? ((Number(asset.monthlyIncome || 0) * 12) / getAssetCurrentValue(asset)) * 100
      : 0,
    currentPrice: getAssetCurrentValue(asset),
    ceilingPrice: null,
  }))
}


export function mergeResearchPortfolios(stored, defaults) {
  return Object.keys(defaults).reduce((tabsAcc, tabKey) => {
    const defaultTab = defaults[tabKey] || {}
    const storedTab = stored?.[tabKey] || {}

    tabsAcc[tabKey] = Object.keys(defaultTab).reduce((housesAcc, houseKey) => {
      const defaultRows = defaultTab[houseKey] || []
      const storedRows = storedTab[houseKey]

      if (!Array.isArray(storedRows)) {
        housesAcc[houseKey] = defaultRows
        return housesAcc
      }

      const shouldRestoreDefaults = storedRows.length === 0 && defaultRows.length > 0
      housesAcc[houseKey] = shouldRestoreDefaults ? defaultRows : storedRows
      return housesAcc
    }, {})

    return tabsAcc
  }, {})
}
