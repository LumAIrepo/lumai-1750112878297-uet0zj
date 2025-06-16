'use client'

import { useConnection, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base'
import { 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  SendOptions,
  TransactionSignature,
  Connection,
  Commitment
} from '@solana/web3.js'
import { useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

export interface WalletContextState {
  publicKey: PublicKey | null
  connected: boolean
  connecting: boolean
  disconnecting: boolean
  wallet: any
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ) => Promise<TransactionSignature>
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
}

export interface UseWalletReturn extends WalletContextState {
  balance: number | null
  isLoading: boolean
  error: string | null
  refreshBalance: () => Promise<void>
  sendAndConfirmTransaction: (
    transaction: Transaction | VersionedTransaction,
    options?: {
      commitment?: Commitment
      skipPreflight?: boolean
      maxRetries?: number
    }
  ) => Promise<TransactionSignature>
}

export function useWallet(): UseWalletReturn {
  const { connection } = useConnection()
  const wallet = useSolanaWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshBalance = useCallback(async () => {
    if (!wallet.publicKey) {
      setBalance(null)
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const lamports = await connection.getBalance(wallet.publicKey)
      setBalance(lamports / 1e9) // Convert lamports to SOL
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance'
      setError(errorMessage)
      console.error('Error fetching balance:', err)
    } finally {
      setIsLoading(false)
    }
  }, [wallet.publicKey, connection])

  const connect = useCallback(async () => {
    try {
      setError(null)
      await wallet.connect()
      toast.success('Wallet connected successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }, [wallet])

  const disconnect = useCallback(async () => {
    try {
      setError(null)
      await wallet.disconnect()
      setBalance(null)
      toast.success('Wallet disconnected')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }, [wallet])

  const sendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<TransactionSignature> => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      const signature = await wallet.sendTransaction(transaction, connection, options)
      return signature
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed'
      setError(errorMessage)
      throw err
    }
  }, [wallet])

  const sendAndConfirmTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction,
    options?: {
      commitment?: Commitment
      skipPreflight?: boolean
      maxRetries?: number
    }
  ): Promise<TransactionSignature> => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      setIsLoading(true)

      const signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: options?.skipPreflight ?? false,
        maxRetries: options?.maxRetries ?? 3
      })

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        signature,
        options?.commitment ?? 'confirmed'
      )

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`)
      }

      // Refresh balance after successful transaction
      await refreshBalance()

      return signature
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [wallet, connection, refreshBalance])

  const signTransaction = useCallback(async <T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> => {
    if (!wallet.signTransaction) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      return await wallet.signTransaction(transaction)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transaction'
      setError(errorMessage)
      throw err
    }
  }, [wallet])

  const signAllTransactions = useCallback(async <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> => {
    if (!wallet.signAllTransactions) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      return await wallet.signAllTransactions(transactions)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign transactions'
      setError(errorMessage)
      throw err
    }
  }, [wallet])

  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!wallet.signMessage) {
      throw new WalletNotConnectedError()
    }

    try {
      setError(null)
      return await wallet.signMessage(message)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message'
      setError(errorMessage)
      throw err
    }
  }, [wallet])

  // Auto-refresh balance when wallet connects
  useMemo(() => {
    if (wallet.connected && wallet.publicKey) {
      refreshBalance()
    }
  }, [wallet.connected, wallet.publicKey, refreshBalance])

  return {
    publicKey: wallet.publicKey,
    connected: wallet.connected,
    connecting: wallet.connecting,
    disconnecting: wallet.disconnecting,
    wallet: wallet.wallet,
    connect,
    disconnect,
    sendTransaction,
    signTransaction,
    signAllTransactions,
    signMessage,
    balance,
    isLoading,
    error,
    refreshBalance,
    sendAndConfirmTransaction
  }
}

export default useWallet