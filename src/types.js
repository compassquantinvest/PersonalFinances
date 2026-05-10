/**
 * @typedef {Object} Member
 * @property {string} id
 * @property {string} name
 * @property {string} role - e.g. 'Titular', 'Dependente'
 * @property {string} accent - CSS color string
 */

/**
 * @typedef {Object} Asset
 * @property {string} id
 * @property {string} ownerId
 * @property {string} name - ticker symbol
 * @property {string} type - 'Acoes' | 'FIIs' | 'Renda fixa' | 'Tesouro' | 'Caixa' | 'Exterior'
 * @property {string} currency - e.g. 'BRL' | 'USD'
 * @property {string} [institution]
 * @property {number} purchaseValue
 * @property {number} [fees]
 * @property {number} [quantity]
 * @property {number} amount - purchaseValue + fees
 * @property {number} [monthlyIncome]
 * @property {Quote} [quote] - enriched at runtime
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} ownerId
 * @property {string} date - ISO 'YYYY-MM-DD'
 * @property {'Compra'|'Venda'} type
 * @property {string} asset - ticker symbol
 * @property {string} [category]
 * @property {string} [broker]
 * @property {number} quantity
 * @property {number} unitPrice
 * @property {number} total
 * @property {number} [fees]
 * @property {string} [notes]
 */

/**
 * @typedef {Object} Dividend
 * @property {string} id
 * @property {string} ownerId
 * @property {string} date - ISO 'YYYY-MM-DD'
 * @property {string} asset - ticker symbol
 * @property {string} [category]
 * @property {string} [incomeType]
 * @property {number} amount
 * @property {string} [referenceMonth] - 'YYYY-MM'
 * @property {string} [notes]
 */

/**
 * @typedef {Object} Quote
 * @property {string} symbol
 * @property {number} price
 * @property {string} currency
 * @property {string} updatedAt - ISO timestamp
 * @property {'brapi'|'yahoo'|'unavailable'} source
 */

/**
 * @typedef {Object} ResearchPosition
 * @property {string} id
 * @property {string} ticker
 * @property {string} company
 * @property {number} allocation - percentage as decimal (0–100)
 * @property {number} [dyExpected]
 * @property {number} [currentPrice]
 * @property {number} [ceilingPrice]
 * @property {number} [patrimonialPrice]
 * @property {string} [segment]
 * @property {string} [reportDate]
 */

/**
 * @typedef {Object} AssetSnapshot
 * @property {number} quantity
 * @property {number} purchaseValue
 * @property {number} fees
 */

/**
 * @typedef {Object} MonthlyPrice
 * @property {number} closePrice
 * @property {string} closeDate - ISO 'YYYY-MM-DD'
 * @property {'brapi'|'yahoo'|'manual'} source
 */

/**
 * @typedef {Object} MarketOverviewItem
 * @property {number} value
 * @property {number} changePercent
 * @property {string} currency
 * @property {string} updatedAt - ISO timestamp
 * @property {string} source
 */

/**
 * @typedef {Object} RealizedPnLRow
 * @property {string} id
 * @property {string} ownerId
 * @property {string} date
 * @property {string} asset
 * @property {number} quantity
 * @property {number} purchaseValue
 * @property {number} saleValue
 * @property {number} profitLoss
 */

/**
 * @typedef {Object} MonthlyReportRow
 * @property {string} id
 * @property {string} monthLabel
 * @property {number} purchaseCount
 * @property {number} saleCount
 * @property {number} investedNet
 * @property {number} saleNet
 * @property {number} dividendIncome
 * @property {number} purchaseFees
 * @property {number} saleFees
 * @property {number} realizedProfitLoss
 * @property {number} netCashFlow
 */
