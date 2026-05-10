import { useEffect, useRef, useState } from 'react'

const serverResourceMap = {
  'pf-members': '/api/data/members',
  'pf-assets': '/api/data/assets',
  'pf-transactions': '/api/data/transactions',
  'pf-dividends': '/api/data/dividends',
  'pf-research-portfolios': '/api/data/research-portfolios',
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value))
}

function isCompatibleSnapshot(candidate, initialValue) {
  if (Array.isArray(initialValue)) {
    return Array.isArray(candidate)
  }

  if (initialValue && typeof initialValue === 'object') {
    return Boolean(candidate) && !Array.isArray(candidate) && typeof candidate === 'object'
  }

  return typeof candidate === typeof initialValue
}

function readLocalSnapshot(key, initialValue) {
  const stored = localStorage.getItem(key)

  if (!stored) {
    return { hasStored: false, value: cloneValue(initialValue) }
  }

  try {
    const parsed = JSON.parse(stored)

    if (!isCompatibleSnapshot(parsed, initialValue)) {
      return { hasStored: false, value: cloneValue(initialValue) }
    }

    return { hasStored: true, value: parsed }
  } catch {
    return { hasStored: false, value: cloneValue(initialValue) }
  }
}

async function readRemoteState(endpoint) {
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(`Falha ao carregar estado remoto (${response.status}).`)
  }

  return response.json()
}

async function writeRemoteState(endpoint, data) {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!response.ok) {
    throw new Error(`Falha ao salvar estado remoto (${response.status}).`)
  }

  return response.json()
}

export function usePersistentState(key, initialValue) {
  const endpoint = serverResourceMap[key] || ''
  const initialSnapshot = readLocalSnapshot(key, initialValue)
  const [state, setState] = useState(initialSnapshot.value)
  const [remoteReady, setRemoteReady] = useState(!endpoint)
  const lastRemoteSnapshot = useRef(JSON.stringify(initialSnapshot.value))

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  useEffect(() => {
    if (!endpoint) {
      return undefined
    }

    let cancelled = false

    ;(async () => {
      try {
        const payload = await readRemoteState(endpoint)

        if (cancelled) {
          return
        }

        const localSnapshot = readLocalSnapshot(key, initialValue)
        const nextState = payload.initialized ? payload.data : localSnapshot.value
        lastRemoteSnapshot.current = JSON.stringify(nextState)
        setState(nextState)
        setRemoteReady(true)

        if (!payload.initialized) {
          await writeRemoteState(endpoint, nextState)
        }
      } catch (error) {
        console.error(`Falha ao sincronizar ${key} com SQLite:`, error)
        setRemoteReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [endpoint, initialValue, key])

  useEffect(() => {
    if (!endpoint || !remoteReady) {
      return undefined
    }

    const serialized = JSON.stringify(state)

    if (serialized === lastRemoteSnapshot.current) {
      return undefined
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await writeRemoteState(endpoint, state)
        lastRemoteSnapshot.current = serialized
      } catch (error) {
        console.error(`Falha ao persistir ${key} no SQLite:`, error)
      }
    }, 150)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [endpoint, key, remoteReady, state])

  return [state, setState]
}
