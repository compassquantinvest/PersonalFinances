import { normalizeTicker } from '../portfolio'

/** @param {string} value */
export function normalizeOcrTicker(value) {
  const upperValue = String(value || '').toUpperCase()
  const prefix = upperValue.slice(0, -2)
  const suffix = upperValue.slice(-2).replace(/[IL]/g, '1').replace(/O/g, '0')
  return `${prefix}${suffix}`.replace(/[^A-Z0-9]/g, '')
}

/** @param {string} ticker */
export function buildOcrTolerantTickerPattern(ticker) {
  return ticker
    .toUpperCase()
    .split('')
    .map((character) => {
      if (character === '1') return '[1IL]'
      if (character === '0') return '[0O]'
      if (/\d/.test(character)) return `[${character}]`
      return character
    })
    .join('')
}

/**
 * @param {string} text
 * @param {string[]} assetTickers
 */
export function resolveTickerFromKnownAssets(text, assetTickers = []) {
  const upperText = String(text || '').toUpperCase()

  for (const ticker of assetTickers) {
    const pattern = new RegExp(buildOcrTolerantTickerPattern(normalizeTicker(ticker)))
    if (pattern.test(upperText)) return normalizeTicker(ticker)
  }

  const compactText = normalizeOcrTicker(upperText.replace(/[^A-Z0-9IL]/g, ''))

  for (const ticker of assetTickers) {
    const normalizedTicker = normalizeTicker(ticker)
    if (
      compactText.includes(normalizedTicker) ||
      normalizedTicker.startsWith(compactText) ||
      compactText.includes(normalizedTicker.slice(0, Math.max(normalizedTicker.length - 1, 1)))
    ) {
      return normalizedTicker
    }
  }

  return ''
}

/**
 * @param {string} text
 * @param {string[]} assetTickers
 */
export function findKnownTickerMatches(text, assetTickers = []) {
  const upperText = String(text || '').toUpperCase()

  return assetTickers
    .flatMap((ticker) => {
      const normalizedTicker = normalizeTicker(ticker)
      const pattern = new RegExp(buildOcrTolerantTickerPattern(normalizedTicker), 'g')
      const matches = []
      let match = pattern.exec(upperText)
      while (match) {
        matches.push({ index: match.index, ticker: normalizedTicker })
        match = pattern.exec(upperText)
      }
      return matches
    })
    .sort((left, right) => left.index - right.index)
}
