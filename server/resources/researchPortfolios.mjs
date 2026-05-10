import { database, runInTransaction, markResourceUpdated } from '../db.mjs'
import { nowIso } from '../utils.mjs'

export function loadResearchPortfolios() {
  const rows = database.prepare(`
    SELECT tab_id AS tabId, source, position_id AS id, ticker, company, allocation,
           dy_expected AS dyExpected, current_price AS currentPrice, ceiling_price AS ceilingPrice
    FROM research_positions
    ORDER BY tab_id ASC, source ASC, ticker COLLATE NOCASE ASC
  `).all()

  return rows.reduce((acc, row) => {
    acc[row.tabId] = acc[row.tabId] || {}
    acc[row.tabId][row.source] = acc[row.tabId][row.source] || []
    acc[row.tabId][row.source].push({
      id: row.id,
      ticker: row.ticker,
      company: row.company,
      allocation: Number(row.allocation || 0),
      dyExpected: row.dyExpected == null ? null : Number(row.dyExpected),
      currentPrice: row.currentPrice == null ? null : Number(row.currentPrice),
      ceilingPrice: row.ceilingPrice == null ? null : Number(row.ceilingPrice),
    })
    return acc
  }, {})
}

/** @param {Record<string, Record<string, import('../../src/types.js').ResearchPosition[]>>} data */
export function saveResearchPortfolios(data = {}) {
  const insert = database.prepare(`
    INSERT INTO research_positions (tab_id, source, position_id, ticker, company, allocation, dy_expected, current_price, ceiling_price, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  runInTransaction(() => {
    database.exec('DELETE FROM research_positions')
    const timestamp = nowIso()

    Object.entries(data || {}).forEach(([tabId, sources]) => {
      Object.entries(sources || {}).forEach(([source, positions]) => {
        ;(positions || []).forEach((position) => {
          insert.run(
            String(tabId),
            String(source),
            String(position.id || crypto.randomUUID()),
            String(position.ticker || ''),
            String(position.company || ''),
            Number(position.allocation || 0),
            position.dyExpected == null ? null : Number(position.dyExpected),
            position.currentPrice == null ? null : Number(position.currentPrice),
            position.ceilingPrice == null ? null : Number(position.ceilingPrice),
            timestamp,
            timestamp,
          )
        })
      })
    })

    markResourceUpdated('research-portfolios')
  })
}
