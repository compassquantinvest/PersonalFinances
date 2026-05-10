export function formatCurrency(value, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

export function formatMarketChange(value) {
  const numericValue = Number(value || 0)
  const sign = numericValue > 0 ? '+' : ''
  return `${sign}${numericValue.toFixed(2)}%`
}

export function formatSignedCurrency(value, currency = 'BRL') {
  const numericValue = Number(value || 0)
  const sign = numericValue > 0 ? '+' : numericValue < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(numericValue), currency)}`
}

export function formatSignedPercent(value) {
  const numericValue = Number(value || 0)
  const sign = numericValue > 0 ? '+' : numericValue < 0 ? '-' : ''
  return `${sign}${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numericValue))}%`
}

export function parseLocalizedNumber(value) {
  if (typeof value === 'number') {
    return value
  }

  const normalized = String(value || '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')

  return Number(normalized || 0)
}

export function formatDecimalInput(value) {
  return value.toFixed(2).replace('.', ',')
}
