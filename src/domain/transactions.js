export function sortTransactionsChronologically(list) {
  return [...list].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }

    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}

export function getAssetTransactionSnapshot(asset, transactions, normalizeTicker) {
  const ticker = normalizeTicker(asset.name)
  const ownerTransactions = sortTransactionsChronologically(
    transactions.filter(
      (transaction) =>
        normalizeTicker(transaction.asset) === ticker && transaction.ownerId === asset.ownerId,
    ),
  )

  let quantity = 0
  let costBasis = 0
  let fees = 0

  ownerTransactions.forEach((transaction) => {
    const transactionType = transaction.type || 'Compra'
    const transactionQuantity = Number(transaction.quantity || 0)
    const transactionTotal = Number(transaction.total || 0)
    const transactionFees = Number(transaction.fees || 0)

    if (transactionType === 'Venda') {
      if (quantity <= 0 || transactionQuantity <= 0) {
        return
      }

      const averageCost = quantity > 0 ? costBasis / quantity : 0
      const quantityToSell = Math.min(quantity, transactionQuantity)
      costBasis -= averageCost * quantityToSell
      quantity -= quantityToSell

      if (quantity <= 0) {
        quantity = 0
        costBasis = 0
        fees = 0
      }

      return
    }

    quantity += transactionQuantity
    costBasis += transactionTotal
    fees += transactionFees
  })

  return {
    quantity,
    purchaseValue: costBasis,
    fees,
  }
}

export function getAvailableAssetQuantity(
  transactions,
  ownerId,
  assetName,
  normalizeTicker,
  excludeTransactionId = '',
) {
  const ticker = normalizeTicker(assetName)
  const ownerTransactions = sortTransactionsChronologically(
    transactions.filter((transaction) => {
      if (excludeTransactionId && transaction.id === excludeTransactionId) {
        return false
      }

      return transaction.ownerId === ownerId && normalizeTicker(transaction.asset) === ticker
    }),
  )

  return ownerTransactions.reduce((sum, transaction) => {
    const quantity = Number(transaction.quantity || 0)
    return sum + ((transaction.type || 'Compra') === 'Venda' ? -quantity : quantity)
  }, 0)
}

export function getRealizedProfitLossRows(transactions, normalizeTicker) {
  const positions = new Map()
  const rows = []

  sortTransactionsChronologically(transactions).forEach((transaction) => {
    const ownerId = transaction.ownerId
    const ticker = normalizeTicker(transaction.asset)
    const key = `${ownerId}:${ticker}`

    if (!positions.has(key)) {
      positions.set(key, { quantity: 0, costBasis: 0 })
    }

    const position = positions.get(key)
    const quantity = Number(transaction.quantity || 0)
    const unitPrice = Number(transaction.unitPrice || 0)
    const fees = Number(transaction.fees || 0)
    const total = Number(transaction.total || unitPrice * quantity)

    if ((transaction.type || 'Compra') === 'Venda') {
      if (quantity <= 0 || position.quantity <= 0) {
        return
      }

      const quantityToSell = Math.min(position.quantity, quantity)
      const averageCost = position.quantity > 0 ? position.costBasis / position.quantity : 0
      const purchaseValue = averageCost * quantityToSell
      const proportionalFees = quantity > 0 ? fees * (quantityToSell / quantity) : 0
      const saleValue = total * (quantityToSell / Math.max(quantity, 1)) - proportionalFees
      const profitLoss = saleValue - purchaseValue

      position.quantity -= quantityToSell
      position.costBasis -= purchaseValue

      if (position.quantity <= 0) {
        position.quantity = 0
        position.costBasis = 0
      }

      rows.push({
        id: `${transaction.id}-pnl`,
        ownerId: transaction.ownerId,
        date: transaction.date,
        asset: ticker,
        quantity: quantityToSell,
        purchaseValue,
        saleValue,
        profitLoss,
      })

      return
    }

    position.quantity += quantity
    position.costBasis += total + fees
  })

  return rows.sort((left, right) => right.date.localeCompare(left.date))
}

export function getMonthlyReportRows(transactions, dividends, realizedPnLRows, selectedMemberId) {
  const reportMap = new Map()

  function ensureRow(monthKey) {
    if (!reportMap.has(monthKey)) {
      const [year, month] = monthKey.split('-')
      const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
        'pt-BR',
        {
          month: '2-digit',
          year: 'numeric',
        },
      )

      reportMap.set(monthKey, {
        id: monthKey,
        monthKey,
        monthLabel,
        purchaseCount: 0,
        saleCount: 0,
        investedNet: 0,
        saleNet: 0,
        dividendIncome: 0,
        purchaseFees: 0,
        saleFees: 0,
        realizedProfitLoss: 0,
        netCashFlow: 0,
      })
    }

    return reportMap.get(monthKey)
  }

  transactions
    .filter((transaction) => !selectedMemberId || transaction.ownerId === selectedMemberId)
    .forEach((transaction) => {
      const monthKey = String(transaction.date || '').slice(0, 7)
      if (!monthKey) {
        return
      }

      const row = ensureRow(monthKey)
      const total = Number(transaction.total || 0)
      const fees = Number(transaction.fees || 0)
      const type = transaction.type || 'Compra'

      if (type === 'Venda') {
        row.saleCount += 1
        row.saleNet += total
        row.saleFees += fees
        row.netCashFlow += total - fees
      } else {
        row.purchaseCount += 1
        row.investedNet += total
        row.purchaseFees += fees
        row.netCashFlow -= total + fees
      }
    })

  dividends
    .filter((dividend) => !selectedMemberId || dividend.ownerId === selectedMemberId)
    .forEach((dividend) => {
      const monthKey = String(dividend.date || '').slice(0, 7)
      if (!monthKey) {
        return
      }

      const row = ensureRow(monthKey)
      const amount = Number(dividend.amount || 0)
      row.dividendIncome += amount
      row.netCashFlow += amount
    })

  realizedPnLRows
    .filter((row) => !selectedMemberId || row.ownerId === selectedMemberId)
    .forEach((rowData) => {
      const monthKey = String(rowData.date || '').slice(0, 7)
      if (!monthKey) {
        return
      }

      const row = ensureRow(monthKey)
      row.realizedProfitLoss += Number(rowData.profitLoss || 0)
    })

  return [...reportMap.values()].sort((left, right) => right.monthKey.localeCompare(left.monthKey))
}
