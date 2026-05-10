/**
 * Cria um rate limiter de janela deslizante baseado em IP.
 * @param {{ windowMs: number, max: number }} options
 * @returns {(ip: string) => boolean} Retorna true se a requisição é permitida
 */
export function createRateLimiter({ windowMs, max }) {
  /** @type {Map<string, { start: number, count: number }>} */
  const windows = new Map()

  // Remove entradas expiradas a cada 5 minutos para evitar vazamento de memória
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of windows) {
      if (now - entry.start > windowMs) {
        windows.delete(key)
      }
    }
  }, 5 * 60 * 1000).unref()

  return function check(ip) {
    const now = Date.now()
    const entry = windows.get(ip)

    if (!entry || now - entry.start > windowMs) {
      windows.set(ip, { start: now, count: 1 })
      return true
    }

    if (entry.count >= max) {
      return false
    }

    entry.count++
    return true
  }
}
