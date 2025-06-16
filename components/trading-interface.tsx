'use client'

import { useState, useEffect, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, TrendingUp, TrendingDown, Zap, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Token {
  address: string
  name: string
  symbol: string
  decimals: number
  supply: number
  marketCap: number
  price: number
  priceChange24h: number
  volume24h: number
  holders: number
  bondingCurveProgress: number
  isGraduated: boolean
  creator: string
  description: string
  image: string
  website?: string
  twitter?: string
  telegram?: string
}

interface TradingInterfaceProps {
  token: Token
  connection: Connection
  onTradeComplete?: () => void
}

interface TradePreview {
  inputAmount: number
  outputAmount: number
  priceImpact: number
  slippage: number
  minimumReceived: number
  fee: number
  newPrice: number
  newMarketCap: number
}

export default function TradingInterface({ token, connection, onTradeComplete }: TradingInterfaceProps) {
  const { publicKey, signTransaction, connected } = useWallet()
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [inputAmount, setInputAmount] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [customSlippage, setCustomSlippage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [solBalance, setSolBalance] = useState(0)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [tradePreview, setTradePreview] = useState<TradePreview | null>(null)

  const slippageOptions = [0.1, 0.5, 1, 3]

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances()
    }
  }, [connected, publicKey, token.address])

  useEffect(() => {
    if (inputAmount && parseFloat(inputAmount) > 0) {
      calculateTradePreview()
    } else {
      setTradePreview(null)
    }
  }, [inputAmount, activeTab, slippage, token])

  const fetchBalances = async () => {
    if (!publicKey) return

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey)
      setSolBalance(solBal / LAMPORTS_PER_SOL)

      // Fetch token balance
      try {
        const tokenMint = new PublicKey(token.address)
        const associatedTokenAddress = await getAssociatedTokenAddress(
          tokenMint,
          publicKey
        )
        
        const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAddress)
        setTokenBalance(parseFloat(tokenAccount.value.amount) / Math.pow(10, token.decimals))
      } catch (error) {
        setTokenBalance(0)
      }
    } catch (error) {
      console.error('Error fetching balances:', error)
    }
  }

  const calculateTradePreview = async () => {
    const amount = parseFloat(inputAmount)
    if (!amount || amount <= 0) return

    try {
      // Simulate bonding curve calculation
      const currentSupply = token.supply
      const currentPrice = token.price
      
      let preview: TradePreview

      if (activeTab === 'buy') {
        // Calculate tokens received for SOL input
        const tokensOut = calculateBuyAmount(amount, currentSupply, currentPrice)
        const priceImpact = calculatePriceImpact(amount, token.volume24h)
        const fee = amount * 0.01 // 1% fee
        const minimumReceived = tokensOut * (1 - slippage / 100)
        const newPrice = currentPrice * (1 + priceImpact / 100)
        const newMarketCap = token.marketCap + (amount * LAMPORTS_PER_SOL)

        preview = {
          inputAmount: amount,
          outputAmount: tokensOut,
          priceImpact,
          slippage,
          minimumReceived,
          fee,
          newPrice,
          newMarketCap
        }
      } else {
        // Calculate SOL received for token input
        const solOut = calculateSellAmount(amount, currentSupply, currentPrice)
        const priceImpact = calculatePriceImpact(solOut, token.volume24h)
        const fee = solOut * 0.01 // 1% fee
        const minimumReceived = solOut * (1 - slippage / 100)
        const newPrice = currentPrice * (1 - priceImpact / 100)
        const newMarketCap = token.marketCap - (solOut * LAMPORTS_PER_SOL)

        preview = {
          inputAmount: amount,
          outputAmount: solOut,
          priceImpact,
          slippage,
          minimumReceived,
          fee,
          newPrice,
          newMarketCap
        }
      }

      setTradePreview(preview)
    } catch (error) {
      console.error('Error calculating trade preview:', error)
    }
  }

  const calculateBuyAmount = (solAmount: number, supply: number, price: number): number => {
    // Simplified bonding curve: y = k * sqrt(x)
    const k = 1000000 // Curve parameter
    const currentX = supply / k
    const newX = currentX + (solAmount / price)
    const newSupply = k * Math.sqrt(newX)
    return newSupply - supply
  }

  const calculateSellAmount = (tokenAmount: number, supply: number, price: number): number => {
    // Inverse of buy calculation
    const k = 1000000
    const currentX = supply / k
    const newSupply = supply - tokenAmount
    const newX = Math.pow(newSupply / k, 2)
    const solAmount = (currentX - newX) * price
    return solAmount
  }

  const calculatePriceImpact = (amount: number, volume24h: number): number => {
    // Price impact based on trade size relative to 24h volume
    const impact = (amount / (volume24h || 1)) * 100
    return Math.min(impact, 50) // Cap at 50%
  }

  const handleTrade = async () => {
    if (!connected || !publicKey || !signTransaction || !tradePreview) {
      toast.error('Please connect your wallet')
      return
    }

    const amount = parseFloat(inputAmount)
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (activeTab === 'buy' && amount > solBalance) {
      toast.error('Insufficient SOL balance')
      return
    }

    if (activeTab === 'sell' && amount > tokenBalance) {
      toast.error('Insufficient token balance')
      return
    }

    if (tradePreview.priceImpact > 15) {
      const confirmed = window.confirm(
        `High price impact of ${tradePreview.priceImpact.toFixed(2)}%. Continue?`
      )
      if (!confirmed) return
    }

    setIsLoading(true)

    try {
      const transaction = new Transaction()
      const tokenMint = new PublicKey(token.address)
      
      // Get or create associated token account
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMint,
        publicKey
      )

      try {
        await connection.getTokenAccountBalance(associatedTokenAddress)
      } catch (error) {
        // Create associated token account if it doesn't exist
        transaction.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            associatedTokenAddress,
            publicKey,
            tokenMint
          )
        )
      }

      // Add trade instruction (simplified - in production, this would interact with your program)
      if (activeTab === 'buy') {
        // Add buy instruction
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(token.creator), // Simplified
            lamports: amount * LAMPORTS_PER_SOL
          })
        )
      } else {
        // Add sell instruction
        // This would be a token transfer in a real implementation
      }

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize())
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed')

      toast.success(`${activeTab === 'buy' ? 'Buy' : 'Sell'} order completed!`)
      
      // Reset form
      setInputAmount('')
      setTradePreview(null)
      
      // Refresh balances
      await fetchBalances()
      
      // Notify parent component
      onTradeComplete?.()

    } catch (error) {
      console.error('Trade error:', error)
      toast.error('Transaction failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
    return num.toFixed(decimals)
  }

  const maxAmount = activeTab === 'buy' ? solBalance * 0.95 : tokenBalance

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Trade {token.symbol}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        {showSettings && (
          <div className="space-y-4 pt-4 border-t">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Slippage Tolerance
              </label>
              <div className="flex gap-2 mb-2">
                {slippageOptions.map((option) => (
                  <Button
                    key={option}
                    variant={slippage === option ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSlippage(option)
                      setCustomSlippage('')
                    }}
                    className="flex-1"
                  >
                    {option}%
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Custom %"
                value={customSlippage}
                onChange={(e) => {
                  setCustomSlippage(e.target.value)
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value > 0 && value <= 50) {
                    setSlippage(value)
                  }
                }}
                className="text-sm"
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'buy' | 'sell')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>You pay (SOL)</span>
                <span>Balance: {solBalance.toFixed(4)} SOL</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="pr-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInputAmount(maxAmount.toString())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs"
                >
                  MAX
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>You receive ({token.symbol})</span>
                <span>Balance: {formatNumber(tokenBalance)} {token.symbol}</span>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-lg font-medium">
                  {tradePreview ? formatNumber(tradePreview.outputAmount) : '0.0'}
                </span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>You sell ({token.symbol})</span>
                <span>Balance: {formatNumber(tokenBalance)} {token.symbol}</span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="pr-16"