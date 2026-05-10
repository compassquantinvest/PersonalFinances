import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getAssetTransactionSnapshot, getAvailableAssetQuantity, getRealizedProfitLossRows } from './transactions.js'

const normalize = (v) => String(v || '').trim().toUpperCase()

describe('getAssetTransactionSnapshot', () => {
  it('calcula snapshot corretamente com duas compras e uma venda parcial', () => {
    const asset = { name: 'PETR4', ownerId: 'u1' }
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'PETR4', date: '2024-01-10', type: 'Compra', quantity: 100, unitPrice: 30, total: 3000, fees: 10 },
      { id: 't2', ownerId: 'u1', asset: 'PETR4', date: '2024-02-10', type: 'Compra', quantity: 50, unitPrice: 32, total: 1600, fees: 5 },
      { id: 't3', ownerId: 'u1', asset: 'PETR4', date: '2024-03-10', type: 'Venda', quantity: 80, unitPrice: 35, total: 2800, fees: 8 },
    ]

    const result = getAssetTransactionSnapshot(asset, transactions, normalize)

    assert.equal(result.quantity, 70)
    assert.ok(result.purchaseValue > 0, 'purchaseValue deve ser positivo')
    assert.ok(result.fees >= 0)
  })

  it('retorna quantity=0 e purchaseValue=0 apos venda total', () => {
    const asset = { name: 'HGLG11', ownerId: 'u1' }
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'HGLG11', date: '2024-01-10', type: 'Compra', quantity: 10, unitPrice: 150, total: 1500, fees: 5 },
      { id: 't2', ownerId: 'u1', asset: 'HGLG11', date: '2024-02-10', type: 'Venda', quantity: 10, unitPrice: 160, total: 1600, fees: 5 },
    ]

    const result = getAssetTransactionSnapshot(asset, transactions, normalize)

    assert.equal(result.quantity, 0)
    assert.equal(result.purchaseValue, 0)
  })

  it('nao afeta ativos de outros membros', () => {
    const asset = { name: 'ITUB4', ownerId: 'u1' }
    const transactions = [
      { id: 't1', ownerId: 'u2', asset: 'ITUB4', date: '2024-01-10', type: 'Compra', quantity: 50, unitPrice: 25, total: 1250, fees: 3 },
    ]

    const result = getAssetTransactionSnapshot(asset, transactions, normalize)
    assert.equal(result.quantity, 0)
  })
})

describe('getAvailableAssetQuantity', () => {
  it('calcula saldo disponivel corretamente com compra e venda parcial', () => {
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'PETR4', date: '2024-01-01', type: 'Compra', quantity: 100 },
      { id: 't2', ownerId: 'u1', asset: 'PETR4', date: '2024-01-10', type: 'Venda', quantity: 30 },
    ]

    const qty = getAvailableAssetQuantity(transactions, 'u1', 'PETR4', normalize)
    assert.equal(qty, 70)
  })

  it('exclui transacao sendo editada do calculo', () => {
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'PETR4', date: '2024-01-01', type: 'Compra', quantity: 100 },
      { id: 't2', ownerId: 'u1', asset: 'PETR4', date: '2024-01-10', type: 'Venda', quantity: 40 },
    ]

    const qty = getAvailableAssetQuantity(transactions, 'u1', 'PETR4', normalize, 't2')
    assert.equal(qty, 100)
  })
})

describe('getRealizedProfitLossRows', () => {
  it('gera linha de lucro corretamente em venda acima do custo medio', () => {
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'VALE3', date: '2024-01-01', type: 'Compra', quantity: 10, unitPrice: 80, total: 800, fees: 0 },
      { id: 't2', ownerId: 'u1', asset: 'VALE3', date: '2024-02-01', type: 'Venda', quantity: 10, unitPrice: 100, total: 1000, fees: 0 },
    ]

    const rows = getRealizedProfitLossRows(transactions, normalize)
    assert.equal(rows.length, 1)
    assert.ok(rows[0].profitLoss > 0, 'deve ser lucro')
    assert.equal(rows[0].quantity, 10)
    assert.equal(rows[0].asset, 'VALE3')
  })

  it('nao gera linha de P&L para compras sem vendas', () => {
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'VALE3', date: '2024-01-01', type: 'Compra', quantity: 10, unitPrice: 80, total: 800, fees: 0 },
    ]

    const rows = getRealizedProfitLossRows(transactions, normalize)
    assert.equal(rows.length, 0)
  })

  it('acumula custo medio entre multiplas compras antes de calcular P&L', () => {
    const transactions = [
      { id: 't1', ownerId: 'u1', asset: 'WEGE3', date: '2024-01-01', type: 'Compra', quantity: 10, unitPrice: 40, total: 400, fees: 0 },
      { id: 't2', ownerId: 'u1', asset: 'WEGE3', date: '2024-01-15', type: 'Compra', quantity: 10, unitPrice: 60, total: 600, fees: 0 },
      { id: 't3', ownerId: 'u1', asset: 'WEGE3', date: '2024-02-01', type: 'Venda', quantity: 10, unitPrice: 55, total: 550, fees: 0 },
    ]

    const rows = getRealizedProfitLossRows(transactions, normalize)
    assert.equal(rows.length, 1)
    assert.ok(Math.abs(rows[0].purchaseValue - 500) < 0.01, 'custo medio deve ser 50 * 10 = 500')
  })
})
