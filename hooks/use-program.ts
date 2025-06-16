```typescript
'use client'

import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Program, AnchorProvider, Idl, setProvider } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { PumpClone } from '../types/pump_clone'
import idl from '../idl/pump_clone.json'

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || 'PumpCLoneProgram11111111111111111111111111')

export function useProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null
    }

    const anchorProvider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      },
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
      }
    )

    setProvider(anchorProvider)
    return anchorProvider
  }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions])

  const program = useMemo(() => {
    if (!provider) return null

    try {
      return new Program<PumpClone>(
        idl as Idl,
        PROGRAM_ID,
        provider
      )
    } catch (error) {
      console.error('Failed to initialize program:', error)
      return null
    }
  }, [provider])

  const isConnected = useMemo(() => {
    return !!(wallet.connected && wallet.publicKey && program)
  }, [wallet.connected, wallet.publicKey, program])

  return {
    program,
    provider,
    programId: PROGRAM_ID,
    isConnected,
    wallet,
    connection,
  }
}

export type UseProgramReturn = ReturnType<typeof useProgram>
```