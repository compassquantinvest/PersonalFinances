import { database, runInTransaction, markResourceUpdated } from '../db.mjs'
import { nowIso, normalizeTicker } from '../utils.mjs'
import { loadMembers } from './members.mjs'
import { loadTransactions, buildAssetSnapshotFromTransactions } from './transactions.mjs'

/** @returns {import('../../src/types.js').Asset[]} */
export function loadAssets() {
  return database.prepare(`
    SELECT id, owner_id AS ownerId, name, category AS type, category, currency, institution,
           purchase_value AS purchaseValue, monthly_income AS monthlyIncome
    FROM assets
    ORDER BY owner_id ASC, name COLLATE NOCASE ASC
  `).all()
}

/** @param {import('../../src/types.js').Asset[]} rows */
export function saveAssets(rows = []) {
  const insert = database.prepare(`
    INSERT INTO assets (id, owner_id, name, category, currency, institution, purchase_value, monthly_income, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  runInTransaction(() => {
    database.exec('DELETE FROM assets')
    const timestamp = nowIso()

    rows.forEach((row) => {
      insert.run(
        String(row.id || crypto.randomUUID()),
        String(row.ownerId || ''),
        String(row.name || ''),
        String(row.type || row.category || ''),
        String(row.currency || 'BRL'),
        String(row.institution || ''),
        Number(row.purchaseValue || 0),
        Number(row.monthlyIncome || 0),
        timestamp,
        timestamp,
      )
    })

    markResourceUpdated('assets')
  })
}

export function reconcileAssetsTable() {
  const members = loadMembers()
  const validOwnerIds = new Set(members.map((member) => String(member.id)))
  const existingAssets = database.prepare(`
    SELECT id, owner_id AS ownerId, name, category, currency, institution,
           purchase_value AS purchaseValue, monthly_income AS monthlyIncome
    FROM assets
  `).all()
  const existingByKey = new Map()

  existingAssets.forEach((asset) => {
    const ownerId = String(asset.ownerId || '')
    if (!validOwnerIds.has(ownerId)) return
    const key = `${ownerId}::${normalizeTicker(asset.name)}`
    existingByKey.set(key, asset)
  })

  const groupedTransactions = loadTransactions()
    .filter((row) => validOwnerIds.has(String(row.ownerId || '')))
    .reduce((acc, row) => {
      const key = `${row.ownerId}::${normalizeTicker(row.asset)}`
      acc[key] = acc[key] || []
      acc[key].push(row)
      return acc
    }, {})

  const nextAssets = Object.entries(groupedTransactions).flatMap(([key, rows]) => {
    const snapshot = buildAssetSnapshotFromTransactions(rows)
    if (snapshot.quantity <= 0) return []

    const [ownerId, ticker] = key.split('::')
    const existing = existingByKey.get(key)
    const sample = rows[rows.length - 1]

    return [{
      id: existing?.id || `asset-${ownerId}-${ticker}`,
      ownerId,
      name: ticker,
      type: existing?.category || sample?.category || '',
      currency: existing?.currency || 'BRL',
      institution: existing?.institution || sample?.broker || '',
      purchaseValue: snapshot.purchaseValue,
      monthlyIncome: Number(existing?.monthlyIncome || 0),
    }]
  })

  existingByKey.forEach((asset, key) => {
    if (groupedTransactions[key]) return
    nextAssets.push({
      id: asset.id,
      ownerId: asset.ownerId,
      name: asset.name,
      type: asset.category,
      currency: asset.currency || 'BRL',
      institution: asset.institution || '',
      purchaseValue: Number(asset.purchaseValue || 0),
      monthlyIncome: Number(asset.monthlyIncome || 0),
    })
  })

  saveAssets(nextAssets)
}
