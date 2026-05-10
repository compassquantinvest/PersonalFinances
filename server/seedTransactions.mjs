import { historicalTransactionSeeds } from '../data/historical-transaction-seeds.mjs'
import { database, runInTransaction, markResourceUpdated } from './db.mjs'
import { nowIso } from './utils.mjs'
import { loadMembers } from './resources/members.mjs'

function normalizeSeedMemberName(value) {
  return String(value || '').trim().toLowerCase()
}

function seedTransactionExists(ownerId, row) {
  const found = database.prepare(`
    SELECT id
    FROM transactions
    WHERE owner_id = ?
      AND trade_date = ?
      AND operation_type = ?
      AND asset = ?
      AND broker = ?
      AND ABS(quantity - ?) < 0.000001
      AND ABS(unit_price - ?) < 0.000001
    LIMIT 1
  `).get(
    String(ownerId || ''),
    String(row.date || ''),
    String(row.type || 'Compra'),
    String(row.asset || ''),
    String(row.broker || ''),
    Number(row.quantity || 0),
    Number(row.unitPrice || 0),
  )
  return Boolean(found)
}

/** @param {import('./resources/members.mjs').loadMembers extends () => infer T ? T : never} [memberRows] */
export function ensureHistoricalTransactionSeeds(memberRows = loadMembers()) {
  const normalizedMembers = new Map(
    (memberRows || []).map((member) => [normalizeSeedMemberName(member.name), member])
  )

  const insert = database.prepare(`
    INSERT OR IGNORE INTO transactions (id, owner_id, trade_date, operation_type, asset, category, broker, quantity, unit_price, gross_total, fees, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let inserted = 0

  runInTransaction(() => {
    Object.entries(historicalTransactionSeeds).forEach(([memberName, rows]) => {
      const member = normalizedMembers.get(normalizeSeedMemberName(memberName))
      if (!member) return

      ;(rows || []).forEach((row) => {
        if (seedTransactionExists(member.id, row)) return

        const timestamp = nowIso()
        insert.run(
          String(row.id || crypto.randomUUID()),
          String(member.id),
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
        inserted += 1
      })
    })

    if (inserted > 0) markResourceUpdated('transactions')
  })

  return inserted
}
