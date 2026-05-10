import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { nowIso } from './utils.mjs'

export const dbPath = resolve(process.cwd(), 'data', 'personal-finances.sqlite')

mkdirSync(dirname(dbPath), { recursive: true })

export const database = new DatabaseSync(dbPath)
database.exec('PRAGMA journal_mode = WAL;')
database.exec('PRAGMA foreign_keys = ON;')

database.exec(`
  CREATE TABLE IF NOT EXISTS resource_state (
    resource TEXT PRIMARY KEY,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    accent TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    currency TEXT NOT NULL,
    institution TEXT NOT NULL,
    purchase_value REAL NOT NULL DEFAULT 0,
    monthly_income REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    asset TEXT NOT NULL,
    category TEXT NOT NULL,
    broker TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    gross_total REAL NOT NULL DEFAULT 0,
    fees REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dividends (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    asset TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    reference_month TEXT NOT NULL DEFAULT '',
    income_type TEXT NOT NULL DEFAULT 'Dividendos',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS research_positions (
    tab_id TEXT NOT NULL,
    source TEXT NOT NULL,
    position_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    company TEXT NOT NULL,
    allocation REAL NOT NULL DEFAULT 0,
    dy_expected REAL,
    current_price REAL,
    ceiling_price REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (tab_id, source, position_id)
  );

  CREATE TABLE IF NOT EXISTS asset_monthly_prices (
    ticker TEXT NOT NULL,
    month_ref TEXT NOT NULL,
    close_date TEXT NOT NULL,
    close_price REAL NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ticker, month_ref)
  );

  CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_owner_date ON transactions(owner_id, trade_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_asset_date ON transactions(asset, trade_date);
  CREATE INDEX IF NOT EXISTS idx_dividends_owner_date ON dividends(owner_id, payment_date);
  CREATE INDEX IF NOT EXISTS idx_dividends_asset_date ON dividends(asset, payment_date);
  CREATE INDEX IF NOT EXISTS idx_research_tab_source ON research_positions(tab_id, source);
`)

/** @param {() => void} callback */
export function runInTransaction(callback) {
  database.exec('BEGIN')
  try {
    callback()
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

/** @param {string} resource */
export function markResourceUpdated(resource) {
  database.prepare(`
    INSERT INTO resource_state (resource, updated_at)
    VALUES (?, ?)
    ON CONFLICT(resource) DO UPDATE SET updated_at = excluded.updated_at
  `).run(resource, nowIso())
}

/** @param {string} resource */
export function getResourceMetadata(resource) {
  return database.prepare('SELECT updated_at FROM resource_state WHERE resource = ?').get(resource) || null
}
