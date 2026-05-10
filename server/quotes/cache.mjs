/** Máximo de entradas no cache (evita vazamento de memória) */
const MAX_CACHE_SIZE = 500

/** @type {Map<string, { cachedAt: number, value: import('../../src/types.js').Quote }>} */
export const quoteCache = new Map()

let cacheTtlMs = 60_000

/** @param {number} ttl */
export function setCacheTtl(ttl) {
  cacheTtlMs = ttl
}

/** @param {string} symbol */
export function getCachedQuote(symbol) {
  const cached = quoteCache.get(symbol)
  if (!cached) return null
  if (Date.now() - cached.cachedAt > cacheTtlMs) return null
  return cached.value
}

/**
 * @param {string} symbol
 * @param {{ cachedAt: number, value: import('../../src/types.js').Quote }} entry
 */
export function setCachedQuote(symbol, entry) {
  if (quoteCache.size >= MAX_CACHE_SIZE) {
    // Evição LRU simples: remove a entrada mais antiga (primeira do Map)
    quoteCache.delete(quoteCache.keys().next().value)
  }
  quoteCache.set(symbol, entry)
}
