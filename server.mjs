import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(fileName = '.env.server') {
  const envPath = resolve(process.cwd(), fileName)
  if (!existsSync(envPath)) return

  readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) return
    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  })
}

loadEnvFile()

// Configuração via variáveis de ambiente
const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '0.0.0.0'
const brapiToken = process.env.BRAPI_TOKEN || ''
const hgBrasilKey = process.env.HG_BRASIL_KEY || ''
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173'
const cacheTtlMs = Number(process.env.QUOTE_CACHE_TTL_MS || 60_000)

// Inicializa módulos com a configuração
import { setAllowedOrigin, json, normalizeSymbols, readJsonBody } from './server/utils.mjs'
import { database, dbPath, getResourceMetadata } from './server/db.mjs'
import { runMigrations } from './server/db/migrations.mjs'
import { loadMembers, saveMembers } from './server/resources/members.mjs'
import { loadAssets, saveAssets, reconcileAssetsTable } from './server/resources/assets.mjs'
import { loadTransactions, saveTransactions } from './server/resources/transactions.mjs'
import { loadDividends, saveDividends } from './server/resources/dividends.mjs'
import { loadResearchPortfolios, saveResearchPortfolios } from './server/resources/researchPortfolios.mjs'
import { ensureMonthlyPrices } from './server/resources/monthlyPrices.mjs'
import { setBrapiToken, getQuotes } from './server/quotes/brapi.mjs'
import { setCacheTtl } from './server/quotes/cache.mjs'
import { getMarketOverview, setMarketOverviewTokens } from './server/marketOverview.mjs'
import { getIncomeMatrixForOwner } from './server/incomeMatrix.mjs'
import { ensureHistoricalTransactionSeeds } from './server/seedTransactions.mjs'
import { createRateLimiter } from './server/middleware/rateLimit.mjs'

setAllowedOrigin(allowedOrigin)
setBrapiToken(brapiToken)
setCacheTtl(cacheTtlMs)
setMarketOverviewTokens({ brapiToken, hgBrasilKey })
runMigrations(database)
reconcileAssetsTable()
ensureHistoricalTransactionSeeds()

const dataRateLimiter = createRateLimiter({ windowMs: 60_000, max: 120 })
const quotesRateLimiter = createRateLimiter({ windowMs: 60_000, max: 10 })

