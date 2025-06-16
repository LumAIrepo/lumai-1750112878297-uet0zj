'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, Users, DollarSign, ExternalLink } from 'lucide-react'

interface TokenStats {
  marketCap: number
  volume24h: number
  holders: number
  priceChange24h: number
  liquidity: number
  transactions24h: number
}

interface TokenCardProps {
  address: string
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: Date
  currentPrice: number
  stats: TokenStats
  isGraduated: boolean
  progress: number
  className?: string
  onClick?: () => void
}

export default function TokenCard({
  address,
  name,
  symbol,
  description,
  image,
  creator,
  createdAt,
  currentPrice,
  stats,
  isGraduated,
  progress,
  className = '',
  onClick
}: TokenCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(false)
  }, [])

  const formatPrice = (price: number): string => {
    if (price < 0.000001) {
      return price.toExponential(2)
    }
    if (price < 0.01) {
      return price.toFixed(6)
    }
    if (price < 1) {
      return price.toFixed(4)
    }
    return price.toFixed(2)
  }

  const formatMarketCap = (marketCap: number): string => {
    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(1)}M`
    }
    if (marketCap >= 1000) {
      return `$${(marketCap / 1000).toFixed(1)}K`
    }
    return `$${marketCap.toFixed(0)}`
  }

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(1)}M`
    }
    if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(1)}K`
    }
    return `$${volume.toFixed(0)}`
  }

  const formatHolders = (holders: number): string => {
    if (holders >= 1000) {
      return `${(holders / 1000).toFixed(1)}K`
    }
    return holders.toString()
  }

  const truncateAddress = (addr: string): string => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength)}...`
  }

  const getPriceChangeColor = (change: number): string => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  const getPriceChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-3 h-3" />
    if (change < 0) return <TrendingDown className="w-3 h-3" />
    return null
  }

  const getProgressColor = (): string => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-yellow-500'
    if (progress >= 50) return 'bg-blue-500'
    return 'bg-purple-500'
  }

  if (isLoading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 hover:shadow-lg cursor-pointer group ${className}`}
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            <div className="relative">
              {!imageError ? (
                <Image
                  src={image}
                  alt={`${name} logo`}
                  width={48}
                  height={48}
                  className="rounded-full border-2 border-gray-200 dark:border-gray-600"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {symbol.charAt(0)}
                </div>
              )}
              {isGraduated && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {name}
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  ${symbol}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  by {truncateAddress(creator)}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/token/${address}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </Link>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
          {truncateText(description, 120)}
        </p>

        {/* Price and Change */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="font-mono text-lg font-semibold text-gray-900 dark:text-white">
              {formatPrice(currentPrice)}
            </span>
          </div>
          <div className={`flex items-center space-x-1 ${getPriceChangeColor(stats.priceChange24h)}`}>
            {getPriceChangeIcon(stats.priceChange24h)}
            <span className="text-sm font-medium">
              {stats.priceChange24h > 0 ? '+' : ''}{stats.priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Market Cap</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatMarketCap(stats.marketCap)}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">24h Volume</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatVolume(stats.volume24h)}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
              <Users className="w-3 h-3" />
              <span>Holders</span>
            </div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {formatHolders(stats.holders)}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">24h Txns</div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {stats.transactions24h.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {!isGraduated && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Bonding Curve Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isGraduated ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Graduated
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                Bonding Curve
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Liquidity: {formatVolume(stats.liquidity)}
          </div>
        </div>
      </div>
    </div>
  )
}