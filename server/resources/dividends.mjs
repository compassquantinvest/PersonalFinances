import { database, runInTransaction, markResourceUpdated } from '../db.mjs'
import { nowIso } from '../utils.mjs'

/** @returns {import('../../src/types.js').Dividend[]} */
export function loadDividends() {
  return database.prepare(`
    SELECT id, owner_id AS ownerId, payment_date AS date, asset, category, amount,
           reference_month AS referenceMonth, income_type AS incomeType, notes
    FROM dividends
    ORDER BY payment_date DESC, id DESC
  `).all()
}

/** @param {import('../../src/types.js').Dividend[]} rows */
export function saveDividends(rows = []) {
  const insert = database.prepare(`
    INSERT INTO dividends (id, owner_id, payment_date, asset, category, amount, reference_month, income_type, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  runInTransaction(() => {
    database.exec('DELETE FROM dividends')
    const timestamp = nowIso()

    rows.forEach((row) => {
      insert.run(
        String(row.id || crypto.randomUUID()),
        String(row.ownerId || ''),
        String(row.date || ''),
        String(row.asset || ''),
        String(row.category || ''),
        Number(row.amount || 0),
        String(row.referenceMonth || ''),
        String(row.incomeType || 'Dividendos'),
        String(row.notes || ''),
        timestamp,
        timestamp,
      )
    })

    markResourceUpdated('dividends')
  })
}
