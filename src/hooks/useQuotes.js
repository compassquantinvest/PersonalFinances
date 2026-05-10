import { useEffect, useState } from 'react'
import { quoteRefreshMs } from '../lib/constants'

export function useQuotes(quoteTickers) {
  const [quoteSnapshot, setQuoteSnapshot] = useState({ status: 'idle', quotes: {}, updatedAt: '', error: '' })

  useEffect(() => {
    if (!quoteTickers.length) return undefined

    let cancelled = false
    let activeController = null

    async function loadQuotes() {
      activeController?.abort()
      activeController = new AbortController()

      try {
        setQuoteSnapshot((current) => ({ ...current, status: current.status === 'ready' ? 'refreshing' : 'loading' }))

        const response = await fetch(`/api/quotes?symbols=${quoteTickers.join(',')}`, { signal: activeController.signal })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (cancelled) return
          setQuoteSnapshot((current) => ({
            ...current,
            status: response.status === 503 ? 'unconfigured' : 'error',
            error: payload.error || 'Nao foi possivel atualizar as cotacoes.',
          }))
          return
        }

        if (cancelled) return
        setQuoteSnapshot({ status: 'ready', quotes: payload.quotes || {}, updatedAt: payload.fetchedAt || '', error: '' })
      } catch (error) {
        if (cancelled || error.name === 'AbortError') return
        setQuoteSnapshot((current) => ({ ...current, status: 'error', error: 'Servidor de cotacoes indisponivel no momento.' }))
      }
    }

    loadQuotes()
    const intervalId = window.setInterval(loadQuotes, quoteRefreshMs)

    return () => {
      cancelled = true
      activeController?.abort()
      window.clearInterval(intervalId)
    }
  }, [quoteTickers])

  return quoteSnapshot
}
