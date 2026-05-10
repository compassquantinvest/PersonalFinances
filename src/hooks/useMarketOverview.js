import { useEffect, useState } from 'react'
import { quoteRefreshMs } from '../lib/constants'

export function useMarketOverview() {
  const [marketOverview, setMarketOverview] = useState({ status: 'idle', items: {}, updatedAt: '', error: '' })

  useEffect(() => {
    let cancelled = false

    async function loadMarketOverview() {
      try {
        setMarketOverview((current) => ({ ...current, status: current.status === 'ready' ? 'refreshing' : 'loading' }))

        const response = await fetch('/api/market-overview')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          if (cancelled) return
          setMarketOverview((current) => ({
            ...current,
            status: response.status === 503 ? 'unconfigured' : 'error',
            error: payload.error || 'Nao foi possivel carregar o panorama de mercado.',
          }))
          return
        }

        if (cancelled) return
        setMarketOverview({ status: 'ready', items: payload.items || {}, updatedAt: payload.fetchedAt || '', error: '' })
      } catch (error) {
        if (cancelled) return
        setMarketOverview((current) => ({ ...current, status: 'error', error: 'Servidor de mercado indisponivel no momento.' }))
      }
    }

    loadMarketOverview()
    const intervalId = window.setInterval(loadMarketOverview, quoteRefreshMs)

    return () => { cancelled = true; window.clearInterval(intervalId) }
  }, [])

  return marketOverview
}
