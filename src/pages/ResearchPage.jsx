import { researchPortfolioTabs } from '../data/defaultData'
import { formatCurrency, formatPercent } from '../lib/formatters'
import { getFamilyResearchRows, getResearchBias } from '../domain/portfolio'

function ResearchTabSelector({ activeTab, setActiveTab }) {
  return (
    <div className="research-tabs">
      {researchPortfolioTabs.map((tab) => (
        <button
          key={tab.id}
          className={`ghost-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ResearchColumn({ title, subtitle, rows, rowToneMap, isFamily = false }) {
  const sortedRows = [...rows].sort((left, right) => {
    const leftTone = rowToneMap[left.ticker] || 'unique'
    const rightTone = rowToneMap[right.ticker] || 'unique'
    const priority = { 'family-shared': 2, 'analyst-shared': 1, unique: 0 }
    const leftShared = priority[leftTone] || 0
    const rightShared = priority[rightTone] || 0

    if (leftShared !== rightShared) return rightShared - leftShared
    return left.ticker.localeCompare(right.ticker)
  })

  return (
    <article className="panel research-column">
      <div className="panel-header research-header">
        <div>
          <p className="eyebrow">{isFamily ? 'Carteira atual' : 'Casa de analise'}</p>
          <h3>{title}</h3>
          <span className="research-subtitle">{subtitle}</span>
        </div>
        <span className="mono">{rows.length} ativos</span>
      </div>

      {rows.length ? (
        <div className="research-list">
          {sortedRows.map((row) => {
            const tone = rowToneMap[row.ticker] || 'unique'
            const bias = getResearchBias(row)

            return (
              <div className={`research-row ${tone}`} key={`${title}-${row.ticker}`}>
                <div className="research-main">
                  <strong>{row.ticker}</strong>
                  <span>{row.company}</span>
                  {row.segment || row.reportDate ? (
                    <p className="research-meta">
                      {[row.segment, row.reportDate ? `Ref. ${row.reportDate}` : ''].filter(Boolean).join(' | ')}
                    </p>
                  ) : null}
                </div>
                <div className="research-metrics">
                  <div>
                    <span>Alocacao</span>
                    <strong>{formatPercent(row.allocation)}</strong>
                  </div>
                  <div>
                    <span>DY esp.</span>
                    <strong>{formatPercent(row.dyExpected || 0)}</strong>
                  </div>
                  <div>
                    <span>Preco atual</span>
                    <strong>{row.currentPrice ? formatCurrency(row.currentPrice) : '-'}</strong>
                  </div>
                  <div>
                    <span>{typeof row.ceilingPrice === 'number' ? 'Preco teto' : typeof row.patrimonialPrice === 'number' ? 'VP/cota' : 'Referencia'}</span>
                    <strong>
                      {typeof row.ceilingPrice === 'number'
                        ? formatCurrency(row.ceilingPrice)
                        : typeof row.patrimonialPrice === 'number'
                          ? formatCurrency(row.patrimonialPrice)
                          : 'Nao ha'}
                    </strong>
                  </div>
                  {!isFamily ? (
                    <div>
                      <span>Recomendacao</span>
                      <strong className={`bias-pill ${bias.tone}`}>{bias.label}</strong>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="research-empty">
          <p className="eyebrow">Sem ativos</p>
          <strong>{isFamily ? 'Esse membro ainda nao tem ativos dessa classe.' : 'Essa coluna esta pronta para receber a carteira dessa casa.'}</strong>
        </div>
      )}
    </article>
  )
}

export function ResearchPage({ activeTab, setActiveTab, researchPortfolios, member, assets }) {
  const tabData = researchPortfolios[activeTab] || {}
  const familyRows = getFamilyResearchRows(activeTab, member, assets)
  const comparisonColumns = [
    { key: 'family', title: member?.name || 'Familia', subtitle: 'Carteira do membro', rows: familyRows, isFamily: true },
    { key: 'Suno', title: 'Suno', subtitle: 'Casa de analise', rows: tabData.Suno || [] },
    { key: 'XP', title: 'XP', subtitle: 'Casa de analise', rows: tabData.XP || [] },
    { key: 'Finclass', title: 'Finclass', subtitle: 'Casa de analise', rows: tabData.Finclass || [] },
  ]
  const familyTickers = new Set(familyRows.map((row) => row.ticker))
  const analystTickerCounts = comparisonColumns
    .filter((column) => !column.isFamily)
    .flatMap((column) => [...new Set(column.rows.map((row) => row.ticker))])
    .reduce((accumulator, ticker) => {
      accumulator[ticker] = (accumulator[ticker] || 0) + 1
      return accumulator
    }, {})
  const rowToneMaps = comparisonColumns.reduce((accumulator, column) => {
    accumulator[column.key] = Object.fromEntries(
      column.rows.map((row) => {
        if (column.isFamily) return [row.ticker, analystTickerCounts[row.ticker] ? 'family-shared' : 'unique']
        if (familyTickers.has(row.ticker)) return [row.ticker, 'family-shared']
        if ((analystTickerCounts[row.ticker] || 0) > 1) return [row.ticker, 'analyst-shared']
        return [row.ticker, 'unique']
      }),
    )
    return accumulator
  }, {})

  return (
    <section className="entries-layout research-layout">
      <article className="panel research-overview">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Comparativo resumido</p>
            <h3>Carteiras por tema</h3>
          </div>
        </div>

        <ResearchTabSelector activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="research-legend">
          <span className="legend-chip shared">Usuario x casa de analise</span>
          <span className="legend-chip analyst-shared">Sobrepoe entre casas</span>
          <span className="legend-chip unique">Exclusivo de uma coluna</span>
        </div>
      </article>

      <div className="research-grid four-columns">
        {comparisonColumns.map((column) => (
          <ResearchColumn
            key={column.key}
            title={column.title}
            subtitle={column.subtitle}
            rows={column.rows}
            rowToneMap={rowToneMaps[column.key] || {}}
            isFamily={column.isFamily}
          />
        ))}
      </div>
    </section>
  )
}