const persistenceResources = {
  members: { load: loadMembers, save: (data) => { saveMembers(data); ensureHistoricalTransactionSeeds(loadMembers()); reconcileAssetsTable() } },
  assets: { load: loadAssets, save: saveAssets },
  transactions: { load: loadTransactions, save: (data) => { saveTransactions(data); reconcileAssetsTable() } },
  dividends: { load: loadDividends, save: saveDividends },
  'research-portfolios': { load: loadResearchPortfolios, save: saveResearchPortfolios },
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`)
  const clientIp = request.socket.remoteAddress || 'unknown'
  const startTime = Date.now()

  response.on('finish', () => {
    console.log(`${request.method} ${requestUrl.pathname} ${response.statusCode} ${Date.now() - startTime}ms`)
  })

  // CORS preflight
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Content-Length': '0',
    })
    response.end()
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    json(response, 200, { ok: true, tokenConfigured: Boolean(brapiToken), hgBrasilConfigured: Boolean(hgBrasilKey), sqlitePath: dbPath })
    return
  }

  if (requestUrl.pathname.startsWith('/api/data/')) {
    if (!dataRateLimiter(clientIp)) {
      json(response, 429, { error: 'Muitas requisições. Aguarde um momento.' })
      return
    }

    const resource = requestUrl.pathname.replace('/api/data/', '')
    const handlers = persistenceResources[resource]

    if (!handlers) {
      json(response, 404, { error: 'Recurso nao encontrado.' })
      return
    }

    if (request.method === 'GET') {
      const metadata = getResourceMetadata(resource)
      json(response, 200, { data: handlers.load(), initialized: Boolean(metadata), updatedAt: metadata?.updated_at || '', source: 'sqlite' })
      return
    }

    if (request.method === 'PUT') {
      try {
        const payload = await readJsonBody(request)

        if (!payload || (typeof payload.data !== 'object' && payload.data !== null)) {
          json(response, 400, { error: 'Corpo da requisição inválido.' })
          return
        }

        if (Array.isArray(payload.data) && payload.data.length > 50_000) {
          json(response, 400, { error: 'Limite de registros excedido (máximo: 50.000).' })
          return
        }

        handlers.save(payload.data)
        const metadata = getResourceMetadata(resource)
        json(response, 200, { ok: true, initialized: true, updatedAt: metadata?.updated_at || new Date().toISOString(), source: 'sqlite' })
      } catch (error) {
        json(response, 400, { error: error.message || 'Falha ao salvar recurso.' })
      }
      return
    }
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/monthly-prices') {
    const symbols = normalizeSymbols(requestUrl.searchParams.get('symbols'))
    const months = [...new Set(String(requestUrl.searchParams.get('months') || '').split(',').map((v) => v.trim()).filter(Boolean))]

    if (!symbols.length || !months.length) {
      json(response, 400, { error: 'Informe symbols e months.' })
      return
    }

    try {
      const prices = await ensureMonthlyPrices(symbols, months)
      json(response, 200, { prices, fetchedAt: new Date().toISOString(), source: 'sqlite+yahoo' })
    } catch (error) {
      json(response, 502, { error: error.message || 'Falha ao carregar precos mensais.', prices: {}, fetchedAt: new Date().toISOString() })
    }
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/portfolio-income-matrix') {
    const ownerId = String(requestUrl.searchParams.get('ownerId') || '').trim()

    if (!ownerId) {
      json(response, 400, { error: 'Informe ownerId.' })
      return
    }

    try {
      const matrix = await getIncomeMatrixForOwner(ownerId)
      json(response, 200, { ...matrix, fetchedAt: new Date().toISOString(), source: 'sqlite+yahoo' })
    } catch (error) {
      json(response, 502, { error: error.message || 'Falha ao carregar matriz de proventos.', columns: [], fiisRows: [], acoesRows: [], fetchedAt: new Date().toISOString() })
    }
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/market-overview') {
    if (!quotesRateLimiter(clientIp)) {
      json(response, 429, { error: 'Muitas requisições. Aguarde um momento.' })
      return
    }

    try {
      const overview = await getMarketOverview()
      json(response, 200, { items: overview.items, error: overview.error, fetchedAt: new Date().toISOString(), source: 'mixed' })
    } catch (error) {
      const statusCode = error.code === 'TOKEN_MISSING' ? 503 : 502
      json(response, statusCode, { error: error.message, items: {}, fetchedAt: new Date().toISOString(), source: 'brapi' })
    }
    return
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/quotes') {
    if (!quotesRateLimiter(clientIp)) {
      json(response, 429, { error: 'Muitas requisições. Aguarde um momento.' })
      return
    }

    const symbols = normalizeSymbols(requestUrl.searchParams.get('symbols'))

    if (!symbols.length) {
      json(response, 400, { error: 'Informe pelo menos um ticker em ?symbols=' })
      return
    }

    try {
      const quotes = await getQuotes(symbols)
      json(response, 200, { quotes, fetchedAt: new Date().toISOString(), source: 'brapi' })
    } catch (error) {
      const statusCode = error.code === 'TOKEN_MISSING' ? 503 : 502
      json(response, statusCode, { error: error.message, quotes: {}, fetchedAt: new Date().toISOString(), source: 'brapi' })
    }
    return
  }

  json(response, 404, { error: 'Rota nao encontrada.' })
})

server.listen(port, host, () => {
  console.log(`Quote server running on http://${host}:${port}`)
  console.log(`SQLite database ready at ${dbPath}`)
})
