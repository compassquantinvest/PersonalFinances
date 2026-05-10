import { categoryColors } from '../lib/constants'
import { formatCurrency, formatMarketChange, formatPercent, formatSignedCurrency, formatSignedPercent } from '../lib/formatters'
import { buildGradient, getAssetCurrentValue, getAssetPerformance } from '../domain/portfolio'

function MarketOverviewBlock({ marketOverview }) {
  const cards = [
    { key: 'ibov', label: 'Ibovespa', prefix: 'Indice Brasil' },
    { key: 'usdbrl', label: 'Dolar', prefix: 'USD/BRL' },
    { key: 'bitcoin', label: 'Bitcoin', prefix: 'BTC/BRL' },
    { key: 'ifix', label: 'IFIX', prefix: 'FIIs Brasil' },
  ]

  return (
    <article className="panel market-overview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Mercado hoje</p>
          <h3>Indicadores acompanhados</h3>
        </div>
        <span className="mono">
          {marketOverview.updatedAt
            ? `Atualizado ${new Date(marketOverview.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            : 'Aguardando dados'}
        </span>
      </div>

      {marketOverview.error ? <p className="market-overview-error">{marketOverview.error}</p> : null}

      <div className="market-strip">
        {cards.map((card) => {
          const item = marketOverview.items?.[card.key]
          const hasValue = typeof item?.value === 'number'
          const variation = Number(item?.changePercent || 0)

          return (
            <div className="market-card" key={card.key}>
              <span className="eyebrow">{card.prefix}</span>
              <div className="market-card-line">
                <strong>{card.label}</strong>
                <div className="market-card-inline-values">
                  <div className="market-card-value">{hasValue ? formatCurrency(item.value, item.currency || 'BRL') : '--'}</div>
                  <span className={`market-change ${variation > 0 ? 'positive' : variation < 0 ? 'negative' : 'neutral'}`}>
                    {hasValue ? formatMarketChange(variation) : 'Indisponivel'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

function FamilySummary({ member, allocation, totalValue, monthlyIncome }) {
  return (
    <article className="panel family-summary">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{member.name}</p>
          <h3>Panorama da carteira</h3>
        </div>
        <span className="mono">{formatCurrency(totalValue)}</span>
      </div>

      <div className="summary-grid">
        <div className="summary-kpis">
          <div className="summary-item">
            <span>Patrimonio</span>
            <strong>{formatCurrency(totalValue)}</strong>
          </div>
          <div className="summary-item">
            <span>Renda mensal estimada</span>
            <strong>{formatCurrency(monthlyIncome)}</strong>
          </div>
          <div className="summary-item">
            <span>Classes monitoradas</span>
            <strong>{allocation.length}</strong>
          </div>
        </div>

        <div className="donut-block">
          <div className="donut-chart" style={{ backgroundImage: buildGradient(allocation) }}>
            <div>
              <strong>{formatCurrency(totalValue)}</strong>
              <span>Total</span>
            </div>
          </div>
        </div>

        <div className="legend-list">
          {allocation.map((item) => {
            const weight = totalValue ? (item.amount / totalValue) * 100 : 0
            return (
              <div className="legend-row" key={item.category}>
                <span className="dot" style={{ backgroundColor: item.color }} />
                <div>
                  <strong>{item.category}</strong>
                  <p>{formatCurrency(getAssetCurrentValue(item))}</p>
                </div>
                <span className="mono">{formatPercent(weight)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

function HoldingTable({ rows, sortBy, sortDirection, setSortBy, setSortDirection }) {
  function toggleSort(nextSortBy) {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortBy(nextSortBy)
    setSortDirection('desc')
  }

  return (
    <article className="panel holdings-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ativos do membro</p>
          <h3>Ordenar e navegar por classe</h3>
        </div>
        <div className="sort-controls">
          <button className={`ghost-button ${sortBy === 'amount' ? 'active' : ''}`} onClick={() => toggleSort('amount')}>tamanho</button>
          <button className={`ghost-button ${sortBy === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}>nome</button>
          <button className={`ghost-button ${sortBy === 'type' ? 'active' : ''}`} onClick={() => toggleSort('type')}>classe</button>
          <button className={`ghost-button ${sortBy === 'monthlyIncome' ? 'active' : ''}`} onClick={() => toggleSort('monthlyIncome')}>renda</button>
          <span className="mono">{sortDirection === 'desc' ? 'maior > menor' : 'a > z'}</span>
        </div>
      </div>

      <div className="grouped-holdings">
        {rows.map(({ category, items, total }) => (
          <section className="holding-group" key={category}>
            <div className="holding-group-header">
              <div>
                <p className="eyebrow">{category}</p>
                <strong>{formatCurrency(total)}</strong>
              </div>
              <span className="mono">{items.length} ativos</span>
            </div>

            <div className="holding-table">
              <div className="holding-table-row heading">
                <span>Ativo</span>
                <span>Quantidade</span>
                <span>Moeda</span>
                <span>Instituicao</span>
                <span>Renda mes</span>
                <span>Valor atual</span>
              </div>
              {items.map((item) => {
                const performance = getAssetPerformance(item)
                return (
                  <div className="holding-table-row" key={item.id}>
                    <span>{item.name}</span>
                    <span>{Number(item.quantity || 0)}</span>
                    <span>{item.currency}</span>
                    <span>{item.institution || '-'}</span>
                    <span>{formatCurrency(item.monthlyIncome)}</span>
                    <div className="holding-value-cell">
                      <strong>{formatCurrency(getAssetCurrentValue(item), item.currency)}</strong>
                      <span className={`holding-result ${performance.tone}`}>
                        {formatSignedCurrency(performance.absolute, item.currency)} ({formatSignedPercent(performance.percentage)})
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}

function IncomeMatrixTable({ title, eyebrow, rows, columns, emptyMessage }) {
  return (
    <article className="panel table-panel income-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <span className="mono">{rows.length} ativos</span>
      </div>

      {!rows.length ? (
        <div className="income-empty-state">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="table-wrap income-table-wrap">
          <table className="income-table">
            <thead>
              <tr>
                <th>Ativo</th>
                <th>Instituicao</th>
                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker}>
                  <td><strong>{row.ticker}</strong></td>
                  <td>{row.institution || '-'}</td>
                  {row.values.map((value) => (
                    <td key={value.monthKey}>
                      <div className="income-cell">
                        <strong>{value.amount > 0 ? formatCurrency(value.amount) : '--'}</strong>
                        <span className={`income-cell-percent ${value.percent > 0 ? 'positive' : 'neutral'}`}>
                          {value.percent > 0 ? formatPercent(value.percent) : '--'}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  )
}

function IncomePanels({ member, incomePanels, incomePriceSnapshot }) {
  if (!member) return null

  const hasRows = incomePanels.fiisRows.length || incomePanels.acoesRows.length

  return (
    <section className="income-panels">
      <article className="panel income-summary-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Proventos</p>
            <h3>Tabelas de rendimento mensal</h3>
          </div>
          <span className="mono">
            {incomePriceSnapshot.updatedAt
              ? `Precos atualizados ${new Date(incomePriceSnapshot.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Ultimos 12 meses'}
          </span>
        </div>

        <p className="income-summary-copy">Cada celula mostra o valor recebido no mes e o yield sobre o fechamento do mes anterior.</p>
        {incomePriceSnapshot.error ? <p className="market-overview-error">{incomePriceSnapshot.error}</p> : null}
        {!hasRows ? <p className="income-summary-copy">Cadastre compras e proventos em FIIs ou acoes para montar a grade.</p> : null}
      </article>

      <div className="income-grid">
        <IncomeMatrixTable title="FIIs" eyebrow="Renda imobiliaria" rows={incomePanels.fiisRows} columns={incomePanels.columns} emptyMessage="Nenhum FII encontrado para este membro." />
        <IncomeMatrixTable title="Acoes" eyebrow="Renda corporativa" rows={incomePanels.acoesRows} columns={incomePanels.columns} emptyMessage="Nenhuma acao encontrada para este membro." />
      </div>
    </section>
  )
}

function EmptyHome({ marketOverview }) {
  return (
    <>
      <MarketOverviewBlock marketOverview={marketOverview} />
      <article className="panel empty-state">
        <p className="eyebrow">Sem dados</p>
        <h3>Cadastre um membro e pelo menos um ativo para montar a home.</h3>
      </article>
    </>
  )
}

export function HomePage({ member, assets, sortBy, sortDirection, setSortBy, setSortDirection, marketOverview, incomePanels, incomePriceSnapshot }) {
  if (!member) return <EmptyHome marketOverview={marketOverview} />

  const memberAssets = assets.filter((asset) => asset.ownerId === member.id)

  if (!memberAssets.length) return <EmptyHome marketOverview={marketOverview} />

  const sortedAssets = [...memberAssets].sort((left, right) => {
    const leftValue = sortBy === 'amount' ? getAssetCurrentValue(left) : left[sortBy]
    const rightValue = sortBy === 'amount' ? getAssetCurrentValue(right) : right[sortBy]

    if (typeof leftValue === 'string') {
      return sortDirection === 'asc' ? leftValue.localeCompare(rightValue) : rightValue.localeCompare(leftValue)
    }

    return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue
  })

  const allocation = Object.keys(categoryColors)
    .map((category) => {
      const amount = memberAssets
        .filter((item) => item.type === category)
        .reduce((sum, item) => sum + getAssetCurrentValue(item), 0)
      return { category, amount, color: categoryColors[category] }
    })
    .filter((item) => item.amount > 0)

  const groupedRows = allocation.map((item) => ({
    category: item.category,
    total: item.amount,
    items: sortedAssets.filter((asset) => asset.type === item.category),
  }))

  const totalValue = memberAssets.reduce((sum, item) => sum + getAssetCurrentValue(item), 0)
  const monthlyIncome = memberAssets.reduce((sum, item) => sum + item.monthlyIncome, 0)

  return (
    <section className="home-layout">
      <MarketOverviewBlock marketOverview={marketOverview} />
      <FamilySummary member={member} allocation={allocation} totalValue={totalValue} monthlyIncome={monthlyIncome} />

      <div className="home-columns">
        <HoldingTable rows={groupedRows} sortBy={sortBy} sortDirection={sortDirection} setSortBy={setSortBy} setSortDirection={setSortDirection} />
      </div>

      <IncomePanels member={member} incomePanels={incomePanels} incomePriceSnapshot={incomePriceSnapshot} />
    </section>
  )
}
