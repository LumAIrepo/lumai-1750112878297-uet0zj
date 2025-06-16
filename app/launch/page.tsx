'use client'

import { useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, createInitializeMintInstruction, createAssociatedTokenAccountInstruction, createMintToInstruction, getAssociatedTokenAddress, MINT_SIZE, getMinimumBalanceForRentExemptMint } from '@solana/spl-token'
import { Keypair } from '@solana/web3.js'
import { toast } from 'sonner'
import { Upload, Loader2, Coins, TrendingUp, Users, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '11111111111111111111111111111111')

interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: File | null
  website: string
  twitter: string
  telegram: string
}

interface BondingCurveConfig {
  initialPrice: number
  targetPrice: number
  maxSupply: number
  liquidityThreshold: number
}

export default function LaunchPage() {
  const { publicKey, signTransaction } = useWallet()
  const [isCreating, setIsCreating] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [metadata, setMetadata] = useState<TokenMetadata>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    website: '',
    twitter: '',
    telegram: ''
  })

  const [bondingCurve, setBondingCurve] = useState<BondingCurveConfig>({
    initialPrice: 0.0001,
    targetPrice: 0.1,
    maxSupply: 1000000000,
    liquidityThreshold: 85
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!metadata.name.trim()) {
      newErrors.name = 'Token name is required'
    } else if (metadata.name.length > 32) {
      newErrors.name = 'Token name must be 32 characters or less'
    }

    if (!metadata.symbol.trim()) {
      newErrors.symbol = 'Token symbol is required'
    } else if (metadata.symbol.length > 10) {
      newErrors.symbol = 'Token symbol must be 10 characters or less'
    } else if (!/^[A-Z0-9]+$/.test(metadata.symbol)) {
      newErrors.symbol = 'Token symbol must contain only uppercase letters and numbers'
    }

    if (!metadata.description.trim()) {
      newErrors.description = 'Token description is required'
    } else if (metadata.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }

    if (!metadata.image) {
      newErrors.image = 'Token image is required'
    }

    if (metadata.website && !isValidUrl(metadata.website)) {
      newErrors.website = 'Please enter a valid website URL'
    }

    if (metadata.twitter && !isValidTwitter(metadata.twitter)) {
      newErrors.twitter = 'Please enter a valid Twitter handle or URL'
    }

    if (metadata.telegram && !isValidTelegram(metadata.telegram)) {
      newErrors.telegram = 'Please enter a valid Telegram handle or URL'
    }

    if (bondingCurve.initialPrice <= 0) {
      newErrors.initialPrice = 'Initial price must be greater than 0'
    }

    if (bondingCurve.targetPrice <= bondingCurve.initialPrice) {
      newErrors.targetPrice = 'Target price must be greater than initial price'
    }

    if (bondingCurve.maxSupply <= 0) {
      newErrors.maxSupply = 'Max supply must be greater than 0'
    }

    if (bondingCurve.liquidityThreshold < 50 || bondingCurve.liquidityThreshold > 100) {
      newErrors.liquidityThreshold = 'Liquidity threshold must be between 50% and 100%'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const isValidTwitter = (twitter: string): boolean => {
    const twitterRegex = /^(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/|x\.com\/)?@?([A-Za-z0-9_]{1,15})$/
    return twitterRegex.test(twitter)
  }

  const isValidTelegram = (telegram: string): boolean => {
    const telegramRegex = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me\/|telegram\.me\/)?@?([A-Za-z0-9_]{5,32})$/
    return telegramRegex.test(telegram)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setMetadata(prev => ({ ...prev, image: file }))

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    if (errors.image) {
      setErrors(prev => ({ ...prev, image: '' }))
    }
  }

  const uploadToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      return data.ipfsHash
    } catch (error) {
      console.error('IPFS upload error:', error)
      throw new Error('Failed to upload image to IPFS')
    }
  }

  const createTokenMetadata = async (imageHash: string) => {
    const tokenMetadata = {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: `https://ipfs.io/ipfs/${imageHash}`,
      external_url: metadata.website || '',
      attributes: [
        {
          trait_type: 'Initial Price',
          value: bondingCurve.initialPrice
        },
        {
          trait_type: 'Target Price',
          value: bondingCurve.targetPrice
        },
        {
          trait_type: 'Max Supply',
          value: bondingCurve.maxSupply
        }
      ],
      properties: {
        files: [
          {
            uri: `https://ipfs.io/ipfs/${imageHash}`,
            type: metadata.image?.type || 'image/png'
          }
        ],
        category: 'image',
        creators: [
          {
            address: publicKey?.toString() || '',
            share: 100
          }
        ]
      },
      collection: {
        name: 'PumpClone Tokens',
        family: 'PumpClone'
      },
      social: {
        twitter: metadata.twitter,
        telegram: metadata.telegram,
        website: metadata.website
      }
    }

    const metadataBlob = new Blob([JSON.stringify(tokenMetadata)], {
      type: 'application/json'
    })

    const metadataFile = new File([metadataBlob], 'metadata.json', {
      type: 'application/json'
    })

    return await uploadToIPFS(metadataFile)
  }

  const createToken = async () => {
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the form errors')
      return
    }

    setIsCreating(true)
    setUploadProgress(0)

    try {
      // Upload image to IPFS
      setUploadProgress(20)
      const imageHash = await uploadToIPFS(metadata.image!)
      
      // Create and upload metadata
      setUploadProgress(40)
      const metadataHash = await createTokenMetadata(imageHash)

      // Create mint account
      setUploadProgress(60)
      const connection = new Connection(RPC_ENDPOINT, 'confirmed')
      const mintKeypair = Keypair.generate()
      
      const lamports = await getMinimumBalanceForRentExemptMint(connection)
      
      const transaction = new Transaction()

      // Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID
        })
      )

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          9, // decimals
          publicKey, // mint authority
          publicKey // freeze authority
        )
      )

      // Create associated token account for creator
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        publicKey
      )

      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          associatedTokenAccount,
          publicKey,
          mintKeypair.publicKey
        )
      )

      // Mint initial supply to creator (for bonding curve)
      const initialSupply = Math.floor(bondingCurve.maxSupply * 0.2) // 20% to creator
      transaction.add(
        createMintToInstruction(
          mintKeypair.publicKey,
          associatedTokenAccount,
          publicKey,
          initialSupply * Math.pow(10, 9) // Convert to smallest unit
        )
      )

      // Set recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      // Partially sign with mint keypair
      transaction.partialSign(mintKeypair)

      // Sign with wallet
      const signedTransaction = await signTransaction(transaction)

      setUploadProgress(80)

      // Send transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize()
      )

      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed')

      setUploadProgress(90)

      // Create bonding curve account
      const bondingCurveData = {
        mint: mintKeypair.publicKey.toString(),
        creator: publicKey.toString(),
        name: metadata.name,
        symbol: metadata.symbol,
        uri: `https://ipfs.io/ipfs/${metadataHash}`,
        initialPrice: bondingCurve.initialPrice,
        targetPrice: bondingCurve.targetPrice,
        maxSupply: bondingCurve.maxSupply,
        liquidityThreshold: bondingCurve.liquidityThreshold,
        currentSupply: initialSupply,
        reserveBalance: 0,
        createdAt: Date.now()
      }

      // Save to database
      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bondingCurveData)
      })

      if (!response.ok) {
        throw new Error('Failed to save token data')
      }

      setUploadProgress(100)

      toast.success('Token created successfully!')
      
      // Redirect to token page
      window.location.href = `/token/${mintKeypair.publicKey.toString()}`

    } catch (error) {
      console.error('Token creation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create token')
    } finally {
      setIsCreating(false)
      setUploadProgress(0)
    }
  }

  const estimatedCost = 0.01 // SOL

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Launch Your Token</h1>
          <p className="text-gray-300">Create and launch your meme token with automated bonding curves</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token Information */}
            <Card className="bg-black/20 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Token Information
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Basic information about your token
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name" className="text-white">Token Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Doge Coin"
                      value={metadata.name}
                      onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                    {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}