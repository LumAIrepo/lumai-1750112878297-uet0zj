```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { PublicKey } from '@solana/web3.js'
import { Metadata } from 'next'
import ProfileHeader from '@/components/profile/profile-header'
import CreatedTokens from '@/components/profile/created-tokens'
import TradingHistory from '@/components/profile/trading-history'
import ProfileStats from '@/components/profile/profile-stats'
import { getUserProfile, getUserTokens, getUserTrades } from '@/lib/api/user'
import { formatWalletAddress } from '@/lib/utils'

interface ProfilePageProps {
  params: Promise<{
    wallet: string
  }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { wallet } = await params
  
  try {
    new PublicKey(wallet)
    const shortWallet = formatWalletAddress(wallet)
    
    return {
      title: `${shortWallet} - Profile | PumpClone`,
      description: `View ${shortWallet}'s token launches and trading activity on PumpClone`,
      openGraph: {
        title: `${shortWallet} - Profile`,
        description: `View ${shortWallet}'s token launches and trading activity`,
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title: `${shortWallet} - Profile`,
        description: `View ${shortWallet}'s token launches and trading activity`,
      },
    }
  } catch {
    return {
      title: 'Invalid Wallet - PumpClone',
      description: 'The provided wallet address is invalid',
    }
  }
}

async function ProfileContent({ wallet }: { wallet: string }) {
  try {
    // Validate wallet address
    new PublicKey(wallet)
  } catch {
    notFound()
  }

  try {
    const [profile, tokens, trades] = await Promise.all([
      getUserProfile(wallet),
      getUserTokens(wallet),
      getUserTrades(wallet, 50)
    ])

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Profile Header */}
            <ProfileHeader 
              wallet={wallet}
              profile={profile}
            />

            {/* Profile Stats */}
            <ProfileStats 
              tokensCreated={tokens.length}
              totalVolume={profile.totalVolume}
              totalTrades={trades.length}
              winRate={profile.winRate}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Created Tokens */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  Created Tokens ({tokens.length})
                </h2>
                <CreatedTokens tokens={tokens} />
              </div>

              {/* Trading History */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  Trading History ({trades.length})
                </h2>
                <TradingHistory trades={trades} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading profile:', error)
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Profile Not Found</h1>
          <p className="text-gray-400 max-w-md">
            We couldn't load this profile. The wallet address might be invalid or there might be a network issue.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Profile Header Skeleton */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gray-700 rounded-full animate-pulse"></div>
              <div className="space-y-3">
                <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <div className="h-4 w-20 bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-16 bg-gray-700 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="space-y-6">
                <div className="h-8 w-48 bg-gray-700 rounded animate-pulse"></div>
                <div className="space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-700 rounded-full animate-pulse"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-32 bg-gray-700 rounded animate-pulse"></div>
                          <div className="h-3 w-24 bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div className="h-6 w-16 bg-gray-700 rounded animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { wallet } = await params

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent wallet={wallet} />
    </Suspense>
  )
}
```