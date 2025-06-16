'use client'

import { useState, useEffect } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react'

interface Transaction {
  signature: string
  type: 'buy' | 'sell'
  user: string
  tokenAmount: number
  solAmount: number
  timestamp: number
  price: number
}

interface TransactionHistoryProps {
  tokenMint?: string
  className?: string
}

export default function TransactionHistory({ tokenMint, className = '' }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com')

  const fetchTransactions = async (pageNum: number = 1, reset: boolean = false) => {
    if (!tokenMint) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/transactions?mint=${tokenMint}&page=${pageNum}&limit=20`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      
      if (reset) {
        setTransactions(data.transactions)
      } else {
        setTransactions(prev => [...prev, ...data.transactions])
      }
      
      setHasMore(data.hasMore)
      setPage(pageNum)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const refreshTransactions = () => {
    fetchTransactions(1, true)
  }

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions(page + 1, false)
    }
  }

  useEffect(() => {
    if (tokenMint) {
      fetchTransactions(1, true)
    }
  }, [tokenMint])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  const openTransaction = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, '_blank')
  }

  if (!tokenMint) {
    return (
      <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
        <div className="text-center py-8 text-gray-400">
          Select a token to view transaction history
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
        <button
          onClick={refreshTransactions}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {transactions.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-400">
            No transactions found
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <div
                key={tx.signature}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
                onClick={() => openTransaction(tx.signature)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      tx.type === 'buy' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tx.type === 'buy' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-medium ${
                          tx.type === 'buy' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.type.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm">
                          by {formatAddress(tx.user)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(tx.timestamp * 1000), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-white font-medium">
                      {formatNumber(tx.tokenAmount)} tokens
                    </div>
                    <div className="text-sm text-gray-400">
                      {tx.solAmount.toFixed(4)} SOL
                    </div>
                    <div className="text-xs text-gray-500">
                      @ ${tx.price.toFixed(6)}
                    </div>
                  </div>

                  <ExternalLink className="w-4 h-4 text-gray-400 ml-2" />
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 text-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </>
        )}
      </div>

      {loading && transactions.length === 0 && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                  <div>
                    <div className="w-20 h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="w-32 h-3 bg-gray-700 rounded"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="w-24 h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="w-16 h-3 bg-gray-700 rounded mb-1"></div>
                  <div className="w-20 h-3 bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}