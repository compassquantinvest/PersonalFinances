/** @param {import('node:http').ServerResponse} response */
let _allowedOrigin = 'http://localhost:5173'

/** @param {string} origin */
export function setAllowedOrigin(origin) {
  _allowedOrigin = origin
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {number} statusCode
 * @param {unknown} payload
 */
export function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
    'Access-Control-Allow-Origin': _allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Strict-Transport-Security': 'max-age=31536000',
  })
  response.end(JSON.stringify(payload))
}

/** @returns {string} */
export function nowIso() {
  return new Date().toISOString()
}

/** @param {string} value */
export function normalizeTicker(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()
  if (normalizedValue === 'ELET6') return 'AXIA6'
  if (normalizedValue === 'IRDM11') return 'IRIM11'
  return normalizedValue
}

/** @param {number} count */
export function buildSqlPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ')
}

/** @param {string | null | undefined} rawSymbols */
export function normalizeSymbols(rawSymbols) {
  return [...new Set(
    String(rawSymbols || '')
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
  )]
}

/** @param {import('node:http').IncomingMessage} request */
export function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload excede o limite de 5MB.'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(raw))
    request.on('error', reject)
  })
}

/** @param {import('node:http').IncomingMessage} request */
export async function readJsonBody(request) {
  const raw = await readRequestBody(request)
  if (!raw) return {}
  return JSON.parse(raw)
}

/** @param {number} value */
function padMonth(value) {
  return String(value).padStart(2, '0')
}

/**
 * @param {number} year
 * @param {number} month
 */
export function buildMonthKey(year, month) {
  return `${year}-${padMonth(month)}`
}

/** @param {string} monthKey */
export function getPreviousMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return ''
  if (month === 1) return buildMonthKey(year - 1, 12)
  return buildMonthKey(year, month - 1)
}

/** @param {string} monthKey */
export function getMonthEndIso(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number)
  if (!year || !month) return ''
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/** @param {Array<{ date?: string, id?: string }>} rows */
export function sortTransactionsChronologically(rows = []) {
  return [...rows].sort((left, right) => {
    if (left.date !== right.date) {
      return String(left.date || '').localeCompare(String(right.date || ''))
    }
    return String(left.id || '').localeCompare(String(right.id || ''))
  })
}
