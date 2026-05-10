import { useEffect, useMemo, useState } from 'react'
import { DataTable } from '../components/DataTable'
import { formatCurrency, formatPercent, formatSignedCurrency } from '../lib/formatters'
import { normalizeTicker } from '../domain/portfolio'
import { getMonthEndIso } from '../domain/provents'
import { quoteableAssetTypes } from '../lib/constants'

function inferAssetCategoryFromTicker(ticker) {
  const upper = String(ticker || '').toUpperCase().trim()
  if (/\d{2}$/.test(upper) && upper.length >= 5) return 'FIIs'
  return 'Acoes'
}

function buildPeriodMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function formatReportPeriodLabel(periodKey, granularity) {
  if (granularity === 'yearly') return periodKey

  const [year, month] = String(periodKey || '').split('-').map(Number)
  if (!year || !month) return periodKey

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatCompactCurrencyLabel(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
  return value.toFixed(0)
}

function buildClosedReportPeriods(transactions, dividends, granularity) {
  const allDates = [...transactions.map((t) => t.date), ...dividends.map((d) => d.date)].filter(Boolean)

  if (!allDates.length) return []

  const sorted = [...allDates].sort()
  const [earliestYear, earliestMonth] = sorted[0].split('-').map(Number)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (granularity === 'yearly') {
    const lastClosedYear = currentYear - 1
    if (!earliestYear || earliestYear > lastClosedYear) return []

    return Array.from({ length: lastClosedYear - earliestYear + 1 }, (_, index) => {
      const year = earliestYear + index
      const cutoffMonthKey = buildPeriodMonthKey(year, 12)
      return { key: String(year), label: formatReportPeriodLabel(String(year), 'yearly'), cutoffMonthKey, cutoffDate: getMonthEndIso(cutoffMonthKey), startDate: `${year}-01-01` }
    })
  }

  const firstMonthDate = new Date(Date.UTC(earliestYear, (earliestMonth || 1) - 1, 1))
  const endBoundary = new Date(Date.UTC(currentYear, currentMonth - 1, 1))
  const periods = []
  const cursor = new Date(firstMonthDate)

  while (cursor < endBoundary) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth() + 1
    const periodKey = buildPeriodMonthKey(year, month)
    periods.push({ key: periodKey, label: formatReportPeriodLabel(periodKey, 'monthly'), cutoffMonthKey: periodKey, cutoffDate: getMonthEndIso(periodKey), startDate: `${periodKey}-01` })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return periods
}

function getHoldingSnapshotAsOf(transactions, ownerId, ticker, cutoffDate) {
  return [...transactions]
    .filter((transaction) => transaction.ownerId === ownerId && normalizeTicker(transaction.asset) === ticker && String(transaction.date || '') <= cutoffDate)
    .sort((left, right) => {
      if (left.date !== right.date) return String(left.date || '').localeCompare(String(right.date || ''))
      return String(left.id || '').localeCompare(String(right.id || ''))
    })
    .reduce((snapshot, transaction) => {
      const quantity = Number(transaction.quantity || 0)
      const total = Number(transaction.total || 0)
      const fees = Number(transaction.fees || 0)

      if ((transaction.type || 'Compra') === 'Venda') {
        if (snapshot.quantity <= 0 || quantity <= 0) return snapshot
        const averageCost = snapshot.quantity > 0 ? snapshot.costBasis / snapshot.quantity : 0
        const quantityToSell = Math.min(snapshot.quantity, quantity)
        snapshot.costBasis -= averageCost * quantityToSell
        snapshot.quantity -= quantityToSell
        if (snapshot.quantity <= 0) { snapshot.quantity = 0; snapshot.costBasis = 0 }
        return snapshot
      }

      snapshot.quantity += quantity
      snapshot.costBasis += total + fees
      return snapshot
    }, { quantity: 0, costBasis: 0 })
}

function buildReportsPerformanceRows({ ownerId, assets, transactions, dividends, periods, monthlyPrices }) {
  if (!ownerId || !periods.length) return []

  const ownerTransactions = transactions.filter((transaction) => transaction.ownerId === ownerId)
  const ownerDividends = dividends.filter((dividend) => dividend.ownerId === ownerId)
  const ownerAssets = assets.filter((asset) => asset.ownerId === ownerId)
  const quoteableTickers = [
    ...new Set(
      [...ownerAssets, ...ownerTransactions, ...ownerDividends]
        .filter((row) => {
          const type = row.type || row.category || inferAssetCategoryFromTicker(row.name || row.asset || '')
          return quoteableAssetTypes.has(type)
        })
        .map((row) => normalizeTicker(row.name || row.asset))
        .filter(Boolean),
    ),
  ]
  const snapshotCache = new Map()

  function getCachedSnapshot(ticker, cutoffDate) {
    const cacheKey = `${ticker}::${cutoffDate}`
    if (snapshotCache.has(cacheKey)) return snapshotCache.get(cacheKey)
    const snapshot = getHoldingSnapshotAsOf(ownerTransactions, ownerId, ticker, cutoffDate)
    snapshotCache.set(cacheKey, snapshot)
    return snapshot
  }

  return periods.map((period) => {
    const cumulativeDividends = ownerDividends.filter((dividend) => String(dividend.date || '') <= period.cutoffDate).reduce((sum, dividend) => sum + Number(dividend.amount || 0), 0)
    const periodDividends = ownerDividends.filter((dividend) => { const d = String(dividend.date || ''); return d >= period.startDate && d <= period.cutoffDate }).reduce((sum, dividend) => sum + Number(dividend.amount || 0), 0)
    const cumulativeInvested = ownerTransactions.filter((transaction) => (transaction.type || 'Compra') !== 'Venda' && String(transaction.date || '') <= period.cutoffDate).reduce((sum, transaction) => sum + Number(transaction.total || 0) + Number(transaction.fees || 0), 0)

    let patrimonio = 0
    let usedCostFallback = false

    quoteableTickers.forEach((ticker) => {
      const snapshot = getCachedSnapshot(ticker, period.cutoffDate)
      if (Number(snapshot.quantity || 0) <= 0) return
      const closePrice = Number(monthlyPrices?.[ticker]?.[period.cutoffMonthKey]?.closePrice || 0)
      const averageCost = snapshot.quantity > 0 ? snapshot.costBasis / snapshot.quantity : 0
      const unitValue = closePrice > 0 ? closePrice : averageCost
      if (!(closePrice > 0) && unitValue > 0) usedCostFallback = true
      patrimonio += Number(snapshot.quantity || 0) * unitValue
    })

    return { ...period, patrimonio, cumulativeDividends, periodDividends, cumulativeInvested, dividendYieldPercent: cumulativeInvested > 0 ? (cumulativeDividends / cumulativeInvested) * 100 : 0, usedCostFallback }
  })
}

function ReportsPerformanceChart({ rows, granularity, onChangeGranularity, loading, error }) {
  const latestRow = rows[rows.length - 1] || null
  const chartMax = rows.reduce((maxValue, row) => Math.max(maxValue, Number(row.patrimonio || 0), Number(row.cumulativeDividends || 0)), 0)
  const safeChartMax = chartMax > 0 ? chartMax : 1
  const scaleTicks = [1, 0.75, 0.5, 0.25, 0]
  const hasFallbackValues = rows.some((row) => row.usedCostFallback)

  return (
    <article className="panel reports-chart-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Evolucao</p>
          <h3>Patrimonio e retorno em dividendos</h3>
          <span>Patrimonio no fechamento do periodo e dividendos acumulados do membro selecionado.</span>
        </div>

        <div className="sort-controls compact-sort-controls">
          <button className={`ghost-button ${granularity === 'monthly' ? 'active' : ''}`} type="button" onClick={() => onChangeGranularity('monthly')}>Mensal</button>
          <button className={`ghost-button ${granularity === 'yearly' ? 'active' : ''}`} type="button" onClick={() => onChangeGranularity('yearly')}>Anual</button>
        </div>
      </div>

      <div className="reports-summary-grid reports-performance-highlights">
        <div className="summary-item"><span>Patrimonio no ultimo fechamento</span><strong>{latestRow ? formatCurrency(latestRow.patrimonio) : '-'}</strong></div>
        <div className="summary-item"><span>Dividendos acumulados</span><strong>{latestRow ? formatCurrency(latestRow.cumulativeDividends) : '-'}</strong></div>
        <div className="summary-item"><span>Retorno acumulado de dividendos</span><strong>{latestRow ? formatPercent(latestRow.dividendYieldPercent) : '-'}</strong></div>
        <div className="summary-item"><span>Dividendos no ultimo periodo</span><strong>{latestRow ? formatCurrency(latestRow.periodDividends) : '-'}</strong></div>
      </div>

      <div className="legend-row reports-chart-legend">
        <div>
          <strong>Leitura do grafico</strong>
          <p>Barras agrupadas por periodo com patrimonio de fechamento e dividendos acumulados.</p>
        </div>
        <div className="reports-legend-items">
          <span className="reports-legend-item"><span className="reports-legend-swatch patrimonio" />Patrimonio</span>
          <span className="reports-legend-item"><span className="reports-legend-swatch dividends" />Dividendos acumulados</span>
        </div>
      </div>

      {loading ? <p className="income-summary-copy">Carregando precos historicos para montar o grafico...</p> : null}
      {!loading && error ? <p className="import-help-text">{error}</p> : null}
      {!loading && hasFallbackValues ? <p className="income-summary-copy">Alguns fechamentos indisponiveis foram estimados pelo custo medio da posicao.</p> : null}

      {!rows.length ? (
        <div className="research-empty">
          <p className="eyebrow">Sem serie</p>
          <strong>{granularity === 'yearly' ? 'Ainda nao ha anos fechados suficientes para montar esse comparativo.' : 'Ainda nao ha meses fechados suficientes para montar esse comparativo.'}</strong>
        </div>
      ) : (
        <div className="reports-chart-shell">
          <div className="reports-chart-scale">
            {scaleTicks.map((tick) => (
              <div className="reports-chart-scale-row" key={tick}>
                <span>{formatCompactCurrencyLabel(safeChartMax * tick)}</span>
              </div>
            ))}
          </div>

          <div className="reports-chart-scroll">
            <div className="reports-chart-grid">
              {scaleTicks.map((tick) => <div className="reports-chart-grid-line" key={tick} style={{ bottom: `${tick * 100}%` }} />)}

              <div className="reports-chart-groups">
                {rows.map((row) => {
                  const patrimonioHeight = Math.max((Number(row.patrimonio || 0) / safeChartMax) * 100, row.patrimonio > 0 ? 3 : 0)
                  const dividendsHeight = Math.max((Number(row.cumulativeDividends || 0) / safeChartMax) * 100, row.cumulativeDividends > 0 ? 3 : 0)
                  const isLatest = latestRow?.key === row.key

                  return (
                    <div
                      className={`reports-chart-group ${isLatest ? 'latest' : ''}`}
                      key={row.key}
                      title={`${row.label} | Patrimonio: ${formatCurrency(row.patrimonio)} | Dividendos acumulados: ${formatCurrency(row.cumulativeDividends)} | Retorno acumulado: ${formatPercent(row.dividendYieldPercent)}`}
                    >
                      <span className="reports-yield-chip">{formatPercent(row.dividendYieldPercent)}</span>
                      <div className="reports-bars">
                        <div className="reports-bar-column"><div className="reports-bar patrimonio" style={{ height: `${patrimonioHeight}%` }} /></div>
                        <div className="reports-bar-column"><div className="reports-bar dividends" style={{ height: `${dividendsHeight}%` }} /></div>
                      </div>
                      <div className="reports-period-footer">
                        <strong>{row.label}</strong>
                        <span>{formatCurrency(row.periodDividends)} no periodo</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export function ReportsPage({ monthlyReportRows, selectedMember, assets, transactions, dividends }) {
  const totals = monthlyReportRows.reduce(
    (accumulator, row) => ({
      investedNet: accumulator.investedNet + row.investedNet,
      purchaseFees: accumulator.purchaseFees + row.purchaseFees,
      dividendIncome: accumulator.dividendIncome + row.dividendIncome,
      realizedProfitLoss: accumulator.realizedProfitLoss + row.realizedProfitLoss,
      netCashFlow: accumulator.netCashFlow + row.netCashFlow,
    }),
    { investedNet: 0, purchaseFees: 0, dividendIncome: 0, realizedProfitLoss: 0, netCashFlow: 0 },
  )
  const totalInvested = totals.investedNet + totals.purchaseFees
  const dividendReturnPercent = totalInvested > 0 ? totals.dividendIncome / totalInvested : 0
  const [performanceGranularity, setPerformanceGranularity] = useState('monthly')
  const [performancePriceSnapshot, setPerformancePriceSnapshot] = useState({ status: 'idle', prices: {}, updatedAt: '', error: '' })

  const ownerAssets = useMemo(() => assets.filter((asset) => asset.ownerId === selectedMember?.id), [assets, selectedMember?.id])
  const ownerTransactions = useMemo(() => transactions.filter((transaction) => transaction.ownerId === selectedMember?.id), [selectedMember?.id, transactions])
  const ownerDividends = useMemo(() => dividends.filter((dividend) => dividend.ownerId === selectedMember?.id), [dividends, selectedMember?.id])
  const performancePeriods = useMemo(() => buildClosedReportPeriods(ownerTransactions, ownerDividends, performanceGranularity), [ownerDividends, ownerTransactions, performanceGranularity])
  const performanceTickers = useMemo(
    () => [
      ...new Set(
        [...ownerAssets, ...ownerTransactions, ...ownerDividends]
          .filter((row) => { const type = row.type || row.category || inferAssetCategoryFromTicker(row.name || row.asset || ''); return quoteableAssetTypes.has(type) })
          .map((row) => normalizeTicker(row.name || row.asset))
          .filter(Boolean),
      ),
    ],
    [ownerAssets, ownerDividends, ownerTransactions],
  )
  const performanceRows = useMemo(
    () => buildReportsPerformanceRows({ ownerId: selectedMember?.id || '', assets: ownerAssets, transactions, dividends, periods: performancePeriods, monthlyPrices: performancePriceSnapshot.prices }),
    [dividends, ownerAssets, performancePeriods, performancePriceSnapshot.prices, selectedMember?.id, transactions],
  )

  useEffect(() => {
    if (!selectedMember?.id || !performanceTickers.length || !performancePeriods.length) {
      setPerformancePriceSnapshot({ status: 'idle', prices: {}, updatedAt: '', error: '' })
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadPerformancePrices() {
      try {
        setPerformancePriceSnapshot((current) => ({ ...current, status: current.status === 'ready' ? 'refreshing' : 'loading', error: '' }))

        const response = await fetch(
          `/api/monthly-prices?symbols=${performanceTickers.join(',')}&months=${performancePeriods.map((period) => period.cutoffMonthKey).join(',')}`,
          { signal: controller.signal },
        )
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (cancelled) return
          setPerformancePriceSnapshot({ status: 'error', prices: {}, updatedAt: payload.fetchedAt || '', error: payload.error || 'Nao foi possivel carregar os precos historicos do grafico.' })
          return
        }

        if (cancelled) return
        setPerformancePriceSnapshot({ status: 'ready', prices: payload.prices || {}, updatedAt: payload.fetchedAt || '', error: '' })
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return
        setPerformancePriceSnapshot({ status: 'error', prices: {}, updatedAt: '', error: 'Servidor de precos mensais indisponivel no momento.' })
      }
    }

    loadPerformancePrices()

    return () => { cancelled = true; controller.abort() }
  }, [performancePeriods, performanceTickers, selectedMember?.id])

  return (
    <section className="entries-layout reports-layout">
      <article className="panel reports-summary-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Resumo</p>
            <h3>Fechamento mensal</h3>
          </div>
        </div>

        <div className="reports-summary-grid">
          <div className="summary-item"><span>Meses com movimento</span><strong>{monthlyReportRows.length}</strong></div>
          <div className="summary-item"><span>Dividendos</span><strong>{formatCurrency(totals.dividendIncome)}</strong></div>
          <div className="summary-item">
            <span>Lucro/Perda realizado</span>
            <strong className={totals.realizedProfitLoss >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(totals.realizedProfitLoss)}</strong>
          </div>
          <div className="summary-item">
            <span>Fluxo liquido</span>
            <strong className={totals.netCashFlow >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(totals.netCashFlow)}</strong>
          </div>
        </div>

        <div className="reports-summary-grid">
          <div className="summary-item"><span>Total investido</span><strong>{formatCurrency(totalInvested)}</strong></div>
          <div className="summary-item">
            <span>Retorno total de dividendos</span>
            <strong>{formatCurrency(totals.dividendIncome)}</strong>
            <span>{formatPercent(dividendReturnPercent * 100)}</span>
          </div>
        </div>
      </article>

      <ReportsPerformanceChart
        rows={performanceRows}
        granularity={performanceGranularity}
        onChangeGranularity={setPerformanceGranularity}
        loading={performancePriceSnapshot.status === 'loading' || performancePriceSnapshot.status === 'refreshing'}
        error={performancePriceSnapshot.error}
      />

      <DataTable
        title="Relatorio mensal consolidado"
        rows={monthlyReportRows}
        columns={[
          { key: 'monthLabel', label: 'Mes' },
          { key: 'purchaseCount', label: 'Compras', render: (row) => row.purchaseCount },
          { key: 'saleCount', label: 'Vendas', render: (row) => row.saleCount },
          { key: 'investedNet', label: 'Investido', render: (row) => formatCurrency(row.investedNet) },
          { key: 'saleNet', label: 'Vendido', render: (row) => formatCurrency(row.saleNet) },
          { key: 'dividendIncome', label: 'Dividendos', render: (row) => formatCurrency(row.dividendIncome) },
          { key: 'purchaseFees', label: 'Taxas compra', render: (row) => formatCurrency(row.purchaseFees) },
          { key: 'saleFees', label: 'Taxas venda', render: (row) => formatCurrency(row.saleFees) },
          { key: 'realizedProfitLoss', label: 'Lucro/Perda', render: (row) => <span className={row.realizedProfitLoss >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(row.realizedProfitLoss)}</span> },
          { key: 'netCashFlow', label: 'Fluxo liquido', render: (row) => <span className={row.netCashFlow >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(row.netCashFlow)}</span> },
        ]}
      />
    </section>
  )
}
