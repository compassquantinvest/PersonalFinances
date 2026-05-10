import { DataTable } from '../components/DataTable'
import { formatSignedCurrency } from '../lib/formatters'
import { getOwnerName } from '../lib/members'

function RealizedPnLTable({ rows, members }) {
  return (
    <DataTable
      title="Historico de Lucros e Perdas"
      rows={rows}
      columns={[
        { key: 'ownerId', label: 'Membro', render: (row) => getOwnerName(row.ownerId, members) },
        { key: 'date', label: 'Data' },
        { key: 'asset', label: 'Ativo' },
        { key: 'quantity', label: 'Quantidade' },
        { key: 'purchaseValue', label: 'Valor compra', render: (row) => Number(row.purchaseValue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        { key: 'saleValue', label: 'Valor venda', render: (row) => Number(row.saleValue ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
        {
          key: 'profitLoss',
          label: 'Lucro/Perda',
          render: (row) => <span className={Number(row.profitLoss) >= 0 ? 'delta positive' : 'delta negative'}>{formatSignedCurrency(row.profitLoss)}</span>,
        },
      ]}
    />
  )
}

export function LucrosPage({ realizedPnLRows, members }) {
  return (
    <section className="entries-layout">
      <RealizedPnLTable rows={realizedPnLRows} members={members} />
    </section>
  )
}
