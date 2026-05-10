import { database, runInTransaction, markResourceUpdated } from '../db.mjs'
import { nowIso } from '../utils.mjs'

/** @returns {import('../../src/types.js').Member[]} */
export function loadMembers() {
  return database.prepare(`
    SELECT id, name, role, accent
    FROM members
    ORDER BY name COLLATE NOCASE ASC
  `).all()
}

/** @param {import('../../src/types.js').Member[]} rows */
export function saveMembers(rows = []) {
  const insert = database.prepare(`
    INSERT INTO members (id, name, role, accent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  runInTransaction(() => {
    database.exec('DELETE FROM members')
    const timestamp = nowIso()

    rows.forEach((row) => {
      insert.run(
        String(row.id || crypto.randomUUID()),
        String(row.name || ''),
        String(row.role || ''),
        String(row.accent || '#58d7ff'),
        timestamp,
        timestamp,
      )
    })

    markResourceUpdated('members')
  })
}
