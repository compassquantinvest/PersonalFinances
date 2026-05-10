import { useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './hooks/useToast.jsx'
import {
  defaultAssets,
  defaultDividends,
  defaultMembers,
  defaultResearchPortfolios,
  defaultTransactions,
  researchPortfolioTabs,
} from './data/defaultData'
import { usePersistentState } from './hooks/usePersistentState'
import { useQuotes } from './hooks/useQuotes'
import { useMarketOverview } from './hooks/useMarketOverview'
import {
  collectQuoteTickers,
  enrichAssetsWithQuotes,
  isQuoteableAssetType,
  mergeResearchPortfolios,
  mergeResearchQuotes,
  normalizeTicker,
} from './domain/portfolio'
import { buildMemberIncomePanels, getRequiredPriceMonthKeys } from './domain/provents'
import {
  getAssetTransactionSnapshot,
  getAvailableAssetQuantity,
  getMonthlyReportRows,
  getRealizedProfitLossRows,
} from './domain/transactions'
import { useDataMigrations } from './domain/migrations'
import { quoteableAssetTypes } from './lib/constants'
import { getPageMeta } from './lib/navigation'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { ResearchPage } from './pages/ResearchPage'
import { CadastrosPage } from './pages/CadastrosPage'
import { LancamentosPage } from './pages/LancamentosPage'
import { LucrosPage } from './pages/LucrosPage'
import { ReportsPage } from './pages/ReportsPage'

export default function App() {
  const [activePage, setActivePage] = useState('home')
  const [members, setMembers] = usePersistentState('pf-members', defaultMembers)
  const [assets, setAssets] = usePersistentState('pf-assets', defaultAssets)
  const [selectedMemberId, setSelectedMemberId] = useState(defaultMembers[0]?.id ?? '')
  const [sortBy, setSortBy] = useState('amount')
  const [sortDirection, setSortDirection] = useState('desc')
  const [transactions, setTransactions] = usePersistentState('pf-transactions', defaultTransactions)
  const [dividends, setDividends] = usePersistentState('pf-dividends', defaultDividends)
  const [researchPortfolios, setResearchPortfolios] = usePersistentState('pf-research-portfolios', defaultResearchPortfolios)
  const [activeResearchTab, setActiveResearchTab] = useState(researchPortfolioTabs[0]?.id ?? 'dividendos')
  const [editingMemberId, setEditingMemberId] = useState('')
  const [editingTransactionId, setEditingTransactionId] = useState('')
  const [editingDividendId, setEditingDividendId] = useState('')
  const [incomePriceSnapshot, setIncomePriceSnapshot] = useState({ status: 'idle', prices: {}, updatedAt: '', error: '' })

  const mergedResearchPortfolios = useMemo(() => mergeResearchPortfolios(researchPortfolios, defaultResearchPortfolios), [researchPortfolios])
  const realizedPnLRows = useMemo(() => getRealizedProfitLossRows(transactions, normalizeTicker), [transactions])
  const quoteTickers = useMemo(() => collectQuoteTickers(assets, mergedResearchPortfolios, quoteableAssetTypes, isQuoteableAssetType), [assets, mergedResearchPortfolios])

  const selectedMember = useMemo(() => members.find((member) => member.id === selectedMemberId) ?? members[0] ?? null, [members, selectedMemberId])
  const editingMember = useMemo(() => members.find((member) => member.id === editingMemberId) ?? null, [members, editingMemberId])
  const editingTransaction = useMemo(() => transactions.find((transaction) => transaction.id === editingTransactionId) ?? null, [transactions, editingTransactionId])
  const editingDividend = useMemo(() => dividends.find((dividend) => dividend.id === editingDividendId) ?? null, [dividends, editingDividendId])
  const incomePriceMonthKeys = useMemo(() => getRequiredPriceMonthKeys(buildMemberIncomePanels({ member: null }).columns), [])
  const monthlyReportRows = useMemo(() => getMonthlyReportRows(transactions, dividends, realizedPnLRows, selectedMemberId || ''), [dividends, realizedPnLRows, selectedMemberId, transactions])

  const deleteRule = useMemo(() => {
    if (!selectedMember) return { canDelete: false, reason: 'Selecione um membro para excluir.' }
    const role = (selectedMember.role || '').trim().toLowerCase()
    const hasDependents = members.some((member) => member.id !== selectedMember.id && (member.role || '').trim().toLowerCase() === 'dependente')
    if (role === 'titular' && hasDependents) return { canDelete: false, reason: 'O Titular so pode ser deletado quando nao existirem dependentes cadastrados.' }
    return { canDelete: true, reason: 'Essa acao remove o membro e todos os ativos, compras e dividendos vinculados a ele.' }
  }, [members, selectedMember])

  useDataMigrations({ assets, transactions, setAssets, setTransactions, setDividends })

  useEffect(() => {
    const next = mergeResearchPortfolios(researchPortfolios, defaultResearchPortfolios)
    if (JSON.stringify(next) !== JSON.stringify(researchPortfolios)) setResearchPortfolios(next)
  }, [researchPortfolios, setResearchPortfolios])

  const quoteSnapshot = useQuotes(quoteTickers)
  const marketOverview = useMarketOverview()

  const liveAssets = useMemo(() => enrichAssetsWithQuotes(assets, transactions, quoteSnapshot.quotes, getAssetTransactionSnapshot, normalizeTicker), [assets, transactions, quoteSnapshot.quotes])
  const liveResearchPortfolios = useMemo(() => mergeResearchQuotes(mergedResearchPortfolios, quoteSnapshot.quotes, normalizeTicker), [mergedResearchPortfolios, quoteSnapshot.quotes])
  const incomeTickers = useMemo(
    () => selectedMember
      ? [...new Set(liveAssets.filter((asset) => asset.ownerId === selectedMember.id && ['FIIs', 'Acoes'].includes(asset.type)).map((asset) => normalizeTicker(asset.name)).filter(Boolean))]
      : [],
    [liveAssets, selectedMember],
  )
  const incomePanels = useMemo(
    () => buildMemberIncomePanels({ member: selectedMember, assets: liveAssets, transactions, dividends, monthlyPrices: incomePriceSnapshot.prices, normalizeTicker }),
    [selectedMember, liveAssets, transactions, dividends, incomePriceSnapshot.prices],
  )

  useEffect(() => {
    if (!selectedMember || !incomeTickers.length || !incomePriceMonthKeys.length) {
      setIncomePriceSnapshot({ status: 'idle', prices: {}, updatedAt: '', error: '' })
      return undefined
    }

    let cancelled = false
    const controller = new AbortController()

    async function loadIncomePrices() {
      try {
        setIncomePriceSnapshot((current) => ({ ...current, status: current.status === 'ready' ? 'refreshing' : 'loading', error: '' }))

        const response = await fetch(`/api/monthly-prices?symbols=${incomeTickers.join(',')}&months=${incomePriceMonthKeys.join(',')}`, { signal: controller.signal })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (cancelled) return
          setIncomePriceSnapshot({ status: 'error', prices: {}, updatedAt: payload.fetchedAt || '', error: payload.error || 'Nao foi possivel carregar os precos mensais dos proventos.' })
          return
        }

        if (cancelled) return
        setIncomePriceSnapshot({ status: 'ready', prices: payload.prices || {}, updatedAt: payload.fetchedAt || '', error: '' })
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return
        setIncomePriceSnapshot({ status: 'error', prices: {}, updatedAt: '', error: 'Servidor de precos mensais indisponivel no momento.' })
      }
    }

    loadIncomePrices()
    return () => { cancelled = true; controller.abort() }
  }, [selectedMember, incomeTickers, incomePriceMonthKeys])

  const pageMeta = getPageMeta(activePage, selectedMember, activeResearchTab)

  function addMember(entry) {
    setMembers((current) => {
      const hasExisting = current.some((member) => member.id === entry.id)
      return hasExisting ? current.map((member) => (member.id === entry.id ? entry : member)) : [...current, entry]
    })
    if (!selectedMemberId) setSelectedMemberId(entry.id)
    setEditingMemberId('')
  }

  function addTransaction(entry) {
    const normalizedAssetName = entry.asset.trim().toUpperCase()
    const nextEntry = { ...entry, asset: normalizedAssetName }
    const availableQuantity = getAvailableAssetQuantity(transactions, entry.ownerId, normalizedAssetName, normalizeTicker, editingTransactionId || '')

    if (entry.type === 'Venda' && Number(entry.quantity || 0) > availableQuantity) {
      window.alert(`Quantidade insuficiente para venda. Disponivel: ${availableQuantity}.`)
      return false
    }

    setTransactions((current) => {
      const hasExisting = current.some((transaction) => transaction.id === entry.id)
      return hasExisting ? current.map((transaction) => (transaction.id === entry.id ? nextEntry : transaction)) : [nextEntry, ...current]
    })
    setEditingTransactionId('')

    setAssets((current) => {
      const existingAssetIndex = current.findIndex((asset) => asset.ownerId === entry.ownerId && asset.name.toLowerCase() == normalizedAssetName.toLowerCase())

      if (existingAssetIndex >= 0) {
        const existingAsset = current[existingAssetIndex]
        const nextType = entry.category || existingAsset.type
        const nextInstitution = entry.broker || existingAsset.institution || ''
        if (existingAsset.type === nextType && (existingAsset.institution || '') === nextInstitution) return current
        return current.map((asset, index) => index === existingAssetIndex ? { ...asset, type: nextType, institution: nextInstitution } : asset)
      }

      if (entry.type === 'Venda') return current

      const purchaseValue = Number(entry.quantity || 0) * Number(entry.unitPrice || 0)
      const fees = Number(entry.fees || 0)
      return [{ id: crypto.randomUUID(), ownerId: entry.ownerId, name: normalizedAssetName, currency: 'BRL', type: entry.category || 'Acoes', institution: entry.broker || '', purchaseValue, fees, quantity: entry.quantity, amount: purchaseValue + fees, monthlyIncome: 0 }, ...current]
    })

    return true
  }

  function addDividend(entry) {
    setDividends((current) => {
      const hasExisting = current.some((dividend) => dividend.id === entry.id)
      return hasExisting ? current.map((dividend) => (dividend.id === entry.id ? entry : dividend)) : [entry, ...current]
    })
    setEditingDividendId('')
    return true
  }

  function deleteTransaction(transactionId) {
    const transaction = transactions.find((entry) => entry.id === transactionId)
    if (!transaction) return
    if (!window.confirm(`Tem certeza que deseja excluir o lancamento de ${transaction.asset}?`)) return
    setTransactions((current) => current.filter((entry) => entry.id !== transactionId))
    if (editingTransactionId === transactionId) setEditingTransactionId('')
  }

  function deleteDividend(dividendId) {
    const dividend = dividends.find((entry) => entry.id === dividendId)
    if (!dividend) return
    if (!window.confirm(`Tem certeza que deseja excluir o dividendo de ${dividend.asset}?`)) return
    setDividends((current) => current.filter((entry) => entry.id !== dividendId))
    if (editingDividendId === dividendId) setEditingDividendId('')
  }

  function deleteSelectedMember() {
    if (!selectedMember || !deleteRule.canDelete) return
    if (!window.confirm(`Tem certeza que deseja deletar ${selectedMember.name}? Essa acao remove todos os dados vinculados.`)) return
    const removedId = selectedMember.id
    const nextMembers = members.filter((member) => member.id !== removedId)
    setMembers(nextMembers)
    setAssets((current) => current.filter((asset) => asset.ownerId !== removedId))
    setTransactions((current) => current.filter((entry) => entry.ownerId !== removedId))
    setDividends((current) => current.filter((entry) => entry.ownerId !== removedId))
    setSelectedMemberId(nextMembers[0]?.id ?? '')
  }

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar activePage={activePage} setActivePage={setActivePage} members={members} selectedMemberId={selectedMember?.id ?? ''} onSelectMember={setSelectedMemberId} />

        <main className="content">
          <Header meta={pageMeta} />

          {activePage === 'home' && (
            <ErrorBoundary>
              <HomePage member={selectedMember} assets={liveAssets} sortBy={sortBy} sortDirection={sortDirection} setSortBy={setSortBy} setSortDirection={setSortDirection} marketOverview={marketOverview} incomePanels={incomePanels} incomePriceSnapshot={incomePriceSnapshot} />
            </ErrorBoundary>
          )}

          {activePage === 'carteiras' && (
            <ErrorBoundary>
              <ResearchPage activeTab={activeResearchTab} setActiveTab={setActiveResearchTab} researchPortfolios={liveResearchPortfolios} member={selectedMember} assets={liveAssets} />
            </ErrorBoundary>
          )}

          {activePage === 'cadastros' && (
            <ErrorBoundary>
              <CadastrosPage
                members={members}
                assets={liveAssets}
                selectedMemberId={selectedMember?.id ?? ''}
                onChangeDeleteMember={setSelectedMemberId}
                selectedMember={selectedMember}
                canDeleteMember={deleteRule.canDelete}
                deleteReason={deleteRule.reason}
                onAddMember={addMember}
                onEditMember={setEditingMemberId}
                editingMember={editingMember}
                onCancelEditMember={() => setEditingMemberId('')}
                onDeleteMember={deleteSelectedMember}
              />
            </ErrorBoundary>
          )}

          {activePage === 'lancamentos' && (
            <ErrorBoundary>
              <LancamentosPage
                transactions={transactions}
                dividends={dividends}
                onAddTransaction={addTransaction}
                onAddDividend={addDividend}
                realizedPnLRows={realizedPnLRows}
                onEditTransaction={setEditingTransactionId}
                onDeleteTransaction={deleteTransaction}
                onEditDividend={setEditingDividendId}
                onDeleteDividend={deleteDividend}
                editingTransaction={editingTransaction}
                editingDividend={editingDividend}
                onCancelEditTransaction={() => setEditingTransactionId('')}
                onCancelEditDividend={() => setEditingDividendId('')}
                members={members}
                assets={liveAssets}
                selectedMemberId={selectedMember?.id ?? ''}
                selectedMember={selectedMember}
              />
            </ErrorBoundary>
          )}

          {activePage === 'lucros' && (
            <ErrorBoundary>
              <LucrosPage realizedPnLRows={realizedPnLRows} members={members} />
            </ErrorBoundary>
          )}

          {activePage === 'relatorios' && (
            <ErrorBoundary>
              <ReportsPage monthlyReportRows={monthlyReportRows} selectedMember={selectedMember} assets={liveAssets} transactions={transactions} dividends={dividends} />
            </ErrorBoundary>
          )}
        </main>
      </div>
    </ToastProvider>
  )
}
