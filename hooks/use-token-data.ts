'use client'

import { useState, useEffect, useCallback } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useConnection } from '@solana/wallet-adapter-react'

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  website?: string
  twitter?: string
  telegram?: string
}

export interface TokenData {
  mint: string
  name: string
  symbol: string
  description: string
  image: string
  website?: string
  twitter?: string
  telegram?: string
  supply: number
  decimals: number
  creator: string
  createdAt: number
  marketCap: number
  price: number
  volume24h: number
  holders: number
  bondingCurveProgress: number
  isGraduated: boolean
  liquidityPool?: string
  replies: number
  king: boolean
}

export interface UseTokenDataReturn {
  tokenData: TokenData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const TOKEN_CACHE = new Map<string, { data: TokenData; timestamp: number }>()
const CACHE_DURATION = 30000 // 30 seconds

export function useTokenData(mintAddress: string | null): UseTokenDataReturn {
  const { connection } = useConnection()
  const [tokenData, setTokenData] = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTokenMetadata = async (mint: PublicKey): Promise<TokenMetadata | null> => {
    try {
      // Try to fetch from Metaplex metadata
      const metadataPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
          mint.toBuffer(),
        ],
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
      )[0]

      const metadataAccount = await connection.getAccountInfo(metadataPDA)
      if (!metadataAccount) return null

      // Parse metadata (simplified - in production you'd use @metaplex-foundation/mpl-token-metadata)
      const metadata = parseMetadata(metadataAccount.data)
      if (!metadata) return null

      // Fetch off-chain metadata if URI exists
      if (metadata.uri) {
        try {
          const response = await fetch(metadata.uri)
          if (response.ok) {
            const offChainMetadata = await response.json()
            return {
              name: offChainMetadata.name || metadata.name || '',
              symbol: offChainMetadata.symbol || metadata.symbol || '',
              description: offChainMetadata.description || '',
              image: offChainMetadata.image || '',
              website: offChainMetadata.external_url,
              twitter: offChainMetadata.twitter,
              telegram: offChainMetadata.telegram,
            }
          }
        } catch (e) {
          console.warn('Failed to fetch off-chain metadata:', e)
        }
      }

      return {
        name: metadata.name || '',
        symbol: metadata.symbol || '',
        description: '',
        image: '',
      }
    } catch (e) {
      console.warn('Failed to fetch token metadata:', e)
      return null
    }
  }

  const fetchTokenSupply = async (mint: PublicKey): Promise<{ supply: number; decimals: number }> => {
    try {
      const mintInfo = await connection.getParsedAccountInfo(mint)
      if (!mintInfo.value?.data || typeof mintInfo.value.data === 'string') {
        throw new Error('Invalid mint account')
      }

      const parsedData = mintInfo.value.data as any
      return {
        supply: parsedData.parsed.info.supply / Math.pow(10, parsedData.parsed.info.decimals),
        decimals: parsedData.parsed.info.decimals,
      }
    } catch (e) {
      console.warn('Failed to fetch token supply:', e)
      return { supply: 0, decimals: 9 }
    }
  }

  const fetchBondingCurveData = async (mint: PublicKey): Promise<{
    creator: string
    createdAt: number
    marketCap: number
    price: number
    volume24h: number
    bondingCurveProgress: number
    isGraduated: boolean
    liquidityPool?: string
  }> => {
    try {
      // In a real implementation, this would fetch from your program's bonding curve account
      // For now, we'll simulate the data
      const bondingCurvePDA = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), mint.toBuffer()],
        new PublicKey('11111111111111111111111111111111') // Replace with your program ID
      )[0]

      const bondingCurveAccount = await connection.getAccountInfo(bondingCurvePDA)
      
      if (bondingCurveAccount) {
        // Parse bonding curve data (this would be your actual account structure)
        const data = parseBondingCurveData(bondingCurveAccount.data)
        return data
      }

      // Fallback data if bonding curve account doesn't exist
      return {
        creator: '11111111111111111111111111111111',
        createdAt: Date.now(),
        marketCap: 0,
        price: 0,
        volume24h: 0,
        bondingCurveProgress: 0,
        isGraduated: false,
      }
    } catch (e) {
      console.warn('Failed to fetch bonding curve data:', e)
      return {
        creator: '11111111111111111111111111111111',
        createdAt: Date.now(),
        marketCap: 0,
        price: 0,
        volume24h: 0,
        bondingCurveProgress: 0,
        isGraduated: false,
      }
    }
  }

  const fetchHolderCount = async (mint: PublicKey): Promise<number> => {
    try {
      const tokenAccounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
        filters: [
          { dataSize: 165 },
          { memcmp: { offset: 0, bytes: mint.toBase58() } },
        ],
      })

      return tokenAccounts.filter(account => {
        const parsedData = account.account.data as any
        return parsedData.parsed?.info?.tokenAmount?.uiAmount > 0
      }).length
    } catch (e) {
      console.warn('Failed to fetch holder count:', e)
      return 0
    }
  }

  const fetchTokenData = useCallback(async () => {
    if (!mintAddress) {
      setTokenData(null)
      return
    }

    // Check cache first
    const cached = TOKEN_CACHE.get(mintAddress)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setTokenData(cached.data)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const mint = new PublicKey(mintAddress)

      // Fetch all data in parallel
      const [metadata, supplyInfo, bondingCurveData, holders] = await Promise.all([
        fetchTokenMetadata(mint),
        fetchTokenSupply(mint),
        fetchBondingCurveData(mint),
        fetchHolderCount(mint),
      ])

      const tokenData: TokenData = {
        mint: mintAddress,
        name: metadata?.name || 'Unknown Token',
        symbol: metadata?.symbol || 'UNKNOWN',
        description: metadata?.description || '',
        image: metadata?.image || '',
        website: metadata?.website,
        twitter: metadata?.twitter,
        telegram: metadata?.telegram,
        supply: supplyInfo.supply,
        decimals: supplyInfo.decimals,
        creator: bondingCurveData.creator,
        createdAt: bondingCurveData.createdAt,
        marketCap: bondingCurveData.marketCap,
        price: bondingCurveData.price,
        volume24h: bondingCurveData.volume24h,
        holders,
        bondingCurveProgress: bondingCurveData.bondingCurveProgress,
        isGraduated: bondingCurveData.isGraduated,
        liquidityPool: bondingCurveData.liquidityPool,
        replies: Math.floor(Math.random() * 100), // Placeholder
        king: Math.random() > 0.9, // Placeholder
      }

      // Cache the result
      TOKEN_CACHE.set(mintAddress, { data: tokenData, timestamp: Date.now() })
      setTokenData(tokenData)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to fetch token data'
      setError(errorMessage)
      console.error('Error fetching token data:', e)
    } finally {
      setLoading(false)
    }
  }, [mintAddress, connection])

  const refetch = useCallback(async () => {
    if (mintAddress) {
      TOKEN_CACHE.delete(mintAddress)
      await fetchTokenData()
    }
  }, [mintAddress, fetchTokenData])

  useEffect(() => {
    fetchTokenData()
  }, [fetchTokenData])

  return {
    tokenData,
    loading,
    error,
    refetch,
  }
}

