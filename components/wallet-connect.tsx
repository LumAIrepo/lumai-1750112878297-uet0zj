'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { WalletIcon, ChevronDownIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

interface WalletConnectProps {
  className?: string
  showBalance?: boolean
  variant?: 'default' | 'compact' | 'minimal'
}

export default function WalletConnect({ 
  className = '', 
  showBalance = true, 
  variant = 'default' 
}: WalletConnectProps) {
  const { publicKey, wallet, disconnect, connecting, connected, disconnecting } = useWallet()
  const { setVisible } = useWalletModal()
  const [balance, setBalance] = useState<number | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  const connection = new Connection(
    process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'confirmed'
  )

  useEffect(() => {
    if (connected && publicKey && showBalance) {
      fetchBalance()
    } else {
      setBalance(null)
      setBalanceError(null)
    }
  }, [connected, publicKey, showBalance])

  const fetchBalance = async () => {
    if (!publicKey) return
    
    setIsLoadingBalance(true)
    setBalanceError(null)
    
    try {
      const balanceInLamports = await connection.getBalance(publicKey)
      setBalance(balanceInLamports / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      setBalanceError('Failed to load balance')
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const handleConnect = () => {
    setVisible(true)
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setIsDropdownOpen(false)
      setBalance(null)
      setBalanceError(null)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const formatBalance = (balance: number) => {
    if (balance < 0.001) return '< 0.001'
    if (balance < 1) return balance.toFixed(3)
    if (balance < 10) return balance.toFixed(2)
    return balance.toFixed(1)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  if (variant === 'minimal') {
    return (
      <div className={`relative ${className}`}>
        {connected && publicKey ? (
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm font-medium text-white">
              {formatAddress(publicKey.toString())}
            </span>
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        {connected && publicKey ? (
          <div className="flex items-center space-x-2">
            {showBalance && (
              <div className="px-3 py-2 bg-gray-100 rounded-lg">
                <div className="flex items-center space-x-2">
                  {isLoadingBalance ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
                  ) : balanceError ? (
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      {balance !== null ? `${formatBalance(balance)} SOL` : '--'}
                    </span>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
            >
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm font-medium text-gray-900">
                {formatAddress(publicKey.toString())}
              </span>
              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
          >
            <WalletIcon className="w-5 h-5" />
            <span>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {connected && publicKey ? (
        <div className="flex items-center space-x-3">
          {showBalance && (
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Balance
                </span>
                {isLoadingBalance ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
                ) : balanceError ? (
                  <div className="flex items-center space-x-1">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-600">Error</span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-gray-900">
                    {balance !== null ? `${formatBalance(balance)} SOL` : '--'}
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-3 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-600">Connected</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {wallet?.adapter.icon && (
                  <img 
                    src={wallet.adapter.icon} 
                    alt={wallet.adapter.name}
                    className="w-5 h-5 rounded"
                  />
                )}
                <span className="text-sm font-mono text-gray-900">
                  {formatAddress(publicKey.toString())}
                </span>
                <ChevronDownIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </button>

            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      {wallet?.adapter.icon && (
                        <img 
                          src={wallet.adapter.icon} 
                          alt={wallet.adapter.name}
                          className="w-8 h-8 rounded"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {wallet?.adapter.name}
                        </div>
                        <div className="flex items-center space-x-1">
                          <CheckIcon className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600">Connected</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Wallet Address
                      </label>
                      <button
                        onClick={() => copyToClipboard(publicKey.toString())}
                        className="mt-1 w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm font-mono text-gray-900 transition-colors"
                        title="Click to copy"
                      >
                        {publicKey.toString()}
                      </button>
                    </div>

                    {showBalance && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          SOL Balance
                        </label>
                        <div className="mt-1 flex items-center justify-between p-2 bg-gray-50 rounded">
                          {isLoadingBalance ? (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin"></div>
                              <span className="text-sm text-gray-600">Loading...</span>
                            </div>
                          ) : balanceError ? (
                            <div className="flex items-center space-x-2">
                              <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-red-600">{balanceError}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-gray-900">
                              {balance !== null ? `${formatBalance(balance)} SOL` : '--'}
                            </span>
                          )}
                          <button
                            onClick={fetchBalance}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            disabled={isLoadingBalance}
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-gray-100">
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect Wallet'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-400 disabled:to-blue-400 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <WalletIcon className="w-5 h-5" />
          <span>{connecting ? 'Connecting...' : 'Connect Wallet'}</span>
          {connecting && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
        </button>
      )}
    </div>
  )
}