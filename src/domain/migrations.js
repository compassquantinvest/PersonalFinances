import { useEffect } from 'react'
import { normalizeTicker, buildSeedAsset } from './portfolio'
import { getAssetTransactionSnapshot } from './transactions'

export function useDataMigrations({ assets, transactions, setAssets, setTransactions, setDividends }) {
  useEffect(() => {
    setAssets((current) => {
      let changed = false
      const next = current.map((asset) => {
        const currentTicker = String(asset.name || '').trim().toUpperCase()
        if (!['ELET6', 'IRDM11'].includes(currentTicker)) return asset
        changed = true
        return { ...asset, name: currentTicker === 'ELET6' ? 'AXIA6' : 'IRIM11' }
      })
      return changed ? next : current
    })

    setTransactions((current) => {
      let changed = false
      const next = current.map((transaction) => {
        const currentTicker = String(transaction.asset || '').trim().toUpperCase()
        if (!['ELET6', 'IRDM11'].includes(currentTicker)) return transaction
        changed = true
        return { ...transaction, asset: currentTicker === 'ELET6' ? 'AXIA6' : 'IRIM11' }
      })
      return changed ? next : current
    })

    setDividends((current) => {
      let changed = false
      const next = current.map((dividend) => {
        const currentTicker = String(dividend.asset || '').trim().toUpperCase()
        if (!['ELET6', 'IRDM11'].includes(currentTicker)) return dividend
        changed = true
        return { ...dividend, asset: currentTicker === 'ELET6' ? 'AXIA6' : 'IRIM11' }
      })
      return changed ? next : current
    })
  }, [setAssets, setDividends, setTransactions])

  useEffect(() => {
    setTransactions((current) => {
      let changed = false
      const next = current.map((transaction) => {
        if (
          transaction.id === 'seed-iuri-20230921-petr4' &&
          transaction.date === '2023-09-21' &&
          normalizeTicker(transaction.asset) === 'PETR4' &&
          Number(transaction.quantity || 0) === 49 &&
          Number(transaction.unitPrice || 0) === 33.95 &&
          (transaction.type || 'Compra') !== 'Venda'
        ) {
          changed = true
          return { ...transaction, type: 'Venda', notes: 'Importado da nota de corretagem CLEAR de venda em 21/09/2023.' }
        }
        return transaction
      })
      return changed ? next : current
    })
  }, [setTransactions])

  useEffect(() => {
    setAssets((current) => {
      const next = current.filter((asset) => normalizeTicker(asset.name) !== 'TESOURO SELIC 2029')
      return next.length === current.length ? current : next
    })

    setTransactions((current) => {
      const next = current.filter((transaction) => normalizeTicker(transaction.asset) !== 'TESOURO SELIC 2029')
      return next.length === current.length ? current : next
    })

    setDividends((current) => {
      const next = current.filter((dividend) => normalizeTicker(dividend.asset) !== 'TESOURO SELIC 2029')
      return next.length === current.length ? current : next
    })
  }, [setAssets, setDividends, setTransactions])

  useEffect(() => {
    setAssets((current) => {
      const next = current.filter((asset) => {
        const isFakeHglg =
          normalizeTicker(asset.name) === 'HGLG11' &&
          (asset.institution || '') === 'XP' &&
          Number(asset.purchaseValue || 0) === 28500 &&
          Number(asset.monthlyIncome || 0) === 185
        return !isFakeHglg
      })
      return next.length === current.length ? current : next
    })

    setTransactions((current) => {
      const next = current.filter((transaction) => {
        const isFakeHglgTransaction =
          normalizeTicker(transaction.asset) === 'HGLG11' &&
          transaction.date === '2026-03-05' &&
          Number(transaction.quantity || 0) === 20 &&
          Number(transaction.unitPrice || 0) === 164.52 &&
          (transaction.broker || '') === 'XP'
        return !isFakeHglgTransaction
      })
      return next.length === current.length ? current : next
    })
  }, [setAssets, setTransactions])

  useEffect(() => {
    setAssets((current) => {
      const grouped = transactions.reduce((accumulator, transaction) => {
        const ownerId = transaction.ownerId || ''
        const ticker = normalizeTicker(transaction.asset)
        if (!ownerId || !ticker) return accumulator
        const key = `${ownerId}::${ticker}`
        accumulator[key] = accumulator[key] || []
        accumulator[key].push(transaction)
        return accumulator
      }, {})
      let changed = false
      const nextAssets = current.map((asset) => {
        const key = `${asset.ownerId || ''}::${normalizeTicker(asset.name)}`
        const transactionsGroup = grouped[key]
        if (!transactionsGroup?.length) return asset

        const sortedGroup = [...transactionsGroup].sort((left, right) => {
          if (left.date !== right.date) return String(left.date || '').localeCompare(String(right.date || ''))
          return String(left.id || '').localeCompare(String(right.id || ''))
        })
        const latestTransaction = sortedGroup[sortedGroup.length - 1]
        const assetSnapshot = buildSeedAsset(asset.ownerId, sortedGroup)
        const snapshot = getAssetTransactionSnapshot(assetSnapshot, transactions, normalizeTicker)

        if (!snapshot || Number(snapshot.quantity || 0) <= 0) return asset

        const nextType = latestTransaction?.category || asset.type
        const nextInstitution = latestTransaction?.broker || asset.institution || ''
        const nextPurchaseValue = snapshot.purchaseValue
        const nextFees = snapshot.fees
        const nextAmount = snapshot.purchaseValue + snapshot.fees

        if (
          asset.type === nextType &&
          (asset.institution || '') === nextInstitution &&
          Number(asset.quantity || 0) === Number(snapshot.quantity || 0) &&
          Number(asset.purchaseValue || 0) === Number(nextPurchaseValue || 0) &&
          Number(asset.fees || 0) === Number(nextFees || 0) &&
          Number(asset.amount || 0) === Number(nextAmount || 0)
        ) {
          return asset
        }

        changed = true
        return { ...asset, type: nextType, institution: nextInstitution, quantity: snapshot.quantity, purchaseValue: nextPurchaseValue, fees: nextFees, amount: nextAmount }
      })

      const missingAssets = Object.values(grouped).flatMap((transactionsGroup) => {
        const sample = transactionsGroup[0]
        const alreadyExists = nextAssets.some(
          (asset) => asset.ownerId === sample.ownerId && normalizeTicker(asset.name) === normalizeTicker(sample.asset),
        )
        if (alreadyExists) return []

        const asset = buildSeedAsset(sample.ownerId, transactionsGroup)
        const snapshot = getAssetTransactionSnapshot(asset, transactions, normalizeTicker)
        if (!snapshot || Number(snapshot.quantity || 0) <= 0) return []

        changed = true
        return [{
          ...asset,
          type: sample.category || asset.type,
          institution: sample.broker || asset.institution || '',
          quantity: snapshot.quantity,
          purchaseValue: snapshot.purchaseValue,
          fees: snapshot.fees,
          amount: snapshot.purchaseValue + snapshot.fees,
        }]
      })

      if (!changed && !missingAssets.length) return current
      return [...missingAssets, ...nextAssets]
    })
  }, [assets, transactions, setAssets])
}
