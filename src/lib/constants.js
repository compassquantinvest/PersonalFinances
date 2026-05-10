export const navItems = [
  { id: 'home', label: 'Home da familia', short: '01' },
  { id: 'carteiras', label: 'Carteiras recomendadas', short: '02' },
  { id: 'cadastros', label: 'Cadastros', short: '03' },
  { id: 'lancamentos', label: 'Lancamentos', short: '04' },
  { id: 'lucros', label: 'Lucros e perdas', short: '05' },
  { id: 'relatorios', label: 'Relatorios', short: '06' },
]

export const categoryColors = {
  FIIs: '#58d7ff',
  Acoes: '#8ef7d5',
  'Renda fixa': '#ffb454',
  Tesouro: '#7c8bff',
  Caixa: '#ff7e8a',
  Exterior: '#9f88ff',
}

export const quoteableAssetTypes = new Set(['Acoes', 'FIIs'])

export const quoteRefreshMs = 60_000

export const dividendIncomeTypes = [
  'Dividendos',
  'Juros sobre capital proprio (JCP)',
  'Rendimento de FII/FIAGRO/FIP',
  'Fracao de acoes (nao recorrente)',
  'Amortizacao',
  'Restituicao de capital',
  'Premio',
  'Atualizacao monetaria',
  'Outros proventos',
]
