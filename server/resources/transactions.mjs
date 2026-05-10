import { database, runInTransaction, markResourceUpdated } from '../db.mjs'
import { nowIso, normalizeTicker, sortTransactionsChronologically } from '../utils.mjs'

/** @returns {import('../../src/types.js').Transaction[]} */
export function loadTransactions() {
  return database.prepare(`
    SELECT id, owner_id AS ownerId, trade_date AS date, operation_type AS type, asset, category, broker,
           quantity, unit_price AS unitPrice, gross_total AS total, fees, notes
    FROM transactions
    ORDER BY trade_date DESC, id DESC
  `).all()
}

/** @param {import('../../src/types.js').Transaction[]} rows */
export function saveTransactions(rows = []) {
  const insert = database.prepare(`
    INSERT INTO transactions (id, owner_id, trade_date, operation_type, asset, category, broker, quantity, unit_price, gross_total, fees, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  runInTransaction(() => {
    database.exec('DELETE FROM transactions')
    const timestamp = nowIso()

    rows.forEach((row) => {
      insert.run(
        String(row.id || crypto.randomUUID()),
        String(row.ownerId || ''),
        String(row.date || ''),
        String(row.type || 'Compra'),
        String(row.asset || ''),
        String(row.category || ''),
        String(row.broker || ''),
        Number(row.quantity || 0),
        Number(row.unitPrice || 0),
        Number(row.total || 0),
        Number(row.fees || 0),
        String(row.notes || ''),
        timestamp,
        timestamp,
      )
    })

    markResourceUpdated('transactions')
  })
}

/**
 * Calcula snapshot (quantidade + custo) de um ativo a partir das transações (FIFO/médio).
 * @param {import('../../src/types.js').Transaction[]} rows
 * @returns {{ quantity: number, purchaseValue: number }}
 */
export function buildAssetSnapshotFromTransactions(rows = []) {
  let quantity = 0
  let purchaseValue = 0

  sortTransactionsChronologically(rows).forEach((row) => {
    const transactionType = String(row.type || 'Compra')
    const transactionQuantity = Number(row.quantity || 0)
    const transactionTotal = Number(row.total || 0)
    const transactionFees = Number(row.fees || 0)

    if (transactionType === 'Venda') {
      if (quantity <= 0 || transactionQuantity <= 0) return
      const quantityToSell = Math.min(quantity, transactionQuantity)
      const averageCost = quantity > 0 ? purchaseValue / quantity : 0
      purchaseValue -= averageCost * quantityToSell
      quantity -= quantityToSell
      if (quantity <= 0) { quantity = 0; purchaseValue = 0 }
      return
    }

    quantity += transactionQuantity
    purchaseValue += transactionTotal + transactionFees
  })

  return { quantity, purchaseValue }
}

/**
 * Retorna a quantidade mantida de um ticker por um owner até uma data de corte.
 * @param {import('../../src/types.js').Transaction[]} transactions
 * @param {string} ownerId
 * @param {string} ticker
 * @param {string} cutoffDate
 */
export function getQuantityHeldAsOf(transactions, ownerId, ticker, cutoffDate) {
  return sortTransactionsChronologically(
    (transactions || []).filter(
      (t) =>
        t.ownerId === ownerId &&
        normalizeTicker(t.asset) === ticker &&
        String(t.date || '') <= cutoffDate,
    ),
  ).reduce((sum, t) => {
    const qty = Number(t.quantity || 0)
    return sum + ((t.type || 'Compra') === 'Venda' ? -qty : qty)
  }, 0)
}
