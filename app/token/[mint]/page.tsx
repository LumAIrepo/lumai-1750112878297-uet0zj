```tsx
import { Suspense } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import TokenTradingInterface from '@/components/token/TokenTradingInterface'
import TokenChart from '@/components/token/TokenChart'
import TokenInfo from '@/components/token/TokenInfo'
import TransactionHistory from '@/components/token/TransactionHistory'
import TokenHolders from '@/components/token/TokenHolders'
import TokenComments from '@/components/token/TokenComments'
import { getTokenData, getTokenMetrics, getTokenTransactions } from '@/lib/api/tokens'
import { formatNumber } from '@/lib/utils'

interface TokenPageProps {
  params: Promise<{ mint: string }>
}

async function validateMintAddress(mint: string): Promise<boolean> {
  try {
    new PublicKey(mint)
    return true
  } catch {
    return false
  }
}

async function getTokenPageData(mint: string) {
  try {
    const [tokenData, metrics, transactions] = await Promise.all([
      getTokenData(mint),
      getTokenMetrics(mint),
      getTokenTransactions(mint, 50)
    ])

    if (!tokenData) {
      return null
    }

    return {
      token: tokenData,
      metrics,
      transactions
    }
  } catch (error) {
    console.error('Error fetching token data:', error)
    return null
  }
}

export async function generateMetadata({ params }: TokenPageProps): Promise<Metadata> {
  const { mint } = await params
  
  if (!await validateMintAddress(mint)) {
    return {
      title: 'Invalid Token | PumpClone',
      description: 'Token not found'
    }
  }

  const data = await getTokenPageData(mint)
  
  if (!data) {
    return {
      title: 'Token Not Found | PumpClone',
      description: 'The requested token could not be found'
    }
  }

  const { token, metrics } = data
  const marketCap = formatNumber(metrics.marketCap)
  const price = metrics.price.toFixed(8)

  return {
    title: `${token.name} (${token.symbol}) | PumpClone`,
    description: `Trade ${token.name} on PumpClone. Current price: $${price}, Market cap: $${marketCap}. ${token.description}`,
    openGraph: {
      title: `${token.name} (${token.symbol})`,
      description: `Price: $${price} | Market Cap: $${marketCap}`,
      images: token.image ? [{ url: token.image }] : [],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: `${token.name} (${token.symbol})`,
      description: `Price: $${price} | Market Cap: $${marketCap}`,
      images: token.image ? [token.image] : []
    }
  }
}

function TokenPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            
            <div className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="space-y-4">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function TokenPageContent({ mint }: { mint: string }) {
  const data = await getTokenPageData(mint)
  
  if (!data) {
    notFound()
  }

  const { token, metrics, transactions } = data

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <TokenInfo token={token} metrics={metrics} />
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Price Chart</h2>
              </div>
              <div className="p-6">
                <TokenChart mint={mint} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
              </div>
              <TransactionHistory transactions={transactions} />
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
              </div>
              <TokenComments mint={mint} />
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Trade</h2>
              </div>
              <div className="p-6">
                <TokenTradingInterface token={token} metrics={metrics} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Top Holders</h2>
              </div>
              <TokenHolders mint={mint} />
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Market Cap</span>
                  <span className="font-medium">${formatNumber(metrics.marketCap)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">24h Volume</span>
                  <span className="font-medium">${formatNumber(metrics.volume24h)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Supply</span>
                  <span className="font-medium">{formatNumber(token.totalSupply)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Holders</span>
                  <span className="font-medium">{formatNumber(metrics.holders)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Liquidity</span>
                  <span className="font-medium">${formatNumber(metrics.liquidity)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Progress</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(metrics.progress, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{metrics.progress.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {token.website || token.twitter || token.telegram ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Links</h3>
                <div className="space-y-3">
                  {token.website && (
                    <a
                      href={token.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.559-.499-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.559.499.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.497-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
                      </svg>
                      <span>Website</span>
                    </a>
                  )}
                  {token.twitter && (
                    <a
                      href={token.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                      <span>Twitter</span>
                    </a>
                  )}
                  {token.telegram && (
                    <a
                      href={token.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-3 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6