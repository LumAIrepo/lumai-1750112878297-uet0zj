'use client'

import { useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConnection } from '@solana/wallet-adapter-react'
import { toast } from 'sonner'
import { Upload, X, Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'

interface TokenFormData {
  name: string
  symbol: string
  description: string
  image: File | null
  website: string
  twitter: string
  telegram: string
  initialBuy: number
}

interface ValidationErrors {
  name?: string
  symbol?: string
  description?: string
  image?: string
  website?: string
  twitter?: string
  telegram?: string
  initialBuy?: string
}

export default function TokenCreationForm() {
  const { publicKey, signTransaction } = useWallet()
  const { connection } = useConnection()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    image: null,
    website: '',
    twitter: '',
    telegram: '',
    initialBuy: 0
  })

  const [errors, setErrors] = useState<ValidationErrors>({})

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Token name is required'
    } else if (formData.name.length > 32) {
      newErrors.name = 'Token name must be 32 characters or less'
    }

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Token symbol is required'
    } else if (formData.symbol.length > 10) {
      newErrors.symbol = 'Token symbol must be 10 characters or less'
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol)) {
      newErrors.symbol = 'Token symbol must contain only uppercase letters and numbers'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less'
    }

    if (!formData.image) {
      newErrors.image = 'Token image is required'
    }

    if (formData.website && !isValidUrl(formData.website)) {
      newErrors.website = 'Please enter a valid website URL'
    }

    if (formData.twitter && !isValidTwitter(formData.twitter)) {
      newErrors.twitter = 'Please enter a valid Twitter handle or URL'
    }

    if (formData.telegram && !isValidTelegram(formData.telegram)) {
      newErrors.telegram = 'Please enter a valid Telegram handle or URL'
    }

    if (formData.initialBuy < 0) {
      newErrors.initialBuy = 'Initial buy amount cannot be negative'
    } else if (formData.initialBuy > 10) {
      newErrors.initialBuy = 'Initial buy amount cannot exceed 10 SOL'
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

  const handleInputChange = (field: keyof TokenFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Please select a valid image file' }))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Image size must be less than 5MB' }))
      return
    }

    setFormData(prev => ({ ...prev, image: file }))
    setErrors(prev => ({ ...prev, image: undefined }))

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }))
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadImageToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Failed to upload image')
    }

    const { ipfsHash } = await response.json()
    return `https://ipfs.io/ipfs/${ipfsHash}`
  }

  const createTokenMetadata = async (): Promise<string> => {
    if (!formData.image) throw new Error('No image selected')

    const imageUrl = await uploadImageToIPFS(formData.image)
    
    const metadata = {
      name: formData.name,
      symbol: formData.symbol,
      description: formData.description,
      image: imageUrl,
      external_url: formData.website || '',
      attributes: [],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: formData.image.type
          }
        ],
        category: 'image'
      },
      extensions: {
        website: formData.website || '',
        twitter: formData.twitter || '',
        telegram: formData.telegram || ''
      }
    }

    const response = await fetch('/api/upload-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    })

    if (!response.ok) {
      throw new Error('Failed to upload metadata')
    }

    const { ipfsHash } = await response.json()
    return `https://ipfs.io/ipfs/${ipfsHash}`
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the form errors')
      return
    }

    setIsSubmitting(true)

    try {
      const metadataUri = await createTokenMetadata()

      const response = await fetch('/api/create-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          symbol: formData.symbol,
          metadataUri,
          creator: publicKey.toString(),
          initialBuy: formData.initialBuy
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create token')
      }

      const { transaction, mint } = await response.json()

      const tx = Transaction.from(Buffer.from(transaction, 'base64'))
      
      if (!signTransaction) {
        throw new Error('Wallet does not support transaction signing')
      }

      const signedTx = await signTransaction(tx)
      const signature = await connection.sendRawTransaction(signedTx.serialize())
      
      await connection.confirmTransaction(signature, 'confirmed')

      toast.success('Token created successfully!')
      
      // Reset form
      setFormData({
        name: '',
        symbol: '',
        description: '',
        image: null,
        website: '',
        twitter: '',
        telegram: '',
        initialBuy: 0
      })
      setImagePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      // Redirect to token page
      window.location.href = `/token/${mint}`

    } catch (error) {
      console.error('Error creating token:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create token')
    } finally {
      setIsSubmitting(false)
    }
  }

  const creationCost = 0.02 + formData.initialBuy

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
          <h2 className="text-2xl font-bold text-white">Create Your Token</h2>
          <p className="text-purple-100 mt-2">Launch your meme token with automated bonding curves</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., Doge Coin"
                maxLength={32}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors ${
                  errors.symbol ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., DOGE"
                maxLength={10}
              />
              {errors.symbol && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.symbol}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe your token..."
              rows={4}
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-1">
              {errors.description ? (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.description}
                </p>
              ) : (
                <div />
              )}
              <span className="text-sm text-gray-500">
                {formData.description.length}/500
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Image *
            </label>
            <div className="flex items-start space-x-4">
              <div
                className={`flex-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  errors.image ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  Click to upload image
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
              
              {imagePreview && (
                <div className="relative">
                  <Image
                    src={imagePreview}
                    alt="Token preview"
                    width={80}
                    height={80}
                    className="rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            {errors.image && (
              <p className