// Helper function to parse metadata (simplified)
function parseMetadata(data: Buffer): { name: string; symbol: string; uri: string } | null {
  try {
    // This is a simplified parser - in production use @metaplex-foundation/mpl-token-metadata
    const name = data.slice(65, 97).toString('utf8').replace(/\0/g, '')
    const symbol = data.slice(105, 115).toString('utf8').replace(/\0/g, '')
    const uri = data.slice(117, 317).toString('utf8').replace(/\0/g, '')
    
    return { name, symbol, uri }
  } catch (e) {
    return null
  }
}

// Helper function to parse bonding curve data (placeholder)
function parseBondingCurveData(data: Buffer): {
  creator: string
  createdAt: number
  marketCap: number
  price: number
  volume24h: number
  bondingCurveProgress: number
  isGraduated: boolean
  liquidityPool?: string
} {
  // This would parse your actual bonding curve account structure
  // For now, return mock data
  return {
    creator: '11111111111111111111111111111111',
    createdAt: Date.now() - Math.random() * 86400000 * 30, // Random date within last 30 days
    marketCap: Math.random() * 1000000,
    price: Math.random() * 0.01,
    volume24h: Math.random() * 100000,
    bondingCurveProgress: Math.random() * 100,
    isGraduated: Math.random() > 0.8,
    liquidityPool: Math.random() > 0.8 ? '11111111111111111111111111111111' : undefined,
  }
}