import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getLastTwelveMonthColumns, getPreviousMonthKey } from './provents.js'

describe('getPreviousMonthKey', () => {
  it('retorna mes anterior dentro do mesmo ano', () => {
    assert.equal(getPreviousMonthKey('2024-06'), '2024-05')
  })

  it('retorna dezembro do ano anterior na virada de janeiro', () => {
    assert.equal(getPreviousMonthKey('2024-01'), '2023-12')
  })

  it('retorna string vazia para input invalido', () => {
    assert.equal(getPreviousMonthKey(''), '')
    assert.equal(getPreviousMonthKey(undefined), '')
  })
})

describe('getLastTwelveMonthColumns', () => {
  it('retorna exatamente 12 colunas', () => {
    const referenceDate = new Date(Date.UTC(2024, 5, 15))
    const columns = getLastTwelveMonthColumns(referenceDate)
    assert.equal(columns.length, 12)
  })

  it('ultima coluna corresponde ao mes de referencia', () => {
    const referenceDate = new Date(Date.UTC(2024, 5, 15))
    const columns = getLastTwelveMonthColumns(referenceDate)
    assert.equal(columns[11].key, '2024-06')
  })

  it('primeira coluna e 11 meses antes do mes de referencia', () => {
    const referenceDate = new Date(Date.UTC(2024, 5, 15))
    const columns = getLastTwelveMonthColumns(referenceDate)
    assert.equal(columns[0].key, '2023-07')
  })

  it('colunas atravessam virada de ano corretamente', () => {
    const referenceDate = new Date(Date.UTC(2024, 2, 1))
    const columns = getLastTwelveMonthColumns(referenceDate)
    assert.equal(columns[0].key, '2023-04')
    assert.equal(columns[11].key, '2024-03')
  })

  it('cada coluna tem key e label preenchidos', () => {
    const columns = getLastTwelveMonthColumns(new Date(Date.UTC(2024, 0, 1)))
    for (const column of columns) {
      assert.ok(column.key, 'key nao deve ser vazio')
      assert.ok(column.label, 'label nao deve ser vazio')
    }
  })
})
