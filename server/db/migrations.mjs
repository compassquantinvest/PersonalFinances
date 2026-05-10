import { database } from '../db.mjs'

/**
 * @typedef {Object} Migration
 * @property {number} version
 * @property {string} description
 * @property {string} sql
 */

/** @type {Migration[]} */
export const migrations = [
  {
    version: 1,
    description: 'Baseline schema (já aplicado via CREATE IF NOT EXISTS)',
    sql: '',
  },
]

/** @param {import('node:sqlite').DatabaseSync} db */
export function runMigrations(db = database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version)
  )

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    if (migration.sql) db.exec(migration.sql)
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      new Date().toISOString()
    )
  }
}
